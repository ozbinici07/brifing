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
