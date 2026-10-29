(function(){
const cache=new Map();
window.canonicalGradeBranches=r=>{if(r._canonicalBranches)return r._canonicalBranches;const out=Array(14).fill(null),g=r.grade_branches||[];if(String(r.source||'').startsWith('Temel')){for(let i=0;i<9;i++)out[i]=g[i]??null;}else for(let i=1;i<6;i++)out[i+8]=g[i]??null;return out;};
window.branchTotal=rows=>rows.length&&rows.every(r=>r.branches!=null)?nf.format(rows.reduce((a,r)=>a+r.branches,0)):'Veri yok';
window.enrichStudentBranches=async(p,data,files)=>{
 if(['basic','secondary'].every(k=>!data[k]?.length||data[k].every(r=>r.grade_branches)))return;
 const key=p.folder+'/'+p.latestVersion;
 if(!cache.has(key))cache.set(key,(async()=>{const parsed={};for(const f of await files()){if(f.category!=='students')continue;const part=await window.__brifingExcelParser.parseUploaded('students',[new File([f.blob],f.name,{type:f.type})]);for(const kind of ['basic','secondary'])if(part[kind])parsed[kind]=part[kind].rows;}return parsed;})());
 try{const parsed=await cache.get(key);for(const kind of ['basic','secondary']){const sources=parsed[kind]||[];const used=new Set();for(const r of data[kind]||[]){if(r.grade_branches)continue;const i=sources.findIndex((x,i)=>!used.has(i)&&String(x.code)===String(r.code)&&x.name===r.name&&String(x.type)===String(r.type)&&JSON.stringify(x.grade_students)===JSON.stringify(r.grade_students));if(i>=0){used.add(i);r.grade_branches=sources[i].grade_branches;}}}}catch(e){cache.delete(key);console.warn('Şube verisi okunamadı:',e.message);}
};
const original=window.runStudentQuery;window.runStudentQuery=function(...args){const result=original(...args);const rows=studentQueryExportRows().rows;if($('stuQBranches'))$('stuQBranches').textContent=branchTotal(rows);return result;};
})();
