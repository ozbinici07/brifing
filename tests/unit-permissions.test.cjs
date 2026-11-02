const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../js/unit-permissions-core');
const user={uid:'example',role:'unit',editUnits:['6'],readUnits:['22'],screens:['units','overview']};
test('selected user changes preserve extra units and untouched permissions',()=>{
 const next=P.apply(user,'6',{students:true,unitsEdit:false},'');
 assert.deepEqual(next.editUnits,[]);assert.deepEqual(next.readUnits,['22','6']);assert.deepEqual(next.screens,['units','overview','students']);assert.equal(user.editUnits.length,1);
 const unchanged=P.apply(user,'6',{},'');assert.deepEqual(unchanged,user);
});
test('disabling one unit never removes another unit grant',()=>{
 const next=P.apply(user,'6',{unitsView:false},'');assert.deepEqual(next.readUnits,['22']);assert.deepEqual(next.editUnits,[]);assert.ok(next.screens.includes('units'));
});
test('management permissions require an explicit administrator role',()=>{
 assert.throws(()=>P.apply(user,'6',{usersEdit:true},''),/Yönetici/);
 assert.equal(P.apply(user,'6',{usersEdit:true},'admin').role,'admin');
 assert.throws(()=>P.apply(user,'6',{unknown:true},''));assert.throws(()=>P.apply(user,'6',{},'unknown'));
});
