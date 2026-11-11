/* Local, deterministic assistant. Statistical values come exclusively from authorized source adapters. */
(function(){'use strict';const C=window.DataAssistantCore,A=window.AssistantData,$=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),nf=new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2});let result=null,context=null,query='',filter='',sort='',direction=1,page=0,request=0,interpreter=null;
const root=document.createElement('section');root.id='data-assistant';root.className='page';$('units').parentElement.append(root);const nav=document.createElement('div');nav.className='nav';nav.dataset.page='data-assistant';nav.innerHTML='<span class="ico" aria-hidden="true">✦</span>Akıllı Veri Asistanı';nav.onclick=()=>window.show('data-assistant');document.querySelector('.side .nav[data-page="overview"]').after(nav);
root.innerHTML=`<div class="assistant-hero"><span class="assistant-symbol">✦</span><div><h2>Akıllı Veri Asistanı</h2><p>Yetkili olduğunuz gerçek verilerde Türkçe soru sorun; tabloları ve analizleri inceleyin.</p></div><span class="assistant-badge">Yerel Doğal Dil Sorgulama</span></div><form id="assistantForm"><label class="sr-only" for="assistantQuestion">Sorunuz</label><div class="assistant-search"><span aria-hidden="true">⌕</span><input id="assistantQuestion" autocomplete="off" placeholder="Örneğin: Atatürk İlkokulu öğrenci sayılarını sınıf bazlı ver"><button type="button" id="assistantClear" aria-label="Soruyu temizle">×</button><button class="btn" type="submit">Ara</button></div></form><div class="assistant-examples"><b>Örnek Sorular:</b>${['8. sınıf öğrenci sayısı','Norm açığı olan unvanlar','İlçelere göre öğrenci sayıları','Geçen dönemle karşılaştır','Derslik başına öğrenci'].map(q=>`<button type="button" data-example="${esc(q)}">${esc(q)}</button>`).join('')}</div><div id="assistantStatus" role="status" aria-live="polite"></div><div id="assistantResults"></div>`;
const question = $('assistantQuestion');
const suggestions = document.createElement('div');
suggestions.id = 'assistantSuggestions';
suggestions.className = 'assistant-suggestions';
suggestions.hidden = true;
suggestions.setAttribute('role', 'listbox');
suggestions.setAttribute('aria-label', 'Okul önerileri');
$('assistantForm').append(suggestions);
question.setAttribute('role', 'combobox');
question.setAttribute('aria-autocomplete', 'list');
question.setAttribute('aria-controls', suggestions.id);
question.setAttribute('aria-expanded', 'false');

