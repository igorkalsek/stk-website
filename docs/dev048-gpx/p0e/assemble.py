#!/usr/bin/env python3
"""Assemble P0E from frozen responses only. Never fetch or modify P0/P0D."""
import copy
import csv
import hashlib
import io
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
import research

OUT, CACHE, v = research.OUT, research.CACHE, research.v
BASE = OUT.parent / 'p0d'


def save(name, data):
    (OUT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')


def csvout(name, rows):
    with (OUT/name).open('w',encoding='utf-8-sig',newline='') as f:
        csv.writer(f,lineterminator='\n').writerows(rows)


def cached(url):
    key=hashlib.sha256(url.encode()).hexdigest()
    return (CACHE/(key+'.body')).read_bytes(),json.loads((CACHE/(key+'.json')).read_text())


names=['first12-results.json','buttons-results.json','drive-results.json','breadth-results.json',
       'lahinja-results.json','current-results.json','svinjskih-results.json','last-results.json']
attempts=[r for name in names for r in json.loads((OUT/name).read_text())]
oldfiles=json.loads((BASE/'technical-results.json').read_text())
old_valid={f['sha256'] for f in oldfiles if f['file_status']=='FILE_VALID'}
assert len(old_valid)==50
with (BASE/'catalog.csv').open(encoding='utf-8-sig',newline='') as f:oldcatalog=list(csv.reader(f))
with (OUT/'input29.csv').open(encoding='utf-8-sig',newline='') as f:
    inputrows=list(csv.reader(f));inputs=[dict(zip(inputrows[0],r)) for r in inputrows[1:]]
assert len(oldcatalog)==140 and len(inputs)==29

# Research observations keep their own IDs; canonical event identities are not created.
observations={r['id']:dict(r,initial_input=True) for r in inputs}
for r in attempts:
    oid=r['id'].removesuffix('-CURRENT')
    if oid not in observations:
        observations[oid]=dict(id=oid,event=r['event'],route=r['route'],source_url=r['source_url'],
                               candidate_url=r['target_url'],initial_input=False,
                               master_2026_row=r.get('master_2026_row'),master_2027_row=r.get('master_2027_row'))

existing={'P0E-001':'GPX-0099','P0E-002':'GPX-0100','P0E-003':'GPX-0101','P0E-004':'GPX-0102',
          'P0E-005':'GPX-0103','P0E-006':'GPX-0104','P0E-019':'GPX-0011',
          'P0E-028':'GPX-0009','P0E-029':'GPX-0010','P0E-030':'GPX-0013','P0E-031':'GPX-0014'}
mapping={};next_id=140
for oid in sorted(observations):
    if oid=='P0E-042':continue  # The ZIP has three actual courses, allocated below.
    if oid in existing:mapping[oid]=existing[oid]
    else:mapping[oid]=f'GPX-{next_id:04d}';next_id+=1

newfiles=[];seen=set()
for attempt in attempts:
    oid=attempt['id'].removesuffix('-CURRENT')
    for member in attempt.get('files',[]):
        key=(attempt['target_url'],member.get('member'))
        if key in seen:continue
        seen.add(key)
        f=copy.deepcopy(member)
        f.update(result_id=f'P0E-F{len(newfiles)+1:03d}',observation_id=oid,event=attempt['event'],
                 route=attempt['route'],source_url=attempt['source_url'],target_url=attempt['target_url'],
                 http=attempt['target_http'],rehost_permission='NOT_ESTABLISHED',
                 linked_from_live_source=attempt.get('linked_from_live_source',False),
                 evidence_origin='P0E_BYTE_DOWNLOAD',new_in_p0e=f['sha256'] not in old_valid,
                 archive_sha256=attempt.get('zip',{}).get('archive_sha256'),archive_bytes=attempt.get('zip',{}).get('archive_bytes'),
                 archive_member=member.get('member'),input_ids=attempt.get('input_ids',[oid]))
        f['declared_km']=attempt.get('expected_km')
        if f['event'].startswith('EAORC Kamnik'):
            f['event']='EAORC Kamnik 2026'  # One family; some courses are elite/U20, not open races.
        if f['declared_km'] is None:
            matches=re.findall(r'(\d+(?:[.,]\d+)?)\s*km',f['route'],re.I)
            f['declared_km']=float(matches[-1].replace(',','.')) if matches else None
        if oid=='P0E-042':
            km=float(re.search(r'- (\d+(?:\.\d+)?) km',member['member'])[1])
            f.update(route=f'{km:g} km',declared_km=km,declared_km_source='ZIP member and GPX route label')
            coursekey=f'{oid}:{km:g}'
            mapping[coursekey]=f'GPX-{next_id:04d}';next_id+=1
            f['candidate_id']=mapping[coursekey]
        else:f['candidate_id']=mapping[oid]
        if attempt['id']=='P0E-013-CURRENT':f.update(route='GO Trim 13 km (aktualna)',declared_km=13)
        if oid=='P0E-039':f['declared_km']=3
        payload,_=cached(f['target_url'])
        if f['archive_member']:payload=zipfile.ZipFile(io.BytesIO(payload)).read(f['archive_member'])
        g=v.validate_gpx(payload,f['declared_km'])
        # Preserve technical facts, not personal names/accounts or metadata XML.
        labels=g.pop('names_and_descriptions',[])[:1]
        creator=g.pop('creator','')
        copyrights=g.pop('copyright_metadata',[])
        g.update(route_label=labels[0] if labels else None,creator_present=bool(creator),
                 creator_sha256=hashlib.sha256(creator.encode()).hexdigest(),copyright_metadata_present=bool(copyrights))
        f['gpx']=g
        basename=attempt.get('metadata',{}).get('title') or f['archive_member'] or f['target_url'].split('/')[-1]
        explicit=' '.join(labels+[basename.split('?')[0]])
        explicit=re.sub(r'20\d{2}-\d\d-\d\dT\S+','',explicit)
        years=sorted({int(y) for y in re.findall(r'(?<!\d)20\d{2}(?!\d)',explicit)})
        f['file_year']=years[0] if len(years)==1 else None
        f['year_evidence']='Explicit GPX route/file label' if f['file_year'] else 'UNKNOWN; page year, upload folder and GPS point timestamps are not file edition proof'
        f['source_year_hint']=observations.get(oid,{}).get('source_year')
        f['edition_association']='FILE_LABEL_YEAR_SUPPORTED' if f['file_year'] else 'SOURCE_PAGE_ASSOCIATION_REVIEW'
        f['canonical_edition_status']='NOT_CONFIRMED'
        f['public_access']=attempt.get('public_access','PUBLIC_HTTP_200')
        f['provenance']='URADNI_LIVE_LINK' if f['linked_from_live_source'] else 'NEJASNO_SUPPLIED_TARGET_NOT_LINKED_ON_CURRENT_PAGE'
        f['review']=list(g['warnings']);f['duplicate_flags']=[]
        if 'P0E-006' in f['input_ids'] and 'P0E-007' in f['input_ids']:
            f['duplicate_flags'].append('SHARED_CATEGORY_FILE_P0E-006_P0E-007')
        if not f['file_year']:f['review'].append('FILE_EDITION_UNKNOWN')
        if not f['linked_from_live_source']:f['review'].append('CURRENT_PAGE_LINKS_DIFFERENT_FILE')
        if f['public_access']=='NOT_INDEPENDENTLY_VERIFIED':f['review'].append('CONNECTOR_DOWNLOAD_PUBLIC_ANONYMOUS_ACCESS_NOT_VERIFIED')
        if f['declared_km']:
            f['distance_delta_km']=round(g['distance_km']-f['declared_km'],3)
            f['distance_delta_pct']=round(f['distance_delta_km']/f['declared_km'],5)
            if abs(f['distance_delta_km'])>1 and abs(f['distance_delta_pct'])>.1:f['review'].append('DISTANCE_DIFFERENCE_OVER_10_PERCENT_AND_1_KM')
        if oid in ('P0E-026','P0E-027'):f['review'].append('ORGANIZER_PAGE_LABEL_2025_VS_MASTER_REFERENCE_2026')
        if oid=='P0E-039':f['review'].append('GPX_LABEL_NOCNA_CURRENT_MASTER_DAYTIME_EVENT')
        if oid=='P0E-041':f['review'].append('750_M_DOWNLOAD_HAS_GPX_NAME_12_KM')
        newfiles.append(f)


def samples(f):
    body,_=cached(f['target_url'])
    if f.get('archive_member'):body=zipfile.ZipFile(io.BytesIO(body)).read(f['archive_member'])
    root=ET.fromstring(body,parser=ET.XMLParser(target=v.NoDTD()));ns={'g':v.NS[root.get('version')]}
    segs=root.findall('g:trk/g:trkseg',ns);tag='g:trkpt'
    if not segs:segs=root.findall('g:rte',ns);tag='g:rtept'
    edges=[];total=0
    for seg in segs:
        points=[(float(p.get('lat')),float(p.get('lon'))) for p in seg.findall(tag,ns)]
        for a,b in zip(points,points[1:]):
            distance=v.haversine(a,b)
            if distance:edges.append((total,total+distance,a,b));total+=distance
    out=[];j=0
    for i in range(256):
        d=total*i/255
        while j<len(edges)-1 and d>edges[j][1]:j+=1
        lo,hi,a,b=edges[j];ratio=(d-lo)/(hi-lo)
        out.append((a[0]+ratio*(b[0]-a[0]),a[1]+ratio*(b[1]-a[1])))
    return out


comparisons=[]
for oid in ('P0E-001','P0E-002','P0E-003','P0E-004','P0E-005','P0E-006','P0E-012','P0E-013'):
    group=[f for f in newfiles if f['observation_id']==oid]
    if len(group)!=2:continue
    a,b=group;ap,bp=samples(a),samples(b)
    distances=min(([v.haversine(x,y)*1000 for x,y in zip(ap,other)] for other in (bp,list(reversed(bp)))),key=sum)
    p95=sorted(distances)[int(.95*255)];ratio=abs(a['gpx']['distance_km']-b['gpx']['distance_km'])/a['gpx']['distance_km']
    flag='POSSIBLE_GEOMETRY_DUPLICATE' if p95<100 and ratio<.02 else 'GEOMETRY_DIFFERS_IN_SAMPLED_COMPARISON'
    comparisons.append(dict(left=a['result_id'],right=b['result_id'],status=flag,p95_separation_m=round(p95,1),max_separation_m=round(max(distances),1),samples=256,
                            method='P0D method: normalized cumulative within-segment distance, linear interpolation, forward/reverse; no cyclic alignment. Screening only.'))
    if flag=='POSSIBLE_GEOMETRY_DUPLICATE':
        a['duplicate_flags'].append(flag+':'+b['result_id']);b['duplicate_flags'].append(flag+':'+a['result_id'])

allfiles=copy.deepcopy(oldfiles)+newfiles
hashgroups=defaultdict(list);geogroups=defaultdict(list)
for f in allfiles:
    if f['file_status']!='FILE_VALID':continue
    hashgroups[f['sha256']].append(f)
    geo=f.get('gpx',{}).get('geometry_sha256_6dp')
    if geo:geogroups[geo].append(f)
for f in newfiles:
    if len(hashgroups[f['sha256']])>1:f['duplicate_flags'].append('BYTE_DUPLICATE')
    if len(geogroups[f['gpx']['geometry_sha256_6dp']])>1:f['duplicate_flags'].append('SAME_ROUNDED_6DP_GEOMETRY')

for oid,o in observations.items():
    fs=[f for f in newfiles if oid in f['input_ids']]
    attempt=next((r for r in attempts if r['id']==oid),None)
    o['candidate_id']=mapping.get(oid)
    o['result_ids']=[f['result_id'] for f in fs]
    o['status']='FILE_VALID' if fs else (attempt['status'] if attempt else 'PAGE_ONLY')
    if oid=='P0E-007':o['duplicate']='SAME_TARGET_AND_SHA_AS_P0E-006; distinct category, not another GPX'
    if oid in ('P0E-032','P0E-033'):o['reason']='ROBOTS_DISALLOW_DOWNLOADFILE; no bytes downloaded'
    if oid in ('P0E-020','P0E-021','P0E-022','P0E-023','P0E-024','P0E-025'):o['reason']='PLOTAROUTE_PAGE_ONLY_EXPORT_RIGHTS_REVIEW'
    if oid in ('P0E-028','P0E-029'):o['reason']='VIEWGPX_PAGE_ONLY; no explicit usable download target observed in public page/browser'

with (OUT/'catalog.csv').open('w',encoding='utf-8-sig',newline='') as f:
    writer=csv.writer(f,lineterminator='\n')
    extra=['P0E_status','P0E_observations','P0E_results','P0E_sources','P0E_targets','P0E_HTTP','P0E_measured_km',
           'P0E_points','P0E_segments','P0E_bytes','P0E_file_SHA256','P0E_archive_SHA256','P0E_file_year_labels',
           'P0E_year_evidence','P0E_origin','P0E_canonical_edition','P0E_duplicate','P0E_REVIEW','P0E_checked','P0E_rehost']
    catalog=[oldcatalog[0]+extra]
    new_by_candidate={}
    for oid,o in observations.items():
        cid=mapping.get(oid)
        if cid and cid not in existing.values():new_by_candidate[cid]=o
    for frow in newfiles:
        if frow['observation_id']=='P0E-042':new_by_candidate[frow['candidate_id']]=dict(observations['P0E-042'],route=frow['route'],id='P0E-042')
    original_headers=oldcatalog[0]
    appended=[]
    for cid,o in sorted(new_by_candidate.items()):
        event='EAORC Kamnik 2026' if o['event'].startswith('EAORC Kamnik') else o['event']
        r=dict(ID=cid,skupina='P0E_NEW_COURSE_OR_RESEARCH_OPPORTUNITY',naziv=event,proga=o['route'],
               source=o['source_url'],track=o.get('candidate_url'),master_leto=2026 if o.get('master_2026_row') else None,
               master_vrstica=o.get('master_2026_row'),rehost='NOT_ESTABLISHED',review='DA',checked='2026-11-03')
        appended.append([r.get(h) for h in original_headers])
    for row in oldcatalog[1:]+appended:
        cid=row[0];fs=[f for f in newfiles if f['candidate_id']==cid]
        obs=[o for oid,o in observations.items() if mapping.get(oid)==cid]
        if any(o['id']=='P0E-007' for o in obs):fs=[f for f in newfiles if 'P0E-007' in f['input_ids']]
        status='FILE_VALID' if fs else (obs[0]['status'] if obs else 'P0D_REUSED_NO_P0E_BYTE_CHECK')
        def joined(values):return ' | '.join(dict.fromkeys(str(x) for x in values if x is not None))
        vals=[status,joined(o['id'] for o in obs),joined(f['result_id'] for f in fs),joined([f['source_url'] for f in fs]+[o['source_url'] for o in obs]),
              joined(f['target_url'] for f in fs),joined(f['http'].get('status') or 'CONNECTOR_HTTP_NOT_EXPOSED' for f in fs),
              fs[-1]['gpx']['distance_km'] if len(fs)==1 else joined(f['gpx']['distance_km'] for f in fs),
              joined(f['gpx']['track_points'] for f in fs),joined(f['gpx']['segments'] for f in fs),joined(f['bytes'] for f in fs),
              joined(f['sha256'] for f in fs),joined(f.get('archive_sha256') for f in fs),joined(f['file_year'] for f in fs),
              joined(f['year_evidence'] for f in fs),joined(f['provenance'] for f in fs),'NOT_CONFIRMED',
              joined([x for f in fs for x in f['duplicate_flags']]+[o.get('duplicate') for o in obs]),
              joined([x for f in fs for x in f['review']]+[o.get('reason') for o in obs]),'2026-11-03' if fs or obs else None,'NOT_ESTABLISHED']
        catalog.append(row+['']*(len(original_headers)-len(row))+vals)
    writer.writerows(catalog)

columns=['result_id','candidate_id','observation_id','event','route','file_status','file_year','declared_km',
         'distance_km','distance_delta_pct','track_points','segments','bytes','sha256','archive_sha256','archive_member',
         'provenance','source_url','target_url','HTTP','new_in_p0e','evidence_origin','rehost_permission','duplicate_flags',
         'review','checked_at','canonical_edition_status']
tech=[columns]
for f in allfiles:
    row=[]
    for c in columns:
        x=f.get(c)
        if c in ('distance_km','track_points','segments'):x=f.get('gpx',{}).get(c)
        if c=='HTTP':x=f.get('http',{}).get('status')
        if c=='checked_at':x=f.get('http',{}).get('checked_at')
        if c=='new_in_p0e':x=int(f.get('new_in_p0e',False))
        if isinstance(x,list):x=' | '.join(x)
        row.append(x)
    tech.append(row)
csvout('technical-results.csv',tech)
save('technical-results.json',allfiles)
save('observations.json',list(observations.values()))
save('geometry-comparisons.json',comparisons)
old_events={f['event'] for f in oldfiles if f['file_status']=='FILE_VALID'}
new_events={f['event'] for f in newfiles}-old_events
summary=dict(base_commit='47547c37b3b8058ffc68da006dd26e4ca5a1c495',p0d_valid_unique_files=50,
             new_valid_unique_files=len(set(hashgroups)-old_valid),total_valid_unique_files=len(hashgroups),
             new_events=len(new_events),new_event_names=sorted(new_events),total_events=len(old_events|new_events),
             input_opportunities=29,input_direct_occurrences=13,input_direct_unique_urls=12,
             input_duplicate_url_occurrences=1,
             first12_statuses=dict(Counter(r['status'] for r in attempts[:12])),
             new_download_targets=len({f['target_url'] for f in newfiles}),new_valid_files=len(newfiles),
             zip_archives=len({f['archive_sha256'] for f in newfiles if f.get('archive_sha256')}),
             source_restricted_targets=sum(r['status']=='SOURCE_RESTRICTED' for r in attempts),
             invalid_new_files=0,canonical_2027_confirmed=0,
             possible_geometry_duplicate_pairs=sum(c['status']=='POSSIBLE_GEOMETRY_DUPLICATE' for c in comparisons),
             geometry_pairs_screened=len(comparisons),same_rounded_geometry_groups=sum(len(g)>1 for g in geogroups.values()),
             geometry_fingerprints_available_unique_files=len({f['sha256'] for f in allfiles if f.get('gpx',{}).get('geometry_sha256_6dp')}),
             byte_duplicate_groups=sum(len(g)>1 for g in hashgroups.values()),
             estimated_current_public_official_external_file_links=sum(f['linked_from_live_source'] and f['http'].get('status')==200 for f in newfiles),
             current_public_official_unique_download_links=len({f['target_url'] for f in newfiles if f['linked_from_live_source'] and f['http'].get('status')==200}),
             direct_public_gpx_targets=len({f['target_url'] for f in newfiles if f['http'].get('status')==200 and not f.get('archive_sha256')}),
             connector_downloads=sum(f['http'].get('status') is None for f in newfiles),
             unlinked_supplied_legacy_targets=sum(not f['linked_from_live_source'] for f in newfiles),
             p0d_catalog_rows=139,catalog_rows=len(catalog)-1,new_catalog_rows=len(catalog)-140,
             valid_files_by_event=dict(Counter(f['event'] for f in allfiles if f['file_status']=='FILE_VALID')))
save('summary.json',summary)
save('file-sha256-manifest.json',[dict(result_id=f['result_id'],sha256=f['sha256'],bytes=f['bytes'],target_url=f['target_url'],archive_sha256=f.get('archive_sha256'),archive_member=f.get('archive_member')) for f in newfiles])
save('workbook-data.json',dict(catalog=catalog,technical=tech,summary=summary,input29=inputrows))
print(json.dumps(summary,ensure_ascii=False,indent=2))
