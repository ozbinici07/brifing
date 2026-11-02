const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const C=require('../js/unit-briefing-core'),M=require('../js/unit-migration');
function setup(){
 const documents=new Map(),commits=[];let failAt=-1;
 const api={read:async p=>documents.has(p)?{data:C.copy(documents.get(p)),updateTime:'revision'}:null,list:async p=>[...documents].filter(([k])=>k.startsWith(p+'/')&&!k.slice(p.length+1).includes('/')).map(([k,v])=>({id:k.split('/').pop(),...C.copy(v)})),write:(path,data)=>({path,data}),commit:async writes=>{commits.push(writes);if(commits.length===failAt)throw Error('Simulated connection loss');for(const w of writes)documents.set(w.path,C.copy(w.data));}};
 const context={document:{getElementById:()=>null},UnitBriefingCore:C,UnitMigration:M,BRIFING_FIREBASE_CONFIG:{},__personnelFirestore:api,authUser:()=>({role:'System Admin'}),crypto:require('node:crypto').webcrypto,atob,Date};context.window=context;
 vm.runInNewContext(fs.readFileSync(require.resolve('../js/unit-service'),'utf8'),context);
 return {S:context.UnitBriefingService,documents,commits,setFailure:n=>failAt=n};
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
