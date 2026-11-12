# DEV-057: datum teka in več svežih sprememb

Pripravljeno 12. 11. 2026. Samo website; brez mergea ali deploya.

## Kanonični obseg in preflight

- [Backlog!58](https://docs.google.com/spreadsheets/d/1B7fWHfu3ylDTEuU6vKG--riFQMRx7-URriHcuT8F4sc/edit#gid=1935370638&range=A58:Z58), prebrano prek povezanega Google Sheets orodja, brez zapisov.
- Osnova: `origin/main af1a15a9f89c88faacf27b3f6389d346017464f8` (#263); ponovno preverjeno pred commitom.
- Odprta PR #247 (GPX raziskava) in #237 (dokumentacijski audit) ne posegata v ta razdelek.
- Živa SL/EN produkcija: štiri kartice, datum spremembe pred nazivom, brez razširitve. Datumi tekov: 14. 11., 5. 12., 28. 11. in 6. 12. 2026. Produkcijski odčitki samo GET/HEAD; POST blokiran in analitika izključena. Prvi EN odčitek je potekel; ponovitev je potrdila HTTP 200 in vse štiri kartice.
- [Živi Worker contract](https://stk-master-api.igor-kalsek.workers.dev/recent_updates?days=30&limit=20&years=2026,2027): HTTP 200, `ok: true`, `type: recent_updates`, `years: ["2026", "2027"]`, obdobje `2026-10-14`–`2026-11-12` (`days: 30`), 20 kanoničnih `events`, 20 različnih parov leto/vrstica. Padajoči datumi sprememb; oba letnika. Tri stare skupine ostajajo v odzivu, vendar jih UI ne združuje ali preureja.
- Začetni contract `days=7&limit=4&years=2026,2027` vrne štiri zapise in obdobje 6.–12. 11. 2026.

## Izvedba

- Označen datum teka je prvi, večji in krepkejši, sledita naziv in kraj. Tip ter datum spremembe sta sekundarna. Javni opisi ostanejo nespremenjeni.
- Koledarski datumi uporabljajo preverjen ISO dan in UTC oblikovanje, zato obiskovalčev časovni pas ne spremeni dneva teka ali spremembe.
- Prvi prikaz ostane največ štiri kartice iz sedmih dni. Šele aktivacija gumba zahteva 30 dni/največ 20 kartic; celoten kanonični seznam zamenja začetnega, brez dodajanja dvojnikov.
- Prikazano je preverjeno vključujoče API obdobje in število kartic. Neveljavno obdobje ali datum spremembe pomeni napako, ne ugibanja podatkov.
- Native button, `aria-expanded`, `aria-controls`, status v živo, `aria-busy`; ohranjen fokus, Enter/Space, zaščita pred večkratno zahtevo med čakanjem. Razširjena zahteva ima 12-sekundno omejitev in ponovni poskus po napaki.
- Napaka razširitve ohrani prvotne kartice. Prazno obdobje ali enak seznam sta prikazana pošteno. Skrčenje povrne točen začetni prikaz; ponovno razširjanje uporabi že prejeti prikaz.
- Nespremenjeni so kanonični selection/dedup, večletni identity matching, povezave in `home_updates` klik/impression semantika. Po menjavi prikaza se znova uporabi obstoječi impression initializer z obstoječo deduplikacijo za dokument.
- Ni sprememb API, Master, CHANGE_LOG, podatkovnega modela, infrastrukture ali odvisnosti. Nepovezane lokalne datoteke niso vključene.

## Preverjanje

- `npm test`: 875/875 PASS.
- `npm run build`: PASS, 715 strani, 688 preverjenih SL/EN profilov. Končni build je izveden samostojno; začetni sočasni build poskus je imel konflikt začasnih izhodnih datotek.
- Ciljni Chromium: `home-updates.spec.ts`, `home.spec.ts`, `home-stats.spec.ts`; prvi celotni sklop na statičnem buildu je dosegel 160/162 PASS (44 DEV-057, 96 home in 20/22 statističnih testov). Dva statistična testa SL pri 641/768 px pričakujeta `[1,1,1]` zahtev za Master 2027/stats/group-runs, dobita `[2,1,1]`. Oba sta reproducirana tudi na nespremenjenem `origin/main af1a15a` iz začasne kopije. Obstoječi reader deduplicira samo prekrivajoče se Master zahteve; rezultat je občutljiv na njihov čas. To ni popravljeno v tem omejenem UX posegu. Po dodatku štirih testov začetnega API izpada je končni ciljni sklop dosegel **144/144 PASS** (48 DEV-057 + 96 home; statični build, 1,7 minute).
- DEV-057 matrika: SL/EN × 390/1440 px × uspeh, isti štirje, prazno, začetni API izpad z uspešno razširitvijo in poštenim skrčenjem, HTTP/network/timeout, neveljaven JSON, stari contract, neveljaven datum spremembe/obdobje, izpad Masterja 2027. Testi tečejo tudi v `America/Los_Angeles`. Preverijo največ 4/20, kanonični vrstni red, dedup, isto vrstico v različnih letih, pravilne datume, povezave/klik 2027, ponovni poskus, brez dvojnih zahtev ali impressionov, skrčenje, fokus, Enter/Space, dostopna imena in bralni vrstni red v drevesu dostopnosti ter brez horizontalnega overflowa.
- Vizualni pregled SL/EN pri 390/1440 px. Posnetki iz končnega browser sklopa so lokalni testni artefakti; niso novi javni podatki ali spremembe dizajna drugih razdelkov.
- Reader preverjanje pomeni Chromium accessibility tree/ARIA snapshot in live-region semantiko. Ročni VoiceOver/NVDA pregled ni izveden.
- `git diff --check`: PASS.

## Rollback

Pred mergeom zadostuje zaprtje Draft PR. Po morebitni poznejši odobreni uvedbi se povrne samo ta website commit in ponovno zgradi predhodna različica. API in podatki ne potrebujejo povrnitve. Commit vsebuje `[CF-Pages-Skip]`; ta izvedba ne sproža deploya.
