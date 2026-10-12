# DEV-023 Phase 2 — implementation and cutover runbook

2026-10-12, Europe/Ljubljana. **NOT READY FOR PRODUCTION CUTOVER.**
DEV-023 remains **IN_PROGRESS**; DEV-012 remains **BLOCKED**.
This work prepares two linked Draft PRs. No merge, deploy, clasp push, production
secret change, Form closure or production INBOX test write is authorized here.

## Preflight evidence

- Website main/production: `b9701d3a9c619a295a3c5c93eca0d9f691ef3bae`, active Pages
  `ca4d296a-7c9a-4e8f-ae53-35ac4daa360d`, on the STK public domains.
- Admin main/production: `d674776e8b3db2d7045515b9aa5b7d41a6a757f4`, active Pages
  `756ddc57-8c8c-4249-85ea-6540a6473921`. No Admin changes are needed.
- Apps Scripts main: `4f83c0afc878cd58f12cda6ad358e3a9297316b3`.
  Fresh authenticated Apps Script API read confirms sole versioned deployment v15;
  its full source matches the previously verified Phase 1 immutable package.
- No open PRs in these three repositories at the initial preflight.
- Read-only Drive inspection confirms the existing 30-column INBOX header and
  unchanged six SPAM statuses at R2:R7. Header mapping is fixed by name; no new
  column, status or organizer metadata is introduced.
- Public SL and EN pages still expose the same original Google Form POST and
  fallback. A GET of its viewform returns a live form, not a closure notice.
  No POST was made to it. Short aliases, if present outside the repository, must
  resolve to this same canonical form during the cutover audit.
- Pages Functions already serve `/api/organizer-claim`. Production settings show
  Node 20, compatibility date 2026-06-03, existing organizer variables, no intake
  secrets/bindings and runtime fail-open. Settings were only read.
- New race, correction, additional details and Other use the same proposal
  component in both languages. `mode=confirm` loads its current race snapshot and
  uses the separate organizer-claim endpoint; it never loads Turnstile here.
- The group-run Google Form on `/skupinski-teki/` is a distinct form and remains
  outside this change. No other proposal Form target was found in repository src.

## Implemented contract

Browser -> `/api/proposals` Pages Function -> mandatory Siteverify ->
HMAC-authenticated standalone Apps Script -> existing `INBOX_predlogi`.
No relay through Google Forms, no direct Master write, no database or paid service.

- Browser JSON has exactly `requestId` (UUID v4), `lang` (`sl`/`en`),
  `turnstileToken` and `proposal`. Requests are streamed with a 16 KiB cap.
- Proposal fields are the existing business values: proposalType, date, title,
  place, region, officialSource, description, organizer, officialAnnouncement,
  email and additionalData. Unknown fields, non-string scalars, invalid dates,
  enums, HTML/control characters, unsafe schemes and duplicate category values
  are rejected independently at both boundaries. Canonical category order and
  NFC/trim normalization make content deduplication deterministic across languages.
- Limits: title/place 200, description 6000, source URL 1000, email 254 characters;
  date is an actual ISO date within 2000–2100; controlled choice limits are in the
  shared validator. Dates are stored as ISO text; Timestamp uses the existing
  M/d/yyyy H:mm:ss display convention in Europe/Ljubljana.
- Exact same-origin and server hostname allowlist checks precede Siteverify.
  Siteverify must return `success=true`, matching request hostname,
  `action=race-proposal` and a valid challenge timestamp no older than 300 seconds.
  Invalid/expired/reused tokens cannot reach the writer. Siteverify failure or
  service errors fail closed. No IP is sent in this Siteverify call.
- The server reads only Cloudflare's trusted `CF-Connecting-IP`; never forwarded
  headers or body IPs. The writer receives a keyed pseudonym rotating every fixed
  ten-minute UTC bucket, not an IP. There is no country blocking.
- Signed envelope: version=1, timestamp (epoch seconds string), nonce UUID v4,
  payload (exact JSON string), signature (lowercase HMAC-SHA256 hex). Signed bytes:
  `stk-proposal-v1\n{timestamp}\n{nonce}\n{sha256(payload)}`.
  Payload contains requestId, lang, canonical proposal and rateKey. The timestamp
  window is ±120 seconds; used nonces are rejected for five minutes.
