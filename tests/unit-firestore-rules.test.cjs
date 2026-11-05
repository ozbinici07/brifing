const {test,before,after,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,updateDoc,writeBatch,collection,getCountFromServer,serverTimestamp,query,where,getDocs}=require('firebase/firestore');
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Rules tests require the local emulator. Production is never used.');
let env;
const payload={cells:{'1!B4':10},source:'Kaynak',asOf:'2026-10-31',notes:'',savedTables:['1']};
const report={unitId:'7',periodId:'P',version:1,status:'draft',draft:payload,pending:null,pendingVersion:null,approved:null,approvedVersion:null};
const ref=(db,path)=>doc(db,path);
const user=id=>env.authenticatedContext(id,{email:id+'@example.test'}).firestore();
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-brifing-units',firestore:{rules:fs.readFileSync(process.env.UNIT_RULES_FILE||__dirname+'/../config/firestore.rules','utf8')}})});
after(async()=>{await env?.cleanup()});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{const db=c.firestore(),batch=writeBatch(db);for(const [path,data]of Object.entries({
 'unitAccounts/a':{uid:'a',role:'unit',active:true,editUnits:['7'],readUnits:[],screens:['units'],mustChange:true},
 'unitAccounts/b':{uid:'b',role:'unit',active:true,editUnits:['22'],readUnits:['7'],screens:['units'],mustChange:false},
 'unitAccounts/manager':{uid:'manager',role:'admin',active:true,editUnits:[],readUnits:[],screens:['*'],mustChange:false},
 'unitAccounts/revoked':{uid:'revoked',role:'unit',active:false,editUnits:['7'],readUnits:[],screens:['units']},
 'unitPeriods/P':{name:'Test',ready:true},
 'unitPeriods/P/schemas/7':{unitId:'7',keys:['1!B4'],tableIds:['1']},
 'unitPeriods/P/schemas/22':{unitId:'22',keys:['1!B6'],tableIds:['1']},
 'unitPeriods/P/reports/7':report,
 'unitPeriods/P/reports/22':{...report,unitId:'22',draft:{...payload,cells:{'1!B6':20}}},
 'unitPeriods/P/published/7':{unitId:'7',version:1,payload},
 'unitPeriods/P/importBase/7':{cells:{'1!B4':5}},
 'unitPeriods/P/tables/1':{id:'1',allowedUnits:['7','22']},
 'unitLoginDirectory/insankaynaklari':{username:'insankaynaklari',active:true},
 'unitMedia/image':{allowedUnits:['7']},
 'unitMedia/image/parts/0':{payload:'test'}
})){batch.set(ref(db,path),data)}await batch.commit()})});
test('unit and read-only grants do not expose other unit drafts',async()=>{
 const a=user('a'),b=user('b');
 await assertSucceeds(getDoc(ref(a,'unitPeriods/P/reports/7')));
 await assertFails(getDoc(ref(a,'unitPeriods/P/reports/22')));
 await assertSucceeds(getDoc(ref(b,'unitPeriods/P/published/7')));
 await assertFails(getDoc(ref(b,'unitPeriods/P/reports/7')));
 await assertFails(getDoc(ref(b,'unitPeriods/P/importBase/7')));
});
test('allowed field can be edited, another unit field and labels cannot',async()=>{
 const a=user('a');await assertSucceeds(updateDoc(ref(a,'unitPeriods/P/reports/7'),{version:2,draft:{...payload,cells:{'1!B4':0}}}));
 await assertFails(updateDoc(ref(a,'unitPeriods/P/reports/7'),{version:3,draft:{...payload,cells:{'1!B6':40}}}));
 await assertFails(updateDoc(ref(a,'unitPeriods/P/reports/7'),{version:3,draft:{...payload,cells:{'1!A4':'başlık'}}}));
 await assertFails(updateDoc(ref(a,'unitPeriods/P/reports/22'),{version:2}));
});
test('self-escalation, grants changes and directory registration are denied',async()=>{
 const a=user('a');await assertFails(updateDoc(ref(a,'unitAccounts/a'),{role:'admin'}));
 await assertFails(updateDoc(ref(a,'unitAccounts/a'),{editUnits:['7','22']}));
 await assertFails(setDoc(ref(a,'unitLoginDirectory/other'),{username:'other'}));
 await assertSucceeds(updateDoc(ref(a,'unitAccounts/a'),{mustChange:false}));
});
test('unit cannot approve itself or publish data',async()=>{
 const a=user('a');await assertFails(updateDoc(ref(a,'unitPeriods/P/reports/7'),{version:2,status:'approved',approved:payload,approvedVersion:2}));
 await assertFails(setDoc(ref(a,'unitPeriods/P/published/7'),{unitId:'7',version:2,payload}));
});
test('package submission is frozen while later drafts remain editable',async()=>{
 const a=user('a'),p=ref(a,'unitPeriods/P/reports/7');
 await assertSucceeds(updateDoc(p,{version:2,status:'pending',pending:payload,pendingVersion:2,submittedBy:'a',submittedAt:'2026-10-31T10:00:00Z',reviewNote:''}));
 const changed={...payload,cells:{'1!B4':99}};
 await assertSucceeds(updateDoc(p,{version:3,draft:changed}));
 await assertFails(updateDoc(p,{version:4,pending:changed}));
 const snap=(await getDoc(p)).data();assert.equal(snap.pending.cells['1!B4'],10);
});
test('additional administrator can manage users and publish only the approved snapshot',async()=>{
 const db=user('manager');await assertSucceeds(setDoc(ref(db,'unitAccounts/new'),{uid:'new',role:'unit',active:true,editUnits:['7'],readUnits:[],screens:['units']}));
 await assertSucceeds(updateDoc(ref(db,'unitPeriods/P/reports/7'),{version:2,approved:payload,approvedVersion:2,status:'approved'}));
 await assertFails(setDoc(ref(db,'unitPeriods/P/published/7'),{unitId:'7',version:2,payload:{...payload,cells:{'1!B4':999}}}));
 await assertSucceeds(setDoc(ref(db,'unitPeriods/P/published/7'),{unitId:'7',version:2,payload}));
});
test('anonymous access is limited to the public login directory',async()=>{
 const db=env.unauthenticatedContext().firestore();await assertSucceeds(getDoc(ref(db,'unitLoginDirectory/insankaynaklari')));
 await assertFails(getDoc(ref(db,'unitAccounts/a')));await assertFails(getDoc(ref(db,'unitPeriods/P/reports/7')));
});
test('inactive accounts lose read, write and image access',async()=>{
 const db=user('revoked');await assertFails(getDoc(ref(db,'unitPeriods/P/reports/7')));await assertFails(getDoc(ref(db,'unitMedia/image/parts/0')));
 await assertFails(updateDoc(ref(db,'unitPeriods/P/reports/7'),{version:2,draft:payload}));
});
test('unit audit history is append-only and scoped to its package version',async()=>{
 const db=user('a'),h={unitId:'7',actor:'a',action:'save',version:1,payload};
 await assertSucceeds(setDoc(ref(db,'unitPeriods/P/history/one'),h));
 await assertFails(updateDoc(ref(db,'unitPeriods/P/history/one'),{version:2}));
 await assertFails(setDoc(ref(db,'unitPeriods/P/history/other'),{...h,unitId:'22'}));
});
test('locked periods reject unit and administrator report edits',async()=>{
 await env.withSecurityRulesDisabled(c=>updateDoc(ref(c.firestore(),'unitPeriods/P'),{locked:true}));
 await assertFails(updateDoc(ref(user('a'),'unitPeriods/P/reports/7'),{version:2,draft:payload}));
 await assertFails(updateDoc(ref(user('manager'),'unitPeriods/P/reports/7'),{version:2,draft:payload}));
 await assertSucceeds(getDoc(ref(user('a'),'unitPeriods/P/reports/7')));
});
test('initial imports are staged by administrators while units cannot write',async()=>{
 await env.withSecurityRulesDisabled(c=>updateDoc(ref(c.firestore(),'unitPeriods/P'),{ready:false}));
 await assertFails(updateDoc(ref(user('a'),'unitPeriods/P/reports/7'),{version:2,draft:payload}));
 await assertSucceeds(updateDoc(ref(user('manager'),'unitPeriods/P/reports/7'),{version:2,draft:payload}));
 await assertFails(setDoc(ref(user('a'),'unitPeriods/P/migration/audit'),{source:'private'}));
 await assertSucceeds(setDoc(ref(user('manager'),'unitPeriods/P/migration/audit'),{source:'private'}));
});
test('only administrators can replace accounts and append password reset audit events',async()=>{
 const unit=user('a'),admin=user('manager');
 await assertFails(updateDoc(ref(unit,'unitAccounts/a'),{active:false,replacedBy:'new'}));
 await assertFails(setDoc(ref(unit,'unitAccounts/new'),{uid:'new',role:'unit',active:true,editUnits:['7']}));
 await assertFails(setDoc(ref(unit,'unitAccountEvents/reset'),{action:'temporary-password',actor:'a'}));
 await assertSucceeds(setDoc(ref(admin,'unitAccountEvents/reset'),{action:'temporary-password',actor:'manager'}));
 await assertFails(updateDoc(ref(admin,'unitAccountEvents/reset'),{actor:'changed'}));
 await assertSucceeds(updateDoc(ref(admin,'unitAccounts/a'),{active:false,replacedBy:'new'}));
 await assertFails(getDoc(ref(unit,'unitPeriods/P/reports/7')));
});
test('submission requires every schema field and saved table; dash and zero are valid',async()=>{
 const db=user('a'),path=ref(db,'unitPeriods/P/reports/7'),submit=draft=>({version:2,status:'pending',pending:draft,draft,pendingVersion:2,submittedBy:'a',reviewNote:''});
 await assertFails(updateDoc(path,submit({...payload,savedTables:[]})));
 await assertFails(updateDoc(path,submit({...payload,cells:{}})));
 await assertFails(updateDoc(path,submit({...payload,cells:{'1!B4':null}})));
 await assertFails(updateDoc(path,submit({...payload,cells:{'1!B4':''}})));
 await assertSucceeds(updateDoc(path,submit({...payload,cells:{'1!B4':'-'}})));
});
test('source workbook archive stays private to administrators',async()=>{
 await assertSucceeds(setDoc(ref(user('manager'),'unitPeriods/P/excelFiles/latest'),{name:'source.xlsx'}));
 await assertSucceeds(setDoc(ref(user('manager'),'unitPeriods/P/excelFiles/latest/parts/0'),{payload:'private'}));
 await assertFails(getDoc(ref(user('a'),'unitPeriods/P/excelFiles/latest')));await assertFails(getDoc(ref(user('a'),'unitPeriods/P/excelFiles/latest/parts/0')));
});

