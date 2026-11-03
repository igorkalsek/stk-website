#!/usr/bin/env python3
"""Offline integrity/readback audit. --payloads also checks locally cached raw bytes."""
import argparse
import csv
import hashlib
import io
import json
import posixpath
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parent
BASE=ROOT.parent/'p0d'
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def book(path):
    with zipfile.ZipFile(path) as z:
        shared=[]
        if 'xl/sharedStrings.xml' in z.namelist():
            shared=[''.join(x.itertext()) for x in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        rel={r.get('Id'):r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        sheets={}
        for s in ET.fromstring(z.read('xl/workbook.xml')).find('m:sheets',NS):
            target=rel[s.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')]
            target=target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/'+target)
            xml=ET.fromstring(z.read(target));cells={}
            for c in xml.findall('m:sheetData/m:row/m:c',NS):
                e=c.find('m:v',NS);value=e.text if e is not None else None
                if c.get('t')=='s':value=shared[int(value)]
                elif c.get('t')=='inlineStr':value=''.join(c.find('m:is',NS).itertext())
                elif c.get('t','n')=='n' and value is not None:value=float(value)
                if value not in ('',None):cells[c.get('r')]=value
                formula=c.find('m:f',NS)
                if formula is not None:cells[c.get('r')+':formula']=formula.text
            sheets[s.get('name')]=cells
        return sheets


def readcsv(path):
    with path.open(encoding='utf-8-sig',newline='') as f:return list(csv.reader(f))


def native_features(path):
    with zipfile.ZipFile(path) as z:
        tables={};panes=[]
        for name in z.namelist():
            if name.startswith('xl/tables/') and name.endswith('.xml'):
                t=ET.fromstring(z.read(name))
                tables[t.get('name')]=dict(ref=t.get('ref'),columns=[c.attrib for c in t.findall('m:tableColumns/m:tableColumn',NS)],
                                          style=t.find('m:tableStyleInfo',NS).attrib)
            if re_sheet(name):
                t=ET.fromstring(z.read(name));p=t.find('m:sheetViews/m:sheetView/m:pane',NS)
                panes.append((name,p.attrib if p is not None else None))
        return tables,dict(panes)


def re_sheet(name):
    import re
    return re.fullmatch(r'xl/worksheets/sheet\d+\.xml',name) is not None


def run(payloads=False):
    baseline=json.loads((ROOT/'baseline-integrity.json').read_text())
    repo=ROOT.parents[2]
    for entry in baseline['files']:
        path=repo/entry['path']
        assert hashlib.sha256(path.read_bytes()).hexdigest()==entry['sha256'],entry['path']
    print('P0D: all 26 files byte-for-byte unchanged from 47547c3')
    old=book(BASE/'outputs/dev048-p0d/STK_GPX_P0D_2026-11-03.xlsx')
    new=book(ROOT/'outputs/dev048-p0e/STK_GPX_P0E_2026-11-03.xlsx')
    assert len(old)==15 and len(new)==19
    for name,values in old.items():assert new[name]==values,name
    print('XLSX: all 15 P0D sheets preserve every nonblank value and formula')
    a_tables,a_panes=native_features(BASE/'outputs/dev048-p0d/STK_GPX_P0D_2026-11-03.xlsx')
    b_tables,b_panes=native_features(ROOT/'outputs/dev048-p0e/STK_GPX_P0E_2026-11-03.xlsx')
    assert all(b_tables[k]==value for k,value in a_tables.items())
    assert all(b_panes[k]==value for k,value in a_panes.items())
    print('XLSX: original table names/ranges/columns/styles and frozen panes preserved')
    a,b=readcsv(BASE/'catalog.csv'),readcsv(ROOT/'catalog.csv')
    assert len(a)==140 and len(b)==173
    for left,right in zip(a,b):assert left==right[:len(a[0])]
    ids=[row[0] for row in b[1:]];assert len(ids)==len(set(ids))==172
    print('CSV: all 139 P0D rows/columns preserved; 33 new research/category/course IDs')
    oldfiles=json.loads((BASE/'technical-results.json').read_text())
    files=json.loads((ROOT/'technical-results.json').read_text())
    assert files[:len(oldfiles)]==oldfiles
    fresh=[f for f in files if f.get('new_in_p0e')]
    valid=[f for f in files if f['file_status']=='FILE_VALID']
    assert len(fresh)==len({f['sha256'] for f in fresh})==41
    assert len({f['sha256'] for f in valid})==91
    assert len({f['event'] for f in valid})==26
    direct=json.loads((ROOT/'first12-results.json').read_text())
    assert len(direct)==12
    assert all(r['status']=='VALID' and r['target_http']['status']==200 for r in direct)
    observations=json.loads((ROOT/'observations.json').read_text())
    a=next(o for o in observations if o['id']=='P0E-006')
    b=next(o for o in observations if o['id']=='P0E-007')
    assert a['result_ids']==b['result_ids'] and len(a['result_ids'])==2
    assert new['P0E_POVZETEK']['C6']==41 and new['P0E_POVZETEK']['C7']==91
    assert all(f['rehost_permission']=='NOT_ESTABLISHED' for f in files)
    assert not list(ROOT.rglob('*.gpx')) and not list(ROOT.rglob('*.zip'))
    print('Evidence: 12/12 initial targets valid; shared JAT categories counted once; 50 + 41 = 91 SHA, 26 families')
    if payloads:
        import research
        for f in fresh:
            key=hashlib.sha256(f['target_url'].encode()).hexdigest()
            body=(research.CACHE/(key+'.body')).read_bytes()
            if f.get('archive_sha256'):
                assert hashlib.sha256(body).hexdigest()==f['archive_sha256']
                result=research.v.validate_zip(body)
                assert any(x['sha256']==f['sha256'] for x in result['files'])
                body=zipfile.ZipFile(io.BytesIO(body)).read(f['archive_member'])
            assert len(body)==f['bytes'] and hashlib.sha256(body).hexdigest()==f['sha256']
            result=research.v.validate_gpx(body,f['declared_km'])
            assert result['distance_km']==f['gpx']['distance_km']
            assert result['geometry_sha256_6dp']==f['gpx']['geometry_sha256_6dp']
        print('Payloads: all 41 new GPX hashes/bytes/XML/distance/fingerprints reproduced offline; ZIP safety rechecked')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--payloads',action='store_true')
    run(parser.parse_args().payloads)