- One standalone script and one ScriptLock serialize all acceptance decisions:
  5 accepts per ten-minute pseudonym bucket, 30 accepts per rolling hour globally,
  200 per rolling 24 hours globally. These are conservative starting limits for
  the low-volume proposal workflow, not guarantees about user identity. Fixed
  bucket boundaries can allow ten adjacent submissions; shared NAT can share the
  budget, and IP changes can bypass the per-IP budget. Global caps still apply.
  No Cloudflare regional rate-limiter is presented as an exact global counter.
- Script Properties hold a bounded ledger of keyed content hashes/receipts,
  counters and nonces; no full proposals, emails, raw IPs or challenge tokens.
  A maximum 1000 live ledger records fails closed. Accepted request/content
  deduplication lasts 24 hours. Pending records are retained for operator review.
- Append is a single Advanced Sheets `values.append`, restricted to fixed server
  spreadsheet ID and `'INBOX_predlogi'!A:AD`, with `RAW` and `INSERT_ROWS`.
  Unspecified editorial/organizer fields and Status obdelave remain empty.
  RAW prevents formula execution even for formula-like literal input.
- A durable pending receipt is saved BEFORE append. ACCEPTED requires the Sheets
  acknowledgement, one row, matching range and echoed cell values, followed by a
  durable accepted receipt. Lost response: retry the unchanged browser request
  with a fresh token; accepted duplicates return the same receipt without writing.
  An uncertain pending append never blindly writes again, even after its TTL.
- Public replies expose only status and UUID receipt. Upstream errors, signatures,
  URLs, secrets and contact data are not logged or echoed. Apps Script failure
  may still be HTTP 200; the relay requires explicit `ok=true` + accepted status.
- Legacy response/view URLs, fallback builders, hidden POST form and iframe
  success inference are removed from the Website. Entry identifiers remain only
  as legacy DOM/INBOX field mappings; no public Google Forms transport remains.
  Failure preserves fields, refreshes the challenge and permits retry. Reset
  cannot race an in-flight proposal. Organizer claim behavior stays separate.

## Configuration required after separate approval

| Location | Name / setting | Required value / purpose |
| --- | --- | --- |
| Pages build, public | `PUBLIC_STK_TURNSTILE_SITE_KEY` | Real managed-widget sitekey; this is the only public key. Never a dummy key in production. |
| Pages runtime text | `STK_PROPOSALS_ENABLED` | Absent/false until coordinated cutover; then literal `true`. |
| Pages runtime text | `STK_PROPOSALS_HOSTNAMES` | `tekaski-koledar.si,www.tekaski-koledar.si`; exact hostnames, no wildcards or preview hosts. |
| Pages runtime secret | `STK_TURNSTILE_SECRET_KEY` | Paired real widget secret. |
| Pages runtime secret | `STK_PROPOSALS_UPSTREAM_URL` | New standalone immutable `/exec` URL; never existing v15 or organizer upstream. |
| Pages runtime secret | `STK_PROPOSALS_HMAC_SECRET` | Random ≥32-character shared signing secret; separate from existing STK tokens. |
| Pages runtime secret | `STK_PROPOSALS_RATE_SECRET` | Separate random ≥32-character pseudonym key. |
| Turnstile | Managed widget, allowed hosts | Both STK hosts above, action `race-proposal`; pre-clearance not needed. Runtime verifies host and action as well. |
| Standalone Script Properties | `STK_PROPOSALS_ENABLED` | Absent/false until approved cutover; then literal `true`. |
| Standalone Script Properties | `STK_PROPOSALS_HMAC_SECRET` | Exact same signing secret as Pages. |
| Standalone Script Properties | `STK_PROPOSALS_SPREADSHEET_ID` | Existing STK spreadsheet ID; test environments use a synthetic sheet copy. Not supplied by callers. |
| Standalone manifest | OAuth / service | Only spreadsheets scope, V8, Europe/Ljubljana, Advanced Sheets v4. No Gmail/Forms/Calendar/Drive service. |
| Standalone project | Deployment/access | Existing trusted owner executes; anonymous transport must still pass HMAC. Restrict project editors. Do not reuse v15. |
| Standalone triggers UI | `stkProposalCleanup` | Every ten minutes; install and verify before enabling, so expired pseudonyms are removed even while idle. |
| Pages runtime | Quota exhaustion behavior | Prefer fail-closed during approved setup. Existing fail-open still cannot submit: fallback HTML is never an accepted JSON receipt. |

