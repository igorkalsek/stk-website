# Slovenski Tekaški Koledar website

Initial MVP for a new public website for **Slovenski Tekaški Koledar**. The site is intentionally simple: Astro pages, plain CSS, and public event data from the existing STK Cloudflare Worker API.

## Requirements

- Node.js 20 or newer
- npm

Astro does not support old Node.js versions such as Node 16. If commands fail with a Node version error, upgrade Node before continuing.

## Preview in GitHub Codespaces

This repository includes a `.devcontainer/devcontainer.json` configuration that starts Codespaces with Node 20 and forwards Astro's default port, `4321`.

1. Open the repository on GitHub.
2. Choose **Code** → **Codespaces** → **Create codespace**.
3. Wait for the dev container to finish setup. It runs:

   ```bash
   npm install
   ```

4. Start the Astro dev server with the Codespaces-friendly host flag:

   ```bash
   npm run dev -- --host 0.0.0.0
   ```

5. Open the forwarded port:
   - In VS Code / Codespaces, open the **Ports** tab.
   - Find port **4321** labeled **Astro dev server**.
   - Click the globe / open-browser icon.

If port 4321 is not listed, run the dev server command again and wait for Codespaces to detect the forwarded port.

## Preview locally

1. Confirm your Node version:

   ```bash
   node --version
   ```

2. If Node is older than 20, install a newer version. Common options are:
   - install the current LTS from <https://nodejs.org/>
   - use `nvm` and run `nvm install 20 && nvm use 20`
   - use another Node version manager that can provide Node 20+

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the local dev server:

   ```bash
   npm run dev
   ```

5. Open the URL Astro prints, usually <http://localhost:4321/>.

## Build check

```bash
npm run build
```

## Public data API used

The website never reads Google Sheets directly. Google Sheets remains the master data source behind the public API.

- Stats: `https://stk-master-api.igor-kalsek.workers.dev/stats`
- Master event data and Iskalnik tekov page: `https://stk-master-api.igor-kalsek.workers.dev/`
- Top upcoming voted events: `https://stk-master-api.igor-kalsek.workers.dev/top?scope=upcoming&limit=10`
- Recent updates: `https://stk-master-api.igor-kalsek.workers.dev/recent_updates?days=7`

The Iskalnik tekov page uses `/` for the public 2026 event list and filters it client-side. The Družinam prijazni teki page also uses `/` and shows only confirmed public 2026 events whose `opombe_javne` explicitly contains `družinam prijazno`.

The home page currently fetches live data from:

- `/stats` for `confirmed_public_events_total` and `family_friendly_total`
- `/` for the live “Najbližji teki” section, filtered client-side to the nearest confirmed public 2026 events from today onward
- `/top?scope=upcoming&limit=10` for the most voted upcoming events
- `/recent_updates?days=7` for recent updates

Each live section includes graceful fallback content if an API request fails or returns no usable items.

## Implemented in this MVP

- Astro project scaffold with plain CSS.
- Mobile-first responsive layout.
- Shared header, footer, and base layout.
- Home page with:
  - strong STK hero section
  - primary CTA links
  - live stats strip
  - API-backed “Najbližji teki” section with fallback
  - lightweight personal calendar CTA
  - API-backed “Najbolj glasovani prihajajoči teki” section with fallback
  - API-backed “Zadnje posodobitve” section with fallback
- First usable Iskalnik tekov page with client-side search and filters.
- First usable Družinam prijazni teki page with client-side search and filters based on `opombe_javne`.
- Full public pages for:
  - Najbolj glasovani teki
  - Dodajte ali popravite tek
  - STK Tekobot
  - Osebni koledar (`/osebni-koledar/`)
- English placeholder page.
- GitHub Codespaces support with Node 20 and forwarded port 4321.
- Project rules in `AGENTS.md`.
- Manual review checklist in `REVIEW_CHECKLIST.md`.


## Calendar links