let suggestionsVersion = 0, activeSuggestion = -1, schoolIndex, suggestedSchool;
function closeSuggestions() {
  suggestionsVersion++;
  activeSuggestion = -1;
  suggestions.hidden = true;
  suggestions.replaceChildren();
  question.setAttribute('aria-expanded', 'false');
  question.removeAttribute('aria-activedescendant');
}
function autocomplete() {
  closeSuggestions();
  const version = suggestionsVersion;
  const text = question.value;
  const caret = question.selectionStart ?? text.length;
  const before = text.slice(0, caret);
  if (!text.trim() || /\s$/.test(before) || !window.token?.() || !available()) return;
  window.setTimeout(async () => {
    if (version !== suggestionsVersion) return;
    const current = window.authUser?.();
    const period = $('periodSelect')?.value;
    if (!current || !period) return;
    const scope = current.uid + '|' + period;
    try {
      const data = typeof D === 'undefined' ? null : D;
      let records = data?.institutions || [];
      if (!records.length) {
        if (schoolIndex?.scope !== scope) {
          const entry = {scope, promise: A.model(period, 'Öğrenci sayısı').then(model => model.institutions)};
          schoolIndex = entry;
          entry.promise.catch(() => { if (schoolIndex === entry) schoolIndex = null; });
        }
        records = await schoolIndex.promise;
      }
      if (version !== suggestionsVersion || document.activeElement !== question) return;
      const starts = [...before.matchAll(/\S+/g)].slice(-5).map(match => match.index);
      for (const start of starts) {
        const fragment = before.slice(start);
        if (C.fold(fragment).length < 3 || /^(okul|kurum|ogrenci|ogretmen|sinif|bilgi|kac|toplam|derslik|sube)$/.test(C.fold(fragment))) continue;
        const matches = window.SchoolDetail.matches(records, fragment, 6)
          .filter(record => C.fold(record.name).startsWith(C.fold(fragment)) && C.fold(record.name) !== C.fold(fragment));
        if (!matches.length) continue;
        const suffix = text.slice(caret).replace(/^\S*/, '');
        for (const record of matches) {
          const option = document.createElement('button');
          option.type = 'button';
          option.id = 'assistantSuggestion' + suggestions.childElementCount;
          option.setAttribute('role', 'option');
          option.setAttribute('aria-selected', 'false');
          option.textContent = [record.name, record.district, record.code].filter(Boolean).join(' · ');
          option.onpointerdown = event => event.preventDefault();
          option.onclick = () => {
            const completed = before.slice(0, start) + record.name;
            question.value = completed + suffix;
            suggestedSchool = record;
            closeSuggestions();
            question.focus();
            question.setSelectionRange(completed.length, completed.length);
          };
          suggestions.append(option);
        }
        suggestions.hidden = false;
        question.setAttribute('aria-expanded', 'true');
        break;
      }
    } catch {
      closeSuggestions();
    }
  }, 180);
}
question.addEventListener('input', autocomplete);
question.addEventListener('blur', closeSuggestions);
question.addEventListener('keydown', event => {
  if (suggestions.hidden) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeSuggestions();
    return;
  }
  const options = [...suggestions.children];
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    activeSuggestion = activeSuggestion < 0 ? (event.key === 'ArrowDown' ? 0 : options.length - 1) :
      (activeSuggestion + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    options.forEach((option, index) => option.setAttribute('aria-selected', String(index === activeSuggestion)));
    question.setAttribute('aria-activedescendant', options[activeSuggestion].id);
    options[activeSuggestion].scrollIntoView({block: 'nearest'});
  } else if (event.key === 'Enter' && activeSuggestion >= 0) {
    event.preventDefault();
    options[activeSuggestion].click();
  }
});
function available(){return !nav.hidden;}
function status(text,error=false){$('assistantStatus').className=error?'assistant-error':'assistant-notice';$('assistantStatus').textContent=text;}
function invalidate(){closeSuggestions();schoolIndex=null;suggestedSchool=null;request++;result=null;context=null;$('assistantResults').replaceChildren();root.removeAttribute('aria-busy');root.querySelector('[type=submit]').disabled=false;status('Veri veya dönem değişti. Güncel sonuç için sorguyu yeniden çalıştırınız.');}
window.addEventListener('bbs-assistant-invalidated',invalidate);
async function submit(overrides={}){
closeSuggestions();const text=question.value.trim();if(!text)return;if(/sifre|parola|password|oturum|token|api anahtar|kullanici (adi|hesap|liste|sayisi)|yonetici hesabi|admin hesabi/.test(C.fold(text))){result=null;$('assistantResults').replaceChildren();status('Hesap, şifre ve oturum bilgileri asistan kapsamı dışındadır.',true);return;}
const chosen=overrides.institutionKey||!suggestedSchool||!C.fold(text).includes(C.fold(suggestedSchool.name))?
  overrides:{...overrides,institutionKey:C.identity(suggestedSchool)};
const id=++request;root.setAttribute('aria-busy','true');root.querySelector('[type=submit]').disabled=true;status('Kaynak kataloğu ve gerçek kayıtlar inceleniyor…');let providerWarning='';
try{await A.access();const periods=await A.periods();let selection=C.queryPeriods(text,periods,$('periodSelect')?.value);if(!selection.selected)throw Error('Sorgu için geçerli bir dönem bulunamadı.');const basis=await A.model(selection.selected.id,'Öğrenci sayısı');const exactSchool=window.SchoolDetail.matches(basis.institutions,text).some(r=>C.fold(r.name)===C.fold(text)||String(r.code)===text);const intent=exactSchool?text+' tüm bilgileri':text;const readCatalog=async period=>{try{return await A.catalog(period);}catch{return [];}};let catalog=await readCatalog(selection.selected.id);const prior=C.isFollowUp(text)?context:null,localPlan=C.groundedPlan(intent,catalog,null,prior),provisionalModel=localPlan.domain==='briefing'?await A.model(selection.selected.id,intent,prior,localPlan):basis,provisional=C.runQuery(localPlan,provisionalModel,null,chosen),evidence=C.groundingEvidence(provisional);let semantic=null;
try{semantic=await window.AssistantGemini.interpret(intent,{context:prior,periods,currentPeriod:selection.selected.id,fields:basis.fields,catalog,evidence});}catch(e){if(e.status===401||e.status===403)throw e;providerWarning=(e.message||'Gemini kullanılamıyor.')+' Yerel kaynak araması kullanıldı.';}
let canonical=semantic?.canonicalQuery||intent;if(semantic){selection=C.queryPeriods(canonical,periods,semantic.periodId);selection.selected=periods.find(p=>p.id===semantic.periodId);selection.previous=C.queryPeriods(canonical,periods,semantic.periodId).previous;if(selection.selected.id!==basis.period.id)catalog=await readCatalog(selection.selected.id);}
let proposed=null;
if(semantic){
  try{proposed=C.validatePlan(semantic.plan,basis,canonical);}
  catch{
    semantic=null;canonical=intent;
    selection=C.queryPeriods(intent,periods,$('periodSelect')?.value);
    catalog=await readCatalog(selection.selected.id);
    providerWarning='Yapay zekâ planı kaynaklarla eşleşmedi. Yerel kaynak araması kullanıldı.';
  }
}
const routingText=C.isDetailedQuery(intent)||C.matchSources(intent,catalog).length?intent:canonical;
const plan=C.groundedPlan(routingText,catalog,proposed,prior),model=await A.model(selection.selected.id,routingText,prior,plan);
let r=C.runQuery(plan,model,null,chosen);
if(r.plan?.compare&&['scalar','table'].includes(r.kind)){if(selection.previous){const oldModel=await A.model(selection.previous.id,routingText,r.plan,r.plan),old=C.runQuery({...r.plan,compare:false},oldModel,null,chosen);r=C.compareResults(r,old);}else r={...r,chart:null,warnings:[...(r.warnings||[]),'Karşılaştırılacak önceki dönem bulunamadı.']};}
if(id!==request)return;result=displayResult(r);query=text;filter='';sort='';page=0;if(['scalar','table','comparison'].includes(r.kind))context=r.plan;if(providerWarning)result.warnings=[...(result.warnings||[]),providerWarning];root.querySelector('.assistant-badge').textContent=semantic?'Gemini · Kaynaklarla Doğrulanmış':'Yerel Kaynak Araması';status(providerWarning&&!['scalar','table','comparison'].includes(r.kind)?providerWarning:'');render();
}catch(e){if(id===request){result=null;$('assistantResults').replaceChildren();status(e.message||'Sorgu çalıştırılamadı.',true);}}finally{if(id===request){root.removeAttribute('aria-busy');root.querySelector('[type=submit]').disabled=false;}}}
function displayResult(value) {
  if (value.kind === 'scalar' && value.metrics?.length === 1 && Number.isFinite(value.metrics[0].value)) {
    const metric = value.metrics[0];
    return {...value, kind: 'table', singleValue: true, columns: [['label','Gösterge'], ['display','Değer']],
      rows: [{label: metric.label, display: format(metric.value) + (metric.unit || ''), value: metric.value}],
      chart: {type: 'bar', title: 'Sorgu Sonucu', unit: metric.unit || '', hideTotal: true}};
  }
  if (value.kind !== 'table' || value.chart || value.rate || !value.rows?.length || value.plan?.domain !== 'briefing') return value;
  value = {...value, columns: value.columns.filter(([key]) => key !== 'address')};
  const numbers = value.rows.filter(row => Number.isFinite(row.numeric) && !row.isTotalRow && !row.isTotalColumn);
  const units = new Set(numbers.map(row => row.unit || ''));
  if (!numbers.length || units.size !== 1) return value;
  const rows = numbers.map(row => ({...row, label: [row.rowLabel, row.columnLabel].filter(Boolean).join(' · ') || row.address, value: row.numeric}));
  return {...value, chart: {type: 'bar', title: 'Sorgu Sonucundaki Sayısal Değerler', unit: [...units][0], hideTotal: true}, chartRows: rows};
}
function filtered(){let rows=(result?.rows||[]).filter(r=>!filter||C.fold((result.columns||[]).map(([k])=>r[k]).join(' ')).includes(C.fold(filter)));if(filter&&!result.rate&&!result.singleValue&&!result.nonAdditive&&rows.every(r=>typeof r.value==='number')){const total=rows.reduce((a,r)=>a+r.value,0);rows=rows.map(r=>({...r,percent:total?r.value/total*100:0}));}if(sort)rows=rows.slice().sort((a,b)=>direction*(typeof a[sort]==='number'&&typeof b[sort]==='number'?a[sort]-b[sort]:String(a[sort]??'').localeCompare(String(b[sort]??''),'tr')));return rows;}
function format(v){return typeof v==='number'?nf.format(v):String(v??'—');}
function card(m,big=false){return `<article class="assistant-metric ${big?'assistant-scalar':''}"><span>${esc(m.label)}</span><strong>${esc(format(m.value))}${esc(m.unit||'')}</strong></article>`;}
function render(){const out=$('assistantResults'),r=result;if(!r)return;if(r.kind==='choices'||r.kind==='table-choices'){out.innerHTML=`<div class="assistant-result-head"><h3>${esc(r.message||r.title||'Eşleşmeyi seçiniz')}</h3></div><div class="assistant-choices">${(r.choices||[]).map((v,i)=>`<button class="btn light" data-choice="${i}">${esc(v.name||v.title)} ${esc(v.district||v.sheet||'')} ${esc(v.code||'')}</button>`).join('')}</div>`;out.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{const v=r.choices[+b.dataset.choice];submit(r.kind==='choices'?{institutionKey:v.institutionKey}:{tableId:String(v.id)});});return;}if(!['scalar','table','comparison'].includes(r.kind)){out.innerHTML=`<p class="assistant-notice">${esc(r.message||r.title||'Bu sorgu için uygun veri bulunamadı.')}</p>`;return;}out.innerHTML=`<div class="assistant-result-head"><div><h3>${esc(r.title)}</h3><p>${esc(r.period?.name)}${r.period?.version?' · Sürüm '+esc(r.period.version):''}</p></div>${r.target?'<button class="btn" data-target="main">İlgili Ekrana Git ↗</button>':''}</div>${(r.warnings||[]).map(w=>`<p class="assistant-notice">${esc(w)}</p>`).join('')}<div class="assistant-metrics">${(r.metrics||[]).map(m=>card(m,r.kind==='scalar')).join('')}</div>${r.description?`<p>${esc(r.description)}</p>`:''}${r.kind==='scalar'?'':`<div class="assistant-tools"><label>Sonuçlarda filtrele <input id="assistantFilter" value="${esc(filter)}" placeholder="Tabloda ara…"></label><span id="assistantRowCount"></span><button class="btn light" data-export="csv">CSV</button><button class="btn light" data-export="xlsx">Excel</button><button class="btn light" data-export="pdf">PDF</button></div><div class="assistant-analysis"><article class="assistant-table-panel"><h3>Ayrıntılı Sonuçlar</h3><div class="tablewrap"><table class="table"><thead><tr>${r.columns.map(([k,l])=>`<th><button data-sort="${esc(k)}">${esc(l)} ↕</button></th>`).join('')}<th>Kaynak Ekran</th></tr></thead><tbody id="assistantBody"></tbody></table></div><div class="assistant-pages"><button class="btn light" id="assistantPrev">Önceki</button><span id="assistantPage"></span><button class="btn light" id="assistantNext">Sonraki</button></div></article><article class="assistant-chart-panel" id="assistantChart"></article></div>`}<p class="assistant-source"><b>Veri Kaynağı:</b> ${esc((r.sources||[]).join(' · ')||'Seçili dönemin yetkili kaynakları')} · ${esc(r.period?.name)}. Sonuçlar kaynak kayıtlardan hesaplanır; eksik alanlar tahmin edilmez.</p>`;
out.querySelector('[data-target=main]')?.addEventListener('click',()=>navigate(r.target));out.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{direction=sort===b.dataset.sort?-direction:1;sort=b.dataset.sort;table();});out.querySelectorAll('[data-export]').forEach(b=>b.onclick=()=>exportRows(b.dataset.export).catch(e=>status(e.message,true)));if(r.kind!=='scalar'){$('assistantFilter').oninput=e=>{filter=e.target.value;page=0;table();};$('assistantPrev').onclick=()=>{page--;table();};$('assistantNext').onclick=()=>{page++;table();};table();}}
function table(){const rows=filtered();root.querySelector('.assistant-metrics').innerHTML=result.overview?C.overviewMetrics(rows).map(m=>card(m)).join(''):filter&&!result.rate&&!result.singleValue&&!result.nonAdditive&&result.kind!=='comparison'&&rows.every(r=>typeof r.value==='number')?card({label:'Filtrelenen sonuçların toplamı',value:rows.reduce((a,r)=>a+r.value,0)}):(result.metrics||[]).map(m=>card(m)).join('');const pages=Math.max(1,Math.ceil(rows.length/25));page=Math.max(0,Math.min(page,pages-1));$('assistantBody').innerHTML=rows.slice(page*25,page*25+25).map((r,i)=>`<tr>${result.columns.map(([k])=>`<td class="${typeof r[k]==='number'?'num':''}">${esc(format(r[k]))}</td>`).join('')}<td>${r.target?`<button class="btn light" data-row="${page*25+i}">İlgili Ekrana Git</button>`:'—'}</td></tr>`).join('')||`<tr><td colspan="${result.columns.length+1}">Sonuç yok.</td></tr>`;$('assistantBody').querySelectorAll('[data-row]').forEach(b=>b.onclick=()=>navigate(rows[+b.dataset.row].target));$('assistantRowCount').textContent=rows.length+' sonuç';$('assistantPage').textContent=`${page+1} / ${pages}`;$('assistantPrev').disabled=page===0;$('assistantNext').disabled=page===pages-1;chart(rows);}
function chart(rows){const box=$('assistantChart');box.replaceChildren();if(result.chartRows){const shown=new Set(rows.map(r=>[r.table,r.address].join('|')));rows=result.chartRows.filter(r=>shown.has([r.table,r.address].join('|')));}if(result.overview)rows=C.overviewChart(rows);if(result.rate){const primary=rows.filter(r=>r.sourceKind==='Tablo'),shown=primary.length?primary:rows,max=Math.max(100,...shown.map(r=>r.value)),years=[...new Set(shown.map(r=>r.year))],height=Math.max(170,shown.length*35+30);if(!shown.length)return;box.innerHTML='<h3>'+esc(primary.length?'Kaynak Tablodaki Oranlar':'Kaynak Grafikteki Oranlar')+'</h3><div class="assistant-chart-scroll"><svg role="img" aria-label="Kaynak göstergelerinin yüzde oranları" viewBox="0 0 640 '+height+'">'+shown.map((r,i)=>'<text x="0" y="'+(i*35+22)+'" font-size="11">'+esc((r.year?r.year+' · ':'')+r.indicator)+'</text><rect x="275" y="'+(i*35+7)+'" width="'+Math.max(0,r.value)/max*285+'" height="21" rx="4" fill="'+(['#087ee5','#974de1','#17b49b'][years.indexOf(r.year)%3])+'"/><text x="'+(280+Math.max(0,r.value)/max*285)+'" y="'+(i*35+22)+'" font-size="12">'+esc(format(r.value))+'%</text>').join('')+'</svg></div><p>Oranlar toplanmaz. Tablo ve kaynak grafik değerleri birbirine karıştırılmaz.</p>';return;}if(!result.chart||!rows.length||rows.some(r=>typeof r.value!=='number'||!Number.isFinite(r.value)))return;const unit=result.chart.unit||'';const total=rows.reduce((a,r)=>a+r.value,0),type=result.chart.type,colors=['#087ee5','#974de1','#17b49b','#f39b30','#e2528d','#426ecb'];let svg='',height=300;const max=Math.max(...rows.map(r=>Math.abs(r.value)),1);if(type==='bar'||type==='ranked-bar'){height=Math.max(180,rows.length*34+25);svg=rows.map((r,i)=>`<text x="0" y="${i*34+22}" font-size="12">${esc(r.label)}</text><rect x="220" y="${i*34+6}" width="${Math.abs(r.value)/max*230}" height="21" rx="4" fill="${colors[i%6]}"/><text x="${225+Math.abs(r.value)/max*230}" y="${i*34+22}" font-size="12">${esc(format(r.value)+unit)}</text>`).join('');}else if(type==='donut'&&total>0&&rows.every(r=>r.value>=0)){let offset=0;svg=rows.map((r,i)=>{const percent=r.value/total*100,s=`<circle cx="130" cy="140" r="85" fill="none" stroke="${colors[i%6]}" stroke-width="33" pathLength="100" stroke-dasharray="${percent} ${100-percent}" stroke-dashoffset="${-offset}" transform="rotate(-90 130 140)"/><text x="260" y="${40+i*25}" font-size="12" fill="${colors[i%6]}">${esc(r.label)}: ${esc(format(r.value))} (%${nf.format(percent)})</text>`;offset+=percent;return s;}).join('')+`<text x="130" y="147" text-anchor="middle" font-size="23">${esc(format(total))}</text>`;height=Math.max(300,rows.length*25+50);}else if(type==='line'){svg=`<polyline points="${rows.map((r,i)=>`${70+i*380/Math.max(1,rows.length-1)},${230-r.value/max*170}`).join(' ')}" stroke="#087ee5" stroke-width="4" fill="none"/>`+rows.map((r,i)=>`<circle cx="${70+i*380/Math.max(1,rows.length-1)}" cy="${230-r.value/max*170}" r="6" fill="#087ee5"/><text x="${70+i*380/Math.max(1,rows.length-1)}" y="${215-r.value/max*170}" text-anchor="middle">${esc(format(r.value))}</text><text x="${70+i*380/Math.max(1,rows.length-1)}" y="265" text-anchor="middle" font-size="12">${esc(r.label)}</text>`).join('');}else if(type==='column'){const width=Math.max(560,rows.length*85);svg=rows.map((r,i)=>{const x=35+i*(width-50)/rows.length,w=(width-50)/rows.length*.65;return `<rect x="${x}" y="${230-r.value/max*175}" width="${w}" height="${Math.abs(r.value)/max*175}" rx="5" fill="#087ee5"/><text x="${x+w/2}" y="${220-r.value/max*175}" text-anchor="middle" font-size="12">${esc(format(r.value))}</text><text x="${x+w/2}" y="260" text-anchor="middle" font-size="11">${esc(r.label)}</text>`;}).join('');box.innerHTML=`<h3>Sınıflara Göre Dağılım</h3><svg role="img" aria-label="Tablodaki değerlerin sütun grafiği" viewBox="0 0 ${width} 300">${svg}</svg><p>Gösterilen toplam: ${esc(format(total))}</p>`;return;}else return;box.innerHTML=`<h3>${esc(result.chart.title||(type==='line'?'Dönem Karşılaştırması':'Veri Dağılımı'))}</h3><div class="assistant-chart-scroll"><svg role="img" aria-label="Tablodaki değerlerin grafiği" viewBox="0 0 560 ${height}">${svg}</svg></div>${result.chart.hideTotal?'':`<p>${type==='line'?'Dönem değerleri ayrı gösterilir; toplanmaz.':'Gösterilen toplam: '+esc(format(total))}</p>`}`;}
function download(bytes,type,name){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function exportRows(type){await A.access();const rows=filtered(),cols=result.columns,source=(result.sources||[]).join(' · ')+' · '+result.period.name;if(type==='csv'){const safe=v=>typeof v==='number'?v:String(v??'').replace(/^[=+@-]/,"'$&"),quote=v=>'"'+String(v).replace(/"/g,'""')+'"';download('\ufeff'+[[result.title],[source],cols.map(x=>x[1]),...rows.map(r=>cols.map(([k])=>safe(r[k])))].map(r=>r.map(quote).join(';')).join('\r\n'),'text/csv;charset=utf-8','Asistan.csv');}else if(type==='xlsx'){const wb=new ExcelJS.Workbook(),sheet=wb.addWorksheet('Sorgu Sonuçları');sheet.addRow([result.title]);sheet.addRow([source]);sheet.addRow(cols.map(x=>x[1]));rows.forEach(r=>sheet.addRow(cols.map(([k])=>r[k]??'')));sheet.views=[{state:'frozen',ySplit:3}];sheet.autoFilter={from:{row:3,column:1},to:{row:3,column:cols.length}};sheet.columns.forEach(c=>c.width=28);download(await wb.xlsx.writeBuffer(),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Asistan.xlsx');}else{const doc=new jspdf.jsPDF({orientation:'landscape'});doc.addFileToVFS('Report.ttf',BRIFING_REPORT_FONT);doc.addFont('Report.ttf','Report','normal');doc.addFont('Report.ttf','Report','bold');doc.setFont('Report');doc.setFontSize(13);doc.text(result.title,14,15);doc.setFontSize(8);doc.text(doc.splitTextToSize(source,265),14,23);doc.autoTable({startY:36,head:[cols.map(x=>x[1])],body:rows.map(r=>cols.map(([k])=>format(r[k]))),styles:{font:doc.getFont().fontName,fontSize:8},columnStyles:Object.fromEntries(cols.map(([k],i)=>[i,rows.some(r=>typeof r[k]==='number')?{halign:'right'}:{}]))});download(doc.output('arraybuffer'),'application/pdf','Asistan.pdf');}}
let sourceFrame=null;
async function ownSource(target){if(!sourceFrame){sourceFrame=document.createElement('iframe');sourceFrame.hidden=true;sourceFrame.title='Asistan salt okunur kaynak görüntüleyicisi';sourceFrame.src='units/index.html?mode=assistant-source';root.append(sourceFrame);}const frame=sourceFrame,start=Date.now();await new Promise((resolve,reject)=>{const send=()=>{if(frame!==sourceFrame)return reject(Error('Kaynak penceresi kapandı.'));if(frame.contentWindow?.__BBS_ASSISTANT_SOURCE_READY){frame.contentWindow.postMessage({type:'bbs-assistant-source',target},location.origin);resolve();return;}if(Date.now()-start>15000)return reject(Error('Kaynak penceresi açılamadı.'));setTimeout(send,100);};send();});}
window.addEventListener('bbs-assistant-invalidated',()=>sourceFrame?.contentWindow?.postMessage({type:'bbs-assistant-source-close'},location.origin));
async function navigate(t){try{const p=await A.access();if(!t||!['students','institutions','teachers','managers','other-statistics','units'].includes(t.page))throw Error('Kaynak ekran desteklenmiyor.');if(p.role!=='admin'&&!p.screens?.includes(t.page)){await ownSource(t);return;}if($('periodSelect').value!==t.period){await window.api('/api/select-period?folder='+encodeURIComponent(t.period));await window.loadTopPeriodSelect();await window.load();}await window.show(t.page);if(t.page==='other-statistics'||t.page==='units'){const frame=$(t.page).querySelector('iframe');const start=Date.now();const send=()=>{if(!$(t.page).classList.contains('active'))return;if(frame.contentWindow?.__BBS_UNIT_READY||t.page==='other-statistics'){frame.contentWindow.postMessage({type:t.page==='units'?'bbs-open-table':'bbs-assistant-open',unitId:t.unitId,tableId:t.tableId,address:t.address},location.origin);return;}if(Date.now()-start<15000)setTimeout(send,100);};send();}else if(t.page==='students'){window.clearStudentQuery();if(t.code){studentCode=String(t.code);studentDistrict=t.district||'';}else{studentCode='';studentDistrict='';}for(const k of ['district','grade','public'])STUDENT_QUERY_FILTERS[k]=t[k]?[k==='public'&&t[k]==='Resmî'?'Resmi':t[k]]:[];$('studentQueryTab')?.click();window.fillStudentQueryFilters();window.runStudentQuery(true);$('stuQTable')?.scrollIntoView({block:'start'});$('stuQTable')?.classList.add('assistant-cell-hit');}else window.applyAssistantModuleTarget(t);}catch(e){status(e.message,true);}}
let studentCode='',studentDistrict='';const originalStudentRows=window.studentQueryRows;window.studentQueryRows=function(){const rows=originalStudentRows.apply(this,arguments);return studentCode?rows.filter(r=>String(r.code)===studentCode&&(!studentDistrict||r.district===studentDistrict)):rows;};const clearStudent=window.clearStudentQuery;window.clearStudentQuery=function(){studentCode='';studentDistrict='';return clearStudent.apply(this,arguments);};$('stuQSearch')?.addEventListener('input',()=>{studentCode='';studentDistrict='';});
$('assistantForm').onsubmit=e=>{e.preventDefault();submit();};$('assistantClear').onclick=()=>{suggestedSchool=null;closeSuggestions();$('assistantQuestion').value='';$('assistantQuestion').focus();};root.querySelectorAll('[data-example]').forEach(b=>b.onclick=()=>{suggestedSchool=null;$('assistantQuestion').value=b.dataset.example;submit();});const show=window.show;window.show=async function(id){const value=await show.apply(this,arguments);if(id==='data-assistant'){try{await A.access();if(!result)status('Sorunuzu yazıp Ara düğmesine basınız. Devam sorularında önceki sorgunun bağlamı korunur.');}catch(e){invalidate();status(e.message,true);}}return value;};window.DataAssistant={available,open:async q=>{suggestedSchool=null;await window.show('data-assistant');$('assistantQuestion').value=q;return submit();},navigate,registerInterpreter:fn=>{if(typeof fn!=='function')throw Error('Yorumlayıcı bir işlev olmalı.');interpreter=fn;}};
})();
