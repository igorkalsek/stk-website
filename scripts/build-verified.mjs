import { existsSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const receipt = '.stk-build-complete.json';
const profile = /^(?:tek|en\/races)\/(2026|2027)\/r\d{6}-[a-z0-9-]+\/$/;
const normalized = value => String(value).replace(/^\//, '').replace(/\/?$/, '/');

export function verifiedOutput() {
  return { name: 'stk-verified-static-output', hooks: {
    'astro:build:done': ({ dir, pages }) => {
      writeFileSync(new URL(receipt, dir), JSON.stringify({ complete: true,
        profiles: pages.map(p => normalized(p.pathname)).filter(p => profile.test(p)).sort() }) + '\n');
    }
  } };
}

export function verifyBuild(dir) {
  const file = join(dir, receipt);
  if (!existsSync(file)) throw new Error('Build did not reach astro:build:done; refusing partial output.');
  const result = JSON.parse(readFileSync(file, 'utf8'));
  if (result.complete !== true || !Array.isArray(result.profiles) ||
      result.profiles.some(p => typeof p !== 'string' || !profile.test(p))) throw new Error('Invalid build receipt.');
  const paths = new Set(result.profiles);
  if (paths.size !== result.profiles.length) throw new Error('Duplicate profile paths.');
  for (const year of ['2026', '2027']) {
    const sl = [...paths].filter(p => p.startsWith(`tek/${year}/`));
    const en = [...paths].filter(p => p.startsWith(`en/races/${year}/`));
    if (!sl.length || sl.length !== en.length || sl.some(p => !paths.has(p.replace(/^tek\//, 'en/races/'))))
      throw new Error(`Incomplete SL/EN profiles for ${year}.`);
    for (const prefix of [`tek/${year}`, `en/races/${year}`]) {
      const actual = readdirSync(join(dir, prefix), { withFileTypes: true }).filter(x => x.isDirectory());
      if (actual.length !== sl.length) throw new Error(`Profile count mismatch for ${prefix}.`);
    }
  }
  for (const p of paths) if (!existsSync(join(dir, p, 'index.html'))) throw new Error('Missing generated profile.');
  return paths.size;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const dir = resolve('dist');
  rmSync(join(dir, receipt), { force: true });
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/astro/astro.js', import.meta.url)), 'build'], { stdio: 'inherit' });
  if (result.status !== 0) process.exitCode = result.status || 1;
  else {
    try { console.log(`[STK] Verified ${verifyBuild(dir)} SL/EN race profiles; build complete.`); }
    catch (error) { console.error(`[STK] ${error.message}`); process.exitCode = 1; }
  }
}