test('unit contact editing is limited to assigned units and administrator, read grants stay read-only',async()=>{const contact={unitId:'7',version:1,manager:{name:'Örnek kişi',phone:'123'},chief:{name:'',phone:''},personnel:{name:'',phone:''},updatedBy:'a',updatedAt:'2026-11-02T00:00:00Z'};await assertSucceeds(setDoc(ref(user('a'),'unitContacts/7'),contact));await assertSucceeds(getDoc(ref(user('b'),'unitContacts/7')));await assertFails(updateDoc(ref(user('b'),'unitContacts/7'),{version:2,updatedBy:'b'}));await assertFails(getDoc(ref(user('a'),'unitContacts/22')));await assertFails(getDoc(ref(user('revoked'),'unitContacts/7')));await assertSucceeds(updateDoc(ref(user('manager'),'unitContacts/7'),{version:2,updatedBy:'manager',manager:{name:'Yönetici güncellemesi',phone:'456'}}));});
test('unit contacts reject stale versions, identity spoofing, oversized values and extra fields',async()=>{const db=user('a'),contact={unitId:'7',version:1,manager:{name:'Kişi',phone:'123'},chief:{name:'',phone:''},personnel:{name:'',phone:''},updatedBy:'a',updatedAt:'2026-11-02T00:00:00Z'};await assertFails(setDoc(ref(db,'unitContacts/7'),{...contact,updatedBy:'b'}));await assertFails(setDoc(ref(db,'unitContacts/7'),{...contact,manager:{name:'a'.repeat(121),phone:''}}));await assertFails(setDoc(ref(db,'unitContacts/7'),{...contact,role:'admin'}));await assertSucceeds(setDoc(ref(db,'unitContacts/7'),contact));await assertFails(updateDoc(ref(db,'unitContacts/7'),{manager:{name:'Değişti',phone:'123'}}));await assertFails(updateDoc(ref(db,'unitContacts/7'),{version:2,unitId:'22'}));await assertFails(updateDoc(ref(db,'unitContacts/7'),{version:2,manager:{name:'Kişi',phone:'123',role:'admin'}}));});


