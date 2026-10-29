/* Brifing Bilgi Sistemi - browser-only Excel reader.
 * Supports the workbook shapes used by the MEB XLSX/XLS source files.
 * XLSX: ZIP + XML, XLS: Compound File + BIFF8/BIFF7.
 */
(function(){
'use strict';
const te=new TextDecoder('utf-8');
const te16=new TextDecoder('utf-16le');
const tdLatin=new TextDecoder('windows-1252');
const u8=(b,o)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getUint8(o);
const u16=(b,o)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getUint16(o,true);
const i16=(b,o)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getInt16(o,true);
const u32=(b,o)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(o,true);
const i32=(b,o)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getInt32(o,true);
const f64=(b,o)=>new DataView(b.buffer,b.byteOffset,b.byteLength).getFloat64(o,true);
function sliceBytes(b,a,z){return b.subarray(a,Math.min(z,b.length));}
async function inflateRaw(bytes){
  if(typeof DecompressionStream==='undefined') throw new Error('Tarayıcı Deflate desteği bulunamadı. Güncel Chrome/Edge kullanınız.');
  const ds=new DecompressionStream('deflate-raw');
  const stream=new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function inflateZlib(bytes){
  if(typeof DecompressionStream==='undefined') throw new Error('Tarayıcı Deflate desteği bulunamadı.');
  const ds=new DecompressionStream('deflate');
  const stream=new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function readZip(buf){
  const b=new Uint8Array(buf), dv=new DataView(buf);
  let p=-1,start=Math.max(0,b.length-65557);
  for(let i=b.length-22;i>=start;i--){if(u32(b,i)===0x06054b50){p=i;break;}}
  if(p<0) throw new Error('XLSX ZIP sonlandırma kaydı bulunamadı.');
  const cdSize=u32(b,p+12),cdOff=u32(b,p+16); let q=cdOff; const files=new Map();
  while(q<cdOff+cdSize && q+46<=b.length){
    if(u32(b,q)!==0x02014b50) break;
    const method=u16(b,q+10), comp=u32(b,q+20), uncomp=u32(b,q+24), nlen=u16(b,q+28), elen=u16(b,q+30), clen=u16(b,q+32), lhoff=u32(b,q+42);
    const name=te.decode(sliceBytes(b,q+46,q+46+nlen)); q+=46+nlen+elen+clen;
    if(lhoff+30>b.length) continue;
    const ln=u16(b,lhoff+26), le=u16(b,lhoff+28), dataStart=lhoff+30+ln+le;
    const cbytes=sliceBytes(b,dataStart,dataStart+comp);
    let data;
    if(method===0)data=new Uint8Array(cbytes);
    else if(method===8)data=await inflateRaw(cbytes);
    else throw new Error('XLSX sıkıştırma yöntemi desteklenmiyor: '+method);
    files.set(name,data);
  }
  return files;
}
function xmlText(bytes){return te.decode(bytes);}
function parseXml(bytes){return new DOMParser().parseFromString(xmlText(bytes),'application/xml');}
function localName(el){return String(el.localName||el.nodeName||'').split(':').pop();}
function childrenBy(el,name){return Array.from(el.children||[]).filter(x=>localName(x)===name);}
function firstChildBy(el,name){return childrenBy(el,name)[0]||null;}
function attr(el,n){return el?.getAttribute(n)||'';}
function colNum(ref){let m=/^[A-Z]+/i.exec(ref||'');if(!m)return 0;let n=0;for(const ch of m[0].toUpperCase())n=n*26+(ch.charCodeAt(0)-64);return n-1;}
function rowNum(ref){const m=/\d+/.exec(ref||'');return m?Number(m[0])-1:0;}
async function parseXlsx(buf){
  const files=await readZip(buf);
  const sst=[]; const ss=files.get('xl/sharedStrings.xml');
  if(ss){const doc=parseXml(ss); const root=doc.documentElement; for(const si of childrenBy(root,'si')){
    let out=''; const texts=si.getElementsByTagName('*'); for(const t of texts){if(localName(t)==='t')out+=t.textContent||'';} sst.push(out);
  }}
  const wb=parseXml(files.get('xl/workbook.xml')); const relDoc=parseXml(files.get('xl/_rels/workbook.xml.rels'));
  const rels=new Map(); for(const r of Array.from(relDoc.documentElement.children||[])){if(localName(r)==='Relationship')rels.set(attr(r,'Id'),attr(r,'Target'));}
  const sheets=[]; const sw=firstChildBy(wb.documentElement,'sheets');
  for(const sh of childrenBy(sw||wb.documentElement,'sheet')){
    const name=attr(sh,'name'),rid=attr(sh,'{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')||attr(sh,'r:id');
    let target=rels.get(rid)||''; if(target.startsWith('/'))target=target.slice(1); else if(!target.startsWith('xl/'))target='xl/'+target.replace(/^\.\//,'');
    if(target.includes('../'))target=target.replace(/^xl\//,'').replace(/^\.\.\//,'xl/');
    const data=files.get(target); if(!data)continue;
    const doc=parseXml(data),root=doc.documentElement, sheetData=firstChildBy(root,'sheetData'); const rows=[];
    let maxCol=0;
    for(const rowEl of childrenBy(sheetData||root,'row')){
      const rr=Number(attr(rowEl,'r')||0)-1; const row=[]; if(rr>rows.length){while(rows.length<rr)rows.push([]);}
      for(const c of childrenBy(rowEl,'c')){
        const ref=attr(c,'r'); const ci=colNum(ref); maxCol=Math.max(maxCol,ci); let v=''; const typ=attr(c,'t'); const ve=firstChildBy(c,'v');
        if(typ==='s')v=sst[Number(ve?.textContent||0)]??'';
        else if(typ==='inlineStr'){let out='';for(const t of c.getElementsByTagName('*'))if(localName(t)==='t')out+=t.textContent||'';v=out;}
        else if(typ==='b')v=String(ve?.textContent||'')==='1';
        else if(typ==='str')v=String(ve?.textContent||'');
        else {const raw=String(ve?.textContent||''); if(raw==='')v=''; else {const n=Number(raw);v=Number.isFinite(n)?n:raw;}}
        row[ci]=v;
      }
      rows[rr]=row;
    }
    while(rows.length && (!rows[rows.length-1]||rows[rows.length-1].length===0))rows.pop();
    sheets.push({name,rows,maxCol});
  }
  return sheets;
}
// ---- Legacy .XLS BIFF / Compound File ----
function cfbStream(buf,wanted=['Workbook','Book']){
  const raw=new Uint8Array(buf); if(raw.length<512||u32(raw,0)!==0xE011CFD0||u32(raw,4)!==0xE11AB1A1)throw new Error('Dosya geçerli bir eski Excel (.xls) OLE dosyası değil.');
  const sectorSize=1<<u16(raw,30), miniSectorSize=1<<u16(raw,32), numFat=u32(raw,44), firstDir=i32(raw,48), cutoff=u32(raw,56), firstMini=i32(raw,60), numMini=u32(raw,64), firstDifat=i32(raw,68);
  const sector=n=>raw.subarray((n+1)*sectorSize,(n+2)*sectorSize);
  const difat=[]; for(let i=0;i<109;i++){const n=i32(raw,76+i*4);if(n>=0)difat.push(n);} // small files use header DIFAT
  const fat=[]; for(const sn of difat.slice(0,numFat)){const z=sector(sn);for(let i=0;i+4<=z.length;i+=4)fat.push(i32(z,i));}
  // Extend DIFAT for large compound files.
  let difatSec=firstDifat; let remaining=Math.max(0,numFat-109), guard=0;
  while(remaining>0&&difatSec>=0&&guard++<100){const z=sector(difatSec);const count=Math.min(Math.floor((z.length-4)/4),remaining);for(let i=0;i<count;i++)difat.push(i32(z,i*4));difatSec=i32(z,z.length-4);remaining-=count;}
  // Rebuild FAT if extended DIFAT found.
  if(difat.length>109){fat.length=0;for(const sn of difat.slice(0,numFat)){const z=sector(sn);for(let i=0;i+4<=z.length;i+=4)fat.push(i32(z,i));}}
  function chain(start,table){const out=[];let n=start,seen=new Set();while(n>=0&&!seen.has(n)&&n<table.length){seen.add(n);out.push(n);n=table[n];}return out;}
  function fatStream(start,size){const chunks=chain(start,fat).map(sector);const out=new Uint8Array(Math.min(size,chunks.length*sectorSize));let p=0;for(const z of chunks){const n=Math.min(z.length,out.length-p);out.set(z.subarray(0,n),p);p+=n;if(p>=out.length)break;}return out;}
  const directory=fatStream(firstDir,1<<20), entries=[];
  for(let off=0;off+128<=directory.length;off+=128){const e=directory.subarray(off,off+128);const ln=u16(e,64);const name=ln>=2?te16.decode(e.subarray(0,Math.max(0,ln-2))).replace(/\0/g,''):'';entries.push({name,type:u8(e,66),start:i32(e,116),size:Number(u32(e,120))+Number(u32(e,124))*4294967296});}
  const target=entries.find(x=>wanted.some(name=>String(name).toLocaleLowerCase('en-US')===String(x.name).toLocaleLowerCase('en-US'))&&x.type===2); if(!target)throw new Error('Workbook/Book akışı bulunamadı.');
  if(target.size<cutoff){const root=entries.find(x=>x.name==='Root Entry'&&x.type===5);if(!root)throw new Error('Excel Root Entry bulunamadı.');const rootstream=fatStream(root.start,root.size);const mf=[];if(firstMini>=0){for(const sn of chain(firstMini,fat).slice(0,numMini)){const z=sector(sn);for(let i=0;i+4<=z.length;i+=4)mf.push(i32(z,i));}}
    const out=new Uint8Array(target.size);let p=0,n=target.start,seen=new Set();while(n>=0&&!seen.has(n)&&n<mf.length&&p<target.size){seen.add(n);const a=n*miniSectorSize,z=rootstream.subarray(a,a+miniSectorSize),k=Math.min(z.length,target.size-p);out.set(z.subarray(0,k),p);p+=k;n=mf[n];}return out;
  }
  return fatStream(target.start,target.size);
}
function biffString(dat,pos){if(pos+3>dat.length)return ['',dat.length];const len=u16(dat,pos),opts=u8(dat,pos+2);pos+=3;let rich=0,ext=0;if(opts&8){rich=u16(dat,pos);pos+=2;}if(opts&4){ext=u32(dat,pos);pos+=4;}const nbytes=len*((opts&1)?2:1),raw=dat.subarray(pos,pos+nbytes);pos+=nbytes;const text=(opts&1?te16:tdLatin).decode(raw);pos+=rich*4+ext;return [text,pos];}
function rk(v){let x;if(v&2){x=(v>>>2)&0x3fffffff;if(x&(1<<29))x-=1<<30;}else{const b=new ArrayBuffer(8),dv=new DataView(b);dv.setUint32(0,(v&0xfffffffc)>>>0,true);dv.setUint32(4,0,true);x=dv.getFloat64(0,true);}return (v&1)?x/100:x;}
function parseXls(buf){const stream=cfbStream(buf),sheets=[],sst=[];let p=0;
  // Globals: BoundSheet8 + SST + CONTINUE. Legacy MEB XLS files often
  // split the shared-string table across many CONTINUE records; ignoring
  // those records silently turns later school names into blank values.
  const records=[]; let globalsEnd=0, gp=0;
  while(gp+4<=stream.length){const typ=u16(stream,gp),len=u16(stream,gp+2),dat=stream.subarray(gp+4,gp+4+len);records.push({typ,dat,off:gp});gp+=4+len;if(typ===0x000A){globalsEnd=gp;break;}}
  for(const rec of records){if(rec.typ===0x0085&&rec.dat.length>=8){const pos=u32(rec.dat,0),ln=u8(rec.dat,6),opts=u8(rec.dat,7);const name=(opts&1?te16:tdLatin).decode(rec.dat.subarray(8,8+ln*(opts&1?2:1)));sheets.push({name,pos});}}
  const sstRec=records.find(x=>x.typ===0x00FC), conts=records.filter(x=>x.typ===0x003C); if(sstRec&&sstRec.dat.length>=8){
    const segments=[sstRec.dat.subarray(8),...conts.map(x=>x.dat)]; let si=0,pos=0;
    const atEnd=()=>si>=segments.length;
    function moveSeg(){si++;pos=0;}
    function readByte(){while(!atEnd()&&pos>=segments[si].length)moveSeg();if(atEnd())return 0;return segments[si][pos++];}
    function readU16(){const a=readByte(),b=readByte();return a|(b<<8);}
    function readBytes(n,unicodeContinuation){const out=[];while(n>0&&!atEnd()){
      if(pos>=segments[si].length){moveSeg();if(atEnd())break;if(unicodeContinuation){/* CONTINUE record starts with an encoding flag */readByte();}continue;}
      const k=Math.min(n,segments[si].length-pos);for(let i=0;i<k;i++)out.push(segments[si][pos++]);n-=k;
    }return new Uint8Array(out);}
    const total=u32(sstRec.dat,0),unique=u32(sstRec.dat,4);let count=0;
    while(count<unique&&!atEnd()){
      const len=readU16(),opts=readByte();let rich=0,ext=0;if(opts&8)rich=readU16();if(opts&4)ext=readU32();
      // Read the character payload. If it crosses a CONTINUE boundary, the
      // first byte of that CONTINUE is the new encoding option flag.
      const unicode=!!(opts&1), bytesPer=unicode?2:1;const raw=readBytes(len*bytesPer,unicode);let text='';
      if(unicode)text=te16.decode(raw);else text=tdLatin.decode(raw);
      // Rich/ext data is after the character payload; it may also cross a
      // segment boundary but has no encoding flag of its own.
      let skip=rich*4+ext;while(skip>0&&!atEnd()){if(pos>=segments[si].length){moveSeg();continue;}const k=Math.min(skip,segments[si].length-pos);pos+=k;skip-=k;}
      sst.push(text);count++;
    }
  }
  for(const sh of sheets){const rows={};for(let q=sh.pos;q+4<=stream.length;){const typ=u16(stream,q),len=u16(stream,q+2),dat=stream.subarray(q+4,q+4+len);q+=4+len;if(q>stream.length)break;
      if(typ===0x0203&&dat.length>=14){const r=u16(dat,0),c=u16(dat,2);rows[r]??={};rows[r][c]=f64(dat,6);}
      else if(typ===0x027E&&dat.length>=10){const r=u16(dat,0),c=u16(dat,2);rows[r]??={};rows[r][c]=rk(u32(dat,6));}
      else if(typ===0x00BD&&dat.length>=12){const r=u16(dat,0),cf=u16(dat,2),cl=u16(dat,dat.length-2);let qq=4;rows[r]??={};for(let c=cf;c<=cl&&qq+6<=dat.length;c++){rows[r][c]=rk(u32(dat,qq+2));qq+=6;}}
      else if(typ===0x00FD&&dat.length>=10){const r=u16(dat,0),c=u16(dat,2),idx=u32(dat,6);rows[r]??={};rows[r][c]=sst[idx]??'';}
      else if(typ===0x0204&&dat.length>=9){const r=u16(dat,0),c=u16(dat,2);rows[r]??={};rows[r][c]=biffString(dat,6)[0];}
      else if(typ===0x0205&&dat.length>=8){const r=u16(dat,0),c=u16(dat,2);rows[r]??={};rows[r][c]=!!dat[6];}
      else if(typ===0x0006&&dat.length>=14){const r=u16(dat,0),c=u16(dat,2);rows[r]??={};rows[r][c]=f64(dat,6);}
      else if(typ===0x0202&&dat.length>=8){const r=u16(dat,0),c=u16(dat,2);rows[r]??={};rows[r][c]=u16(dat,6);}
      if(typ===0x000A)break;
    }
    const maxc=Math.max(-1,...Object.values(rows).map(x=>Math.max(-1,...Object.keys(x).map(Number))));const matrix=[];for(let r=0;r<=Math.max(-1,...Object.keys(rows).map(Number));r++){const obj=rows[r]||{},arr=[];for(let c=0;c<=maxc;c++)arr[c]=obj[c]??'';matrix.push(arr);}sheets.find(x=>x.name===sh.name).rows=matrix;sheets.find(x=>x.name===sh.name).maxCol=maxc;
  }
  return sheets;
}
async function readWorkbook(fileOrBuffer){const buf=fileOrBuffer instanceof ArrayBuffer?fileOrBuffer:await fileOrBuffer.arrayBuffer();const b=new Uint8Array(buf);if(b[0]===0xD0&&b[1]===0xCF)return parseXls(buf);return parseXlsx(buf);}
window.BrifingExcel={readWorkbook};
})();
