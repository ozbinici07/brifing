import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import {download} from './export';
import {bounds, display, fold, includes} from './types';

type Page = {id:string; title:string; unitNames:string; description?:string; rowOffset:number;
  rows:Parameters<typeof display>[0][][]; ranges:string[]; sheet:string; images?:string[]; charts?:any[]};
type Options = {period:string; unitCount:number; draft:boolean; date?:string};
type Images = {background:string; cover:string; logo:string};
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
  const dense = block.rows.length > 10;
  const bodyFont = dense ? 11.5 : 15, headerFont = dense ? 11 : 13.5;
  const lineHeight = dense ? .173 : .23;
  const padding = dense ? .07 : .12;
  const minimumRowHeight = dense ? .27 : .43;
  const bands = count <= 6 ? [Array.from({length:count}, (_, i) => i)] :
    Array.from({length:Math.ceil((count-1)/4)}, (_, band) => [0,...Array.from({length:Math.min(4,count-1-band*4)}, (_, i) => band*4+i+1)]);
  function layout(band:number[], frameWidth:number) {
    const weights = band.map(column => Math.pow(Math.max(8, ...block.rows.map(row => Math.min(55,row[column].length))), .6));
    const widths = weights.map(value => frameWidth * value / weights.reduce((sum, weight) => sum + weight, 0));
    const rows = block.rows.map(row => band.map((column, i) => wrap(row[column], Math.max(8, Math.floor(widths[i] * (dense ? 11 : 8.4))))));
    const labels = block.header ? rows.shift() : undefined;
    const rowHeight = (cells:string[][]) => Math.max(minimumRowHeight, Math.max(...cells.map(lines => lines.length)) * lineHeight + padding);
    const header = labels ? {values:labels,h:Math.min(1.35,rowHeight(labels))} : undefined;
    const entries = rows.flatMap(cells => {
      const maxLines = Math.max(...cells.map(lines => lines.length));
      return Array.from({length:Math.ceil(maxLines / 9)}, (_, part) => {
        const values = cells.map(lines => lines.slice(part*9,part*9+9));
        return {values,h:rowHeight(values)};
      });
    });
    return {widths,header,entries,frameWidth};
  }
  type Layout = ReturnType<typeof layout>;
  const totalHeight = (rows:Layout['entries']) => rows.reduce((sum,row) => sum+row.h,0);
  function draw(slide:Slide, table:Layout, rows:Layout['entries'], x:number) {
    const {header,widths,frameWidth} = table;
    const all = header ? [header,...rows] : rows;
    slide.addTable(all.map((row,i) => row.values.map(lines => ({
      text:lines.join('\n'),options:{
        color:header && i===0 ? 'FFFFFF' : navy,
        bold:!!header && i===0,
        fill:{color:header && i===0 ? navy : i%2 ? 'FFFFFF' : pale},
        fontSize:header && i===0 ? (header.h >= 1.35 ? 10 : headerFont) : bodyFont,
      },
    }))),{x,y:bodyTop,w:frameWidth,colW:widths,rowH:all.map(row => row.h),fontFace:'Arial',
      margin:dense ? [2,6,2,6] : [4,6,4,6],valign:'middle',border:{type:'solid',pt:.6,color:'DEE7F0'},autoPage:false});
  }
  for (const band of bands) {
    const table = layout(band,12.08);
    const headerHeight = table.header?.h || 0;
    if (block.header && count <= 4 && totalHeight(table.entries)+headerHeight > bodyHeight) {
      const gap = .18, panel = layout(band,(12.08-gap)/2);
      const middle = Math.ceil(panel.entries.length/2);
      const left = panel.entries.slice(0,middle), right = panel.entries.slice(middle);
      if (right.length && Math.max(totalHeight(left),totalHeight(right))+(panel.header?.h || 0) <= bodyHeight) {
        const slide = newSlide();
        draw(slide,panel,left,.62);
        draw(slide,panel,right,.62+panel.frameWidth+gap);
        continue;
      }
    }
    let batch:Layout['entries'] = [];
    let used = headerHeight;
    for (const entry of table.entries) {
      if (batch.length && used+entry.h > bodyHeight) {
        draw(newSlide(),table,batch,.62);
        batch = [];
        used = headerHeight;
      }
      batch.push(entry);
      used += entry.h;
    }
    if (batch.length || table.header) draw(newSlide(),table,batch,.62);
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

// Clear only light background connected to the image edges, preserving enclosed artwork.
function transparentChart(image:HTMLImageElement) {
  const maxSize = 2400;
  const scale = Math.min(1,maxSize / Math.max(image.naturalWidth,image.naturalHeight));
  const width = Math.max(1,Math.round(image.naturalWidth * scale));
  const height = Math.max(1,Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d',{willReadFrequently:true})!;
  ctx.drawImage(image,0,0,width,height);
  const pixels = ctx.getImageData(0,0,width,height);
  const rgba = pixels.data;
  const queue = new Uint32Array(width * height);
  const visited = new Uint8Array(queue.length);
  let head = 0, tail = 0;
  function enqueue(index:number) {
    if (visited[index]) return;
    visited[index] = 1;
    const offset = index * 4;
    const min = Math.min(rgba[offset],rgba[offset+1],rgba[offset+2]);
    const max = Math.max(rgba[offset],rgba[offset+1],rgba[offset+2]);
    if (rgba[offset+3] && (min < 244 || max-min > 9)) return;
    rgba[offset+3] = 0;
    queue[tail++] = index;
  }
  for (let x=0; x<width; x++) {
    enqueue(x);
    enqueue((height-1)*width+x);
  }
  for (let y=1; y<height-1; y++) {
    enqueue(y*width);
    enqueue(y*width+width-1);
  }
  while (head<tail) {
    const index=queue[head++], x=index%width;
    if (x>0) enqueue(index-1);
    if (x+1<width) enqueue(index+1);
    if (index>=width) enqueue(index-width);
    if (index+width<queue.length) enqueue(index+width);
  }
  let left=width, right=-1, top=height, bottom=-1;
  for (let index=0; index<queue.length; index++) {
    if (!rgba[index*4+3]) continue;
    const x=index%width, y=Math.floor(index/width);
    left=Math.min(left,x); right=Math.max(right,x);
    top=Math.min(top,y); bottom=Math.max(bottom,y);
  }
  if (right<left || bottom<top) return {data:image.src,width:image.naturalWidth,height:image.naturalHeight};
  const cropped = document.createElement('canvas');
  cropped.width = right-left+1;
  cropped.height = bottom-top+1;
  cropped.getContext('2d')!.putImageData(pixels,-left,-top);
  return {data:cropped.toDataURL('image/png'),width:cropped.width,height:cropped.height};
}

async function backgroundWithWatermark(background:string, logo:string, cover=false) {
  const theme = new Image(), emblem = new Image();
  theme.src = background;
  emblem.src = logo;
  await Promise.all([theme.decode(),emblem.decode()]);
  const canvas = document.createElement('canvas');
  canvas.width = theme.naturalWidth;
  canvas.height = theme.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(theme,0,0);
  if (cover) {
    // The example's title and month become editable PowerPoint text.
    for (const [x,y,w,h,edge,rightEdge] of [[65,360,845,330,24,65],[218,716,273,55,5,5]]) {
      const sx=canvas.width/1671, sy=canvas.height/941;
      const left=Math.round(x*sx), top=Math.round(y*sy);
      const text=ctx.getImageData(left,top,Math.round(w*sx),Math.round(h*sy));
      const {data,width,height}=text;
      const rightColors = Array.from({length:height},(_,row) => {
        const radius = edge;
        const first = Math.max(0,row-radius), last = Math.min(height-1,row+radius);
        return [0,1,2].map(channel => {
          let sum = 0;
          for (let line=first;line<=last;line++) sum+=data[(line*width+width-1)*4+channel];
          return sum/(last-first+1);
        });
      });
      for (let row=0;row<height;row++) {
        const a=row*width*4;
        for (let column=1;column<width-1;column++) {
          const amount=(column/(width-1))**(edge>5 ? 2.2 : 1);
          const blend=Math.min(1,column/edge,(width-1-column)/rightEdge,row/edge,(height-1-row)/edge);
          const offset=a+column*4;
          for (let channel=0;channel<3;channel++) {
            const background=data[a+channel]*(1-amount)+rightColors[row][channel]*amount;
            data[offset+channel]=data[offset+channel]*(1-blend)+background*blend;
          }
        }
      }
      ctx.putImageData(text,left,top);
    }
  }
  ctx.scale(canvas.width/1672,canvas.height/941);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cover ? 1043 : 1071,0);
  ctx.lineTo(1672,0);
  ctx.lineTo(1672,cover ? 638 : 608);
  if (cover) {
    ctx.lineTo(1424,386);
    ctx.quadraticCurveTo(1409,373,1385,377);
    ctx.lineTo(1340,377);
    ctx.quadraticCurveTo(1323,378,1310,361);
  } else ctx.lineTo(1178,168);
  ctx.closePath();
  ctx.clip();
  const redGradient = ctx.createLinearGradient(1190,0,1660,485);
  redGradient.addColorStop(0,'#A30716');
  redGradient.addColorStop(.48,'#CF091B');
  redGradient.addColorStop(1,'#8C0716');
  ctx.fillStyle = redGradient;
  ctx.fillRect(1040,0,632,640);
  ctx.fillStyle = '#FF344533';
  ctx.beginPath();
  ctx.moveTo(1485,0);
  ctx.lineTo(1672,0);
  ctx.lineTo(1672,225);
  ctx.closePath();
  ctx.fill();

  // Use the original emblem as the watermark mask so its lettering stays intact.
  const watermark = document.createElement('canvas');
  watermark.width = watermark.height = 350;
  const stamp = watermark.getContext('2d')!;
  stamp.drawImage(emblem,0,0,350,350);
  stamp.globalCompositeOperation = 'source-in';
  stamp.fillStyle = '#FFFFFF';
  stamp.fillRect(0,0,350,350);
  ctx.globalAlpha = .22;
  ctx.drawImage(watermark,1230,cover ? 18 : 10);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(1474,281);
  ctx.lineTo(1646,420);
  if (!cover) ctx.stroke();
  ctx.restore();
  return canvas.toDataURL('image/png');
}

export async function buildBriefingPresentation(pages:Page[], name:string, options:Options, images:Images, progress=(n:number)=>{}) {
  const ppt = new PptxGenJS();
  ppt.layout = 'LAYOUT_WIDE';
  ppt.author = 'Muğla İl Millî Eğitim Müdürlüğü';
  ppt.title = name;
  const [background,coverBackground] = await Promise.all([
    backgroundWithWatermark(images.background,images.logo),
    backgroundWithWatermark(images.cover,images.logo,true),
  ]);
  ppt.defineSlideMaster({title:'BRIFING',background:{data:background},objects:[
    {rect:{x:.43,y:.20,w:1.01,h:1.00,fill:{color:'FAFAFA'},line:{transparency:100}}},
    {image:{data:images.logo,x:.45,y:.22,w:.96,h:.96,altText:'Millî Eğitim Bakanlığı logosu'}},
  ]});
  ppt.defineSlideMaster({title:'BRIFING_COVER',background:{data:coverBackground},objects:[
    {rect:{x:.36,y:.25,w:1.07,h:1.07,fill:{color:'FAFAFA'},line:{transparency:100}}},
    {image:{data:images.logo,x:.39,y:.28,w:1.01,h:1.01,altText:'Millî Eğitim Bakanlığı logosu'}},
  ]});
  let pageNumber = 1;
  const add = (title?:string) => {
    const slide = ppt.addSlide({masterName:'BRIFING'});
    if (title) {
      box(slide,.40,1.20,12.54,5.71,'FFFFFF');
      label(slide,title,.54,1.24,12.08,.57,title.length > 90 ? 16.5 : 21,ink,true,'top');
      box(slide,.54,2.09,.89,.04,red);
    }
    label(slide,String(++pageNumber),12.45,7.17,.40,.21,10.5,navy,true);
    return slide;
  };
  const cover = ppt.addSlide({masterName:'BRIFING_COVER'});
  const coverTitle = name.trim().replace(/^(Muğla İl Millî Eğitim) (Müdürlüğü) (Brifingi)$/i,'$1\n$2\n$3');
  label(cover,coverTitle,.70,3.13,6.18,2.15,coverTitle.length > 75 ? 37 : 47,ink,true,'top');
  const period = options.period.replace(/\s*[—–-]\s*Aktif\s*$/i,'');
  label(cover,period,1.89,5.73,2.23,.43,26,ink,true);
  if (options.draft) label(cover,'Güncel Taslaklar',.76,6.39,4,.26,12,muted,true);
  const entriesPerSlide = 10;
  const contents = Array.from({length:Math.ceil(pages.length/entriesPerSlide)},() => add('İçindekiler'));
  const sections:{title:string;first:number;last:number}[] = [];
  for (const [index,page] of pages.entries()) {
    const start = pageNumber;
    const pictures = (page.ranges.includes('*') ? page.images || [] : [])
      .filter(data => /^data:image\/(png|jpeg|jpg);base64,/.test(data));
    const isOrganizationChart = fold(page.title).trim() === 'teskilat semasi';
    const chartLabels = pictures.length && isOrganizationChart;
    const content = blocks(page).filter(block => !chartLabels || !block.rows.every(([text,...other]) =>
      !other.length && /^(?:kurum genel bilgileri|(?:okul\s*\/\s*kurum mudurlukleri\s*)+)$/.test(fold(text).trim())));
    if (page.description?.trim()) content.push({title:page.title, rows:[[page.description]], header:false});
    for (const block of content) {
      const newSlide = () => add(block.title);
      if (block.rows[0].length === 1) narrative(block,newSlide);
      else if (block.rows[0].length !== 2 || !indicators(block,newSlide)) tables(block,newSlide);
    }
    for (const chart of page.charts || []) {
      const series = chartData(chart,page,pages);
      if (!series.length) continue;
      const slide = add(chart.title || page.title);
      slide.addChart(chart.type==='pie' ? 'pie' : chart.type==='line' ? 'line' : 'bar',series,
        {x:.62,y:bodyTop,w:12.08,h:bodyHeight,chartColors:[navy,red,'198B63','B77917','7054A5'],
          showLegend:series.length > 1 || chart.type==='pie',legendFontFace:'Arial',catAxisLabelFontFace:'Arial',catAxisLabelFontSize:10});
    }
    for (const data of pictures) {
      const image = new Image();
      image.src = data;
      await image.decode();
      const picture = isOrganizationChart ? transparentChart(image) : {data,width:image.naturalWidth,height:image.naturalHeight};
      const frame = isOrganizationChart ? {x:.32,y:1.18,w:12.69,h:5.86} : {x:.62,y:bodyTop,w:12.08,h:bodyHeight};
      const scale = Math.min(frame.w / picture.width, frame.h / picture.height);
      const w = picture.width * scale, h = picture.height * scale;
      const slide = isOrganizationChart ? add() : add(page.title);
      slide.addImage({data:picture.data,x:frame.x+(frame.w-w)/2,y:frame.y+(frame.h-h)/2,w,h,altText:page.title});
    }
    if (pageNumber === start) label(add(page.title),'Seçili aralıkta gösterilecek veri bulunamadı.',.62,bodyTop,12,.40,15);
    sections.push({title:page.title,first:start+1,last:pageNumber});
    progress(Math.round((index+1)/pages.length*90));
    await new Promise(resolve => setTimeout(resolve,0));
  }
  for (const [index,slide] of contents.entries()) {
    const start = index*entriesPerSlide;
    label(slide,'Bölüm',.76,bodyTop,10,.28,11,navy,true);
    label(slide,'Slayt',11.56,bodyTop,1.02,.28,11,navy,true);
    for (const [row,section] of sections.slice(start,start+entriesPerSlide).entries()) {
      const y = bodyTop+.36+row*.40;
      if (row%2===0) box(slide,.62,y,12.08,.40,pale);
      slide.addText(section.title,{x:.76,y:y+.03,w:10.55,h:.34,fontFace:'Arial',fontSize:14,
        color:navy,margin:0,fit:'shrink',valign:'mid',hyperlink:{slide:section.first}});
      const range = section.first===section.last ? String(section.first) : section.first+'–'+section.last;
      label(slide,range,11.56,y,1.02,.40,13,navy,true);
    }
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

export async function writeBriefingPresentation(ppt:PptxGenJS) {
  const zip = await JSZip.loadAsync(await ppt.write({outputType:'arraybuffer'}) as ArrayBuffer);
  const slides = zip.file(/^ppt\/slides\/slide\d+\.xml$/);
  for (const slide of slides) {
    const xml = await slide.async('string');
    // PptxGenJS numbers tables and shapes independently, which can duplicate a slide object ID.
    const objectId = /(<p:cNvPr\s+id=")(\d+)(")/g;
    const ids = [...xml.matchAll(objectId)].map(match => Number(match[2]));
    const seen = new Set<number>();
    let nextId = Math.max(0,...ids);
    const fixed = xml.replace(objectId,(match,prefix,id,suffix) => {
      const value = Number(id);
      if (seen.has(value)) return prefix + (++nextId) + suffix;
      seen.add(value);
      return match;
    });
    if (fixed !== xml) zip.file(slide.name,fixed);
  }
  return zip.generateAsync({type:'blob',compression:'DEFLATE',
    mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation'});
}

export async function exportBriefingPresentation(pages:Page[], name:string, options:Options, progress:(n:number)=>void) {
  const [background,cover,logo] = await Promise.all([
    imageData('briefing-slide-background.png'),imageData('briefing-cover-reference.png'),imageData('briefing-meb-logo.png'),
  ]);
  const ppt = await buildBriefingPresentation(pages,name,options,{background,cover,logo},progress);
  progress(94);
  const blob = await writeBriefingPresentation(ppt);
  download(blob,name.replace(/[<>:"/\\|?*]/g,'-').slice(0,100)+'.pptx');
  progress(100);
}
