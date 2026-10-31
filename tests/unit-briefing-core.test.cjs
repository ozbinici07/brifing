const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../js/unit-briefing-core.js');
const template={id:'table-1',fields:{B4:{type:'integer'},B5:{type:'integer'},B6:{type:'text'}},assignments:[{unitId:'7',editRanges:['B4:B5']},{unitId:'22',editRanges:['B6']}]};
const ctx={templates:[template],unitId:'7',actor:{id:'u7',role:'unit',editUnits:['7']},now:'2026-10-31T10:00:00Z'};
const payload={tables:{'table-1':{B4:12,B5:0}},source:'Birim kaydı',asOf:'2026-10-31',notes:''};
test('unit can write own range, cannot write another unit or label',()=>{
 assert.deepEqual(C.validatePatch(template,'7',{B4:0}),{B4:0});
 assert.throws(()=>C.validatePatch(template,'7',{B6:'yetkisiz'}));
 assert.throws(()=>C.validatePatch(template,'7',{A4:'başlık'}));
 assert.throws(()=>C.validatePatch(template,'7',{B4:-1}));
 assert.throws(()=>C.validatePatch(template,'7',{B4:1.2}));
 assert.throws(()=>C.validatePatch(template,'7',{B4:Infinity}));
});
test('overlapping edit grants are rejected, shared read-only labels are unaffected',()=>{
 const t=C.copy(template);t.assignments[1].editRanges=['B5:B6'];assert.throws(()=>C.validateTemplate(t));
});
test('new periods have no old input values; zero is different from missing',()=>{
 const empty=C.emptyPeriod([template],'7');assert.deepEqual(empty.tables,{'table-1':{B4:null,B5:null}});
 assert.equal(C.validatePatch(template,'7',{B4:0}).B4,0);
 assert.equal(C.validatePatch(template,'7',{B4:''}).B4,null);
});
test('submission freezes the whole unit package and later drafts cannot alter it',()=>{
 const submitted=C.transition(null,{action:'submit',periodId:'2026-10',version:0,payload},ctx);
 const changed=C.copy(payload);changed.tables['table-1'].B4=33;
 const saved=C.transition(submitted,{action:'save',periodId:'2026-10',version:1,payload:changed},ctx);
 assert.equal(saved.pending.tables['table-1'].B4,12);assert.equal(saved.draft.tables['table-1'].B4,33);
 assert.equal(submitted.draft.tables['table-1'].B4,12);
 const manager={...ctx,actor:{id:'manager',role:'admin'}};
 const approved=C.transition(saved,{action:'approve',periodId:'2026-10',version:2,pendingVersion:1},manager);
 assert.equal(approved.approved.tables['table-1'].B4,12);assert.equal(approved.status,'draft');
 assert.throws(()=>C.transition(saved,{action:'approve',periodId:'2026-10',version:2,pendingVersion:99},manager));
 assert.throws(()=>C.transition(saved,{action:'approve',periodId:'2026-10',version:2,pendingVersion:1},ctx));
});
test('old approved version survives a returned revision',()=>{
 const admin={...ctx,actor:{id:'manager',role:'admin'}};
 let p=C.transition(null,{action:'submit',periodId:'2026-10',version:0,payload},ctx);
 p=C.transition(p,{action:'approve',periodId:'2026-10',version:1,pendingVersion:1},admin);
 const changed=C.copy(payload);changed.tables['table-1'].B4=50;
 p=C.transition(p,{action:'submit',periodId:'2026-10',version:2,payload:changed},ctx);
 assert.throws(()=>C.transition(p,{action:'return',periodId:'2026-10',version:3,pendingVersion:3,note:''},admin));
 p=C.transition(p,{action:'return',periodId:'2026-10',version:3,pendingVersion:3,note:'Kaynağı kontrol ediniz.'},admin);
 assert.equal(p.approved.tables['table-1'].B4,12);assert.equal(p.status,'returned');
});
test('stale saves, wrong units, wrong periods and unrelated table injection fail',()=>{
 const p=C.transition(null,{action:'save',periodId:'2026-10',version:0,payload},ctx);
 assert.throws(()=>C.transition(p,{action:'save',periodId:'2026-10',version:0,payload},ctx));
 assert.throws(()=>C.transition(p,{action:'save',periodId:'2026-09',version:1,payload},ctx));
 assert.throws(()=>C.transition(p,{action:'save',periodId:'2026-10',version:1,payload},{...ctx,unitId:'22'}));
 assert.throws(()=>C.validatePackage([template],'7',{...payload,tables:{other:{B4:1}}}));
});
test('Excel updates never overwrite divergent unit entries without explicit choice',()=>{
 const base={B4:10,B5:0},current={B4:12,B5:0},incoming={B4:20,B5:1};
 const d=C.importDifferences(base,current,incoming);
 assert.equal(d.find(x=>x.key==='B4').conflict,true);
 assert.equal(d.find(x=>x.key==='B5').conflict,false);
 assert.throws(()=>C.applyImport(current,incoming,d,{}));
 assert.deepEqual(C.applyImport(current,incoming,d,{B4:'keep-current',B5:'use-excel'}),{B4:12,B5:1});
 assert.deepEqual(current,{B4:12,B5:0});
});
test('legacy overlays preserve current units and values, while orphan overlays stay warnings',()=>{
 const seed={units:[{id:1},{id:7}],records:[{id:4,source:true,rows:[[{v:9}]],links:[{unit:7,range:'*'}]}]};
 const out=C.normalizeLegacy(seed,[{key:'unit:1',value:{deleted:true}},{key:'record:999',value:{source:true,id:999}}]);
 assert.equal(out.units.length,1);assert.equal(out.records.length,1);assert.equal(out.records[0].rows[0][0].v,9);
 assert.equal(out.warnings[0].code,'orphan-record-overlay');assert.equal(seed.units.length,2);
});

