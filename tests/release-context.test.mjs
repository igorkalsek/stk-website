import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

const originalCommitSha = process.env.CF_PAGES_COMMIT_SHA;

afterEach(() => {
  if (originalCommitSha === undefined) delete process.env.CF_PAGES_COMMIT_SHA;
  else process.env.CF_PAGES_COMMIT_SHA = originalCommitSha;
});

describe('analytics release context', () => {
  it('derives one bounded public release ID from the Cloudflare Pages commit SHA', async () => {
    process.env.CF_PAGES_COMMIT_SHA = 'ABCDEF1234567890ABCDEF1234567890ABCDEF12';
    const config = (await import(`../astro.config.mjs?valid=${Date.now()}`)).default;
    assert.equal(config.vite.define.__STK_RELEASE_ID__, JSON.stringify('abcdef123456'));
  });

  it('publishes no release ID for an invalid or user-shaped build value', async () => {
    process.env.CF_PAGES_COMMIT_SHA = 'private@example.com';
    const config = (await import(`../astro.config.mjs?invalid=${Date.now()}`)).default;
    assert.equal(config.vite.define.__STK_RELEASE_ID__, JSON.stringify(''));
  });
});
