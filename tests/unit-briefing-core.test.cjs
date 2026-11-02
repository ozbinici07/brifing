const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../js/unit-briefing-core.js');
const template={id:'table-1',fields:{B4:{type:'integer'},B5:{type:'integer'},B6:{type:'text'}},assignments:[{unitId:'7',editRanges:['B4:B5']},{unitId:'22',editRanges:['B6']}]};
const ctx={templates:[template],unitId:'7',actor:{id:'u7',role:'unit',editUnits:['7']},now:'2026-10-31T10:00:00Z'};
const payload={tables:{'table-1':{B4:12,B5:0}},source:'Birim kaydı',asOf:'2026-10-31',notes:'',savedTables:['table-1']};
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
 p=C.transition(p,{action:'save-table',tableId:'table-1',periodId:'2026-10',version:2,payload:changed},ctx);
 p=C.transition(p,{action:'submit',periodId:'2026-10',version:3,payload:p.draft},ctx);
 assert.throws(()=>C.transition(p,{action:'return',periodId:'2026-10',version:4,pendingVersion:4,note:''},admin));
 p=C.transition(p,{action:'return',periodId:'2026-10',version:4,pendingVersion:4,note:'Kaynağı kontrol ediniz.'},admin);
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
test('zero and explicit dash complete a saved table; blanks never complete it',()=>{
 const data={...C.copy(payload),savedTables:[],tables:{'table-1':{B4:0,B5:null}}};
 assert.throws(()=>C.transition(null,{action:'save-table',tableId:'table-1',periodId:'P',version:0,payload:data},ctx),/Boş/);
 data.tables['table-1'].B5='-';const saved=C.transition(null,{action:'save-table',tableId:'table-1',periodId:'P',version:0,payload:data},ctx);
 assert.deepEqual(saved.draft.savedTables,['table-1']);const submitted=C.transition(saved,{action:'submit',periodId:'P',version:1,payload:saved.draft},ctx);assert.equal(submitted.status,'pending');
 const schema={tableIds:['table-1'],keys:['table-1!B4','table-1!B5']};assert.equal(C.flatProgress(schema,{cells:{'table-1!B4':0,'table-1!B5':'-'},savedTables:['table-1']}).percent,100);
 assert.equal(C.flatProgress(schema,{cells:{'table-1!B4':0,'table-1!B5':null},savedTables:['table-1']}).percent,0);
});
test('saving one table cannot silently save changes to a different table',()=>{
 const second={...C.copy(template),id:'table-2'},context={...ctx,templates:[template,second]},data={...C.copy(payload),savedTables:[],tables:{'table-1':{B4:1,B5:2},'table-2':{B4:3,B5:4}}};
 let report=C.transition(null,{action:'save',periodId:'P',version:0,payload:data},context);const edited=C.copy(report.draft);edited.tables['table-1'].B4=10;edited.tables['table-2'].B4=20;
 report=C.transition(report,{action:'save-table',tableId:'table-1',periodId:'P',version:1,payload:edited},context);
 assert.equal(report.draft.tables['table-1'].B4,10);assert.equal(report.draft.tables['table-2'].B4,3);assert.deepEqual(report.draft.savedTables,['table-1']);
 assert.throws(()=>C.transition(report,{action:'submit',periodId:'P',version:2,payload:report.draft},context),/Tüm tabloları/);
});
test('blank briefing form inputs are inferred while section headings and row labels stay locked',()=>{
 const fields=C.fieldsFromRecord({rowOffset:1,rows:[[{v:'Tablo A-01. Çalışmalar'},{v:null},{v:null}],[{v:'Çalışma konusu'},{v:'Kapsam'},{v:'Talep (adet)'}],[{v:'Teknik destek'},{v:null},{v:null}],[{v:null},{v:null},{v:null}],[{v:'Kaynak / kayıt'},{v:null},{v:null}]]});
 assert.equal(fields.B3.type,'text');assert.equal(fields.C3.type,'number');assert.equal(fields.A3,undefined);assert.equal(fields.B2,undefined);assert.equal(fields.B4,undefined);assert.equal(fields.B5,undefined);
});

