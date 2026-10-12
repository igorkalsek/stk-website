# DEV-023 Phase 2 — real isolated staging evidence

2026-10-12, Europe/Ljubljana. **Staging integration verified. NO-GO for public production cutover in this task.**

## Scope and isolation

Existing Website Draft PR #223 and Apps Scripts Draft PR #96 were tested against real Cloudflare Pages, real managed Turnstile Siteverify and a separate Google Apps Script deployment writing only to a new synthetic Google spreadsheet. No production INBOX or production writer credential was used. No merge, production deploy, production secret change or Google Form closure was performed. The original public intake remains Phase 1.

The test Pages project is `stk-dev023-staging`, preview branch `phase2-staging`, with no custom domain and a private server-side access gate over pages, Functions and assets. Its nominal production branch is `never-production`; production intake is disabled. The real managed widget allows only the explicit staging hostname. All staging access, HMAC, rate, reader and Turnstile credentials are separate. The access cookie is Secure, HttpOnly and SameSite=Strict. Anonymous access was rejected. Staging is not a public proposal path.

The test spreadsheet has the exact existing 30-column `INBOX_predlogi` contract, including its header whitespace; no production rows were copied. Only synthetic contact addresses and public race context were used. Secrets, raw envelopes, tokens, deployment URLs and full contact rows are excluded from GitHub evidence.

## Pinned production and candidate evidence

- Website main and canonical production: `b9701d3a9c619a295a3c5c93eca0d9f691ef3bae`, deployment `ac06b715-a85b-446c-bc11-cdf37800fdf7`.
- Admin main and canonical production: `d674776e8b3db2d7045515b9aa5b7d41a6a757f4`, deployment `756ddc57-8c8c-4249-85ea-6540a6473921`.
- Apps Scripts main: `4f83c0afc878cd58f12cda6ad358e3a9297316b3`. Authenticated read confirmed the sole versioned production deployment is v15 and its immutable source equals the approved Phase 1 package.
- Tested Website serving code: PR #223 `4efcb2e75774e4983202f88ef7229ad7b001fe9b`. Subsequent Website changes are documentation only.
- Tested Apps code: PR #96 `0dbc57c29bfaec969ca9eeebe716e1428ca32b83` plus the numeric-literal fix described below. The candidate POST writer was unchanged by the staging read/fault harness.
- Admin source identity fix: Draft PR #138 `d834860f719e221ffdb27081ac1f35d525202ee3`.

## Actual submissions and readback

**31 real writer appends: 30 acknowledged accepted submissions and one intentionally uncertain pending append.** Duplicate retries added zero rows. Two additional rows were inserted directly as synthetic compatibility fixtures (one SPAM and one organizer confirmation); they are not counted as submissions. Physical test rows: 33. The Phase 1-compatible reader returns 32 and excludes the one SPAM fixture.

| Browser case | Source row | Date stored as ISO text | Result |
| --- | --- | --- | --- |
| SL new race | 3 | 2027-05-16 | Accepted, complete field match |
| SL correction | 4 | 2026-11-07 | Accepted, complete field match |
| SL additional details | 5 | 2026-11-07 | Accepted, complete field match |
| SL Other | 6 | 2026-01-01 | Accepted, canonical Other defaults |
| EN new race | 7 | 2027-05-17 | Accepted, complete field match |
| EN correction | 8 | 2026-11-07 | Accepted, complete field match |
| EN Other | 9 | 2026-01-01 | Accepted, canonical Other defaults |
| EN additional details | 10 | 2026-11-07 | Accepted after rate-limit retry |

All eight browser cases used the real Pages relay, real Siteverify, test HMAC and actual Google `values.append`. Eleven business fields were compared to captured browser requests, including canonical additional categories and detailed descriptions. The remaining eighteen editorial/organizer fields were empty as required. All source IDs were recomputed with the v15 hash algorithm over timestamp and all thirty cell values; source rows and IDs are unique. Timestamp follows the established local display format; race dates survive as exact ISO text. A separate real signed transport append preserved a literal description beginning `=1+1` with RAW rather than executing it.

The remaining real appends cover recovery after a pre-append Google error, one lost browser response, the daily boundary and eighteen hourly-limit fills. One controlled post-append Google acknowledgement failure accounts for the retained pending row. These extra signed transport tests prove the real Google writer and global counters, not an additional eight-mode browser matrix.