test('administrator can count schemas and tables without exposing collection counts to unit accounts',async()=>{const manager=user('manager');assert.equal((await assertSucceeds(getCountFromServer(collection(manager,'unitPeriods/P/schemas')))).data().count,2);assert.equal((await assertSucceeds(getCountFromServer(collection(manager,'unitPeriods/P/tables')))).data().count,1);await assertFails(getCountFromServer(collection(user('a'),'unitPeriods/P/schemas')));await assertFails(getCountFromServer(collection(user('a'),'unitPeriods/P/tables')));});


test('Firebase usage snapshot is readable only by administrators',async()=>{await env.withSecurityRulesDisabled(c=>setDoc(ref(c.firestore(),'personnelSettings/firestoreUsage'),{format:'brifing-firestore-usage-v1',reads:{used:100,limit:50000}}));await assertSucceeds(getDoc(ref(user('manager'),'personnelSettings/firestoreUsage')));await assertFails(getDoc(ref(user('a'),'personnelSettings/firestoreUsage')));await assertFails(getDoc(ref(env.unauthenticatedContext().firestore(),'personnelSettings/firestoreUsage')));await assertFails(setDoc(ref(user('a'),'personnelSettings/firestoreUsage'),{reads:{used:0}}));});

async function tableFixture(){await env.withSecurityRulesDisabled(async c=>{const db=c.firestore(),batch=writeBatch(db);batch.set(ref(db,'unitPeriods/P/schemas/7'),{unitId:'7',keys:['1!B4','2!B4'],tableIds:['1','2'],tableKeys:{1:['1!B4'],2:['2!B4']}});batch.set(ref(db,'unitPeriods/P/reports/7'),{...report,draft:{...payload,cells:{'1!B4':10,'2!B4':null}}});await batch.commit();});}
function pendingTable(){return {unitId:'7',tableId:'1',periodId:'P',version:1,status:'pending',pending:{...payload,cells:{'1!B4':10}},pendingVersion:1,approved:null,approvedVersion:null,reviewNote:'',submittedBy:'a',submittedAt:serverTimestamp(),updatedAt:serverTimestamp()};}
test('a single saved table can be submitted while other unit tables remain blank',async()=>{await tableFixture();await assertSucceeds(setDoc(ref(user('a'),'unitPeriods/P/tableReviews/7__1'),pendingTable()));const snap=await getDoc(ref(user('a'),'unitPeriods/P/tableReviews/7__1'));assert.equal(snap.data().pending.cells['1!B4'],10);await assertFails(getDoc(ref(user('b'),'unitPeriods/P/tableReviews/7__1')));await assertSucceeds(getDocs(query(collection(user('a'),'unitPeriods/P/tableReviews'),where('unitId','==','7'))));});
test('table submission cannot contain foreign cells, unsaved tables or altered saved values',async()=>{await tableFixture();const a=user('a'),path='unitPeriods/P/tableReviews/7__1';await assertFails(setDoc(ref(a,path),{...pendingTable(),pending:{...payload,cells:{'1!B4':999}}}));await assertFails(setDoc(ref(a,path),{...pendingTable(),pending:{...payload,cells:{'1!B4':10,'1!B6':99}}}));await assertFails(setDoc(ref(a,'unitPeriods/P/tableReviews/7__2'),{...pendingTable(),tableId:'2',pending:{...payload,cells:{'2!B4':null},savedTables:['2']}}));});
test('table snapshots stay frozen and unit users cannot approve or replace pending submissions',async()=>{await tableFixture();const a=user('a'),path='unitPeriods/P/tableReviews/7__1';await setDoc(ref(a,path),pendingTable());const snap=(await getDoc(ref(a,path))).data();await assertFails(setDoc(ref(a,path),{...snap,version:2,status:'approved',pending:null,pendingVersion:null,approved:snap.pending,approvedVersion:1,approvedAt:serverTimestamp(),approvedBy:'a',updatedAt:serverTimestamp()}));await assertFails(setDoc(ref(a,path),{...snap,version:2,pending:{...snap.pending,cells:{'1!B4':20}},updatedAt:serverTimestamp(),submittedAt:serverTimestamp()}));await assertSucceeds(updateDoc(ref(a,'unitPeriods/P/reports/7'),{version:2,draft:{...payload,cells:{'1!B4':20,'2!B4':null}}}));assert.equal((await getDoc(ref(a,path))).data().pending.cells['1!B4'],10);});
test('only administrator can approve the exact submitted table and return requires a note',async()=>{await tableFixture();const path='unitPeriods/P/tableReviews/7__1';await setDoc(ref(user('a'),path),pendingTable());const old=(await getDoc(ref(user('manager'),path))).data(),manager=user('manager');await assertFails(setDoc(ref(manager,path),{...old,version:2,status:'returned',pending:null,pendingVersion:null,reviewNote:'',updatedAt:serverTimestamp()}));await assertFails(setDoc(ref(manager,path),{...old,version:2,status:'approved',approved:{...old.pending,cells:{'1!B4':999}},approvedVersion:1,approvedBy:'manager',approvedAt:serverTimestamp(),pending:null,pendingVersion:null,updatedAt:serverTimestamp()}));await assertSucceeds(setDoc(ref(manager,path),{...old,version:2,status:'approved',approved:old.pending,approvedVersion:1,approvedBy:'manager',approvedAt:serverTimestamp(),pending:null,pendingVersion:null,updatedAt:serverTimestamp()}));});
test('locked period prevents table submissions and administrator decisions',async()=>{await tableFixture();await env.withSecurityRulesDisabled(c=>updateDoc(ref(c.firestore(),'unitPeriods/P'),{locked:true}));await assertFails(setDoc(ref(user('a'),'unitPeriods/P/tableReviews/7__1'),pendingTable()));});
test('new table workflow rejects legacy whole-unit submission',async()=>{await tableFixture();const a=user('a');await assertFails(updateDoc(ref(a,'unitPeriods/P/reports/7'),{version:2,status:'pending',pending:{...payload,cells:{'1!B4':10,'2!B4':20},savedTables:['1','2']},pendingVersion:2,draft:{...payload,cells:{'1!B4':10,'2!B4':20},savedTables:['1','2']},submittedBy:'a',submittedAt:'2026-11-03T00:00:00Z',reviewNote:''}));});

