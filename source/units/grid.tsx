import React from 'react';
import {Building2,Users,Coins,School,ClipboardList,House,Presentation,BookOpen,Monitor,ChartNoAxesCombined,Landmark,HeartHandshake,Globe} from 'lucide-react';
import {RecordItem,bounds,includes,colName,display,fold} from './types';
function indicatorIcon(label:string){
 const key=fold(label);
 if(/maliyet|butce|tutar|odenek|harcama|gelir/.test(key))return Coins;
 if(/lojman|konut/.test(key))return House;
 if(/spor|salon|saha/.test(key)&&!/konferans/.test(key))return Globe;
 if(/konferans|toplanti/.test(key))return Presentation;
 if(/derslik|sinif|okul/.test(key))return School;
 if(/personel|ogretmen|ogrenci|yonetici|katilan/.test(key))return Users;
 if(/proje|yatirim|calisma/.test(key))return ClipboardList;
 if(/dijital|teknoloji|bilgisayar|tahta|platform/.test(key))return Monitor;
 if(/kitap|kurs|egitim/.test(key))return BookOpen;
 return ChartNoAxesCombined;
}
function ReadableGrid({page,ranges}:{page:RecordItem;ranges:string[]}){
 const offset=page.rowOffset||4;
 const merges=page.merges.map(bounds).filter(Boolean) as NonNullable<ReturnType<typeof bounds>>[];
 const nonempty=(v:any)=>v!==null&&v!==undefined&&(typeof v!=='string'||(v.trim()!==''&&!/^(?:veri yok|bilgi yok|n\/a|[-—–])$/i.test(v.trim())));
 const visible=page.rows.map((row,i)=>({row,r:i+offset})).filter(({row,r})=>row.some((cell,c)=>nonempty(cell.v)&&includes(r,c,ranges))||merges.some(m=>r>=m.r1&&r<=m.r2&&includes(m.r1,m.c1,ranges)&&nonempty(page.rows[m.r1-offset]?.[m.c1]?.v)));
 const footnotes:string[]=[];
 const groups:typeof visible[]=[];
 let separated=true,lastNote=false;
 for(const item of visible){
  const cells=item.row.filter((cell,c)=>nonempty(cell.v)&&includes(item.r,c,ranges));
  const value=cells.length===1?String(cells[0].v):'';
  const note=cells.length===1&&(/^[*†‡]/.test(value.trim())||/^(not|kaynak|açıklama)\s*:/i.test(value.trim())||(lastNote&&/^[A-Z]$/.test(value.trim())));
  if(note){footnotes.push(value);separated=true;lastNote=true;continue}
  lastNote=false;
  const last=groups[groups.length-1];
  if(separated||!last||item.r>last[last.length-1].r+1)groups.push([item]);else last.push(item);
  separated=false;
 }
 const sections:{title:string;rows:typeof visible}[]=[];
 let pending='';
 for(const group of groups){
  let data=[...group];const first=data[0];
  const cells=first.row.map((cell,c)=>({cell,c})).filter(({cell,c})=>nonempty(cell.v)&&includes(first.r,c,ranges));
  if(cells.length===1&&typeof cells[0].cell.v==='string'&&String(cells[0].cell.v).length<180&&(data.length>1||groups.length>1)){
   const heading=display(cells[0].cell);data=data.slice(1);
   if(!data.length){if(pending)sections.push({title:pending,rows:[]});pending=heading;continue}
   if(pending)sections.push({title:pending,rows:[]});pending=heading;
  }
  sections.push({title:pending,rows:data});pending='';
 }
 if(pending)sections.push({title:pending,rows:[]});
 function indicatorData(section:typeof sections[number]){
  const columns=Array.from(new Set(section.rows.flatMap(({row,r})=>row.map((cell,c)=>nonempty(cell.v)&&includes(r,c,ranges)?c:-1).filter(c=>c>=0)))).sort((a,b)=>a-b);
  if(columns.length!==2)return null;
  let items=section.rows.filter(({row,r})=>columns.some(c=>includes(r,c,ranges)&&nonempty(row[c]?.v)));
  const first=items[0];let columnTitles='';
  if(first&&columns.every(c=>typeof first.row[c]?.v==='string')&&(/^(bilgi|gösterge|gosterge|veri|tür|tur|açıklama|aciklama)/i.test(String(first.row[columns[0]]?.v))||/^(veri|değer|deger|sayı|sayi|adet|toplam)$/i.test(String(first.row[columns[1]]?.v)))){columnTitles=columns.map(c=>display(first.row[c])).join(' · ');items=items.slice(1);}
  if(items.some(({row})=>!columns.every(c=>nonempty(row[c]?.v))))return null;
  if(items.length<2||items.some(({row,r})=>typeof row[columns[0]]?.v!=='string'||String(row[columns[0]].v).length>160||String(row[columns[1]]?.v??'').length>110||!columns.every(c=>includes(r,c,ranges))||merges.some(m=>m.r2>m.r1&&r>=m.r1&&r<=m.r2)))return null;
  const cards=items.filter(({row})=>nonempty(row[columns[1]]?.v)).map(({row,r})=>({label:display(row[columns[0]]),value:display(row[columns[1]]||{v:null}),r,columnTitles}));return cards.length?cards:null;
 }
 // All source structures share the presentation shell, including matrix and text pages.
 const hasIndicators=sections.length>0;
 const category=sections.filter(section=>!section.rows.length).map(section=>section.title).filter(Boolean);
 const CategoryIcon=/insaat|emlak|yatirim/.test(fold(category.join(' ')+' '+page.title))?Building2:Landmark;
 return <div className="readable-sheet"><div className={hasIndicators?'indicator-dashboard':'table-sections'}>{hasIndicators&&<aside className="indicator-sidebar"><div className="indicator-category"><CategoryIcon size={34}/><h3>{category[0]||'EĞİTİM BRİFİNGİ'}</h3></div><div className="indicator-story"><HeartHandshake size={56}/>{category.slice(1).map((title,i)=><h4 key={i}>{title}</h4>)}<p>{page.description||'Muğla İl Millî Eğitim Müdürlüğü'}</p><span className="indicator-red-rule"/><small>Brifing Bilgi Sistemi</small></div></aside>}<div className={hasIndicators?'indicator-main':'table-sections'}>{sections.map((section,index)=>{
  const indicators=indicatorData(section);
  if(!section.rows.length)return <section className="indicator-section" key={index}><h3>{section.title}</h3></section>;
  if(indicators)return <section className="indicator-section" data-automatic="indicators" key={index}><h3><ChartNoAxesCombined size={25}/>{section.title||page.title}</h3>{indicators[0]?.columnTitles&&<p className="indicator-fields">{indicators[0].columnTitles}</p>}<div className="indicator-cards">{indicators.map((item,i)=>{
   const Icon=indicatorIcon(item.label);const parts=item.value.match(/^([\d.,]+)\s+(\(.+|\+.+)$/);
   const value=parts?parts[1]:item.value;const note=parts?parts[2]:'';
   return <article className={'indicator-card '+(i%2?'indicator-blue':'indicator-red')} key={item.r}><span className="indicator-icon"><Icon size={28}/></span><div className="indicator-content"><h4>{item.label}</h4><span className="indicator-line"/><strong className={(value.length>13?'indicator-long ':'')+(!value?'indicator-missing':'')}>{value}</strong>{note&&<small>{note}</small>}</div><Icon className="indicator-watermark" aria-hidden="true"/></article>
  })}</div></section>;
  const data=section.rows;
  let cols=Array.from({length:Math.max(1,...data.map(({row})=>row.length))},(_,c)=>c).filter(c=>data.some(({row,r})=>includes(r,c,ranges)&&nonempty(row[c]?.v)));
  const first=data[0];const values=first?cols.map(c=>first.row[c]).filter(cell=>nonempty(cell?.v)):[];
  const header=values.length>1&&values.every(cell=>typeof cell.v==='string')&&(values.some(cell=>cell.bold)||values.some(cell=>/^(bilgi|veri|ilçe|ilce|resm|özel|toplam|açıklama|sıra|branş|okul tür)/i.test(String(cell.v))));
  let headerEnd=first?.r||0;
  if(header){let end=headerEnd;do{end=headerEnd;for(const m of merges)if(m.r1<=headerEnd&&m.r2>=first.r)headerEnd=Math.max(headerEnd,m.r2)}while(end!==headerEnd)}
  if(header){const numeric=data.find(item=>item.r>first.r&&item.row.some((cell,c)=>includes(item.r,c,ranges)&&typeof cell.v==='number'));if(numeric)headerEnd=Math.min(headerEnd,numeric.r-1)}
  const headings=header?data.filter(item=>item.r<=headerEnd):[];
  let body=data.slice(headings.length);

  const populated=data.map(({row,r})=>row.map((cell,c)=>({cell,c})).filter(({cell,c})=>nonempty(cell.v)&&includes(r,c,ranges)));
  if(populated.length&&populated.every(cells=>cells.length<=1))return <section className="indicator-section brief-narrative-section" data-automatic="narrative" key={index}><h3><BookOpen size={25}/>{section.title||page.title}</h3><div className="brief-narrative">{populated.map((cells,i)=>cells.length>0&&<p key={data[i].r} className={cells[0].cell.bold?'brief-narrative-emphasis':''}>{display(cells[0].cell)}</p>)}</div></section>;
  const recordCards=header&&headings.length===1&&cols.length>=3&&cols.length<=7&&body.length>0&&body.length<=48&&cols.every(c=>nonempty(first.row[c]?.v))&&body.every(({row,r})=>includes(r,cols[0],ranges)&&typeof row[cols[0]]?.v==='string'&&nonempty(row[cols[0]]?.v)&&!merges.some(m=>r>=m.r1&&r<=m.r2&&cols.some(c=>c>=m.c1&&c<=m.c2)));
  if(recordCards)return <section className="indicator-section brief-record-section" data-automatic="records" key={index}><h3><ChartNoAxesCombined size={25}/>{section.title||page.title}</h3><p className="indicator-fields">{display(first.row[cols[0]])}</p><div className="brief-record-cards">{body.map(({row,r},i)=>{
   const label=display(row[cols[0]]);const Icon=indicatorIcon(section.title+' '+page.title);const total=fold(label).includes('toplam');
   return <article className={'brief-record-card '+(total?'brief-record-total':'')} key={r}><header><span className={'brief-record-icon '+(i%2?'record-blue':'')}><Icon size={24}/></span><h4>{label}</h4></header><dl>{cols.slice(1).filter(c=>includes(r,c,ranges)).map(c=><div key={c}><dt>{display(first.row[c])}</dt><dd>{display(row[c]||{v:null})}</dd></div>)}</dl></article>
  })}</div></section>;
  function renderRow(item:typeof visible[number],isHeader=false){
   const {row,r}=item;const total=String(row[cols[0]]?.v||'').toLocaleLowerCase('tr-TR').includes('toplam');
   return <tr key={r} className={total?'readable-total':''}>{cols.map((c,i)=>{
    const merge=merges.find(m=>r>=m.r1&&r<=m.r2&&c>=m.c1&&c<=m.c2);
    const whole=merge&&!(header&&merge.r1<=headerEnd&&merge.r2>headerEnd)&&cols.includes(merge.c1)&&data.filter(x=>x.r>=merge.r1&&x.r<=merge.r2).every(x=>includes(x.r,merge.c1,ranges));
    if(whole&&(r!==merge.r1||c!==merge.c1))return null;
    const cell=row[c]||{v:null};const allowed=includes(r,c,ranges);const value=allowed?display(cell):'';
    const Tag=isHeader?'th':'td';
    return <Tag key={c} scope={isHeader?'col':undefined} colSpan={whole?cols.filter(x=>x>=merge.c1&&x<=merge.c2).length:1} rowSpan={whole?data.filter(x=>x.r>=merge.r1&&x.r<=merge.r2).length:1} className={i===0?'readable-label':''} style={{fontWeight:cell.bold?700:undefined}}>{isHeader?value:!allowed||!nonempty(cell.v)?'':i===0?value:<span className="readable-value">{value}</span>}</Tag>
   })}</tr>
  }
  return <section className="readable-table-card brief-matrix-section" data-automatic="matrix" key={index}><h3><ChartNoAxesCombined size={25}/>{section.title||page.title}</h3>{data.length>0&&<div className="readable-table-scroll"><table className="sheet-grid readable-table">{header&&<thead>{headings.map(item=>renderRow(item,true))}</thead>}<tbody>{body.map(item=>renderRow(item))}</tbody></table></div>}</section>
 })}{footnotes.length>0&&<section className="brief-footnotes" aria-label="Tablo açıklamaları">{footnotes.map((note,i)=><p key={i}>{note}</p>)}</section>}</div></div></div>
}
export default function Grid({page,ranges=['*'],select,selected}:{page:RecordItem;ranges?:string[];select?:(r:number,c:number)=>void;selected?:string}){
 if(!select)return <ReadableGrid page={page} ranges={ranges}/>;
 const offset=page.rowOffset||4;const rows=page.rows;let max=0;rows.forEach(row=>row.forEach((c,i)=>{if(c.v!==null&&c.v!=='')max=Math.max(max,i+1)}));max=Math.max(1,max);
 const cols=Array.from({length:max},(_,i)=>i).filter(c=>rows.some((_,i)=>includes(i+offset,c,ranges)));
 const merges=page.merges.map(bounds).filter(Boolean) as NonNullable<ReturnType<typeof bounds>>[];
 return <div className={'sheet-scroll '+(select?'selectable':'')}><table className="sheet-grid"><thead><tr><th className="rowno">#</th>{cols.map(c=><th key={c}>{colName(c)}</th>)}</tr></thead><tbody>{rows.map((row,i)=>{const r=i+offset;if(!cols.some(c=>includes(r,c,ranges)))return null;return <tr key={r}><th className="rowno">{r}</th>{cols.map(c=>{const merge=merges.find(m=>r>=m.r1&&r<=m.r2&&c>=m.c1&&c<=m.c2);const whole=merge&&cols.filter(x=>x>=merge.c1&&x<=merge.c2).length===merge.c2-merge.c1+1&&Array.from({length:merge.r2-merge.r1+1},(_,n)=>n+merge.r1).every(rr=>includes(rr,merge.c1,ranges));if(!select&&whole&&(r!==merge.r1||c!==merge.c1))return null;const cell=row[c]||{v:null};const allowed=includes(r,c,ranges);const hi=selected&&includes(r,c,[selected]);return <td key={c} colSpan={!select&&whole?merge.c2-merge.c1+1:1} rowSpan={!select&&whole?merge.r2-merge.r1+1:1} className={(hi?'selected ':'')+(!allowed?'excluded':'')} style={{fontWeight:cell.bold?700:400}} onClick={()=>select?.(r,c)} title={colName(c)+r}>{allowed?display(cell):''}</td>})}</tr>})}</tbody></table></div>
}
