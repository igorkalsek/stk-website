# DEV-061 P1 — publishing gate for place photographs

P0 candidates stay `CANDIDATE` and `visualReview=PENDING`; they are not
displayed on STK. The new pure selector rejects every P0 record by design.

## Activation checklist (not yet completed)

1. Visually inspect the original photo at its Commons page and the 390 px / 768 px /
   1440 px crop. Confirm the subject is the exact Slovenian place; do not present
   it as a photo of the race, start, or route.
2. Recheck source, author, licence and attribution after any edits or cropping.
   Include visible credit and linked licence/source alongside published photos.
3. Produce an optimised WebP/AVIF under `/public/images/places/`; respect
   attribution and derivative requirements, and assess image bytes/LCP.
4. Change **only** the approved record to `PUBLISHED`, `visualReview=APPROVED`,
   with its verified local `assetPath`. The photo selector will then return
   metadata. A future UI integration must use the *snapshot-validated* edition
   place ID from DEV-056, never free-text event place names.
5. Integrate an optional responsive profile photo on both SL/EN profile pages.
   Preserve H1, date, event actions and existing fallback; check mobile/desktop,
   accessibility and performance in a deployment preview.

No images are fetched or published by this PR. No public site layout is changed.
