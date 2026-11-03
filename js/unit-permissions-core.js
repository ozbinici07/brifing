(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.UnitUserPermissions=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const screenKeys=['overview','institutions','students','teachers','managers','presentations'];
const adminOnly=['excel','unitsDelete','usersView','usersEdit','permissionsEdit','periodsSet','backup','settings'];
function apply(account,unitId,changes,role){
 const next=JSON.parse(JSON.stringify(account));unitId=String(unitId);
 if(role){if(!['unit','admin'].includes(role))throw Error('Rol geçersiz.');next.role=role;}
 const allowed=[...screenKeys,...adminOnly,'unitsView','unitsEdit','periodsView'];
 if(Object.entries(changes).some(([k,v])=>!allowed.includes(k)||typeof v!=='boolean'))throw Error('Yetki seçimi geçersiz.');
 if(next.role!=='admin'&&adminOnly.some(k=>changes[k]))throw Error('Yönetim yetkileri için Yönetici rolünü seçiniz.');
 const screens=new Set(next.screens||[]),edit=new Set(next.editUnits||[]),read=new Set(next.readUnits||[]);
 for(const key of screenKeys)if(key in changes){if(changes[key])screens.add(key);else screens.delete(key);}
 if(changes.unitsView===false){edit.delete(unitId);read.delete(unitId);}
 else{
  if(changes.unitsEdit===false){edit.delete(unitId);read.add(unitId);}
  if(changes.unitsView===true&&!edit.has(unitId))read.add(unitId);
  if(changes.unitsEdit===true){edit.add(unitId);screens.add('units');}
 }
 if(changes.unitsView===true)screens.add('units');
 if(!edit.size&&!read.size&&changes.unitsView===false)screens.delete('units');
 next.screens=[...screens];next.editUnits=[...edit];next.readUnits=[...read];return next;
}
return {apply};
});
