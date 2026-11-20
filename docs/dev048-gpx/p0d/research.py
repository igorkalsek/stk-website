#!/usr/bin/env python3
"""One-shot P0D research runner. Payload cache stays outside Git; no scheduled work."""
import csv
import hashlib
import json
import re
import sys
import urllib.parse
import urllib.robotparser
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import validate as v

OUT = Path(__file__).resolve().parent
CACHE = Path('/tmp/stk-dev048-p0d')
CACHE.mkdir(exist_ok=True)


def get(url):
    key = hashlib.sha256(url.encode()).hexdigest()
    meta, payload = CACHE / (key + '.json'), CACHE / (key + '.body')
    if meta.exists():
        return (payload.read_bytes() if payload.exists() else None), json.loads(meta.read_text())
    body, evidence = v.fetch(url)
    meta.write_text(json.dumps(evidence, ensure_ascii=False, indent=2))
    if body is not None:
        payload.write_bytes(body)
    return body, evidence


def source(url):
    body, http = get(url)
    result = {'http': http, 'links': [], 'text': ''}
    if body and http.get('status') == 200 and 'pdf' not in (http.get('content_type') or ''):
        parser = v.Links()
        parser.feed(body.decode('utf-8', errors='replace'))
        result['links'] = list(dict.fromkeys(urllib.parse.urljoin(http['final_url'], x) for x in parser.hrefs))
        result['text'] = re.sub(r'\s+', ' ', ' '.join(parser.text)).strip()[:60000]
    return result


def policy(url):
    p = urllib.parse.urlsplit(url)
    robots_url = f'{p.scheme}://{p.netloc}/robots.txt'
    body, http = get(robots_url)
    decision = {'robots_http': http, 'allowed': None}
    if http.get('status') == 404:
        decision['allowed'] = True
    elif http.get('status') == 200 and body:
        # A robots URL returning a website/challenge is not a permission statement.
        if b'<html' in body[:1000].lower():
            decision['reason'] = 'ROBOTS_HTML_REVIEW'
        else:
            parser = urllib.robotparser.RobotFileParser()
            parser.parse(body.decode('utf-8', errors='replace').splitlines())
            decision['allowed'] = parser.can_fetch('STK-DEV048-P0', url)
            decision['crawl_delay'] = parser.crawl_delay('STK-DEV048-P0')
            if decision['crawl_delay']:
                v._REQUEST_DELAY[p.hostname] = max(1.05, decision['crawl_delay'])
    else:
        decision['reason'] = 'ROBOTS_UNAVAILABLE'
    return decision


def run(candidates, filename):
    results = []
    for c in candidates:
        record = dict(c, rehost_permission='NOT_ESTABLISHED', edition_status='NOT_CONFIRMED')
        url = c['target_url']
        record['access_policy'] = policy(url)
        if record['access_policy']['allowed'] is False:
            record.update(status='SOURCE_RESTRICTED', reason='ROBOTS_DISALLOW')
        else:
            record['source'] = source(c['source_url'])
            s = record['source']
            record['linked_from_live_source'] = url in s['links']
            challenge = bool(re.search(r'<title[^>]*>\s*(Just a moment|Access denied|Attention Required)|verify you are human|checking your browser', (get(c['source_url'])[0] or b'').decode('utf-8', errors='replace')[:10000], re.I))
            if s['http'].get('status') in (401, 403, 429) or challenge:
                record.update(status='SOURCE_RESTRICTED', reason='SOURCE_HTTP_OR_CHALLENGE')
            else:
                body, http = get(url)
                record['target_http'] = http
                if body is None:
                    record.update(status='NOT_AVAILABLE_FROM_ENVIRONMENT', reason=http.get('error'))
                elif http.get('status') != 200:
                    record.update(status='SOURCE_RESTRICTED' if http.get('status') in (401, 403, 429) else 'HTTP_ERROR')
                else:
                    try:
                        if c.get('kind') == 'ZIP' or url.lower().endswith('.zip'):
                            record['zip'] = v.validate_zip(body, c.get('expected_km'))
                            record['files'] = record['zip']['files']
                        else:
                            record['files'] = [dict(file_status='FILE_VALID', sha256=http['sha256'], bytes=http['bytes'],
                                                    gpx=v.validate_gpx(body, c.get('expected_km')))]
                        record['status'] = 'VALID' if all(f['file_status'] == 'FILE_VALID' for f in record['files']) else 'INVALID'
                    except (ValueError, ET.ParseError, zipfile.BadZipFile, RuntimeError, NotImplementedError) as e:
                        record.update(status='INVALID', reason=str(e))
        results.append(record)
        (OUT / filename).write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
        print(c['id'], record['status'], [(f['gpx']['distance_km'], f['sha256'][:10]) for f in record.get('files', []) if 'gpx' in f], record.get('reason', ''), flush=True)
    return results


if __name__ == '__main__':
    candidates = json.loads(Path(sys.argv[1]).read_text())
    run(candidates, sys.argv[2])
