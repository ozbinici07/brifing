(function () {
  'use strict';

  const levels = ['Okul Öncesi', 'İlkokul', 'Ortaokul', 'Ortaöğretim'];
  const numbers = new Intl.NumberFormat('tr-TR', {maximumFractionDigits: 2});
  const definitions = [
    ['levels', 'Kademelere Göre Öğrenciler', 'İlçelere göre kademe ve okul öncesi dağılımı', '▤', 'blue'],
    ['grades', 'Sınıflara Göre Öğrenci Sayıları', 'Anasınıfından 12. sınıfa ilçe dağılımı', '▥', 'green'],
    ['general', 'Genel Öğrenci Sayıları', 'Muğla geneli, okul türleri ve öğrenci oranları', '▦', 'purple'],
    ['classrooms', 'İlçe Bazlı Öğrenci-Derslik Sayı', 'Resmî ve özel öğrenci ve derslik toplamları', '▣', 'slate'],
    ['types', 'İlçe Bazlı Öğrenci Sayıları', 'İlçe ve okul türüne göre öğrenci sayıları', '▧', 'blue'],
  ];

  function category(row) {
    const type = norm(row.source_type || row.type);
    if (row._gradeIndex === 0) {
      if (type.includes('diyanet') || type.includes('kuran')) return 'preCourse';
      if (/ashb|bakimevi|gunduz bakim|kres/.test(type)) return 'preCare';
      if (type.includes('ozel egitim anaokulu')) return 'preSpecial';
      if (type.includes('anaokul') || type.includes('okul oncesi')) return 'preIndependent';
      if (type.includes('imam hatip ortaokul')) return 'preImam';
      if (type.includes('ilkokul')) return 'prePrimary';
      if (type.includes('ortaokul')) return 'preMiddle';
      if (type.includes('lise') || /meslek|teknik/.test(type)) return 'preHigh';
      if (type.includes('ozel egitim')) return 'preSpecialPrimary';
      return 'preOther';
    }
    if (row._gradeIndex <= 4) return type.includes('ozel egitim') ? 'primarySpecial' : 'primary';
    if (row._gradeIndex <= 8) {
      if (type.includes('ozel egitim')) return 'middleSpecial';
      if (type.includes('imam hatip')) return type.includes('lise') ? 'middleImamHigh' : 'middleImam';
      return 'middle';
    }
    if (type.includes('ozel egitim')) return type.includes('meslek') ? 'highVocationalSpecial' : 'highSpecial';
    if (type.includes('imam hatip')) return type.includes('hazirlik') ? 'highImamPrep' : 'highImam';
    if (type.includes('sosyal bilimler')) return type.includes('bulunmayan') ? 'highSocialNoPrep' : 'highSocial';
    if (type.includes('guzel sanatlar')) return 'highArts';
    if (type.includes('spor')) return 'highSports';
    if (type.includes('fen')) return type.includes('teknoloji') ? 'highTechnology' : 'highScience';
    if (type.includes('teknik')) return 'highTechnical';
    if (/meslek|cok programli|turizm|ticaret/.test(type)) return 'highVocational';
    if (type.includes('hazirlik')) return 'highGeneralPrep';
    return 'highGeneral';
  }

  const highImam = ['highImam','highImamPrep'];
  const highVocational = ['highVocational','highTechnical','highVocationalSpecial'];
  const highGeneral = ['highGeneral','highGeneralPrep','highScience','highTechnology','highSocial','highSocialNoPrep','highSports','highArts'];
  const middleImam = ['middleImam','middleImamHigh'];

  function makeModel(rows, institutionRows) {
    const districts = new Map();
    const schools = new Map();
    function schoolOf(row) {
      const district = norm(row.district);
      const pub = publicKey(row.public_private);
      const key = JSON.stringify([district,row.code || norm(row.name),pub]);
      if (!schools.has(key)) schools.set(key,{district,pub,groups:new Set(),classrooms:null,teachers:null});
      return schools.get(key);
    }
    for (const row of institutionRows) {
      const school = schoolOf(row);
      for (const field of ['classrooms','teachers']) {
        const value = row[field];
        if (value != null && value !== '' && Number.isFinite(Number(value)) && Number(value)>=0) {
          school[field] = Math.max(school[field] ?? 0,Number(value));
        }
      }
    }
    function add(map,key,value,pub) {
      if (!map.has(key)) map.set(key,[0,0,0]);
      const current=map.get(key);
      if (pub==='resmi') current[0]+=value;
      if (pub==='ozel') current[1]+=value;
      current[2]+=value;
    }
    const all = new Map();
    for (const row of rows) {
      const district = norm(row.district);
      if (!districts.has(district)) districts.set(district,new Map());
      const pub=publicKey(row.public_private), kind=category(row);
      const groups=['total',row.level,'grade'+row._gradeIndex,kind];
      if (row._gradeIndex<9) groups.push('basic');
      if (row.students>0) {
        const school=schoolOf(row);
        for (const key of groups) school.groups.add(key);
      }
      for (const key of groups) {
        add(districts.get(district),key,row.students,pub);
        add(all,key,row.students,pub);
      }
    }
    function total(district,...keys) {
      const values=district==null?all:districts.get(norm(district));
      return keys.reduce((sum,key)=>sum.map((value,i)=>value+(values?.get(key)?.[i]||0)),[0,0,0]);
    }
    function quantities(field,district,groups=[]) {
      const matching=[...schools.values()].filter(row=>
        (district==null||row.district===norm(district)) && (!groups.length||groups.some(key=>row.groups.has(key))));
      return [0,1,2].map(index=>{
        const rows=matching.filter(row=>index===2||row.pub===(index===0?'resmi':'ozel'));
        if(!rows.length)return matching.length?0:null;
        if(field==='schools')return rows.length;
        return rows.every(row=>row[field]!=null)?rows.reduce((sum,row)=>sum+row[field],0):null;
      });
    }
    return {total,quantities,hasStudents:rows.length>0};
  }

  function valuesFor(sheet,model) {
    const values=new Map();
    const set=(row,col,value)=>{if(value!=null)values.set(row+':'+col,value);};
    const rowValues=(row,start,items)=>items.forEach((value,i)=>set(row,start+i,value));
    const total=(...keys)=>model.total(null,...keys);
    if (sheet.id==='general') {
      const mappings=[
        [3,[levels[0]]],[4,['primary']],[5,['primarySpecial']],[6,[levels[1]]],
        [7,['middle']],[8,middleImam],[9,['middleSpecial']],[10,[levels[2]]],
        [11,highGeneral],[12,highImam],[13,highVocational],[14,['highSpecial']],[15,[levels[3]]],[16,['total']],
      ];
      for (const [row,keys] of mappings) rowValues(row,3,total(...keys));
      set(11,7,total(...highGeneral,'highSpecial')[2]);
      const ratioGroups=[[levels[0]],[levels[1]],[levels[2]],[...highGeneral,'highSpecial'],highVocational,highImam];
      for (const [row,field,groups] of [[4,'schools',ratioGroups],[9,'classrooms',ratioGroups],[13,'teachers',levels.map(level=>[level])]]) {
        groups.forEach((keys,i)=>{
          const divisor=model.quantities(field,null,keys)[2];
          if(divisor>0)set(row,9+i,total(...keys)[2]/divisor);
        });
      }
      return values;
    }
    const config={levels:[6,19],grades:[4,17],classrooms:[4,17],types:[7,20]};
    const [start,end]=config[sheet.id];
    for(let row=start;row<=end;row++){
      const district=row===end?null:sheet.rows[row-1][1].find(cell=>cell[0]===1)?.[2];
      if(row!==end&&!district)continue;
      const read=(...keys)=>model.total(district,...keys);
      const official=(...keys)=>{const pair=read(...keys);return [pair[0],pair[2]];};
      if(sheet.id==='levels'){
        rowValues(row,2,[
          ...read('preIndependent'),...official('preSpecial'),...read('prePrimary'),...official('preSpecialPrimary'),
          ...read('preMiddle'),...official('preImam'),...official('preHigh'),...official('preCare'),...official('preCourse'),
          ...read(levels[0]),...read(levels[1]),...read('middle','middleSpecial'),...official('middleImam'),...official('middleImamHigh'),
          ...read(levels[2]),...read(...highGeneral,'highSpecial'),...official(...highImam),...read(...highVocational),
          ...read(levels[3]),...read('total'),
        ]);
        if(row!==end)set(row,54,read(...middleImam)[0]);
      }else if(sheet.id==='grades'){
        STUDENT_GRADE_NAMES.forEach((_,i)=>rowValues(row,2+i*2,read('grade'+i).slice(0,2)));
        set(row,30,read('total')[2]);
        rowValues(row,32,read('total'));
        rowValues(row,35,read('basic'));
      }else if(sheet.id==='classrooms'){
        rowValues(row,2,read('total'));
        rowValues(row,7,model.quantities('classrooms',district));
      }else{
        const columns=[
          [levels[0],0],[levels[0],1],['primary',0],['primary',1],['primarySpecial',0],
          ['middle',0],['middle',1],['middleSpecial',0],[middleImam,0],
          ['highGeneral',0],['highGeneral',1],['highGeneralPrep',1],['highScience',0],[['highTechnology','highScience'],1],
          ['highSocial',0],['highSocialNoPrep',0],['highSports',0],['highArts',0],['highSpecial',0],
          ['highVocational',0],['highVocational',1],['highTechnical',0],['highTechnical',1],['highVocationalSpecial',0],
          ['highImam',0],['highImamPrep',0],
        ];
        rowValues(row,2,columns.map(([keys,pub])=>read(...(Array.isArray(keys)?keys:[keys]))[pub]));
        set(row,28,read('total')[2]);
        rowValues(row,30,read(levels[3]).slice(0,row===end?3:2));
      }
    }
    return values;
  }

  function periodText(text) {
    const selected=document.getElementById('periodSelect')?.selectedOptions[0]?.textContent?.replace(/\s*[—–-]\s*Aktif\s*$/i,'').trim();
    if(!selected||!text||!text.includes('2026'))return text;
    return text.replace(/2026\s*[-–]\s*2027\s*EĞİTİM ÖĞRETİM YILI\s*(?:I|1)\.\s*DÖNEM\s*/u,selected.toLocaleUpperCase('tr')+' ')
      .replace(/(?:I|1)\.\s*DÖNEM\s*2026\s*[-–]\s*2027/u,selected.toLocaleUpperCase('tr'));
  }

  function sheetTable(sheet,values) {
    const wrap=element('div',null,'student-catalog-scroll');
    wrap.tabIndex=0;
    wrap.setAttribute('role','region');
    wrap.setAttribute('aria-label',sheet.title);
    const table=element('table',null,'student-sheet-grid');
    table.style.width=sheet.widths.reduce((sum,value)=>sum+value,0)+'px';
    const cols=document.createElement('colgroup');
    for(const width of sheet.widths){
      const col=document.createElement('col');
      col.style.width=width+'px';
      cols.append(col);
    }
    table.append(cols);
    const body=table.createTBody();
    for(const [index,[height,cells]] of sheet.rows.entries()){
      const row=body.insertRow();
      row.style.height=height+'px';
      for(const [col,style,label,rowspan,colspan] of cells){
        const cell=row.insertCell();
        cell.rowSpan=rowspan;
        cell.colSpan=colspan;
        cell.style.cssText=sheet.styles[style];
        const value=values.get((index+1)+':'+col);
        cell.textContent=value==null?(index===0?periodText(label):label)||'':numbers.format(value);
      }
    }
    wrap.append(table);
    return wrap;
  }

  let zipLoader;
  function zipLibrary() {
    if(window.JSZip)return Promise.resolve(window.JSZip);
    if(!zipLoader)zipLoader=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='vendor/jszip.js';
      script.onload=()=>resolve(window.JSZip);
      script.onerror=()=>{zipLoader=null;reject(Error('Excel bileşeni yüklenemedi.'));};
      document.head.append(script);
    });
    return zipLoader;
  }

  async function downloadSheet(sheet,values) {
    const [Zip,response]=await Promise.all([zipLibrary(),fetch('assets/student-sheet-'+sheet.id+'.xlsx')]);
    if(!response.ok)throw Error('Excel şablonu yüklenemedi.');
    const zip=await Zip.loadAsync(await response.arrayBuffer());
    const path='xl/worksheets/sheet1.xml', ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const xml=new DOMParser().parseFromString(await zip.file(path).async('string'),'application/xml');
    const sheetData=xml.getElementsByTagNameNS(ns,'sheetData')[0];
    const rows=new Map([...sheetData.children].map(row=>[Number(row.getAttribute('r')),row]));
    const cells=new Map([...sheetData.getElementsByTagNameNS(ns,'c')].map(cell=>[cell.getAttribute('r'),cell]));
    function address(col) {
      let result='';
      for(let n=col;n;n=Math.floor((n-1)/26))result=String.fromCharCode(65+(n-1)%26)+result;
      return result;
    }
    for(const [key,value] of values) {
      const [row,col]=key.split(':').map(Number), id=address(col)+row;
      let cell=cells.get(id);
      if(!cell){
        cell=xml.createElementNS(ns,'c');
        cell.setAttribute('r',id);
        const line=rows.get(row);
        if(!line)continue;
        const next=[...line.children].find(next=>{const column=next.getAttribute('r').replace(/[0-9]/g,'');return column.length>address(col).length||column.length===address(col).length&&column>address(col);});
        line.insertBefore(cell,next||null);
      }
      cell.setAttribute('t','n');
      const number=xml.createElementNS(ns,'v');
      number.textContent=String(value);
      cell.replaceChildren(number);
    }
    for(const [col,,label] of sheet.rows[0][1]){
      if(!label||periodText(label)===label)continue;
      const cell=cells.get(address(col)+'1');
      const text=cell?.getElementsByTagNameNS(ns,'t')[0];
      if(text)text.textContent=periodText(label);
    }
    zip.file(path,new XMLSerializer().serializeToString(xml));
    const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob), link=element('a');
    link.href=url;
    link.download=sheet.title+'.xlsx';
    link.click();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }

  function printSheet(sheet,table) {
    const frame=document.createElement('iframe');
    frame.className='student-sheet-print-frame';
    frame.title='Yazdırma önizlemesi';
    document.body.append(frame);
    const doc=frame.contentDocument;
    doc.title=sheet.title;
    const style=doc.createElement('style');
    const scale=Math.min(1,1420/Number.parseFloat(table.style.width));
    style.textContent='@page{size:A3 landscape;margin:10mm}body{margin:0}table{border-collapse:collapse;table-layout:fixed;zoom:'+scale+'}td{padding:1px 3px;overflow-wrap:anywhere}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}tr{break-inside:avoid}';
    doc.head.append(style);
    doc.body.append(doc.importNode(table,true));
    frame.contentWindow.addEventListener('afterprint',()=>frame.remove(),{once:true});
    frame.contentWindow.focus();
    frame.contentWindow.print();
  }

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  const panel = document.getElementById('studentCatalogPanel');
  if (!panel) return;
  const catalog = panel.querySelector('.student-catalog-cards');
  const output = panel.querySelector('.student-catalog-report');
  let dataRef, model, selectedId;
  function refresh() {
    if (panel.hidden || !selectedId) return;
    if (dataRef !== D || !model) {
      model = makeModel(D ? window.studentQueryGradeRows() : [], [...(D?.basic || []), ...(D?.secondary || [])]);
      dataRef = D;
    }
    output.replaceChildren();
    if (!model.hasStudents) {
      output.append(element('p', 'Seçili dönemde öğrenci kaydı bulunamadı.'));
      return;
    }
    const sheet = window.StudentSheetLayouts.find(item => item.id===selectedId);
    const values = valuesFor(sheet,model);
    const table = sheetTable(sheet,values);
    const toolbar = element('div',null,'student-sheet-toolbar');
    const status = element('p');
    status.setAttribute('role','status');
    const excel = element('button','Excel İndir','btn excel');
    const print = element('button','Yazdır','btn light');
    excel.type=print.type='button';
    excel.onclick=async()=>{
      excel.disabled=true;
      status.textContent='';
      try{await downloadSheet(sheet,values);}
      catch(error){status.textContent=error.message||'Excel dosyası hazırlanamadı.';}
      finally{excel.disabled=false;}
    };
    print.onclick=()=>printSheet(sheet,table.querySelector('table'));
    toolbar.append(element('h4',sheet.title),status,excel,print);
    output.append(toolbar,table);
  }
  for (const [id, title, subtitle, symbol, color] of definitions) {
    const card = element('button', null, 'student-catalog-card');
    card.type = 'button';
    const icon = element('span', symbol, 'student-catalog-icon ' + color);
    icon.setAttribute('aria-hidden', 'true');
    const copy = element('span');
    copy.append(element('strong', title), element('small', subtitle));
    const arrow = element('span', '›', 'student-catalog-arrow');
    arrow.setAttribute('aria-hidden', 'true');
    card.append(icon, copy, arrow);
    card.setAttribute('aria-pressed', 'false');
    card.onclick = () => {
      selectedId = id;
      catalog.querySelector('[aria-pressed=true]')?.setAttribute('aria-pressed', 'false');
      card.setAttribute('aria-pressed', 'true');
      refresh();
      output.focus({preventScroll:true});
      output.scrollIntoView({block:'nearest'});
    };
    catalog.append(card);
  }
  window.StudentCatalog = {refresh};
})();