Google has no OAuth scope for a single spreadsheet tab: the scope grants broader
sheet access to the owner, while this small code path enforces one fixed ID/tab.
A discovered Apps Script URL does not grant write authority; HMAC is mandatory.
The anonymous transport can still consume Apps Script execution quotas. Neither
secrecy of the URL nor HMAC eliminates that availability risk.

Preview configuration must remain disabled and have **no production writer
credentials**. Automated UI tests use Cloudflare's official
[dummy keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
and mocked Siteverify; the dummy response does not prove real hostname/action
binding and the relay deliberately rejects known dummy secret keys. Do not relax
those checks for testing. Real staging integration needs a separate real widget
restricted to an explicit staging hostname, its own secret, a separate standalone
deployment and a synthetic INBOX copy with the same headers.
Do not change existing organizer env variables, INBOX read token or serving v15.
If a CSP is introduced, allow the official challenge script/frame origin.

Expiration is logical at five/ten minutes and 24 hours. Physical removal occurs
on the next request or scheduled cleanup (at most another ten minutes while the
trigger works). Pending records contain no IP pseudonym and survive cleanup.
Do not log request bodies, secrets or signed envelopes in either provider.

## Validation performed

All submission testing used synthetic values and mocked in-memory Sheets.
No production INBOX was written. The real public Turnstile test widget was also
loaded locally, without an actual proposal POST; mobile/desktop fit was inspected.

| Check | Result |
| --- | --- |
| Website `npm test` | 531 pass, including 6 new relay/security tests and existing organizer relay tests. |
| Paired `npm run test:proposal-integration` | 6 pass: actual Pages+GAS code, SL/EN all four modes, nonce signing, single-use token rejection, receipts/duplicates, per-IP/global caps, uncertain writes, Phase 1 read filtering and unchanged organizer metadata. |
| Standalone `node --test …/proposal-intake-local-test.cjs` | 11 pass, including schema drift, lock contention, corruption/quota failure, replay, 200/day, cleanup and RAW literal safety. |
| Website browser suite | 37 scenarios pass: new/correction/additional/Other, SL/EN, claim snapshot change/timeouts, single POST, challenge/script-load retry, keyboard, 390/768/1440 px without overflow. |
| Website build | PASS, 657 static pages; Pages handler is separately compiled by `npm test`. Wrangler `pages functions build` also bundles all existing/new Functions successfully at compatibility date 2026-06-03, without a deploy. |
| `git diff --check`, both branches | PASS. |
| Current Admin helper tests at actual main | PASS, including Phase 1 manual format/mapping matrix, all 16 cases; a synthetic protected intake read/mapping check covers all four modes and all 15 field defaults with explicit existing header mapping. |
| Broader Apps orodja/content regressions | 19 of 20 files PASS. Existing organizer-access fixture fails at line 2498: fixed September 9 analytics record falls outside today's 30-day window, expected 1, actual 0. Reproduced without Phase 2 changes. |
| `astro check` | Existing finder test line 567 reports TS2339 (`placement` on `{}`); that file is byte-identical to main. No new diagnostics in changed files. |
| GitHub My races workflow | The homepage save/unsave test times out at lines 1055/1057. Reproduced on isolated actual main `b9701d3` with unchanged src/tests (only a separate local test port). Its fixed 2026 race fixtures are now past; no unrelated fix is included. |
| Real Google staging/production integration | NOT RUN: no deployment or production secrets changed. Required staging gate remains open. |

Browser network submissions and site data were intercepted; official test-widget
visual inspection allowed only localhost and challenges.cloudflare.com. Local
screenshots are evidence of layout, not proof of a real production secret pair.

Reproduction from the paired checkouts:

```sh
# Apps Scripts
node --test projects/stk-proposal-intake/proposal-intake-local-test.cjs
# Website
npm ci
npm test
STK_PROPOSAL_INTAKE_DIR=/absolute/apps-checkout/projects/stk-proposal-intake npm run test:proposal-integration
npm run test:browser:proposal-form
npm run build
git diff --check
```

Local Chromium requires permission to launch outside the macOS sandbox. The
baseline failures above were recorded rather than changing unrelated systems.

## Costs and limits

Expected incremental service cost is **€0 at STK's low submission volume**, using
existing Pages plus a standalone Apps Script project. This is an estimate, not
confirmation of the account's plan/billing or a promise under an attack.
[Turnstile Free](https://developers.cloudflare.com/turnstile/plans/) includes
unlimited challenges; no paid widget is needed.
[Pages Functions](https://developers.cloudflare.com/pages/functions/pricing/)
share Workers request quotas; Free has 100,000 total requests/day across those
services. Other STK traffic consumes the same allowance.
[Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)
include 9 KiB/property, 500 KiB/store and 30 concurrent executions/owner, plus
Properties operation quotas and Sheets API limits. A full store, unavailable
Google service or lock contention prevents acceptance. Failed and duplicate
requests still consume provider quotas; accepted-write caps do not bound all
incoming requests. No KV/D1/Durable Object or external database is introduced.

## Coordinated cutover — future approved work only

1. Review both Draft PRs and their pinned SHAs. Resolve/explicitly disposition
   baseline CI issues, recheck all production/main pointers and freeze this small
   intake package. Do not broaden or modify the v15 package.
2. After separate staging approval, create a test-only standalone project and
   synthetic spreadsheet with the verified 30-column header. Upload only the
   three serving files, enable Advanced Sheets, set staging secrets and enable
   its cleanup trigger. Stage the paired Pages handler with dedicated staging
   credentials and a real staging widget; keep automation with dummy keys/mocked
   Siteverify separate from the real server-verification test.
3. Prove real RAW append/echo behavior and Admin read/preview compatibility for
   every mode in SL/EN, 15 master-field defaults, date formats and additional
   descriptions. Verify missing/invalid/expired/reused tokens, tampering, replay,
   duplicates/rates/outages, organizer independence and recovery of ambiguous
   writes. No test data goes to the production INBOX.
4. After approval for production, provision the standalone production writer and
   real widget, keep both enable flags false, verify target ID/header, editor
   access, OAuth/service scope and trigger, and preserve a rollback package.
5. In a coordinated window, temporarily pause public proposal intake. Deploy the
   new Website with real public sitekey but relay disabled; confirm new UI has
   no old Form POST/fallback and the deployed handler cannot accept yet. Refresh
   cached pages and ask users with already-open forms to reload before submitting.
6. Close **only the original proposal Google Form**, preserving its responses and
   linked spreadsheet. Confirm owner-side `isAcceptingResponses() === false`
   and perform the bypass audit below before either new enable flag becomes true.
7. Enable writer, then relay, with matching secrets/allowed hosts. Recheck the
   actual immutable deployments. Obtain an expressly approved legitimate
   proposal to prove production receipt -> INBOX -> read-only Admin preview;
   never silently use a synthetic production proposal as a smoke test.
8. Confirm SL/EN/mobile/desktop and organizer claims independently; verify no
   Master, SPAM, registry or organizer/report changes. Recheck Form closure and
   historical INBOX integrity. Record receipt/source row and deployment SHAs
   without private contact values. Only then complete Phase 2 and DEV-023.

The small maintenance window is intentional: no period of protected UI plus an
open old bypass may be called a successful cutover. If any check fails, keep
public proposals paused and the old Form closed.

## Verify the Google Forms bypass is closed

Canonical original public Form:
`1FAIpQLScBgO8Keau-2cZWHubhacvCmbzLbw0wlroE6-rR6TEJnzfgUw`.
This public ID is different from the owner's editable Form ID; discover the latter
from the linked spreadsheet/owner UI, do not guess it.

- Before closure, record owner response count and relevant INBOX row boundary.
  Preserve response history and the existing spreadsheet link.
- Close acceptance using owner UI or separately approved
  [Form.setAcceptingResponses(false)](https://developers.google.com/apps-script/reference/forms/form#setAcceptingResponses(Boolean));
  then read `isAcceptingResponses()` back. Do not delete/unlink the Form.
- Test public viewform, old prefilled URLs from both languages, any short alias,
  and the old formResponse endpoint using a complete valid synthetic payload
  **only in the separately approved closed-form verification window**.
  A 200 HTTP status alone is not evidence. Require the closed notice, owner
  acceptance=false, unchanged response count and no added INBOX row. Missing
  required fields causing validation errors do not prove that the bypass closed.
- Crawl the deployed Website links/forms and relevant bundle: no proposal
  Google Forms action/fallback remains, and every ordinary proposal POST is
  same-origin `/api/proposals`. Verify `mode=confirm` still uses organizer-claim.
- Recheck closure/counts after activation and after any rollback. Archive only
  sanitized proof and timestamps. If any direct request adds a response, pause
  the new relay, correct the closure, retain the unexpected row for review and
  keep DEV-023 IN_PROGRESS. Do not report production PASS.

## Safe rollback

Disable Pages `STK_PROPOSALS_ENABLED`, then the standalone flag; public proposals
receive an unavailable/retry message. **Keep the old Google Form closed.**
Preserve accepted rows, SPAM statuses, immutable v15, organizer/report systems
and the entire ledger, including pending records. Do not delete/recreate its
properties or silently resubmit an uncertain pending append.

Rollback only to a version that keeps the protected/paused intake and has no
usable old Form fallback. If the prior Website UI must be served, the old Form
must remain closed and proposals stay paused; restore the new safe UI promptly.
Never restore service by reopening Google Forms. Roll back the standalone script
only to reviewed compatible security code with its ledger intact. Restore public
acceptance only after repeating challenge/auth/deduplication and bypass gates.

Pending recovery is an operator action: pause the writer, compare the signed
content digest/created time to a uniquely identified appended row, and inspect
execution completion. A proven accepted row may have its receipt marked accepted
with explicit operator approval. An unproven outcome stays pending. No public
retry or automatic cleanup is allowed to erase the uncertainty.

## Remaining P1 / P2 risks and decision

- **P1 cutover gate:** real Google staging integration and real production
  widget/secret pair are not proven; new code is deliberately undeployed/disabled.
- **P1 cutover gate:** old Form is still accepting by design in this session.
  Closure, rejected direct POSTs, historical preservation and actual production
  receipt/INBOX readback must all be proven before declaring Phase 2 complete.
- **P2:** HMAC blocks unauthorized writes, not unauthenticated Apps Script quota
  exhaustion or all incoming Pages traffic. Human-solved CAPTCHA and distributed
  IPs can still produce spam; global caps and Phase 1 editorial quarantine remain.
- **P2:** shared NAT/fixed windows, 24-hour deduplication horizon, Google service
  latency and conservative limits can delay legitimate proposals. Pending writes
  may need operator recovery. A nonce/store cap intentionally pauses intake.
- **P2:** owner Sheets OAuth scope is broader than one tab; deployment editor
  control and fixed ID/tab source audit are necessary. Cleanup trigger and
  provider log settings must be verified before enabling.
- **P2:** already-open legacy browser tabs may still display their old iframe
  success assumption even though the closed Form rejects the write. Reload is
  needed; only the new receipt-based UI can confirm actual acceptance.
- **P2 baseline:** existing finder type diagnostic, aging organizer analytics
  fixture and homepage My races browser test fail independently of this change; no blanket all-tests-PASS claim.

**NOT READY FOR PRODUCTION CUTOVER.** Implementation is prepared for review and
staging verification; no production success or Phase 2 completion is claimed.
