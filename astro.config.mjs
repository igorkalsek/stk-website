import { defineConfig } from 'astro/config';
import { verifiedOutput } from './scripts/build-verified.mjs';

const rawPagesCommitSha = String(process.env.CF_PAGES_COMMIT_SHA ?? '').trim();
const analyticsReleaseId = /^[0-9a-f]{40}$/i.test(rawPagesCommitSha)
  ? rawPagesCommitSha.toLowerCase().slice(0, 12)
  : '';

export default defineConfig({
  integrations: [verifiedOutput()],
  site: 'https://tekaski-koledar.si',
  vite: {
    define: {
      __STK_RELEASE_ID__: JSON.stringify(analyticsReleaseId)
    }
  }
});
