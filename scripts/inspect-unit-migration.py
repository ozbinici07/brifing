"""Read-only audit of the legacy application. Never uploads data or edits the source."""
import argparse, base64, hashlib, json, sqlite3
from collections import Counter
from pathlib import Path
USERNAMES={4:'sivilsavunma',5:'isguvenligi',6:'bilgiislem',7:'insankaynaklari',8:'disiplin',9:'basinhalkla',10:'temelegitim',11:'ortaogretim',12:'strateji',13:'olcmedegerlendirme',14:'ozelogretim',15:'insaatemlak',16:'meslekiteknik',17:'destek',18:'butcetahakkuk',19:'denklik',20:'dinogretimi',21:'yuksekogretim',22:'hayatboyu',23:'meslekigelisim',24:'ozelegitim',25:'yenilikteknoloji',26:'istatistik'}
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
def inspect(root):
    root=Path(root).resolve()
    workbook=root/'Brifing Excel.xlsx'
    seed_path=root/'app/data/seed.json'
    cache_path=root/'app/.local/last-good-excel.json'
    db=root/'app/.local/panel.sqlite3'
    original_stat=(workbook.stat().st_mtime_ns,workbook.stat().st_size)
    seed=json.loads(seed_path.read_text(encoding='utf-8'))
    cache=json.loads(cache_path.read_text(encoding='utf-8'))
    if Path(cache.get('source','')).resolve()!=workbook:
        raise ValueError('Önbellek farklı Excel dosyasına ait.')
    if cache.get('modified') != workbook.stat().st_mtime:
        raise ValueError('Excel kaydedildikten sonra eski uygulamada eşitlemenin tamamlanmasını bekleyiniz.')
    if seed!=cache.get('data'):
        raise ValueError('Kaynak görüntüleri uyuşmuyor; eski sistemde eşitlemeyi tamamlayınız.')
    units={str(u['id']):dict(u) for u in seed['units']}
    records={str(r['id']):json.loads(json.dumps(r)) for r in seed['records']}
    warnings=[]
    connection=sqlite3.connect(db.as_uri()+'?mode=ro',uri=True)
    try:
        connection.execute('BEGIN')
        documents=connection.execute('select key,value,revision from documents order by key').fetchall()
        pending=connection.execute('select count(*) from pending_excel_links').fetchone()[0]
        if pending:raise ValueError('Eski sistemde bekleyen Excel eşitlemesi var; önce tamamlayınız.')
        for key,value,revision in documents:
            kind,ident=key.split(':',1);value=json.loads(value)
            if kind=='unit' and ident in units:units[ident].update(value)
            elif kind=='record':
                if ident in records:
                    allowed=['links','description','owner','status','due','updated','deleted']
                    records[ident].update({k:value[k] for k in allowed if k in value})
                elif value.get('source') is False and isinstance(value.get('rows'),list):records[ident]=value
                else:warnings.append({'code':'orphan-record-overlay','id':ident})
    finally:connection.close()
    active_units=[u for u in units.values() if not u.get('deleted')]
    ids={u['id'] for u in active_units}
    active_records=[]
    for record in records.values():
        if record.get('deleted'):continue
        record['links']=[l for l in record.get('links',[]) if l['unit'] in ids]
        if not record['links']:warnings.append({'code':'unassigned-record','id':record['id']})
        active_records.append(record)
    assets={}
    for record in active_records:
        for reference in record.get('images',[]):
            candidate=(root/'app/public'/reference.lstrip('/')).resolve()
            candidate.relative_to((root/'app/public/assets').resolve())
            data=candidate.read_bytes()
            assets[reference]={'sha256':hashlib.sha256(data).hexdigest(),'base64':base64.b64encode(data).decode('ascii')}
    if original_stat!=(workbook.stat().st_mtime_ns,workbook.stat().st_size):
        raise ValueError('Excel inceleme sırasında değişti; tekrar deneyiniz.')
    counts=Counter(l['unit'] for r in active_records for l in r['links'])
    usernames=[{'unitId':u['id'],'unit':u['name'],'username':USERNAMES.get(u['id'],'birim'+str(u['id'])),'tables':counts[u['id']]} for u in active_units]
    if len({x['username'] for x in usernames})!=len(usernames):raise ValueError('Kullanıcı adı çakışması.')
    report={'sourceSha256':sha(workbook),'seedSha256':sha(seed_path),'units':len(active_units),'records':len(active_records),'rows':sum(len(r['rows']) for r in active_records),'charts':sum(len(r.get('charts',[])) for r in active_records),'images':len(assets),'usernames':usernames,'warnings':warnings}
    snapshot={'format':'brifing-unit-migration-v1','source':{'name':workbook.name,'sha256':report['sourceSha256'],'period':seed.get('period')},'units':active_units,'records':active_records,'assets':assets,'warnings':warnings}
    return report,snapshot
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',default=r'C:\Brifing Excel')
    parser.add_argument('--report',required=True)
    parser.add_argument('--snapshot',help='Optional private snapshot. Keep outside tracked files; never commit it.')
    args=parser.parse_args()
    report,snapshot=inspect(args.source)
    for target,data in [(args.report,report),(args.snapshot,snapshot)]:
        if target:
            path=Path(target).resolve()
            if Path(args.source).resolve() in path.parents:raise ValueError('Çıktı kaynak klasörüne yazılamaz.')
            path.parent.mkdir(parents=True,exist_ok=True)
            path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='usernames'},ensure_ascii=True))
if __name__=='__main__':main()

