#!/usr/bin/env python3
"""Build research outputs from frozen evidence, not from live production writes.

Input workbook is read into original134.csv by a read-only OOXML extraction.
GPX payloads remain in /tmp; only metrics and fingerprints are exported.
"""
import csv
import hashlib
import io
import json
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from research import OUT, CACHE, v


def get(url):
    """Read frozen local payloads only; assembly must never initiate HTTP."""
    key = hashlib.sha256(url.encode()).hexdigest()
    path = CACHE / (key + '.body')
    if not path.exists():
        raise FileNotFoundError('Missing local evidence payload; run the explicit research manifest first: ' + url)
    return path.read_bytes(), json.loads((CACHE / (key + '.json')).read_text())


def write_json(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def write_csv(name, rows):
    with (OUT / name).open('w', newline='', encoding='utf-8-sig') as f:
        csv.writer(f, lineterminator='\n').writerows(rows)


with (OUT / 'original134.csv').open(encoding='utf-8-sig', newline='') as f:
    original = list(csv.reader(f))
headers = original[0]
base = {r[0]: dict(zip(headers, r)) for r in original[1:]}
assert len(base) == 134
attempts = []
for name in ('first15-results.json', 'series2-results.json', 'series3-results.json', 'comparison-results.json'):
    attempts += json.loads((OUT / name).read_text())
baseline = json.loads((OUT.parent / 'technical-evidence.json').read_text())['candidates']
files = []
previous_hashes = {r['sha'] for r in base.values() if r.get('sha')}
url_to_old = {r.get('track'): r for r in base.values() if r.get('track')}
for r in baseline:
    if r['file_status'] != 'VALID':
        continue
    old = url_to_old[r['target_url']]
    files.append(dict(candidate_id=old['ID'], event=old['naziv'], route=old['proga'],
                      target_url=r['target_url'], source_url=r['source_url'], file_status='FILE_VALID',
                      sha256=r['target_http']['sha256'], bytes=r['target_http']['bytes'], gpx=r['gpx'],
                      http=r['target_http'], evidence_origin='PR247_P0_REUSED', new_in_p0d=False,
                      declared_km=float(old['km']), file_year=int(old['leto_gpx']),
                      year_evidence='P0 provenance-evidence.json; organizer historical edition',
                      provenance='URADNI_PREVIOUS_EVIDENCE', linked_from_live_source=None))
for id in ('GPX-0015', 'GPX-0016', 'GPX-0018'):
    r = base[id]
    files.append(dict(candidate_id=id, event=r['naziv'], route=r['proga'], source_url=r['source'],
                      target_url=r['track'], file_status='FILE_VALID', sha256=r['sha'],
                      bytes=int(float(r['velikost_B'])), declared_km=float(r['km']),
                      file_year=2026, year_evidence=r['dokaz_letnice_03_11'],
                      gpx=dict(structural_check='PASS_REPORTED_IN_INPUT_WORKBOOK',
                               distance_km=float(r['GPX_metraza_km_03_11']), track_points=int(float(r['st_GPS_tock'])),
                               names_and_descriptions=[r['metadata_gpx']], warnings=[]),
                      evidence_origin='INPUT_WORKBOOK_LOCAL_VALIDATION_REUSED', new_in_p0d=False,
                      provenance='URADNI_PREVIOUS_EVIDENCE', linked_from_live_source=None,
                      http=dict(status=None, note='Connector HTTP code not exposed; not re-fetched')))

seen_targets = set()
for attempt in attempts:
    if attempt['target_url'] in seen_targets:
        continue
    seen_targets.add(attempt['target_url'])
    id = attempt['id']
    r = base.get(id, {})
    expected = attempt.get('expected_km') or (float(r['km']) if r.get('km') else None)
    body = None
    if attempt.get('files'):
        body, _ = get(attempt['target_url'])
    for member in attempt.get('files', []):
        f = dict(candidate_id=id, event=attempt['event'], route=attempt['route'],
                 source_url=attempt['source_url'], target_url=attempt['target_url'],
                 http=attempt['target_http'], declared_km=expected,
                 archive_sha256=attempt.get('zip', {}).get('archive_sha256'),
                 archive_bytes=attempt.get('zip', {}).get('archive_bytes'),
                 archive_member=member.get('member'), **{k: val for k, val in member.items() if k != 'member'},
                 evidence_origin='P0D_BYTE_DOWNLOAD', new_in_p0d=member['sha256'] not in previous_hashes,
                 linked_from_live_source=attempt['linked_from_live_source'],
                 provenance='URADNI_LIVE_LINK' if attempt['linked_from_live_source'] else 'URADNI_PRIOR_CATALOG_LINK_REVIEW')
        if f['file_status'] == 'FILE_VALID':
            payload = zipfile.ZipFile(io.BytesIO(body)).read(member['member']) if member.get('member') else body
            f['gpx'] = v.validate_gpx(payload, expected)
        if id == 'GPX-0134':
            pdf = json.loads((OUT / 'ptrf2025-pdf-evidence.json').read_text())
            f['linked_from_live_source'] = f['target_url'] in pdf['links']
            f['provenance'] = 'URADNI_PDF_2025_DIRECT_LINK'
        elif id == 'GPX-0012':
            f['alternate_source_url'] = 'https://ponikva4trail.si/razdalje-tek/'
            f['provenance'] = 'URADNI_ALTERNATE_LIVE_LINK'
            f['linked_from_live_source'] = True
        elif id == 'GPX-0121':
            f['provenance'] = 'URADNI_EMBEDDED_GPX_SHORTCODE'
            f['source_reference_kind'] = 'Visible [sgpx gpx=…] shortcode, not an anchor'
        names = ' '.join(f.get('gpx', {}).get('names_and_descriptions', []))
        # A name that is just a GPS timestamp is not an edition label.
        names = re.sub(r'20\d{2}-\d\d-\d\dT\S+', '', names)
        years = sorted({int(y) for y in re.findall(r'(?<!\d)20\d{2}(?!\d)', names)})
        f['metadata_label_years'] = years
        f['file_year'] = years[0] if len(years) == 1 else None
        f['year_evidence'] = 'Explicit GPX route-name edition label; GPS times excluded' if f['file_year'] else 'Edition unknown; upload folder and GPS timestamps are not edition proof'
        if id == 'GPX-0012': f['file_year'] = 2024
        if id == 'GPX-0134': f['year_evidence'] = 'Organizer 2025 PDF explicitly links this URL; GPX label agrees'
        if id == 'GPX-0132' or id == 'GPX-0133':
            f['year_evidence'] = '2026 organizer page; preview/current byte variants; file edition not explicit'
        # Existing snapshot is not overwritten or counted twice by the justified GM4O recheck.
        previous = next((x for x in files if x['target_url'] == f['target_url'] and x['sha256'] == f['sha256']), None)
        if previous:
            previous.update(gpx=f.get('gpx'), current_http=f['http'], recheck_reason=attempt.get('reason_for_refetch'),
                            recheck_sha_matches=True)
        else:
            files.append(f)

for i, f in enumerate(files, 1):
    f['result_id'] = f'P0D-F{i:03d}'
    f['rehost_permission'] = 'NOT_ESTABLISHED'
    f['edition_status'] = 'NOT_CONFIRMED'
    if f.get('file_year') == 2027 and f.get('linked_from_live_source'):
        f['edition_status'] = 'ORGANIZER_2027_FILE_LABEL_SUPPORTED_REGISTRY_REVIEW'
    f['review'] = []
    f['duplicate_flags'] = []
    if not f.get('file_year'): f['review'].append('FILE_EDITION_UNKNOWN')
    if f.get('file_year') and f['file_year'] != 2027: f['review'].append('NOT_A_CONFIRMED_2027_FILE')
    if f['file_status'] != 'FILE_VALID': f['review'].append(f.get('error', 'INVALID_GPX'))
    if f.get('declared_km') and f.get('gpx', {}).get('distance_km'):
        diff = f['gpx']['distance_km'] - f['declared_km']
        f['distance_delta_km'] = round(diff, 3)
        f['distance_delta_pct'] = round(diff / f['declared_km'], 5)
        if abs(diff) > 1 and abs(diff) / f['declared_km'] > .10:
            f['review'].append('DISTANCE_DIFFERENCE_OVER_10_PERCENT_AND_1_KM')
    if f['candidate_id'] in ('GPX-0069', 'GPX-0070'):
        f['review'].append('CURRENT_2027_SOURCE_DOES_NOT_CONFIRM_INPUT_2026_GEOMETRY')
    if f['candidate_id'] == 'GPX-0022': f['review'].append('30_KM_SOURCE_REDIRECTS_TO_35_KM')
    if f['candidate_id'] in ('GPX-0074', 'GPX-0075'):
        f['review'].append('MASTER_2026_ROW_251_DATE_2026_10_24_VS_ORGANIZER_2026_11_21')
    if f['candidate_id'] in ('GPX-0132','GPX-0133') and not f['linked_from_live_source']:
        f['review'].append('PREVIEW_FILE_REPLACED_ON_CURRENT_PAGE')
    f['review'] += f.get('gpx', {}).get('warnings', [])


def positions(f):
    body, _ = get(f['target_url'])
    if f.get('archive_member'):
        body = zipfile.ZipFile(io.BytesIO(body)).read(f['archive_member'])
    root = ET.fromstring(body, parser=ET.XMLParser(target=v.NoDTD()))
    ns = {'g': v.NS[root.get('version')]}
    segs = root.findall('g:trk/g:trkseg', ns)
    point_tag = 'g:trkpt'
    if not segs:
        segs = root.findall('g:rte', ns); point_tag = 'g:rtept'
    edges=[]; total=0
    for seg in segs:
        points=[(float(p.get('lat')),float(p.get('lon'))) for p in seg.findall(point_tag,ns)]
        for a,b in zip(points,points[1:]):
            distance=v.haversine(a,b)
            if distance:edges.append((total,total+distance,a,b));total+=distance
    samples=[]; j=0
    for i in range(256):
        distance=total*i/255
        while j < len(edges)-1 and distance > edges[j][1]: j+=1
        lo,hi,a,b=edges[j];ratio=(distance-lo)/(hi-lo)
        samples.append((a[0]+ratio*(b[0]-a[0]),a[1]+ratio*(b[1]-a[1])))
    return samples


comparisons=[]
pair_ids=[('GPX-0132','GPX-0132'),('GPX-0133','GPX-0133'),('GPX-0134','GPX-0005'),('GPX-0026','GPX-0026')]
for left,right in pair_ids:
    group=[f for f in files if f['candidate_id'] in (left,right) and f['file_status']=='FILE_VALID']
    if len(group)!=2: continue
    a,b=group
    ap,bp=positions(a),positions(b)
    distances=min(([v.haversine(x,y)*1000 for x,y in zip(ap,other)] for other in (bp,list(reversed(bp)))),key=sum)
    p95=sorted(distances)[int(.95*255)]
    near=p95<100 and abs(a['gpx']['distance_km']-b['gpx']['distance_km'])/a['gpx']['distance_km']<.02
    flag='POSSIBLE_GEOMETRY_DUPLICATE' if near else 'GEOMETRY_DIFFERS_IN_SAMPLED_COMPARISON'
    comparisons.append(dict(left=a['result_id'],right=b['result_id'],status=flag,byte_equal=a['sha256']==b['sha256'],
                            rounded_geometry_hash_equal=a['gpx'].get('geometry_sha256_6dp')==b['gpx'].get('geometry_sha256_6dp'),
                            samples=256,p95_separation_m=round(p95,1),max_separation_m=round(max(distances),1),
                            method='Normalized cumulative within-segment length, linear interpolation; choose forward/reverse, no cyclic alignment. Screening only, not full geometry equivalence.'))
    if near:
        a['duplicate_flags'].append(flag+':'+b['result_id']);b['duplicate_flags'].append(flag+':'+a['result_id'])

hash_groups=defaultdict(list)
for f in files:hash_groups[f['sha256']].append(f)
for group in hash_groups.values():
    if len(group)>1:
        for f in group:f['duplicate_flags'].append('BYTE_DUPLICATE')
valid=[f for f in files if f['file_status']=='FILE_VALID']
counts=Counter(f['event'] for f in valid)
summary=dict(original_candidates=134,new_candidates=5,catalog_rows=139,
             previous_valid_unique_files=10,previous_pr247_files=7,previous_workbook_only_files=3,
             new_valid_unique_files=len({f['sha256'] for f in valid if f['new_in_p0d']}),
             total_valid_unique_files=len({f['sha256'] for f in valid}),
             valid_files_with_p0d_byte_evidence=sum(f['evidence_origin']=='P0D_BYTE_DOWNLOAD' or f.get('recheck_sha_matches',False) for f in valid),
             first15_statuses=dict(Counter(a['status'] for a in attempts[:15])),
             unique_p0d_target_urls=len(seen_targets),duplicate_target_attempts=len(attempts)-len(seen_targets),
             invalid_files=sum(f['file_status']!='FILE_VALID' for f in files),
             events_with_valid_files=len(counts),valid_files_by_event=dict(counts),
             possible_geometry_duplicate_pairs=sum(c['status']=='POSSIBLE_GEOMETRY_DUPLICATE' for c in comparisons),
             geometry_pairs_compared=len(comparisons),byte_duplicate_groups=sum(len(g)>1 for g in hash_groups.values()),
             organizer_2027_file_labels_supported=sum(f['edition_status'].startswith('ORGANIZER_2027') for f in valid),
             edition_registry_confirmed=0,
             estimated_current_official_external_file_links=sum(f.get('linked_from_live_source') is True for f in valid),
             p0d_zip_archives=len({f['archive_sha256'] for f in files if f.get('archive_sha256')}),
             p0d_http_errors=sum(a['status']=='HTTP_ERROR' for a in attempts),
             p0d_environment_unavailable=sum(a['status']=='NOT_AVAILABLE_FROM_ENVIRONMENT' for a in attempts))

write_json('technical-results.json',files)
write_json('geometry-comparisons.json',comparisons)
write_json('summary.json',summary)

technical_headers=['result_id','candidate_id','event','route','file_status','file_year','edition_status','declared_km','distance_km','distance_delta_pct','track_points','segments','bytes','sha256','archive_sha256','archive_member','provenance','source_url','target_url','HTTP','new_in_p0d','evidence_origin','rehost_permission','duplicate_flags','review','checked_at','method']
technical_rows=[technical_headers]
for f in files:
    row=[]
    for h in technical_headers:
        val=f.get(h)
        if h in ('distance_km','track_points','segments'):val=f.get('gpx',{}).get(h)
        if h=='HTTP':val=f.get('http',{}).get('status')
        if h=='checked_at':val=f.get('current_http',f.get('http',{})).get('checked_at')
        if h=='method':val='Byte download + existing GPX validator' if f['new_in_p0d'] else 'Previous evidence reused; see evidence_origin'
        if isinstance(val,list):val=' | '.join(val)
        row.append(val)
    technical_rows.append(row)
write_csv('technical-results.csv',technical_rows)

newrows=[]
for id in ('GPX-0135','GPX-0136','GPX-0137','GPX-0138','GPX-0139'):
    f=next(f for f in files if f['candidate_id']==id)
    record=dict(ID=id,skupina='P0D_NEW_COURSE',naziv=f['event'],leto='2027',leto_gpx=f['file_year'],
                proga=f['route'],km=f['declared_km'],organizator='K24' if 'K24' in f['event'] else 'Hg Trail Idrija',
                master_leto='2027',master_vrstica='20' if 'K24' in f['event'] else '33',
                source=f['source_url'],track=f['target_url'],provenance='URADNI',rehost='NOT_ESTABLISHED',
                review='DA',checked='2026-11-03',note='Current organizer course; GPX edition remains unconfirmed')
    base[id]=record;newrows.append([record.get(h) for h in headers])

extra=['P0D_rezultat','P0D_datoteke','P0D_vir','P0D_target','P0D_HTTP','P0D_izmerjeno_km','P0D_deklarirano_km',
       'P0D_tocke','P0D_segmenti','P0D_bytes','P0D_SHA256','P0D_arhiv_SHA256','P0D_leto_datoteke',
       'P0D_dokaz_letnice','P0D_izvedba_status','P0D_izvor','P0D_dvojnik','P0D_REVIEW','P0D_naslednji_korak','P0D_preverjeno','P0D_rehost']
catalog=[headers+extra]
for row in original[1:]+newrows:
    id=row[0];r=base[id];fs=[f for f in files if f['candidate_id']==id]
    if id=='GPX-0106':fs=[f for f in files if f['candidate_id']=='GPX-0022']
    if id=='GPX-0040':fs=[f for f in files if f['candidate_id']=='GPX-0134']
    selected=next((f for f in reversed(fs) if f.get('linked_from_live_source')),fs[-1] if fs else {})
    status=selected.get('file_status','NOT_BYTE_VALIDATED_IN_P0D')
    if id in ('GPX-0069','GPX-0070'):status='FILE_VALID_INPUT_2026_ASSOCIATION_REVIEW'
    if id=='GPX-0040':status='DUPLICATE_CANDIDATE_OF_GPX-0134'
    if id=='GPX-0106':status='SHARED_URL_WITH_GPX-0022_COURSE_NAME_REVIEW'
    g=selected.get('gpx',{})
    review=list(selected.get('review',[]))
    if id in ('GPX-0023','GPX-0106'):review.append('INPUT_30_60_VS_CURRENT_35_50_COURSES')
    extras=[status,' | '.join(f['result_id'] for f in fs),selected.get('source_url'),selected.get('target_url'),
            selected.get('http',{}).get('status'),g.get('distance_km'),selected.get('declared_km'),g.get('track_points'),g.get('segments'),
            selected.get('bytes'),selected.get('sha256'),selected.get('archive_sha256'),selected.get('file_year'),
            selected.get('year_evidence'),selected.get('edition_status','NOT_CONFIRMED'),selected.get('provenance'),
            ' | '.join(selected.get('duplicate_flags',[]))+(' SAME_EVENT_YEAR_COURSE:GPX-0134' if id=='GPX-0040' else ''),
            ' | '.join(review),'Preveri izvedbo, različico in pravice pred javnim prikazom.' if fs else 'Ohrani izvirno dokazilo; neposredni dovoljeni GPX še ni potrjen.',
            '2026-11-03' if fs else None,'NOT_ESTABLISHED']
    catalog.append(row+[None]*(len(headers)-len(row))+extras)
write_csv('catalog.csv',catalog)
write_json('workbook-data.json',dict(catalog=catalog,technical=technical_rows,summary=summary))
print(json.dumps(summary,ensure_ascii=False,indent=2))