## Protection, duplicate handling and limits

| Real test | Evidence / result |
| --- | --- |
| Missing, invalid and reused Turnstile token | Pages rejects `CHALLENGE_FAILED`; no Google append |
| Stale challenge after a long browser pause | Rejected; fresh challenge succeeds; no false success |
| Real Siteverify | Success logs match staging hostname, `race-proposal` action and fresh challenge age; no dummy secret pair |
| Wrong/missing Origin | `INVALID_ORIGIN`; no append |
| Oversized body, unknown field, overlong title | 413/400 validation rejection; no append |
| Forged `CF-Connecting-IP` header | Cloudflare rejects direct spoof attempt; application never accepts it |
| Missing signature, invalid signature, tampering, expired signed envelope | Google writer `UNAUTHORIZED`; no append |
| Same nonce | `REPLAY`; no append |
| Same request with fresh signed envelope | `DUPLICATE`, same receipt; no append |
| Cross-language canonical duplicate | `DUPLICATE`, same receipt, also while the acceptance budget is full |
| Changed content with same request ID | `REQUEST_CONFLICT`; no append |
| Actual browser per-IP bucket | The next unique proposal after five accepts in a ten-minute bucket receives HTTP 429; fields retained; later retry accepted |
| Rolling global hour | Filled to thirty real pending/accepted records in the current hour; the next distinct signed request was `RATE_LIMITED` |
| Rolling global 24 hours | Seeded old synthetic accepted ledger records to 199, one real append accepted at 200, the next rejected; historical fixtures removed without deleting actual records |

This was a functional adversarial test, not an exhaustive penetration test or a high-volume load test. There is no evidence of a Turnstile or unsigned writer bypass in the tested paths. Human-solved challenges and distributed clients remain possible; editorial review is mandatory. HMAC prevents writes, not anonymous execution-quota exhaustion.

Five accepts per shared public IP can delay legitimate users behind a shared NAT. The observed delay preserved the form and allowed retry after the fixed bucket changed. A legitimate burst requiring more than five proposals per bucket needs an operational decision before cutover; this test does not prove that the chosen thresholds suit every organizer.

## Failure and interruption behavior

A temporary owner-only staging property targeted a nonexistent synthetic spreadsheet. Real `SpreadsheetApp.openById` failed before append; the relay returned HTTP 503, fields remained and no success appeared. Restoring the test spreadsheet allowed the unchanged request with a fresh challenge to append once.

A staging-only immutable fault harness threw immediately after a real Google append and before acceptance acknowledgement. The relay returned HTTP 503 with no false confirmation. After clearing the fault and restoring clean serving v2, the same request stayed pending and retries added no second row. The actual pending record and row were retained for operator review.

For a separate real browser submission, response-stage interception prevented delivery of a successful Pages response after Google had appended. The browser showed an error and retained its values. After removing interception, retrying the unchanged request with a fresh real challenge returned `DUPLICATE` and the existing receipt; the sheet still contained one matching row. Interception was removed after the test. No claim of automatic recovery is made for an uncertain pending Google write.

## Actual Admin / Phase 1 compatibility

The isolated reader is the actual immutable v15 read implementation, adapted only to the fixed test spreadsheet and a separate read credential. A private Pages read-only `/api/inbox` relay served the actual Admin application. The staging build contains no Admin master-write Function.

All eight browser submissions were read with their source IDs, source rows and exact business values. The editor opened a new-race detail preview, checked all fifteen Master field defaults and verified the full additional details in `Interne opombe`. Structured extra values remain preserved in the canonical description for the existing editor workflow; they are not silently parsed into the fifteen Master columns.

The thirty-column source needs an explicit existing header mapping. In the isolated browser, `Timestamp` maps to submission time, the long contact header to contact, the source link to `Razpis`, and description to `Interne opombe`. Full canonical proposal-type choices must be configured. New races enter review; corrections/additional details retain manual Master linking. Other messages remain blocked from automatic event import and are reviewed as messages. The editorial queue remained empty: no proposal import or remote Master write occurred.

The synthetic SPAM row was excluded by the actual reader, while every organizer confirmation field S:AD remained byte-for-byte intact. Candidate proposal appends left those organizer columns empty. Production v15 and organizer-claim Function source are unchanged. The actual staging organizer-confirmation page loaded the public race snapshot without Turnstile and posted only to `/api/organizer-claim`; because the isolated site has no organizer write credential, it failed closed with an unavailable message. No organizer email was sent. End-to-end production organizer email/token writes were deliberately not exercised.

