import {blocks,chartData,type BriefingPage} from './briefing-presentation';

const navy = '#06376A', pale = '#EDF4FA';
const margin = 13, bottom = 282;
const usableWidth = 210-2*margin;

export async function exportBriefingPdf(pages:BriefingPage[], title:string, period:string, draft:boolean, progress:(n:number)=>void) {
  const host:any = parent;
  const pdf = new host.jspdf.jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
  pdf.addFileToVFS('Report.ttf',host.BRIFING_REPORT_FONT);
  pdf.addFont('Report.ttf','Report','normal');
  pdf.addFont('Report.ttf','Report','bold');
  pdf.setFont('Report');
  pdf.setProperties({title,author:'Muğla İl Millî Eğitim Müdürlüğü'});
  let y = margin;

  function reserve(height:number) {
    if (y+height<=bottom) return;
    pdf.addPage();
    y=margin;
  }
  function write(text:string,size:number,color:string,bold=false) {
    pdf.setFont('Report',bold?'bold':'normal');
    pdf.setFontSize(size);
    pdf.setTextColor(color);
    const lines:string[]=pdf.splitTextToSize(text,usableWidth);
    const lineHeight=size*.43;
    reserve(lineHeight+3);
    for (const line of lines) {
      reserve(lineHeight);
      pdf.text(line,margin,y,{baseline:'top'});
      y+=lineHeight;
    }
    y+=3;
  }
  function table(rows:string[][],hasHeader:boolean,chart?:{values:number[]}) {
    if (!rows.length) return;
    const head=hasHeader?[rows[0]]:undefined;
    const body=hasHeader?rows.slice(1):rows;
    const bars=chart?.values || [];
    const max=bars.reduce((value,next)=>Math.max(value,Math.abs(next)),1);
    reserve(hasHeader?18:12);
    pdf.autoTable({
      startY:y,margin:{top:margin,right:margin,bottom:15,left:margin},
      head,body,theme:'grid',rowPageBreak:'avoid',showHead:'everyPage',
      styles:{font:'Report',fontSize:rows[0].length>6?8:9,overflow:'linebreak',cellPadding:1.7,textColor:navy,lineColor:'#D9E5F0',lineWidth:.14},
      headStyles:{fontStyle:'bold',fillColor:navy,textColor:'#FFFFFF'},
      alternateRowStyles:{fillColor:pale},
      ...(chart?{
        columnStyles:{2:{cellWidth:63}},
        didDrawCell({section,column,row,cell}:any){
          if(section!=='body'||column.index!==2)return;
          const value=bars[row.index];
          const left=cell.x+2, width=cell.width-4, middle=left+width/2;
          pdf.setDrawColor('#C9D8E6');
          pdf.line(middle,cell.y+1,middle,cell.y+cell.height-1);
          const span=Math.abs(value)/max*width/2;
          if(span>0){
            pdf.setFillColor(value<0?'#C41236':'#0876C3');
            pdf.rect(value<0?middle-span:middle,cell.y+cell.height/2-1,span,2,'F');
          }
        },
      }:{}),
    });
    y=pdf.lastAutoTable.finalY+4;
  }
  write(title,21,navy,true);
  write([period,draft?'Güncel Taslaklar':''].filter(Boolean).join(' · '),11,navy);
  for (const [index,page] of pages.entries()) {
    reserve(26);
    write(page.title,14,navy,true);
    for (const block of blocks(page)) {
      if(block.title!==page.title){
        reserve(21);
        write(block.title,11,navy,true);
      }
      const count=block.rows[0].length;
      if(count===1){
        for(const [text] of block.rows) write(text,10,navy);
        continue;
      }
      const columns=Array.from({length:count},(_,i)=>i);
      const bands=count<=8?[columns]:Array.from({length:Math.ceil((count-1)/7)},(_,i)=>[0,...columns.slice(i*7+1,i*7+8)]);
      for(const band of bands) table(block.rows.map(row=>band.map(column=>row[column])),block.header);
    }
    for (const chart of page.charts || []) {
      const series=chartData(chart,page,pages);
      if(!series.length)continue;
      reserve(26);
      write(chart.title||'Grafik',11,navy,true);
      for(const item of series){
        if(series.length>1)write(item.name,10,navy);
        table([['Kategori','Değer','Dağılım'],...item.labels.map((label,i)=>[label,item.values[i].toLocaleString('tr-TR'),''])],true,{values:item.values});
      }
    }
    for(const data of page.ranges.includes('*')?page.images||[]:[]){
      const mime=data.match(/^data:image\/(png|jpeg|jpg);base64,/i)?.[1];
      if(!mime)continue;
      const image=pdf.getImageProperties(data);
      const scale=Math.min(usableWidth/image.width,178/image.height);
      const w=image.width*scale,h=image.height*scale;
      reserve(h);
      pdf.addImage(data,mime==='png'?'PNG':'JPEG',(210-w)/2,y,w,h,undefined,'FAST');
      y+=h+4;
    }
    y+=4;
    progress(Math.round((index+1)/pages.length*94));
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  const count=pdf.getNumberOfPages();
  for(let i=1;i<=count;i++){
    pdf.setPage(i);
    pdf.setFont('Report','normal');
    pdf.setFontSize(9);
    pdf.setTextColor(navy);
    pdf.text(String(i),210-margin,290,{align:'right'});
  }
  await pdf.save(title.replace(/[<>:"/\\|?*]/g,'-').slice(0,100)+'.pdf',{returnPromise:true});
  progress(100);
}
