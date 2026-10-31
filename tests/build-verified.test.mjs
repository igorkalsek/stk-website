import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyBuild } from '../scripts/build-verified.mjs';

test('partial successful process output, missing EN/year/files and stale receipt cannot be published', () => {
  const dir = mkdtempSync(join(tmpdir(), 'stk-build-'));
  const receipt = join(dir, '.stk-build-complete.json');
  try {
    assert.throws(() => verifyBuild(dir), /did not reach/);
    const paths = ['tek/2026/r000257-celjski-mali-maraton/', 'en/races/2026/r000257-celjski-mali-maraton/',
      'tek/2027/r000002-test/', 'en/races/2027/r000002-test/'];
    const save = profiles => writeFileSync(receipt, JSON.stringify({ complete: true, profiles }));
    save(paths.slice(0, 2)); assert.throws(() => verifyBuild(dir), /ENOENT|Incomplete/);
    save(paths);
    for (const p of paths) { mkdirSync(join(dir, p), { recursive: true }); writeFileSync(join(dir, p, 'index.html'), '<html>profile</html>'); }
    assert.equal(verifyBuild(dir), 4);
    rmSync(join(dir, paths[1], 'index.html')); assert.throws(() => verifyBuild(dir), /Missing/);
    save(paths.filter(p => p !== paths[1])); assert.throws(() => verifyBuild(dir), /Incomplete/);
    save(['../../private/']); assert.throws(() => verifyBuild(dir), /Invalid/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