test('table submit and history are atomic and fabricated history payload is rejected',async()=>{await tableFixture();const a=user('a'),data=pendingTable(),batch=writeBatch(a);batch.set(ref(a,'unitPeriods/P/tableReviews/7__1'),data);batch.set(ref(a,'unitPeriods/P/tableReviewHistory/submit1'),{unitId:'7',tableId:'1',reviewId:'7__1',actor:'a',action:'submit',version:1,at:serverTimestamp(),payload:data.pending});await assertSucceeds(batch.commit());await assertFails(setDoc(ref(a,'unitPeriods/P/tableReviewHistory/fake'),{unitId:'7',tableId:'1',reviewId:'7__1',actor:'a',action:'submit',version:1,at:serverTimestamp(),payload:{...data.pending,cells:{'1!B4':999}}}));});
test('administrator table decision updates aggregate published data without approving another table',async()=>{await tableFixture();await setDoc(ref(user('a'),'unitPeriods/P/tableReviews/7__1'),pendingTable());const m=user('manager'),old=(await getDoc(ref(m,'unitPeriods/P/tableReviews/7__1'))).data(),batch=writeBatch(m);batch.set(ref(m,'unitPeriods/P/tableReviews/7__1'),{...old,version:2,status:'approved',approved:old.pending,approvedVersion:1,approvedBy:'manager',approvedAt:serverTimestamp(),pending:null,pendingVersion:null,updatedAt:serverTimestamp()});batch.update(ref(m,'unitPeriods/P/reports/7'),{version:2,approved:old.pending,approvedVersion:2,approvedBy:'manager',approvedAt:serverTimestamp()});batch.set(ref(m,'unitPeriods/P/published/7'),{unitId:'7',version:2,payload:old.pending,tableApprovals:{1:1}});batch.set(ref(m,'unitPeriods/P/tableReviewHistory/approve1'),{unitId:'7',tableId:'1',reviewId:'7__1',actor:'manager',action:'approve',version:2,at:serverTimestamp(),payload:old.pending});await assertSucceeds(batch.commit());const data=(await getDoc(ref(user('b'),'unitPeriods/P/published/7'))).data();assert.equal(data.payload.cells['1!B4'],10);assert.equal(data.payload.cells['2!B4'],undefined);});

