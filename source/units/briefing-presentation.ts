import PptxGenJS from 'pptxgenjs';
import {download} from './export';
import {bounds, display, includes} from './types';

type Page = {id:string; title:string; unitNames:string; description?:string; rowOffset:number;
  rows:Parameters<typeof display>[0][][]; ranges:string[]; sheet:string; images?:string[]; charts?:any[]};
type Options = {period:string; unitCount:number; draft:boolean; date?:string};
type Images = {background:string; cover:string};
type Block = {title:string; rows:string[][]; header:boolean};
type Slide = ReturnType<PptxGenJS['addSlide']>;
const navy = '06376A', ink = '06275A', red = 'E50020', muted = '53708F', pale = 'F0F5FB';
const bodyTop = 2.24, bodyHeight = 4.48;

function blocks(page:Page):Block[] {
  const groups:Page['rows'][] = [];
  let group:Page['rows'] = [];
  const hasValue = (cell:Page['rows'][number][number]) => cell?.v != null && String(cell.v).trim() !== '';
  page.rows.forEach((row, index) => {
    const scoped = row.map((cell, column) => includes(index + (page.rowOffset || 4), column, page.ranges) ? cell : {v:null});
    if (scoped.some(hasValue)) group.push(scoped);
    else if (group.length) {groups.push(group); group = [];}
  });
  if (group.length) groups.push(group);
  const result:Block[] = [];
  let heading = '';
  for (const rows of groups) {
    const first = rows[0].filter(hasValue);
    if (first.length === 1 && typeof first[0].v === 'string' && first[0].v.length < 150 && (rows.length > 1 || groups.length > 1)) {
      if (heading) result.push({title:page.title, rows:[[heading]], header:false});
      heading = display(first[0]);
      rows.shift();
    }
    if (!rows.length) continue;
    const columns = Array.from({length:Math.max(...rows.map(row => row.length))}, (_, column) => column)
      .filter(column => rows.some(row => hasValue(row[column])));
    const labels = rows[0].filter(hasValue);
    const header = labels.length > 1 && labels.every(cell => typeof cell.v === 'string') &&
      (labels.some(cell => cell.bold) || labels.some(cell => /^(bilgi|veri|gösterge|ilçe|sıra|branş|okul tür)/i.test(String(cell.v))));
    result.push({title:heading || page.title, rows:rows.map(row => columns.map(column => display(row[column]))), header});
    heading = '';
  }
  if (heading) result.push({title:page.title, rows:[[heading]], header:false});
  return result;
}

function box(slide:Slide, x:number, y:number, w:number, h:number, fill:string, border?:string) {
  slide.addShape('rect', {x,y,w,h,fill:{color:fill},line:{color:border || fill, width:border ? .7 : 0}});
}

function label(slide:Slide, text:string, x:number, y:number, w:number, h:number, fontSize:number, color=navy, bold=false, valign:'top'|'mid'='mid') {
  slide.addText(text, {x,y,w,h,fontFace:'Arial',fontSize,color,bold,margin:0,fit:'shrink',valign,lang:'tr-TR'});
}

function wrap(text:string, max:number):string[] {
  return text.split(/\r?\n/).flatMap(paragraph => {
    const lines:string[] = [];
    let line = '';
    for (const token of paragraph.split(/\s+/)) {
      for (const word of token.match(new RegExp('.{1,' + max + '}', 'gu')) || []) {
        if (line && line.length + word.length + 1 > max) {lines.push(line); line = '';}
        line += (line ? ' ' : '') + word;
      }
    }
    return [...lines,line];
  });
}

