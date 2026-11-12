(function () {
  'use strict';
  const categories = [
    ['anaokulu','ozel turk okul oncesi kurumu'], ['ozel egitim anaokulu'],
    ['ilkokul','ozel turk ilkokulu'], ['ozel egitim uygulama okulu (i. kademe)'],
    ['ortaokul','ozel turk ortaokulu','spor ortaokulu','muzik ortaokulu'],
    ['ozel egitim uygulama okulu (ii. kademe)'], ['imam hatip ortaokulu'],
    ['anadolu lisesi','ozel anadolu lisesi'], ['ozel hazirlik sinifi bulunan anadolu lisesi'],
    ['fen lisesi','ozel fen lisesi'], ['ozel fen ve teknoloji lisesi'],
    ['sosyal bilimler lisesi','hazirlik sinifi bulunmayan sosyal bilimler lisesi'],
    ['spor lisesi'], ['guzel sanatlar lisesi'], ['ozel egitim uygulama okulu (iii. kademe)'],
    ['anadolu imam hatip lisesi','hazirlik sinifi bulunan anadolu imam hatip lisesi'], ['imam hatip lisesi'],
    ['anadolu meslek programi','anadolu teknik programi'], ['cok programli anadolu lisesi'],
    ['ozel mesleki ve teknik anadolu lisesi','ozel anadolu meslek programi','ozel anadolu teknik programi'],
    ['ozel egitim meslek okulu (zihinsel engelliler)'],
    ['aksam sanat okulu (dhgm)','ogretmenevi'], ['bilsem (ustun veya ozel yetenekliler)','bilim ve sanat merkezi'],
    ['cocuk etkinlik ve oyun evi'], ['halk egitimi merkezi','halk egitim merkezi'],
    ['ilce milli egitim mudurlugu'], ['mesleki egitim merkezi'], ['olgunlasma enstitusu'],
    ['ogrenci etkinlik merkezi'], ['olcme degerlendirme merkezi'],
    ['ozel egitim ve rehabilitasyon merkezi'], ['ozel motorlu tasit suruculeri kursu'],
    ['ozel muhtelif kurslar','ozel muhtelif kurs'], ['ozel ogretim kursu'],
    ['ozel uzaktan egitim kursu'], ['ozel yurt'],
    ['rehberlik ve arastirma merkezi','rehberlik arastirma merkezi'],
    ['rehberlik ve psikolojik danisma merkezi'], ['sosyal etkinlik ve gelisim merkezi'],
    ['il milli egitim mudurlugu'],
  ];
  const categoryIndex = new Map(categories.flatMap((types,index)=>types.map(type=>[type,index])));
  const columns = [
    [0,0],[0,1],[1,0],[2,0],[2,1],[3,0],[4,0],[4,1],[5,0],[6,0],
    [7,0],[7,1],[8,1],[9,0],[9,1],[10,1],[11,0],[12,0],[13,0],[14,0],
    [15,0],[16,0],[17,0],[18,0],[19,1],[20,0],
    ...Array.from({length:18},(_,i)=>[i+21,[2,7,9,10,11,12,13,14,16,17].includes(i)?1:0]),
  ];
  const indices = (start,end)=>Array.from({length:end-start+1},(_,i)=>i+start);
  const levelGroups = [[0,1],[2,3],[4,5,6],indices(7,20),indices(21,39)];
  const cleanType = value => norm(value).replace(/\(\s+/g,'(').replace(/\s+/g,' ');
  function createModel(data) {
    const rows = (data?.institutions || []).map(record => {
      const category = categoryIndex.get(cleanType(record.type));
      const level = window.schoolEducationLevel(record);
      const group = category==null ? ['Okul Öncesi','İlkokul','Ortaokul','Ortaöğretim'].indexOf(level) : levelGroups.findIndex(items=>items.includes(category));
      const district = norm(record.district);
      const reportDistrict = category===29 && district==='buyuksehir' ? 'mentese' : district;
      return {district:reportDistrict,pub:publicKey(record.status_type)==='resmi'?0:1,category,group:group<0?4:group};
    });
    function counts(district,predicate=()=>true) {
      const counts=[0,0,0];
      for(const row of rows){
        if(district!=null&&row.district!==norm(district)||!predicate(row))continue;
        counts[row.pub]++;
        counts[2]++;
      }
      return counts;
    }
    return {hasRecords:rows.length>0,counts};
  }

  function valuesFor(sheet, model) {
    const values=new Map();
    const put=(row,column,value)=>values.set(row+':'+column,value);
    const write=(row,start,items)=>items.forEach((value,i)=>put(row,start+i,value));
    const {counts}=model;
    const category=(...keys)=>counts(null,item=>keys.includes(item.category));
    if(sheet.id==='institution-schools'){
      const rows = [
        [3,[0]],[4,[1]],[5,levelGroups[0]],[6,[2]],[7,[3]],[8,levelGroups[1]],
        [9,[4]],[10,[6]],[11,[5]],[12,levelGroups[2]],[13,indices(7,13)],
        [14,[15,16]],[15,[17,18,19,20]],[16,[14]],[17,levelGroups[3]],[18,indices(0,20)],
      ];
      for(const [row,keys] of rows){
        const values=([5,8,12,17,18].includes(row))?
          counts(null,item=>row===18?item.group<4:item.group===[5,8,12,17].indexOf(row)):category(...keys);
        if(sheet.rows[row-1][1].find(cell=>cell[0]===4)?.[2]==='-' && values[1]===0){
          put(row,3,values[0]);put(row,5,values[2]);
        }else write(row,3,values);
      }
      return values;
    }
    if(sheet.id==='institution-offices'){
      [39,25,24,21,22,36,27,26,29].forEach((key,i)=>put(3+i,2,category(key)[0]));
      [32,31,33,30,35,34,38,28,23,37].forEach((key,i)=>put(3+i,4,category(key)[1]));
      const offices=counts(null,item=>item.group===4);
      put(13,2,offices[0]);put(13,4,offices[1]);put(14,4,offices[2]);put(15,4,counts(null)[2]);
      return values;
    }
    const detail=sheet.id==='institution-detail';
    const first=detail?6:4,last=detail?19:17;
    for(let row=first;row<=last;row++){
      const district=row===last?null:sheet.rows[row-1][1].find(cell=>cell[0]===1)?.[2];
      if(row!==last&&!district)continue;
      const countsOf=predicate=>counts(district,predicate);
      const summary=levelGroups.flatMap((_,group)=>countsOf(item=>item.group===group).slice(0,2));
      if(!detail){
        if(row===last)summary[8]=countsOf(item=>item.group===4&&item.category!==39)[0];
        write(row,2,summary);
        write(row,12,countsOf());
        continue;
      }
      columns.forEach(([key,pub],index)=>{
        const value=countsOf(item=>item.category===key)[pub];
        if(value||row===last)put(row,index+2,value);
      });
      put(row,46,countsOf(item=>row===last||item.category!==39)[2]);
      write(row,48,summary.slice(0,8));
      write(row,56,countsOf(item=>item.group<4).slice(0,2));
      write(row,58,countsOf(item=>item.group===4&&item.category!==39).slice(0,2));
      if(row===last)put(row,60,countsOf()[2]);
    }
    const provincial=category(39)[2];
    put(21,49,provincial);
    put(22,1,provincial);
    return values;
  }

  const descriptions = ['İlçe ve kurum türüne göre ayrıntılı dağılım','İlçelere göre resmî ve özel okul / kurum toplamları',
    'Okul türlerine göre Muğla geneli','Kurum türlerine göre Muğla geneli'];
  const cards=window.InstitutionSheetLayouts.map((sheet,index)=>[sheet.id,sheet.title,descriptions[index],['▤','▥','▦','▣'][index],['blue','green','purple','slate'][index]]);
  window.InstitutionCatalog=window.mountWorkbookCatalog({
    panel:document.getElementById('institutionCatalogPanel'), layouts:window.InstitutionSheetLayouts,cards,
    createModel, valuesFor, hasRecords:model=>model.hasRecords, empty:'Seçili dönemde okul / kurum kaydı bulunamadı.',
  });
})();
