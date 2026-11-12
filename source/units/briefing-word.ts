import JSZip from 'jszip';
import {download} from './export';
import {blocks,chartData,type BriefingPage} from './briefing-presentation';

const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const r = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const pk = 'http://schemas.openxmlformats.org/package/2006/relationships';
const red = 'C00000';
const xml = (text:string) => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+text;
const escape = (value:string) => String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'')
  .replace(/[<>&"']/g,character=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[character]!));
const text = (value:string) => escape(value).split(/\r?\n/).map(line=>'<w:t xml:space="preserve">'+line+'</w:t>').join('<w:br/>');

function paragraph(value:string,style='',properties='',run='') {
  return '<w:p><w:pPr>'+(style?'<w:pStyle w:val="'+style+'"/>':'')+properties+'</w:pPr><w:r>'+run+text(value)+'</w:r></w:p>';
}
function table(rows:string[][],header:boolean) {
  const width=10400;
  const count=rows[0].length;
  const widths=Array.from({length:count},(_,i)=>Math.floor(width/count)+(i<width%count?1:0));
  const borders=['top','left','bottom','right','insideH','insideV'].map(side=>'<w:'+side+' w:val="single" w:sz="4" w:color="'+red+'"/>').join('');
  return '<w:tbl><w:tblPr><w:tblStyle w:val="KlavuzuTablo4-Vurgu51"/><w:tblW w:w="'+width+'" w:type="dxa"/><w:tblBorders>'+borders+'</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblLook w:val="04A0"/></w:tblPr><w:tblGrid>'+
    widths.map(value=>'<w:gridCol w:w="'+value+'"/>').join('')+'</w:tblGrid>'+
    rows.map((row,index)=>'<w:tr><w:trPr><w:cantSplit/>'+(header&&index===0?'<w:tblHeader/>':'')+'</w:trPr>'+
      row.map((value,column)=>'<w:tc><w:tcPr><w:tcW w:w="'+widths[column]+'" w:type="dxa"/></w:tcPr>'+
        paragraph(value,'','<w:spacing w:after="40"/>','<w:rPr>'+(header&&index===0?'<w:b/>':'')+'<w:sz w:val="'+(count>8?17:20)+'"/></w:rPr>')+'</w:tc>').join('')+'</w:tr>').join('')+
    '</w:tbl><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>';
}

export async function exportBriefingWord(pages:BriefingPage[],title:string,period:string,draft:boolean,progress:(n:number)=>void) {
  const response=await fetch(new URL('../assets/briefing-word-template.zip',document.baseURI));
  if(!response.ok)throw Error('Word şablonu yüklenemedi.');
  const zip=await JSZip.loadAsync(await response.arrayBuffer());
  const relationships=[
    ['rIdStyles','styles','styles.xml'],['rIdTheme','theme','theme/theme1.xml'],
    ['rIdSettings','settings','settings.xml'],['rIdFooter','footer','footer1.xml'],['rId9','image','media/image1.png'],
  ];
  const content:string[]=[];
  let media=1;
  async function picture(data:string,limitWidth=6480000,limitHeight=6200000) {
    const match=data.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
    if(!match)return '';
    const image=new Image();
    image.src=data;
    await image.decode();
    const factor=Math.min(limitWidth/image.naturalWidth,limitHeight/image.naturalHeight);
    const cx=Math.round(image.naturalWidth*factor),cy=Math.round(image.naturalHeight*factor);
    const id=++media, target='media/image'+id+'.'+(match[1].toLowerCase()==='png'?'png':'jpeg');
    zip.file('word/'+target,match[2],{base64:true});
    relationships.push(['rIdImage'+id,'image',target]);
    return '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline>'+
      '<wp:extent cx="'+cx+'" cy="'+cy+'"/><wp:docPr id="'+id+'" name="Brifing Görseli '+id+'"/>'+
      '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>'+
      '<pic:nvPicPr><pic:cNvPr id="'+id+'" name="Görsel '+id+'"/><pic:cNvPicPr/></pic:nvPicPr>'+
      '<pic:blipFill><a:blip r:embed="rIdImage'+id+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'+
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'+
      '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
  }
  const sides=['top','left','bottom','right'].map(side=>'<w:'+side+' w:val="thinThickThinSmallGap" w:sz="24" w:space="24" w:color="'+red+'"/>').join('');
  const borders='<w:pgBorders w:offsetFrom="page">'+sides+'</w:pgBorders>';
  const cover = (await zip.file('cover.xml')!.async('string')).replace(/<w:br w:type="page"\s*\/>|<w:lastRenderedPageBreak\s*\/>|<w:pBdr>[\s\S]*?<\/w:pBdr>/g,'');
  zip.remove('cover.xml');
  content.push(cover.replaceAll('__BRIFING_PERIOD__',escape(period.replace(/\s*[—–-]\s*Aktif\s*$/i,'')))
    .replaceAll('__BRIFING_STATUS__',draft?'Güncel Taslaklar':'Eğitim Öğretim Yılı'));
  content.push('<w:p><w:pPr><w:sectPr><w:type w:val="nextPage"/><w:pgSz w:w="11906" w:h="16838"/>'+
    '<w:pgMar w:top="1417" w:right="991" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/>'+
    borders+'<w:titlePg/></w:sectPr></w:pPr></w:p>');
  const center='<w:jc w:val="center"/>';
  content.push(paragraph('İçindekiler','','','<w:rPr><w:b/><w:sz w:val="36"/></w:rPr>'));
  content.push('<w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-2" \\h \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r></w:p>');
  for(const [index,page] of pages.entries()){
    content.push('<w:p><w:hyperlink w:anchor="Brifing'+(index+1)+'"><w:r><w:rPr><w:color w:val="06376A"/></w:rPr>'+text(page.title)+'</w:r></w:hyperlink></w:p>');
  }
  content.push('<w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>');
  for(const [index,page] of pages.entries()){
    const id=index+1;
    content.push('<w:p><w:pPr><w:pStyle w:val="Balk1"/><w:keepNext/>'+(index===0?'<w:pageBreakBefore/>':'')+'</w:pPr>'+
      '<w:bookmarkStart w:id="'+id+'" w:name="Brifing'+id+'"/><w:r>'+text(page.title)+'</w:r><w:bookmarkEnd w:id="'+id+'"/></w:p>');
    for(const block of blocks(page)){
      if(block.title!==page.title)content.push(paragraph(block.title,'Balk2','<w:keepNext/>'));
      if(block.rows[0].length===1)content.push(...block.rows.map(([value])=>paragraph(value)));
      else content.push(table(block.rows,block.header));
    }
    if(page.description?.trim())content.push(paragraph(page.description));
    for(const chart of page.charts||[]){
      const series=chartData(chart,page,pages);
      if(!series.length)continue;
      content.push(paragraph(chart.title||'Grafik Verileri','Balk2','<w:keepNext/>'));
      for(const item of series){
        if(series.length>1)content.push(paragraph(item.name));
        content.push(table([['Kategori','Değer'],...item.labels.map((label,index)=>[label,item.values[index].toLocaleString('tr-TR')])],true));
      }
    }
    for(const data of page.ranges.includes('*')?page.images||[]:[])content.push(await picture(data));
    progress(Math.round((index+1)/pages.length*92));
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  content.push('<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="11906" w:h="16838"/>'+
    '<w:pgMar w:top="900" w:right="750" w:bottom="900" w:left="750" w:header="420" w:footer="420" w:gutter="0"/>'+
    borders+'</w:sectPr>');
  zip.file('word/document.xml',xml('<w:document xmlns:w="'+w+'" xmlns:r="'+r+'" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>'+content.join('')+'</w:body></w:document>'));
  zip.file('word/settings.xml',xml('<w:settings xmlns:w="'+w+'"><w:updateFields w:val="true"/></w:settings>'));
  zip.file('word/footer1.xml',xml('<w:ftr xmlns:w="'+w+'"><w:p><w:pPr>'+center+'</w:pPr><w:fldSimple w:instr="PAGE"><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>'));
  const rels=(items:string[][])=>xml('<Relationships xmlns="'+pk+'">'+items.map(([id,type,target])=>'<Relationship Id="'+id+'" Type="'+r+'/'+type+'" Target="'+target+'"/>').join('')+'</Relationships>');
  zip.file('_rels/.rels',rels([['rIdDocument','officeDocument','word/document.xml']]));
  zip.file('word/_rels/document.xml.rels',rels(relationships));
  const overrides=[['document','document.main'],['styles','styles'],['settings','settings'],['footer1','footer']];
  zip.file('[Content_Types].xml',xml('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+
    '<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>'+
    '<Override PartName="/word/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'+
    overrides.map(([file,type])=>'<Override PartName="/word/'+file+'.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.'+type+'+xml"/>').join('')+'</Types>'));
  const data=await zip.generateAsync({type:'blob',compression:'DEFLATE',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  download(data,title.replace(/[<>:"/\\|?*]/g,'-').slice(0,100)+'.docx');
  progress(100);
}
