# STK MVP Review Checklist

Use this checklist before approving or sharing the MVP preview.

## Desktop visual check

- [ ] Open the home page on a desktop-width browser.
- [ ] Confirm the hero feels calm, practical, and specific to a Slovenian running calendar.
- [ ] Confirm the CTA buttons are visible and not overcrowded.
- [ ] Confirm stats, event cards, update cards, and footer spacing look balanced.

## Mobile visual check

- [ ] Open the home page with a narrow mobile viewport.
- [ ] Confirm the header, menu button, and navigation dropdown work without horizontal scrolling.
- [ ] Confirm hero text, CTA buttons, stats cards, and content cards stack cleanly.
- [ ] Confirm tap targets are comfortable on a phone.

## Navigation links check

- [ ] Domov opens `/`.
- [ ] Iskalnik tekov opens `/iskalnik-tekov/`.
- [ ] Družinam prijazni opens `/druzinam-prijazni-teki/`.
- [ ] Glasovani teki opens `/najbolj-glasovani-teki/`.
- [ ] Tekobot opens `/stk-tekobot/`.
- [ ] English opens `/en/`.
- [ ] Dodaj ali popravi tek opens `/dodaj-ali-popravi-tek/`.

## API data check

- [ ] Stats show real values for confirmed public events and family-friendly events.
- [ ] Top voted upcoming event cards show real event titles, not generic fallback titles.
- [ ] Top voted upcoming event cards show useful date/location/vote information when present.
- [ ] Recent updates show useful concise text if the API returns update records.

## Fallback behavior check

- [ ] Temporarily block or change the API base URL in local dev tools.
- [ ] Confirm stats show a clear unavailable or missing-data message.
- [ ] Confirm top voted events keep a clean fallback card.
- [ ] Confirm recent updates keep a clean fallback card.

## Footer links check

- [ ] Dodaj ali popravi tek opens the placeholder page.
- [ ] STK Tekobot opens the placeholder page.
- [ ] Facebook opens `https://www.facebook.com/SlovenskiTekaskiKoledar`.
- [ ] English opens the English placeholder page.
