# Slovenski Tekaški Koledar website

Initial MVP for a new public website for **Slovenski Tekaški Koledar**. The site is intentionally simple: Astro pages, plain CSS, and public data from the existing STK Cloudflare Worker API.

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

## API endpoints used

The website never reads Google Sheets directly. Google Sheets remains the master data source behind the public API.

- Stats: `https://stk-master-api.igor-kalsek.workers.dev/stats`
- Master event data and Iskalnik tekov page: `https://stk-master-api.igor-kalsek.workers.dev/`
- Top upcoming voted events: `https://stk-master-api.igor-kalsek.workers.dev/top?scope=upcoming&limit=10`
- Next week events: `https://stk-master-api.igor-kalsek.workers.dev/next_week`
- Recent updates: `https://stk-master-api.igor-kalsek.workers.dev/recent_updates?days=7`

The Iskalnik tekov page uses `/` for the public 2026 event list and filters it client-side. The Družinam prijazni teki page also uses `/` and shows only confirmed public 2026 events whose `opombe_javne` explicitly contains `družinam prijazno`.

The home page currently fetches live data from:

- `/stats` for `confirmed_public_events_total` and `family_friendly_total`
- `/next_week` for the live “Ta teden tečemo” section
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
  - API-backed “Ta teden tečemo” section with fallback
  - API-backed “Najbolj glasovani prihajajoči teki” section with fallback
  - API-backed “Zadnje posodobitve” section with fallback
- First usable Iskalnik tekov page with client-side search and filters.
- First usable Družinam prijazni teki page with client-side search and filters based on `opombe_javne`.
- Placeholder pages for:
  - Dodaj ali popravi tek
  - English
- Informational landing page for `/stk-tekobot/`, with a CTA ready for the external STK Tekobot URL.
- GitHub Codespaces support with Node 20 and forwarded port 4321.
- Project rules in `AGENTS.md`.
- Manual review checklist in `REVIEW_CHECKLIST.md`.

## Still to do

- Use the master event endpoint for event listing pages.
- Replace placeholder pages with full content and interactions.
- Add the final “Dodaj ali popravi tek” destination once the process is confirmed.
- Replace the temporary `/stk-tekobot/` CTA placeholder with the public STK Tekobot URL when it is available.
- Improve structured data, SEO metadata, and social preview images.
- Add automated tests once the data display components stabilize.

## Project constraints

- Do not connect directly to Google Sheets.
- Do not create a database.
- Do not create an admin system or login flow unless explicitly requested.
- Do not implement custom voting logic yet.
- Keep Slovene copy natural, concise, and practical.
