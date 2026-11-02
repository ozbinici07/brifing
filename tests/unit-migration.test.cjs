const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../js/unit-migration');
const fixture=()=>({format:'brifing-unit-migration-v1',source:{sha256:'a'.repeat(64),name:'source.xlsx',period:'Test'},units:[{id:7,name:'A'},{id:22,name:'B'}],records:[{id:1,title:'Shared',rowOffset:4,sheet:'Sheet',rows:[[{v:'Label'},{v:0}],[{v:'Other'},{v:12}]],links:[{unit:7,range:'B4'},{unit:22,range:'B5'}],images:[],charts:[{title:'Graph',series:[]}],status:'pending'}],assets:{},warnings:[{code:'orphan-record-overlay',id:'old'}]});
test('migration preserves values per unit, isolates templates and keeps old metadata',()=>{
 const plan=M.build(fixture(),'P','2026-11-02T10:00:00Z'),read=p=>plan.writes.find(w=>w.path===p).data;
 assert.deepEqual(read('unitPeriods/P/reports/7').draft.cells,{'1!B4':0});
 assert.deepEqual(read('unitPeriods/P/reports/22').draft.cells,{'1!B5':12});
 assert.equal(read('unitPeriods/P/reports/7').approved,null);
 const table=read('unitPeriods/P/tables/1');assert.equal(JSON.parse(table.rowsJson)[0][0].v,'Label');assert.equal(JSON.parse(table.rowsJson)[1][1].v,null);assert.equal(table.charts.length,1);
 assert.equal(plan.units[0].username,'insankaynaklari');assert.equal(plan.summary.warnings[0].code,'orphan-record-overlay');
});
test('migration fails closed for ambiguous assignments, duplicate IDs or missing images',()=>{
 const s=fixture();s.records[0].links[1].range='B4:B5';assert.throws(()=>M.build(s,'P','2026-11-02'));
 const duplicate=fixture();duplicate.records.push(duplicate.records[0]);assert.throws(()=>M.build(duplicate,'P','2026-11-02'));
 const image=fixture();image.records[0].images=['/assets/missing.png'];assert.throws(()=>M.build(image,'P','2026-11-02'));
});
test('private image bytes are split into small Firestore-safe parts',()=>{
 const s=fixture(),hash='b'.repeat(64);s.records[0].images=['/assets/p.png'];s.assets={'/assets/p.png':{sha256:hash,base64:'AAAA'.repeat(100000)}};
 const plan=M.build(s,'P','2026-11-02'),parts=plan.writes.filter(w=>w.path.includes('/parts/'));
 assert.equal(parts.length,2);assert.ok(parts.every(w=>w.data.payload.length<=240000));assert.equal(parts.map(w=>w.data.payload).join(''),s.assets['/assets/p.png'].base64);
});
