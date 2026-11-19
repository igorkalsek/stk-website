# DEV-061 P1 — publishing gate for place photographs

This document describes the original P1a guard (#281). The downstream Draft
pilot (#284) now marks **Kranj, Štanjel and Celje** as `PUBLISHED / APPROVED`
after the owner's visual selection on 20 November 2026; all other candidates
remain hidden. The selector still rejects every unapproved record.

## Activation checklist (completed for the three selected assets; preview QA pending)

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

The guard-only PR #281 does not publish images by itself. Assets and the optional
SL/EN layout live in its dependent Draft PR #284. Neither PR is merged or deployed
to production.
