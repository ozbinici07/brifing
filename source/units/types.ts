export type Cell={v:string|number|null;f?:string;bold?:boolean;bg?:string|null};
export type Link={unit:number;range:string;label:string};
export type RecordItem={id:number;unit:number;links:Link[];rowOffset:number;title:string;content:string;description:string;owner?:string;status:'pending'|'reviewed';sheet:string;rows:Cell[][];merges:string[];images:string[];charts:any[];source:boolean;due:string;updated:string;deleted?:boolean};
export type Unit={deleted?:boolean;id:number;name:string;owner:string;description:string};
export type State={units:Unit[];records:RecordItem[];settings:{displayName:string;period:string};versions:{[key:string]:number};sourceName:string;sync?:{modified:string;error:string;path:string;pendingExcelLinks?:number;excelLinkError?:string;excelConflicts?:{id:number;title:string;field:string;error:string}[]}};
export function colName(i:number):string{let s='';for(i++;i>0;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s}
export function coord(s:string){const m=s.toUpperCase().replace(/\$/g,'').match(/^([A-Z]+)([1-9]\d*)$/);if(!m)return null;let c=0;for(const x of m[1])c=c*26+x.charCodeAt(0)-64;return {r:+m[2],c:c-1}}
export function bounds(s:string){const p=s.split(':');const a=coord(p[0]);const b=coord(p[1]||p[0]);return a&&b?{r1:Math.min(a.r,b.r),r2:Math.max(a.r,b.r),c1:Math.min(a.c,b.c),c2:Math.max(a.c,b.c)}:null}
export function linksFor(p:RecordItem,u?:number){return (p.links||[{unit:p.unit,range:'*',label:'Tüm sayfa'}]).filter(l=>!u||l.unit===u)}
export function belongs(p:RecordItem,u:number){return !p.deleted&&linksFor(p,u).length>0}
export function includes(r:number,c:number,ranges:string[]){return ranges.some(s=>{if(s==='*')return true;const b=bounds(s);return b&&r>=b.r1&&r<=b.r2&&c>=b.c1&&c<=b.c2})}
export function display(c:Cell){if(c?.v==null)return '';if(typeof c.v==='number'){if(c.f?.includes('%'))return (c.v*100).toLocaleString('tr-TR',{maximumFractionDigits:2})+'%';return c.v.toLocaleString('tr-TR',{maximumFractionDigits:4})}return String(c.v)}
export function fold(v:string){return v.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i')}
export function linkedRows(p:RecordItem,u?:number){const ranges=linksFor(p,u).map(l=>l.range);return p.rows.map((row,i)=>row.map((c,j)=>includes(i+(p.rowOffset||4),j,ranges)?c:{v:null})).filter((row)=>row.some(c=>c.v!==null))}
