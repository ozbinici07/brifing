import React from 'react';
import type {LucideIcon} from 'lucide-react';
import {Building2,FileText,Check,Clock3,ArrowRight,Hourglass,CalendarDays,Search,TableProperties,Mail,List,ChevronRight,ChartNoAxesColumnIncreasing,Megaphone,Monitor,Coins,Files,Settings,Landmark,Users,House,Scale,GraduationCap,Wrench,BookOpen,ClipboardCheck,BriefcaseBusiness,Gavel,ShieldCheck,TrendingUp,Presentation,Globe} from 'lucide-react';
const designs:[RegExp,string,LucideIcon][]=[
  [/istatistik/i,'blue',ChartNoAxesColumnIncreasing],
  [/basın|basin|halkla/i,'purple',Megaphone],
  [/bilgi işlem|bilgi islem/i,'cyan',Monitor],
  [/bütçe|butce|tahakkuk/i,'orange',Coins],
  [/denklik|belge/i,'green',Files],
  [/destek/i,'blue',Settings],
  [/din öğretimi|din ogretimi/i,'green',Landmark],
  [/hayat boyu/i,'blue',Users],
  [/inşaat|insaat|emlak/i,'purple',House],
  [/sağlığı|sagligi|güvenlik|guvenlik/i,'cyan',Scale],
  [/mesleki gelişim|mesleki gelisim/i,'pink',GraduationCap],
  [/mesleki ve teknik/i,'cyan',Wrench],
  [/ortaöğretim|ortaogretim/i,'purple',BookOpen],
  [/ölçme|olcme|sınav|sinav/i,'orange',ClipboardCheck],
  [/özel eğitim|ozel egitim/i,'cyan',Users],
  [/özel öğretim|ozel ogretim/i,'blue',Building2],
  [/atama|özlük|ozluk/i,'green',BriefcaseBusiness],
  [/disiplin/i,'pink',Gavel],
  [/sivil/i,'blue',ShieldCheck],
  [/strateji/i,'purple',TrendingUp],
  [/temel eğitim|temel egitim/i,'cyan',Users],
  [/yenilik|teknoloj/i,'purple',Presentation],
  [/yükseköğretim|yuksekogretim|yurt/i,'orange',Globe],
];
type Unit = {id: string | number; name: string};
type ToolbarProps = {
  periodName: string; active: boolean; query: string; onQuery: (value: string) => void;
  units: Unit[]; unitFilter: string; onUnitFilter: (value: string) => void;
  admin: boolean; onMapping: () => void; listLayout: boolean;
  onCards: () => void; onList: () => void;
};
export function DirectoryToolbar({periodName,active,query,onQuery,units,unitFilter,onUnitFilter,admin,onMapping,listLayout,onCards,onList}: ToolbarProps) {
  return <div className="directory-toolbar">
    <p className="directory-period">
      <CalendarDays size={15}/><span>Veri Dönemi:</span>
      <strong>{periodName}{active?' – Aktif':''}{active&&<Check size={13} aria-hidden="true"/>}</strong>
    </p>
    <label className="directory-search">
      <Search size={16}/><input aria-label="Birim veya brifing ara" placeholder="Birim veya brifing başlığı ara…" value={query} onChange={e=>onQuery(e.target.value)}/>
    </label>
    <select aria-label="Birim filtresi" value={unitFilter} onChange={e=>onUnitFilter(e.target.value)}>
      <option value="">Tüm Birimler</option>
      {units.map(u=><option key={u.id} value={String(u.id)}>{u.name}</option>)}
    </select>
    {admin&&<button className="btn navy" onClick={onMapping}><TableProperties size={15}/>Tablo ve Birim Eşlemesi</button>}
    <button className="btn light" aria-pressed={!listLayout} onClick={onCards}><Mail size={15}/>Kart Görünümü</button>
    <button className="btn light" aria-pressed={listLayout} onClick={onList}><List size={15}/>Liste Görünümü</button>
  </div>;
}

type SummaryProps = {units: number; tables: number; approved: number; waiting: number; submitted: number; pending: number};
export function DirectorySummary({units,tables,approved,waiting,submitted,pending}: SummaryProps) {
  const stats = [
    {value:units,label:'Birim',theme:'blue',Icon:Building2},
    {value:tables,label:'Brifing Sayfası',theme:'purple',Icon:FileText},
    {value:approved,label:'Onaylandı',theme:'green',Icon:Check},
    {value:waiting,label:'Onaya Sunulmayı Bekleyen',theme:'orange',Icon:Clock3},
    {value:submitted,label:'Onaya Sunulan',theme:'purple',Icon:ArrowRight},
    {value:pending,label:'Kontrol Bekleyen',theme:'pink',Icon:Hourglass},
  ];
  return <div className="directory-summary">{stats.map(({value,label,theme,Icon})=>
    <div className={'directory-stat directory-'+theme} key={label}>
      <span className="directory-stat-icon"><Icon size={25} strokeWidth={1.8}/></span>
      <strong>{value}<small>{label}</small></strong>
    </div>
  )}</div>;
}

type TileProps = {unit: Unit; number: number; count: number; done: number; selected: boolean; onSelect: (unit: Unit) => void; matches?: string[]};
export function UnitTile({unit,number,count,done,selected,onSelect,matches=[]}: TileProps) {
  const [,theme,Icon]=designs.find(([pattern])=>pattern.test(unit.name.toLocaleLowerCase('tr')))||[/./,'blue',Building2];
  const progress=Math.max(0,Math.min(100,Number(done)||0));
  return <button className={'directory-unit directory-'+theme+(selected?' selected':'')} onClick={()=>onSelect(unit)}
    aria-label={unit.name+' · '+count+' içerik · %'+progress} aria-pressed={selected}>
    <span className="directory-unit-icon"><Icon size={23} strokeWidth={1.8}/></span>
    <span className="directory-unit-number">{String(number).padStart(2,'0')}</span>
    <span className="directory-unit-copy">
      <strong>{unit.name}</strong><small>{count} içerik</small>
      {matches.map(title=><small className="unit-search-match" key={title}>{title}</small>)}
    </span>
    <ChevronRight className="directory-unit-chevron" size={15}/>
    <span className="directory-progress" aria-hidden="true">
      <span><i style={{width:progress+'%'}}/></span><small>%{progress}</small>
    </span>
  </button>;
}