test('presentations permission is required for private library and only administrator can manage cards or PDF bytes',async()=>{
 const manager=user('manager');await assertSucceeds(setDoc(ref(manager,'presentationCards/strategic'),{title:'Stratejik Planlar',kind:'pdf',version:1,deleted:false}));
 await assertFails(getDoc(ref(user('a'),'presentationCards/strategic')));
 await assertFails(getDoc(ref(env.unauthenticatedContext().firestore(),'presentationCards/strategic')));
 await env.withSecurityRulesDisabled(async c=>{await setDoc(ref(c.firestore(),'unitAccounts/presenter'),{role:'unit',active:true,editUnits:[],readUnits:[],screens:['presentations']});});
 const viewer=user('presenter');await assertSucceeds(getDoc(ref(viewer,'presentationCards/strategic')));
 await assertFails(setDoc(ref(viewer,'presentationCards/new'),{title:'X',kind:'pdf'}));
 const meta={cardId:'strategic',name:'plan.pdf',size:10,parts:1,sha256:'test',ready:false};
 await assertSucceeds(setDoc(ref(manager,'presentationFiles/pdf'),meta));
 await assertSucceeds(setDoc(ref(manager,'presentationFiles/pdf/parts/0'),{payload:'JVBERi0='}));
 await assertFails(getDoc(ref(viewer,'presentationFiles/pdf/parts/0')));
 await assertSucceeds(updateDoc(ref(manager,'presentationFiles/pdf'),{ready:true}));
 await assertSucceeds(getDoc(ref(viewer,'presentationFiles/pdf/parts/0')));
 await assertFails(setDoc(ref(viewer,'presentationFiles/pdf/parts/0'),{payload:'tamper'}));
 await assertFails(updateDoc(ref(viewer,'presentationFiles/pdf'),{ready:false}));
 await assertFails(setDoc(ref(manager,'presentationCards/unsafe'),{title:'X',kind:'link',url:'javascript:alert(1)'}));
 await assertFails(setDoc(ref(manager,'presentationFiles/tooLarge'),{...meta,size:52428801}));
});
test('presentations grants approved briefing inputs but never other unit drafts, reviews or import baselines',async()=>{
 await env.withSecurityRulesDisabled(async c=>{await setDoc(ref(c.firestore(),'unitAccounts/presenter'),{role:'unit',active:true,editUnits:[],readUnits:[],screens:['presentations']});});
 const viewer=user('presenter');await assertSucceeds(getDocs(collection(viewer,'unitPeriods/P/schemas')));
 await assertSucceeds(getDocs(collection(viewer,'unitPeriods/P/tables')));
 await assertSucceeds(getDocs(collection(viewer,'unitPeriods/P/published')));
 await assertSucceeds(getDoc(ref(viewer,'unitMedia/image/parts/0')));
 await assertFails(getDoc(ref(viewer,'unitPeriods/P/reports/22')));
 await assertFails(getDoc(ref(viewer,'unitPeriods/P/importBase/7')));
 await assertFails(getDocs(collection(viewer,'unitPeriods/P/tableReviews')));
 await env.withSecurityRulesDisabled(async c=>{await updateDoc(ref(c.firestore(),'unitAccounts/presenter'),{active:false});});
 await assertFails(getDocs(collection(viewer,'presentationCards')));
 await assertFails(getDocs(collection(viewer,'unitPeriods/P/published')));
});

