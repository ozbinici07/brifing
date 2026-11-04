/* Reference icons and lightweight DOM layout; original data nodes keep their IDs. */
(() => {
'use strict';
const paths = {
 school:'M3 22V10l9-7 9 7v12M1 22h22M9 22v-6h6v6M5 12h2v3H5zM17 12h2v3h-2zM10 8h4v3h-4zM2 8l10-7 10 7',
 building:'M4 22V4h10v18M14 9h6v13M1 22h22M7 7h3v3H7zM7 13h3v3H7zM8 22v-3M17 12h1v2h-1zM17 17h1v2h-1z',
 institution:'M3 22V9h7v13M10 22V3h8v19M18 12h4v10M1 22h22M5 12h2M5 16h2M12 6h3M12 10h3M12 14h3M13 22v-4M20 15h1M20 18h1',
 cap:'m1 8 11-6 11 6-11 6L1 8Zm4 3v7l7 4 7-4v-7M23 8v9',
 people:'M8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20v-3a5 5 0 0 1 10 0v3H2Zm10-8a5 5 0 0 1 10 5v3h-7M11 9h2',
 teacher:'M9 3h13v13h-7M9 3v5M18 16l3 5M17 16v5M6 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM1 22v-3a5 5 0 0 1 10 0v3H1Zm11-12 5-4M16 6h2v2',
 book:'M12 5C8 2 3 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-4-2-7-1-10 1ZM12 5v16M5 7l4 1M5 11l4 1M5 15l4 1M15 8l4-1M15 12l4-1M15 16l4-1',
 pie:'M12 2v10h10A10 10 0 0 0 12 2ZM9 3a10 10 0 1 0 12 12H9V3Z',
 target:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0ZM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
 check:'m4 12 5 5L21 5', alert:'M12 3v12M12 20v1',
 pin:'M12 22s8-9 8-14a8 8 0 1 0-16 0c0 5 8 14 8 14ZM15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 layers:'m2 7 10-5 10 5-10 5L2 7Zm0 5 10 5 10-5M2 17l10 5 10-5',
 chart:'M3 3v18h18M7 17v-6M12 17V6M17 17V9'
};
function icon(name){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+paths[name]+'"/></svg>';}
function addIcon(card,className,name){if(card.querySelector('.'+className))return;const el=document.createElement('span');el.className=className;el.innerHTML=icon(name);card.prepend(el);}
function overview(){
 const school=document.querySelector('#overview .school-category');
 if(school){
  for(const split of school.querySelectorAll('.overview-split-card')){
   if(split.querySelector('.reference-school-total'))continue;
   const count=split.querySelector('strong');if(!count)continue;
   const box=document.createElement('div');box.className='reference-school-total';box.innerHTML=icon(split.classList.contains('kurum')?'institution':'school')+'<div></div>';
   count.before(box);box.lastElementChild.append(count);const label=document.createElement('label');label.textContent=split.classList.contains('kurum')?'Kurum':'Okul';box.lastElementChild.append(label);
  }
  if(!school.querySelector('.reference-school-heading')){const heading=document.createElement('h4');heading.className='reference-school-heading';heading.textContent='Türlerine Göre Okul ve Kurumlar';school.querySelector('.category-metrics').append(heading);}
 }
 document.querySelectorAll('#overview .overview-split-counts>div,#overview .category-metric:not(:first-child)').forEach(card=>{const label=card.textContent;addIcon(card,'reference-metric-icon',card.closest('.school-category')?(/Kurum/.test(label)?'institution':'school'):'people');});
 const teacher=document.querySelector('#overview .teacher-category');
 if(teacher&&!teacher.querySelector(':scope>h4')){const h=document.createElement('h4');h.textContent='Eğitim Kademelerine Göre Öğretmenler';teacher.querySelector('.overview-levels').before(h);}
 document.querySelectorAll('#overview .overview-level-card').forEach(card=>{const label=card.querySelector('h4')?.textContent||'';addIcon(card,'reference-level-icon',/Öncesi/.test(label)?'people':/öğretim/.test(label)?'cap':/Kurum/.test(label)?'school':'book');});
}
function decorate(){
 overview();
 document.querySelectorAll('#overview .category-icon,.module-kpi-icon,.module-chart-icon,#overview .reference-chart h3>span').forEach(el=>{
  if(el.dataset.referenceIcon)return;el.dataset.referenceIcon='1';
  const card=el.closest('.student-summary-item'),text=card?.querySelector('.summary-label')?.textContent||el.closest('h3')?.textContent||el.closest('.category-head')?.textContent||'';
  let key='people';
  if(/Unvan/.test(text))key='people';else if(/Norm/.test(text))key='target';else if(/Mevcut/.test(text))key='check';else if(/İhtiyaç/.test(text))key='alert';else if(/İlçelere/.test(text))key='pin';else if(/Türlerine Göre/.test(text))key=/Okul Türlerine/.test(text)?'chart':'layers';else if(!card&&/Dağılım/.test(text))key='pie';else if(/Kademe|Öğrenci/.test(text))key='cap';else if(/Öğretmen Bilgileri|Toplam Öğretmen/.test(text))key='teacher';else if(/Okul/.test(text))key='school';else if(/Resmî|Özel|Kurum/.test(text))key='building';else if(text==='Toplam')key='cap';
  el.innerHTML=icon(key);
 });
}
decorate();let queued=false;
new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;decorate();});}).observe(document.querySelector('.content'),{childList:true,subtree:true});
})();
