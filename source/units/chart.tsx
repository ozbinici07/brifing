import React from 'react';
const colors=['#075498','#d51d40','#198b63','#b77917','#7054a5','#4b8894'];
export default function BriefChart({chart,records,core}:{chart:any;records:any[];core:any}){
 function values(ref:string,fallback:any[]){const m=ref?.match(/^(?:'(.+)'|([^!]+))!(.+)$/);const table=m&&records.find(p=>p.sheet===(m[1]||m[2]).replace(/''/g,"'"));if(!table)return fallback||[];try{const b=core.range(m[3]),out=[];for(let r=b.top;r<=b.bottom;r++)for(let c=b.left;c<=b.right;c++)out.push(table.rows[r-table.rowOffset]?.[c]?.v??null);return out;}catch{return [];}}
 const series=(chart.series||[]).map((s:any)=>({...s,categories:values(s.catRef,s.categories),numbers:values(s.valRef,s.values).map((n:any)=>Number.isFinite(Number(n))?Number(n):0)}));
 const title=chart.title||'Kaynak Excel grafiği';
 return <div className="chart-box"><h3>{title}</h3>{series.map((s:any,index:number)=>{
  const max=Math.max(1,...s.numbers.map(Math.abs));
  if(chart.type==='pie'){
   const total=s.numbers.reduce((n:number,v:number)=>n+Math.max(0,v),0);let angle=-Math.PI/2;
   return <div key={index}><h4>{s.label}</h4>{total>0?<svg viewBox="0 0 480 240" role="img" aria-label={title} style={{maxWidth:650,width:'100%'}}>{s.numbers.map((v:number,i:number)=>{const start=angle;angle+=Math.max(0,v)/total*Math.PI*2;const x=(a:number)=>120+95*Math.cos(a),y=(a:number)=>120+95*Math.sin(a);return <g key={i}>{v===total?<circle cx="120" cy="120" r="95" fill={colors[i%colors.length]}/>:v>0?<path d={`M120 120 L${x(start)} ${y(start)} A95 95 0 ${angle-start>Math.PI?1:0} 1 ${x(angle)} ${y(angle)} Z`} fill={colors[i%colors.length]}/>:null}<rect x="240" y={15+i*24} width="12" height="12" fill={colors[i%colors.length]}/><text x="260" y={26+i*24} fontSize="12">{String(s.categories[i]??i+1)}: {v.toLocaleString('tr-TR')}</text></g>})}</svg>:<p>Grafik için henüz veri yok.</p>}</div>;
  }
  if(chart.type==='line')return <div key={index}><h4>{s.label}</h4><svg viewBox="0 0 720 250" role="img" aria-label={title} style={{width:'100%'}}><path d="M40 20 V210 H700" stroke="#aec1d2" fill="none"/><polyline points={s.numbers.map((n:number,i:number)=>`${40+i*650/Math.max(1,s.numbers.length-1)},${210-n/max*180}`).join(' ')} fill="none" stroke={colors[index%colors.length]} strokeWidth="3"/>{s.numbers.map((n:number,i:number)=>{const x=40+i*650/Math.max(1,s.numbers.length-1),y=210-n/max*180;return <g key={i}><circle cx={x} cy={y} r="4" fill={colors[index%colors.length]}/><text x={x} y={y-10} textAnchor="middle" fontSize="11">{n.toLocaleString('tr-TR')}</text><text x={x} y="233" textAnchor="middle" fontSize="9">{String(s.categories[i]??i+1)}</text></g>})}</svg></div>;
  return <div key={index}><h4>{s.label}</h4>{s.numbers.map((v:number,i:number)=><div className="barrow" key={i}><span>{String(s.categories[i]??i+1)}</span><div><i style={{width:Math.abs(v)/max*100+'%',background:colors[index%colors.length]}}/></div><b>{v.toLocaleString('tr-TR')}</b></div>)}</div>;
 })}</div>;
}