function tables(block:Block, newSlide:()=>Slide) {
  const count = block.rows[0].length;
  const bands = count <= 6 ? [Array.from({length:count}, (_, i) => i)] :
    Array.from({length:Math.ceil((count-1)/4)}, (_, band) => [0,...Array.from({length:Math.min(4,count-1-band*4)}, (_, i) => band*4+i+1)]);
  for (const band of bands) {
    const weights = band.map(column => Math.pow(Math.max(8, ...block.rows.map(row => Math.min(55,row[column].length))), .6));
    const widths = weights.map(value => 12.08 * value / weights.reduce((sum, weight) => sum + weight, 0));
    const rows = block.rows.map(row => band.map((column, i) => wrap(row[column], Math.max(8, Math.floor(widths[i] * 8.4)))));
    const header = block.header ? rows.shift() : undefined;
    const headerHeight = header ? Math.min(1.35, Math.max(.43, Math.max(...header.map(lines => lines.length)) * .22 + .14)) : 0;
    const entries = rows.flatMap(cells => {
      const maxLines = Math.max(...cells.map(lines => lines.length));
      return Array.from({length:Math.ceil(maxLines / 9)}, (_, part) => {
        const values = cells.map(lines => lines.slice(part*9,part*9+9));
        return {values, h:Math.max(.43, Math.max(...values.map(lines => lines.length)) * .23 + .12)};
      });
    });
    let batch:typeof entries = [];
    let used = headerHeight;
    const flush = () => {
      const slide = newSlide();
      const all = header ? [{values:header,h:headerHeight},...batch] : batch;
      slide.addTable(all.map((row, i) => row.values.map(lines => ({
        text:lines.join('\n'), options:{color:header && i===0 ? 'FFFFFF' : navy,
          bold:!!header && i===0, fill:{color:header && i===0 ? navy : i%2 ? 'FFFFFF' : pale},
          fontSize:header && i===0 && headerHeight >= 1.35 ? 10 : header && i===0 ? 13.5 : 15},
      }))), {x:.62,y:bodyTop,w:12.08,colW:widths,rowH:all.map(row => row.h),fontFace:'Arial',margin:[4,6,4,6],
        valign:'mid',border:{type:'solid',pt:.6,color:'DEE7F0'},autoPage:false});
      batch=[]; used=headerHeight;
    };
    for (const entry of entries) {
      if (batch.length && used + entry.h > bodyHeight) flush();
      batch.push(entry);
      used += entry.h;
    }
    if (batch.length || header) flush();
  }
}

function narrative(block:Block, newSlide:()=>Slide) {
  const lines = block.rows.flatMap(([text]) => [...wrap(text, 92), '']);
  for (let i=0; i<lines.length; i+=13) {
    const text = lines.slice(i,i+13).join('\n').trim();
    if (!text) continue;
    const slide = newSlide();
    box(slide,.54,bodyTop,12.08,bodyHeight,'F5F8FC','DEE7F0');
    box(slide,.54,bodyTop,.04,bodyHeight,red);
    label(slide,text,.70,bodyTop+.12,11.73,bodyHeight-.24,18);
  }
}

function indicators(block:Block, newSlide:()=>Slide) {
  const rows = block.rows.slice(block.header ? 1 : 0);
  if (!rows.length || rows.some(([name,value]) => !name || !value || name.length > 120 || value.length > 60)) return false;
  const columns = rows.some(([name,value]) => name.length > 55 || value.length > 25) ? 2 : 3;
  const w = (12.08 - .18*(columns-1))/columns;
  for (let start=0; start<rows.length; start+=columns*2) {
    const slide = newSlide();
    rows.slice(start,start+columns*2).forEach(([name,value],i) => {
      const x = .62+i%columns*(w+.18), y=bodyTop+Math.floor(i/columns)*2.12, color=i%2 ? navy : red;
      box(slide,x,y,w,1.96,pale,'DEE7F0');
      box(slide,x,y,.05,1.96,color);
      label(slide,name,x+.18,y+.12,w-.36,.72,16,navy,true);
      label(slide,value,x+.18,y+.87,w-.36,.94,value.length > 18 ? 18 : 26,color,true);
    });
  }
  return true;
}

function chartData(chart:any, page:Page, pages:Page[]) {
  function read(reference:string, fallback:unknown[]) {
    const match = reference?.match(/^(?:'(.+)'|([^!]+))!(.+)$/);
    const source = match ? (page.sheet === (match[1] || match[2]).replace(/''/g,"'") ? page :
      pages.find(item => item.sheet === (match[1] || match[2]).replace(/''/g,"'"))) : null;
    const range = match && bounds(match[3]);
    if (!source || !range) return !reference && page.ranges.includes('*') ? fallback || [] : [];
    const values:unknown[] = [];
    for (let row=range.r1;row<=range.r2;row++) for (let col=range.c1;col<=range.c2;col++) {
      if (!includes(row,col,source.ranges)) return [];
      values.push(source.rows[row-(source.rowOffset || 4)]?.[col]?.v ?? null);
    }
    return values;
  }
  return (chart.series || []).flatMap((series:any) => {
    const labels = read(series.catRef,series.categories), values = read(series.valRef,series.values);
    const points = values.flatMap((value,i) => value != null && value !== '' && Number.isFinite(Number(value)) ?
      [{label:String(labels[i] ?? i+1), value:Number(value)}] : []);
    if (!points.length || (series.catRef && !labels.length)) return [];
    return [{name:series.label || chart.title || 'Veri', labels:points.map(p => p.label), values:points.map(p => p.value)}];
  });
}

