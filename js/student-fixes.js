function studentCanonicalType(type,level){
 const n=norm(type);
 if(level==='Ortaokul'&&n.includes('imam hatip'))return 'İmam Hatip Ortaokulu';
 const aliases={'ozel anadolu meslek programi':'Anadolu Meslek Programı','ozel anadolu teknik programi':'Anadolu Teknik Programı','ozel fen lisesi':'Fen Lisesi','ozel fen ve teknoloji lisesi':'Fen Lisesi','ozel ve fen ve teknoloji lisesi':'Fen Lisesi','ozel anadolu lisesi':'Anadolu Lisesi','ozel turk ilkokulu':'İlkokul','ozel turk ortaokulu':'Ortaokul'};
 return aliases[n]||String(type||'').trim();
}
window.studentQueryGradeRows=function(){
 const out=[];
 for(const [source,rows] of [['basic',D?.basic||[]],['secondary',D?.secondary||[]]])rows.forEach((r,rowIndex)=>{
  const grades=canonicalGradeStudents(r);
  grades.forEach((students,i)=>{if(students<=0&&!(window.canonicalGradeBranches(r)[i]>0))return;const level=i===0?'Okul Öncesi':i<=4?'İlkokul':i<=8?'Ortaokul':'Ortaöğretim';out.push({...r,source:r.source||(source==='basic'?'Temel Eğitim.xlsx':'Ortaöğretim.xlsx'),_rowKey:source+':'+rowIndex,type:studentCanonicalType(r.type,level),source_type:r.type,level,grade:STUDENT_GRADE_NAMES[i],students:Number(students),branches:window.canonicalGradeBranches(r)[i],_gradeIndex:i});});
 });return out;
};
window.studentFilterRows=function(){
 const val=id=>$(id)?.value||'',level=val('stuLevel'),district=val('stuDistrict'),type=val('stuType'),pub=val('stuPublic'),grade=val('stuGrade');
 const rows=studentQueryGradeRows().filter(r=>(!district||r.district===district)&&(!level||level==='Tümü'||r.level===level)&&(!type||r.type===type)&&(!pub||pub==='Tümü'||publicKey(r.public_private)===publicKey(pub))&&(!grade||r.grade===grade));
 const grouped=new Map();for(const r of rows){const key=r._rowKey+'|'+r.type+'|'+r.level;if(!grouped.has(key))grouped.set(key,{...r,students:0,branches:0,_canonicalBranches:Array(14).fill(null),_canonicalGrades:Array(14).fill(0),_detailLevel:r.level});const target=grouped.get(key);target.students+=r.students;target.branches=target.branches===null||r.branches===null?null:target.branches+r.branches;target._canonicalBranches[r._gradeIndex]=r.branches;target._canonicalGrades[r._gradeIndex]+=r.students;}
 return [...grouped.values()];
};
window.syncStudentTableFilters=function(changed=''){
 if(!D)return;
 if(changed==='stuLevel'){ $('stuGrade').value='';$('stuType').value=''; }
 const val=id=>$(id)?.value||'';
 for(const [id,key] of [['stuType','type'],['stuGrade','grade']]){
 const rows=studentQueryGradeRows().filter(r=>(!val('stuDistrict')||r.district===val('stuDistrict'))&&(!val('stuLevel')||val('stuLevel')==='Tümü'||r.level===val('stuLevel'))&&(!val('stuPublic')||val('stuPublic')==='Tümü'||publicKey(r.public_private)===publicKey(val('stuPublic')))&&(id!=='stuType'||!val('stuGrade')||r.grade===val('stuGrade'))&&(id==='stuType'||!val('stuType')||r.type===val('stuType')));
 const values=[...new Set(rows.map(r=>r[key]))];if(key==='grade')values.sort((a,b)=>STUDENT_GRADE_NAMES.indexOf(a)-STUDENT_GRADE_NAMES.indexOf(b));else values.sort((a,b)=>a.localeCompare(b,'tr'));
 const current=val(id);$(id).innerHTML='<option value="">Tümü</option>'+values.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');$(id).value=values.includes(current)?current:'';
 }
};
for(const id of ['stuDistrict','stuLevel','stuPublic','stuType'])$(id).addEventListener('change',()=>{syncStudentTableFilters(id);renderStudents();});
$('stuGrade').addEventListener('change',()=>{syncStudentTableFilters('stuGrade');renderStudents();});
window.studentQueryMultiOptions=function(key){
 const keys=['district','public','level','type','grade'];
 const rows=studentQueryGradeRows().filter(r=>keys.every(k=>keys.indexOf(k)>=keys.indexOf(key)||!(STUDENT_QUERY_FILTERS[k]||[]).length||STUDENT_QUERY_FILTERS[k].includes(k==='public'?(publicKey(r.public_private)==='resmi'?'Resmi':'Özel'):r[k])));
 const values=[...new Set(rows.map(r=>key==='public'?(publicKey(r.public_private)==='resmi'?'Resmi':'Özel'):r[key]).filter(Boolean))];
 if(key==='grade')return values.sort((a,b)=>STUDENT_GRADE_NAMES.indexOf(a)-STUDENT_GRADE_NAMES.indexOf(b));if(key==='level')return STUDENT_QUERY_OPTIONS.level.filter(v=>values.includes(v));return values.sort((a,b)=>a.localeCompare(b,'tr'));
};
const originalQuery=window.runStudentQuery;
window.runStudentQuery=function(button){
 // A level selection supersedes incompatible dependent selections.
 const levels=STUDENT_QUERY_FILTERS.level;
 for(const key of ['grade','type']){const valid=new Set(studentQueryGradeRows().filter(r=>!levels.length||levels.includes(r.level)).map(r=>r[key]));STUDENT_QUERY_FILTERS[key]=STUDENT_QUERY_FILTERS[key].filter(v=>valid.has(v));}
 originalQuery(button);
 for(const [key,id] of [['district','stuQDistrictMulti'],['public','stuQPublicMulti'],['level','stuQLevelMulti'],['type','stuQTypeMulti'],['grade','stuQGradeMulti']]){const open=$(id).classList.contains('open');renderStudentQueryMulti(key,id);if(open)$(id).classList.add('open');}
};
