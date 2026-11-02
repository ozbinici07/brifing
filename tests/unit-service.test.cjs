const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const C=require('../js/unit-briefing-core'),M=require('../js/unit-migration');
function setup(role='System Admin'){
 const documents=new Map(),commits=[];let failAt=-1;
 const api={read:async p=>documents.has(p)?{data:C.copy(documents.get(p)),updateTime:'revision'}:null,list:async p=>[...documents].filter(([k])=>k.startsWith(p+'/')&&!k.slice(p.length+1).includes('/')).map(([k,v])=>({id:k.split('/').pop(),...C.copy(v)})),write:(path,data)=>({path,data}),commit:async writes=>{commits.push(writes);if(commits.length===failAt)throw Error('Simulated connection loss');for(const w of writes)documents.set(w.path,C.copy(w.data));}};
 const context={document:{getElementById:()=>null},UnitUserPermissions:require('../js/unit-permissions-core'),UnitBriefingCore:C,UnitMigration:M,BRIFING_FIREBASE_CONFIG:{},__personnelFirestore:api,authUser:()=>({role}),token:()=>'.'+btoa(JSON.stringify({user_id:'caller'}))+'.',crypto:require('node:crypto').webcrypto,atob,btoa,Date};context.window=context;
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/unit-service'),'utf8'),context);
 return {S:context.UnitBriefingService,documents,commits,context,setFailure:n=>failAt=n};
}
function snapshot(){return {format:'brifing-unit-migration-v1',source:{sha256:'a'.repeat(64),name:'source.xlsx',period:'Test'},units:[{id:7,name:'A'}],records:[{id:1,rowOffset:4,rows:[[{v:'Name'},{v:0}]],links:[{unit:7,range:'*'}],images:[],charts:[],status:'pending'}],assets:{}};}
test('initial import exposes catalog only when all private documents are ready',async()=>{
 const t=setup(),p=await t.S.initialImport(snapshot());
 assert.equal(t.documents.get('unitPeriods/'+p.periodId).ready,true);assert.equal(t.documents.get('unitPeriods/'+p.periodId+'/reports/7').draft.cells['1!B4'],0);
 assert.equal(t.commits.at(-1)[0].path,'unitCatalog/main');await assert.rejects(t.S.initialImport(snapshot()),/daha önce/);
});
test('interrupted migration remains hidden and is safely resumed',async()=>{
 const t=setup();t.setFailure(3);await assert.rejects(t.S.initialImport(snapshot()),/connection/);
 const root='unitPeriods/legacy_'+ 'a'.repeat(16);assert.equal(t.documents.get(root).ready,false);assert.equal(t.documents.has('unitCatalog/main'),false);
 t.setFailure(-1);await t.S.initialImport(snapshot());assert.equal(t.documents.get(root).ready,true);
});
test('migration cannot overwrite existing unit input',async()=>{
 const t=setup(),root='unitPeriods/legacy_'+'a'.repeat(16);t.documents.set(root,{ready:false,sourceSha256:'a'.repeat(64)});t.documents.set(root+'/reports/7',{version:3});
 await assert.rejects(t.S.initialImport(snapshot()),/üzerine yazamaz/);assert.equal(t.commits.length,0);
});
test('administrator resets a unit login atomically without storing its password',async()=>{
 const t=setup(),old={uid:'old',username:'example',role:'unit',active:true,editUnits:['7'],readUnits:['22'],screens:['units','students'],mustChange:false};
 t.documents.set('unitAccounts/old',old);t.documents.set('unitLoginDirectory/example',{email:'old@example.test',username:'example',active:true});
 t.context.fetch=async()=>({ok:true,json:async()=>({localId:'new'})});
 const next=await t.S.resetAccountPassword('old','temporary-test-password');
 assert.equal(next.uid,'new');assert.equal(next.mustChange,false);assert.equal(t.documents.get('unitAccounts/old').active,false);assert.equal(t.documents.get('unitAccounts/old').replacedBy,'new');
 assert.deepEqual(t.documents.get('unitAccounts/new').editUnits,['7']);assert.deepEqual(t.documents.get('unitAccounts/new').readUnits,['22']);assert.equal(t.commits.length,1);
 assert.ok(!JSON.stringify([...t.documents]).includes('temporary-test-password'));assert.ok(t.documents.get('unitLoginDirectory/example').email.startsWith('example.'));
});
test('non-admins and retired or admin account targets cannot reset passwords',async()=>{
 const t=setup('Unit User');await assert.rejects(t.S.resetAccountPassword('other','temporary-test-password'),/Yönetici/);assert.equal(t.commits.length,0);
 const a=setup();a.documents.set('unitAccounts/admin',{uid:'admin',role:'admin'});await assert.rejects(a.S.resetAccountPassword('admin','temporary-test-password'),/birim hesapları/);
 a.documents.set('unitAccounts/old',{uid:'old',role:'unit',replacedBy:'next'});await assert.rejects(a.S.resetAccountPassword('old','temporary-test-password'),/birim hesapları/);
});
test('a failed reset leaves the original account and directory in place',async()=>{
 const t=setup(),old={uid:'old',username:'example',role:'unit',active:true};t.documents.set('unitAccounts/old',old);t.documents.set('unitLoginDirectory/example',{email:'old@example.test'});
 t.context.fetch=async()=>({ok:true,json:async()=>({localId:'new'})});t.setFailure(1);await assert.rejects(t.S.resetAccountPassword('old','temporary-test-password'));
 assert.equal(t.documents.get('unitAccounts/old').active,true);assert.equal(t.documents.get('unitLoginDirectory/example').email,'old@example.test');
});
test('self password changes require the current password and refresh the same session',async()=>{
 const t=setup('Unit User');t.documents.set('unitAccounts/caller',{uid:'caller',username:'example',active:true,role:'unit',mustChange:false});t.documents.set('unitLoginDirectory/example',{email:'example@example.test'});
 const updates=[];t.context.__updateFirebaseSessionTokens=x=>updates.push(x);
 t.context.fetch=async url=>({ok:true,json:async()=>({localId:'caller',idToken:url.includes('signInWithPassword')?'reauth':'changed',refreshToken:'refresh',expiresIn:'3600'})});
 await assert.rejects(t.S.changePassword('new-test-password',''),/Mevcut/);
 await t.S.changePassword('new-test-password','old-test-password');assert.equal(updates.length,2);assert.equal(updates[1].idToken,'changed');assert.equal(t.commits.length,0);
 t.context.fetch=async()=>({ok:false,json:async()=>({error:{message:'INVALID_PASSWORD'}})});await assert.rejects(t.S.changePassword('new-test-password','wrong'),/doğrulanamadı/);
});
test('bulk permission changes are one commit and only target selected users',async()=>{
 const t=setup();for(const uid of ['one','two','untouched']){t.documents.set('unitAccounts/'+uid,{uid,username:uid,role:'unit',editUnits:['6'],readUnits:['22'],screens:['units']});t.documents.set('unitLoginDirectory/'+uid,{username:uid,role:'Unit User'});}
 await t.S.saveUnitUserPermissions(['one','two'],'6',{students:true},'');assert.equal(t.commits.length,1);assert.equal(t.commits[0].length,4);
 assert.ok(t.documents.get('unitAccounts/one').screens.includes('students'));assert.ok(t.documents.get('unitAccounts/two').screens.includes('students'));assert.deepEqual(t.documents.get('unitAccounts/untouched').screens,['units']);
 await assert.rejects(t.S.saveUnitUserPermissions(['one'],'99',{students:true},''),/bağlı değil/);
});
function excelFixture(){const t=setup(),payload={cells:{'t!B4':0},source:'Source',asOf:'2026-11-02',notes:'',savedTables:['t']};t.documents.set('unitPeriods/P',{name:'Eski',ready:true,locked:false});t.documents.set('unitPeriods/P/tables/t',{id:'t',sheet:'Sheet',rowOffset:4,rowsJson:JSON.stringify([[{v:'Label'},{v:null}]]),fields:{B4:{type:'number'}},assignments:[{unitId:'7',editRanges:['*']}],allowedUnits:['7']});t.documents.set('unitPeriods/P/schemas/7',{unitId:'7',tableIds:['t'],keys:['t!B4']});t.documents.set('unitPeriods/P/reports/7',{unitId:'7',periodId:'P',version:3,status:'approved',draft:payload,approved:payload,approvedVersion:3,pending:null,pendingVersion:null});t.documents.set('unitPeriods/P/importBase/7',{cells:{'t!B4':0}});t.context.UnitExcelMedia={read:async()=>({})};t.workbook={SheetNames:['Sheet'],Sheets:{Sheet:{B4:{v:0}}}};t.context.XLSX={read:()=>t.workbook};t.file={name:'fixture.xlsx',type:'application/test',arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};return t;}
test('unchanged Excel import archives source but preserves approval and report version',async()=>{
 const t=excelFixture(),plan=await t.S.prepareExcel('P',t.file,{});assert.equal(plan.differences.length,0);await t.S.applyExcel(plan,{});const report=t.documents.get('unitPeriods/P/reports/7');assert.equal(report.version,3);assert.equal(report.status,'approved');assert.deepEqual(t.documents.get('unitPeriods/P/excelFiles/latest').parts,['0']);assert.ok(t.documents.get('unitPeriods/P/excelFiles/latest/parts/0').payload);
});
test('changed Excel import invalidates saved progress and preserves the approved snapshot',async()=>{
 const t=excelFixture();t.workbook.Sheets.Sheet.B4.v=1;const plan=await t.S.prepareExcel('P',t.file,{});await t.S.applyExcel(plan,{'7!t!B4':'use-excel'});const report=t.documents.get('unitPeriods/P/reports/7');assert.equal(report.version,4);assert.equal(report.draft.cells['t!B4'],1);assert.deepEqual(report.draft.savedTables,[]);assert.equal(report.approved.cells['t!B4'],0);
});
test('Excel preview for a new period does not write; confirm creates blank templates then imports',async()=>{
 const t=excelFixture();t.workbook.Sheets.Sheet.B4.v=2;t.context.api=async()=>({periods:[{folder:'P2',name:'Yeni 2026'}]});const plan=await t.S.prepareExcel('P2',t.file,{},'Yeni 2026');assert.equal(t.commits.length,0);assert.equal(plan.newPeriodSource,'P');await t.S.applyExcel(plan,{'7!t!B4':'use-excel'});assert.equal(t.documents.get('unitPeriods/P2/reports/7').draft.cells['t!B4'],2);assert.equal(t.documents.get('unitPeriods/P/reports/7').draft.cells['t!B4'],0);
});