- `/osebni-koledar/` supports a bulk Google Calendar subscription and an iCal subscription for Apple Calendar, Outlook, and other calendar apps.
- Bulk Google Calendar subscription uses: `https://calendar.google.com/calendar/u/0/r?cid=ebc83d7c094e5c61db2b0682a4da13734af4f2f381bafec7ccb37df56bdb1c92@group.calendar.google.com`
- iCal subscription uses: `https://calendar.google.com/calendar/ical/ebc83d7c094e5c61db2b0682a4da13734af4f2f381bafec7ccb37df56bdb1c92%40group.calendar.google.com/public/basic.ics`
- Event cards can include individual Google Calendar links for adding a single race.

## Still to do

- Improve structured data, SEO metadata, and social preview images.
- Add automated tests once the data display components stabilize.

## Public copy and branding

- Header logo asset path: `public/stk-logo.jpeg`. Keep the visible text “Slovenski Tekaški Koledar” next to the logo for clarity and accessibility.
- Logo asset should be added separately as public/stk-logo.jpeg because binary files are not handled by the Codex PR flow.
- Visitor-facing Slovenian copy should use formal “vi” wording.
- Visitor-facing copy should avoid technical API jargon; explain data refreshes in plain language instead.

## Project constraints

- Do not connect directly to Google Sheets.
- Do not create a database.
- Do not create an admin system or login flow unless explicitly requested.
- Do not implement custom voting logic yet.
- Keep Slovene copy natural, concise, and practical.

## Organizer deployment routing (DEV-001b)

The organizer claim Pages function uses the server-only environment variable
`STK_ORGANIZER_CLAIM_UPSTREAM_URL`. Set it to one base versioned Apps Script web
app URL: `https://script.google.com/macros/s/<deployment-id>/exec`, without a
query, fragment, whitespace or `/dev`. The function appends
`?endpoint=organizer-claim`; missing/invalid configuration returns 503
`NOT_CONFIGURED` without contacting an upstream. There is no fallback or
multi-routing. The known public Content v32 deployment is explicitly rejected
as an organizer upstream. URL validation alone does not prove deployment owner;
the operator runtime preflight is still required for a new deployment.
`STK_ORGANIZER_CLAIM_RELAY_ENABLED` remains a separate ingress
switch. Public Content and Master routing is unchanged.

Before deploying this code, configure the upstream variable to the existing
organizer deployment URL to preserve current routing:

```text
https://script.google.com/macros/s/AKfycbzNCSp6qjxwFTmxTEJpFpNET6duD4ChwPhKTXAAYKedaUEDih3AClwVKTr1wmVSKSSA/exec
```

For the separately approved future STK Gmail cutover, pause organizer ingress
and mutation/retry callers, wait for in-flight executions, and inventory pending
claims/reports, active attempts and mailbox-scoped draft IDs. Create the new
versioned deployment under `tekaski.koledar@gmail.com` in the same Content API
project. Use the authenticated operator preflight from STK orodja to test the
actual deployment runtime; editor execution is not deployment identity proof.

Align these three values under the pause: website
`STK_ORGANIZER_CLAIM_UPSTREAM_URL`, STK orodja
`STK_ORGANIZER_CONFIRMATION_INTERNAL_URL`, and Content API
`STK_ORGANIZER_ACCESS_PUBLIC_URL`. Save all OLD values for rollback. A rollback
restores those three URLs under the pause and does not rewrite stored claims or
messages. Keep the old deployment and review links already issued against either
URL before resuming traffic. Existing magic links embed their original deployment
URL and expire after 60 minutes; changing the relay cannot redirect them. Wait
for outstanding tokens to expire and reconcile unresolved claims separately;
do not delete `PENDING_EMAIL` rows or clear persisted drafts.

Keep the admin Basic `STK_ORGANIZER_REPORT_ENABLED=false` in this task. A stored
Gmail draft retry can bypass the Basic fetch, so that flag alone cannot pause
mail delivery. With the flag false, the safe empty-input service probe returns
`UNCONFIRMED`, not a successful authentication proof. Basic service auth remains
UNCONFIRMED until runtime preflight on the new STK-owned deployment; even then,
a disabled Basic flag cannot produce an authentication proof. The complete operator
procedure and read-only inventory live in the apps-scripts repository at
`projects/stk-content-api/ORGANIZER_ACCESS.md`. This source change performs no
production deployment, configuration update, cutover or mail delivery.