## Defects found and repaired

- **P1, PR #96:** Apps Script rejected ES numeric separators as `ILLEGAL` at upload despite successful Node tests. Eight numeric literals now use plain decimal digits; values and validation are unchanged. Real Google upload/deploy and appends then passed. Only the eleven affected intake tests and six paired integration tests were repeated; both passed.
- **P1, separate Admin PR #138:** Distinct submissions with identical mapped values shared a candidate ID. Linking one correction to a Master row replaced multiple distinct source candidates. Candidate identity now includes the existing source-record ID (source row fallback). Unit and browser regression tests pass, along with helper tests, all 128 PR browser scenarios, Astro check and build. GitHub CI is green. On private Cloudflare staging, linking source row 4 changed only that candidate; rows 5, 8 and 10 retained their distinct source identity and unlinked state. They were then linked separately through the existing editor flow.

PR #138 is a separate solution because the bug resides in the Admin repository outside the two intake PRs. It is required before relying on the production Admin intake review path. No new unresolved P1 code defect was found after these fixes.

## Logging and retention

A temporary staging-only Siteverify diagnostic emitted only success, hostname, action, challenge age and error codes. The captured Cloudflare trace had 133 invocations and thirteen application log entries, including nine successful real Siteverify results. Scanning the trace found no staging secret values; application logs contained no proposals, synthetic contact addresses or challenge tokens. Cloudflare's provider request metadata contains IP headers. This is distinct from application logging, and no claim that provider metadata is anonymous is made. The diagnostic was removed from the final staging handler.

Google owner-audit logs contained only counters, receipt IDs, ranges and timestamps. Failure handling caught Google exceptions and returned generic statuses. The deployed manifest has exception logging disabled; no request bodies or contact values are deliberately logged. Local test request/evidence files are private, outside all repositories, and contain synthetic data only. They are not attached to PRs.

## Idle cleanup and final resource state

Expired synthetic nonce, rate-counter and accepted-receipt markers were installed at **14:03:40** local time, together with an expired pending marker. No writer POST followed that seed. Google execution history shows `stkProposalCleanup`, **Time-Driven**, **Completed** at **14:08:38**. A pure read audit at **14:10:39** showed all three expired removable markers absent, with both the expired pending marker and actual uncertain pending receipt retained. One cleanup trigger remains installed. This proves idle scheduled cleanup independently of request-driven cleanup.

After preserving that proof, only the explicitly seeded pending fixture was removed. The real uncertain pending record and its appended sheet row remain. Both test enable flags are false; the private preview and reader remain gated for review. Clean staging serving v2 and HEAD contain the candidate writer plus the test-only read adapter, with the temporary fault/bootstrap/audit helpers removed. The final handler contains no Siteverify diagnostic. Staging resources are retained for evidence; none is promoted to production.

## Production decision and remaining steps

**GO for the completed isolated staging gate. NO-GO for public activation now.**

1. Review/merge the existing Website #223, Apps Scripts #96 and required Admin #138 through a separately authorized production workflow. Disposition the already documented unrelated aging-fixture CI failures; do not call the entire project green.
2. Provision the reviewed standalone production writer and real production widget, separate from immutable v15 and organizer credentials, with both enable flags initially false. Verify the fixed production target/header, least necessary services, editors, fail-closed behavior and cleanup trigger. Do not promote staging credentials or synthetic rows.
3. Confirm the explicit Admin mapping and pending-recovery runbook. Decide how operators handle shared-IP/global cap incidents; no pending record may be deleted or blindly replayed.
4. In an approved cutover window, deploy the receipt-based UI while paused, close only the old proposal Google Form while preserving history, and prove owner-side closure plus rejection of complete direct/prefilled/alias submissions without added responses or INBOX rows.
5. Enable the separate writer then relay and perform an expressly approved legitimate production smoke submission with INBOX readback and Admin preview. Verify organizer workflows independently and preserve Phase 1/SPAM history. No synthetic production smoke is authorized by this staging task.

The blocker “real staging was not run” is resolved by this evidence. Production readiness still depends on reviewed fixes and the production-specific gates above. DEV-023 remains IN_PROGRESS and DEV-012 BLOCKED until the separately approved cutover is completed.