test('only administrator can revoke a table and a new submission preserves audit fields',async()=>{await tableFixture();const a=user('a'),m=user('manager'),path='unitPeriods/P/tableReviews/7__1';await setDoc(ref(a,path),pendingTable());let old=(await getDoc(ref(m,path))).data();await assertSucceeds(setDoc(ref(m,path),{...old,version:2,status:'approved',approved:old.pending,approvedVersion:1,approvedBy:'manager',approvedAt:serverTimestamp(),approvedSubmittedAt:old.submittedAt,approvedSubmittedBy:'a',pending:null,pendingVersion:null,updatedAt:serverTimestamp()}));old=(await getDoc(ref(m,path))).data();const revoked={...old,version:3,status:'returned',approved:null,approvedVersion:null,revokedAt:serverTimestamp(),revokedBy:'manager',updatedAt:serverTimestamp(),reviewNote:'Onay iptal edildi'};await assertFails(setDoc(ref(a,path),{...revoked,revokedBy:'a'}));const batch=writeBatch(m);batch.set(ref(m,path),revoked);batch.set(ref(m,'unitPeriods/P/tableReviewHistory/revoke'),{unitId:'7',tableId:'1',reviewId:'7__1',actor:'manager',action:'revoke',version:3,at:serverTimestamp(),payload:old.approved});await assertSucceeds(batch.commit());old=(await getDoc(ref(a,path))).data();await assertFails(setDoc(ref(a,path),{...old,version:4,status:'pending',pending:payload,pendingVersion:4,submittedBy:'a',submittedAt:serverTimestamp(),updatedAt:serverTimestamp(),reviewNote:'',revokedBy:'a'}));await assertSucceeds(setDoc(ref(a,path),{...old,version:4,status:'pending',pending:payload,pendingVersion:4,submittedBy:'a',submittedAt:serverTimestamp(),updatedAt:serverTimestamp(),reviewNote:''}));});
test('presentation ordering is visible to authorized viewers and writable only by a manager',async()=>{const m=user('manager');await assertSucceeds(setDoc(ref(m,'presentationSettings/order'),{ids:['meb','strategic'],version:1}));await assertFails(getDoc(ref(user('a'),'presentationSettings/order')));await assertFails(setDoc(ref(user('a'),'presentationSettings/order'),{ids:[],version:2}));await env.withSecurityRulesDisabled(c=>updateDoc(ref(c.firestore(),'unitAccounts/a'),{screens:['presentations']}));await assertSucceeds(getDoc(ref(user('a'),'presentationSettings/order')));await assertFails(setDoc(ref(user('a'),'presentationSettings/order'),{ids:[],version:2}));});
test('full revoke batch includes report and published aggregate',async()=>{await tableFixture();const m=user('manager'),path='unitPeriods/P/tableReviews/7__1',T=require('../js/unit-table-core');await env.withSecurityRulesDisabled(async c=>{const db=c.firestore(),r={...report,version:2,approved:payload,approvedVersion:2},rv={...pendingTable(),version:2,status:'approved',approved:payload,approvedVersion:1,pending:null,pendingVersion:null,approvedBy:'manager',approvedAt:'2026-11-03T00:00:00Z'};await setDoc(ref(db,path),rv);await setDoc(ref(db,'unitPeriods/P/reports/7'),r);await setDoc(ref(db,'unitPeriods/P/published/7'),{unitId:'7',version:2,payload,tableApprovals:{1:1}})});const old=(await getDoc(ref(m,path))).data(),r=(await getDoc(ref(m,'unitPeriods/P/reports/7'))).data(),next=T.transition(old,{action:'revoke',version:2,approvedVersion:1},{unitId:'7',tableId:'1',periodId:'P',actor:{id:'manager',role:'admin'},now:'2026-11-04T00:00:00Z',schema:{unitId:'7',keys:['1!B4'],tableIds:['1'],tableKeys:{1:['1!B4']}},draft:r.draft}),master=T.revokeApproved(r,'1'),batch=writeBatch(m);batch.set(ref(m,path),{...next,submittedAt:old.submittedAt,updatedAt:serverTimestamp(),revokedAt:serverTimestamp()});batch.set(ref(m,'unitPeriods/P/tableReviewHistory/fullrevoke'),{unitId:'7',tableId:'1',reviewId:'7__1',actor:'manager',action:'revoke',version:3,at:serverTimestamp(),payload:old.approved});batch.set(ref(m,'unitPeriods/P/reports/7'),master);batch.set(ref(m,'unitPeriods/P/published/7'),{unitId:'7',version:master.approvedVersion,payload:master.approved,tableApprovals:{}});await assertSucceeds(batch.commit());});

