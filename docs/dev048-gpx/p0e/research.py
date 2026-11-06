#!/usr/bin/env python3
"""P0E entry point; reuse P0D fetching/parsing and the existing GPX/ZIP validator.

Separate snapshot/cache. No writes to P0D. Fetch each organizer's policy first.
"""
import importlib.util
import json
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('p0d_research', OUT.parent / 'p0d/research.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)
runner.OUT = OUT
runner.CACHE = Path('/tmp/stk-dev048-p0e')
runner.CACHE.mkdir(exist_ok=True)
CACHE = runner.CACHE
get, source, policy, v = runner.get, runner.source, runner.policy, runner.v


def run(candidates, name):
    results=[]
    for candidate in candidates:
        policies=[dict(url=url, **policy(url)) for url in candidate.get('source_pages',[candidate['source_url']])]
        if any(p['allowed'] is False for p in policies):
            results.append(dict(candidate,status='SOURCE_RESTRICTED',reason='SOURCE_ROBOTS_DISALLOW',source_policies=policies))
        else:
            row=runner.run([candidate], '_current-result.json')[0]
            row['source_policies']=policies
            row['additional_source_evidence']=[dict(url=url, **source(url)) for url in candidate.get('source_pages',[]) if url!=candidate['source_url']]
            results.append(row)
        (OUT/name).write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
    (OUT/'_current-result.json').unlink(missing_ok=True)
    return results


if __name__=='__main__':
    run(json.loads(Path(sys.argv[1]).read_text()),sys.argv[2])
