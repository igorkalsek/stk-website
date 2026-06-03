# STK Website Agent Rules

- Google Sheets remains the master data source.
- The website must read public event data through the existing STK Cloudflare Worker API only.
- Do not connect directly to Google Sheets.
- Do not create a database, persistence layer, or data warehouse for the website unless explicitly requested.
- Do not create admin, login, authentication, or role-management features unless explicitly requested.
- Do not implement custom voting logic unless explicitly requested; use the public API where needed.
- Keep Slovene copy natural, concise, and practical.
- Keep the design mobile-friendly and easy to scan.
- Prefer plain CSS and readable Astro components for this MVP.
- Do not modify unrelated files.
