const {test,before,after,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,updateDoc,writeBatch}=require('firebase/firestore');
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Rules tests require the local emulator. Production is never used.');
let env;
const payload={cells:{'1!B4':10},source:'Kaynak',asOf:'2026-10-31',notes:''};
const report={unitId:'7',periodId:'P',version:1,status:'draft',draft:payload,pending:null,pendingVersion:null,approved:null,approvedVersion:null};
const ref=(db,path)=>doc(db,path);
const user=id=>env.authenticatedContext(id,{email:id+'@example.test'}).firestore();
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-brifing-units',firestore:{rules:fs.readFileSync(process.env.UNIT_RULES_FILE||__dirname+'/firestore.rules','utf8')}})});
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