export async function buildBriefingPresentation(pages:Page[], name:string, options:Options, images:Images, progress=(n:number)=>{}) {
  const ppt = new PptxGenJS();
  ppt.layout = 'LAYOUT_WIDE';
  ppt.author = 'Muğla İl Millî Eğitim Müdürlüğü';
  ppt.title = name;
  ppt.defineSlideMaster({title:'BRIFING',background:{data:images.background}});
  let pageNumber = 0;
  const add = (title?:string, subtitle='') => {
    const slide = ppt.addSlide({masterName:'BRIFING'});
    if (title) {
      box(slide,.40,1.20,12.54,5.71,'FFFFFF');
      label(slide,title,.54,1.24,12.08,.57,title.length > 90 ? 16.5 : 21,ink,true,'top');
      label(slide,subtitle,.54,1.85,11.88,.23,9.75,muted);
      box(slide,.54,2.09,.89,.04,red);
    }
    label(slide,String(++pageNumber),12.45,7.17,.40,.21,10.5,navy,true);
    return slide;
  };
  const cover = add();
  box(cover,.40,1.59,12.54,5.21,'FFFFFF');
  label(cover,'BRİFİNG BİLGİ SİSTEMİ',.62,1.86,7.19,.36,15,red,true);
  label(cover,name,.62,2.45,6.88,2.16,name.length > 65 ? 25.5 : 32.25,ink,true,'top');
  box(cover,.62,4.70,1.12,.05,red);
  label(cover,options.period + (options.draft ? ' · Güncel Taslaklar' : ''),.62,5,6.88,.42,18,navy,true);
  label(cover,pages.length+' BRİFİNG SAYFASI     •     '+options.unitCount+' BİRİM',.62,5.78,6.77,.42,16.5,navy,true);
  label(cover,options.date || new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date()),.62,6.35,6.77,.26,12.75,muted);
  cover.addImage({data:images.cover,x:7.92,y:2.71,w:4.64,h:2.80});
  for (const [index,page] of pages.entries()) {
    const context = [page.unitNames, options.period, options.draft ? 'Taslak' : 'Onaylı'].filter(Boolean).join(' · ');
    const start = pageNumber;
    const content = blocks(page);
    if (page.description?.trim()) content.push({title:page.title, rows:[[page.description]], header:false});
    for (const block of content) {
      const newSlide = () => add(block.title, block.title === page.title ? context : page.title+' · '+context);
      if (block.rows[0].length === 1) narrative(block,newSlide);
      else if (block.rows[0].length !== 2 || !indicators(block,newSlide)) tables(block,newSlide);
    }
    for (const chart of page.charts || []) {
      const series = chartData(chart,page,pages);
      if (!series.length) continue;
      const slide = add(chart.title || page.title,context);
      slide.addChart(chart.type==='pie' ? 'pie' : chart.type==='line' ? 'line' : 'bar',series,
        {x:.62,y:bodyTop,w:12.08,h:bodyHeight,chartColors:[navy,red,'198B63','B77917','7054A5'],
          showLegend:series.length > 1 || chart.type==='pie',legendFontFace:'Arial',catAxisLabelFontFace:'Arial',catAxisLabelFontSize:10});
    }
    for (const data of page.ranges.includes('*') ? page.images || [] : []) {
      if (!/^data:image\/(png|jpeg|jpg);base64,/.test(data)) continue;
      const image = new Image();
      image.src = data;
      await image.decode();
      const frameWidth = 12.08;
      const scale = Math.min(frameWidth / image.naturalWidth, bodyHeight / image.naturalHeight);
      const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
      const slide = add(page.title,context);
      slide.addImage({data,x:.62+(frameWidth-w)/2,y:bodyTop+(bodyHeight-h)/2,w,h});
    }
    if (pageNumber === start) label(add(page.title,context),'Seçili aralıkta gösterilecek veri bulunamadı.',.62,bodyTop,12,.40,15);
    progress(Math.round((index+1)/pages.length*90));
    await new Promise(resolve => setTimeout(resolve,0));
  }
  return ppt;
}

async function imageData(file:string):Promise<string> {
  const response = await fetch(new URL('../assets/'+file,document.baseURI));
  if (!response.ok) throw Error('Sunum teması yüklenemedi.');
  const blob = await response.blob();
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(Error('Sunum teması okunamadı.'));
    reader.readAsDataURL(blob);
  });
}

export async function exportBriefingPresentation(pages:Page[], name:string, options:Options, progress:(n:number)=>void) {
  const [background,cover] = await Promise.all([imageData('briefing-slide-background.png'),imageData('briefing-cover-mugla.jpg')]);
  const ppt = await buildBriefingPresentation(pages,name,options,{background,cover},progress);
  progress(94);
  const blob = await ppt.write({outputType:'blob'}) as Blob;
  download(blob,name.replace(/[<>:"/\\|?*]/g,'-').slice(0,100)+'.pptx');
  progress(100);
}
