/* Run with NODE_PATH pointing to the desktop's bundled Playwright installation. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const JSZip=require('jszip');
test('OOXML keeps Turkish names/text and embedded chart/image definitions',async()=>{
 const {chromium}=require('playwright'),browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),headless:true});
 try{
  const zip=new JSZip();
  zip.file('xl/workbook.xml','<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="İşgücü – Öğretmen" r:id="r1"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>');
  zip.file('xl/sharedStrings.xml','<sst><si><t>Şube – Ölçme ve Değerlendirme</t></si></sst>');
  zip.file('xl/worksheets/sheet1.xml','<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1"><v>0</v></c></row></sheetData><drawing r:id="drawing"/></worksheet>');
  zip.file('xl/worksheets/_rels/sheet1.xml.rels','<Relationships><Relationship Id="drawing" Target="../drawings/drawing1.xml"/></Relationships>');
  zip.file('xl/drawings/drawing1.xml','<drawing xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><blip r:embed="picture"/><chart r:id="graph"/></drawing>');
  zip.file('xl/drawings/_rels/drawing1.xml.rels','<Relationships><Relationship Id="picture" Target="../media/image.png"/><Relationship Id="graph" Target="../charts/chart1.xml"/></Relationships>');
  zip.file('xl/media/image.png',Buffer.from('test-image'));
  zip.file('xl/charts/chart1.xml','<chartSpace><chart><title><t>Öğrenci Sayısı</t></title><plotArea><pieChart><ser><tx><v>Sayısı</v></tx><cat><strRef><f>Sheet!A1</f><strCache><pt idx="0"><v>İlkokul</v></pt></strCache></strRef></cat><val><numRef><f>Sheet!B1</f><numCache><pt idx="0"><v>0</v></pt></numCache></numRef></val></ser></pieChart></plotArea></chart></chartSpace>');
  const page=await browser.newPage();await page.route('https://qa.test/',r=>r.fulfill({contentType:'text/html',body:'<html></html>'}));await page.goto('https://qa.test/');
  await page.addScriptTag({path:require.resolve('jszip/dist/jszip.min.js')});await page.addScriptTag({path:require.resolve('../js/unit-excel-media.js')});
  const result=await page.evaluate(async b64=>{const workbook={SheetNames:['corrupt-name'],Sheets:{'corrupt-name':{A1:{v:'corrupt-text'},B1:{v:99}}}},media=await UnitExcelMedia.read(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),JSZip,workbook);return {workbook,media};},await zip.generateAsync({type:'base64'}));
  assert.deepEqual(result.workbook.SheetNames,['İşgücü – Öğretmen']);assert.equal(result.workbook.Sheets['İşgücü – Öğretmen'].A1.v,'Şube – Ölçme ve Değerlendirme');assert.equal(result.workbook.Sheets['İşgücü – Öğretmen'].B1.v,0);
  const media=result.media['İşgücü – Öğretmen'];assert.equal(media.images.length,1);assert.equal(media.charts[0].type,'pie');assert.equal(media.charts[0].title,'Öğrenci Sayısı');assert.equal(media.charts[0].series[0].categories[0],'İlkokul');
 }finally{await browser.close();}
});