test('other statistics is a separate read-only grant with no PDF library, drafts, review or workbook access',async()=>{const m=user('manager');await env.withSecurityRulesDisabled(async c=>{await setDoc(ref(c.firestore(),'unitAccounts/statviewer'),{role:'unit',active:true,editUnits:[],readUnits:[],screens:['other-statistics']});await setDoc(ref(c.firestore(),'unitMedia/stat'),{allowedUnits:['22'],parts:[0]});await setDoc(ref(c.firestore(),'unitMedia/stat/parts/0'),{payload:'image'});});const v=user('statviewer');await assertSucceeds(getDocs(collection(v,'unitPeriods/P/tables')));await assertSucceeds(getDocs(collection(v,'unitPeriods/P/published')));await assertSucceeds(getDoc(ref(v,'unitMedia/stat/parts/0')));await assertFails(getDocs(collection(v,'presentationCards')));await assertFails(getDocs(collection(v,'presentationFiles')));await assertFails(getDocs(collection(v,'unitPeriods/P/reports')));await assertFails(getDocs(collection(v,'unitPeriods/P/tableReviews')));await assertFails(getDocs(collection(v,'unitPeriods/P/excelFiles')));await assertFails(setDoc(ref(v,'unitPeriods/P/tables/new'),{title:'Forbidden'}));await assertFails(setDoc(ref(v,'unitPeriods/P/schemas/99'),{unitId:'99'}));await assertFails(getDocs(collection(user('a'),'unitPeriods/P/tables')));await updateDoc(ref(m,'unitAccounts/statviewer'),{screens:[]});await assertFails(getDocs(collection(v,'unitPeriods/P/tables')));await updateDoc(ref(m,'unitAccounts/statviewer'),{screens:['other-statistics'],active:false});await assertFails(getDocs(collection(v,'unitPeriods/P/published')));});
