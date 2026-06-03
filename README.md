# Slovenski Tekaški Koledar website

Initial MVP for a new public website for **Slovenski Tekaški Koledar**. The site is intentionally simple: Astro pages, plain CSS, and public data from the existing STK Cloudflare Worker API.

## Install dependencies

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Astro will print the local URL, usually <http://localhost:4321/>.

## Build check

```bash
npm run build
```

## API endpoints used

The website never reads Google Sheets directly. Google Sheets remains the master data source behind the public API.

- Stats: `https://stk-master-api.igor-kalsek.workers.dev/stats`
- Master event data: `https://stk-master-api.igor-kalsek.workers.dev/`
- Top upcoming voted events: `https://stk-master-api.igor-kalsek.workers.dev/top?scope=upcoming&limit=10`
- Recent updates: `https://stk-master-api.igor-kalsek.workers.dev/recent_updates?days=7`

The home page currently fetches live data from:

- `/stats` for confirmed public events and family-friendly totals
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
  - placeholder “Ta teden tečemo” cards
  - API-backed “Najbolj glasovani prihajajoči teki” section with fallback
  - API-backed “Zadnje posodobitve” section with fallback
- Placeholder pages for:
  - Iskalnik tekov
  - Družinam prijazni teki
  - Najbolj glasovani teki
  - Dodaj ali popravi tek
  - STK Tekobot
  - English
- Project rules in `AGENTS.md`.

## Still to do

- Build the real event search and filtering experience.
- Use the master event endpoint for event listing pages.
- Add a real weekly “Ta teden tečemo” query or client-side filter.
- Replace placeholder pages with full content and interactions.
- Add the final “Dodaj ali popravi tek” destination once the process is confirmed.
- Integrate STK Tekobot when requested.
- Improve structured data, SEO metadata, and social preview images.
- Add automated tests once the data display components stabilize.

## Project constraints

- Do not connect directly to Google Sheets.
- Do not create a database.
- Do not create an admin system or login flow unless explicitly requested.
- Do not implement custom voting logic yet.
- Keep Slovene copy natural, concise, and practical.
