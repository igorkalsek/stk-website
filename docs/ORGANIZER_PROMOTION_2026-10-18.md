# Za organizatorje – priprava na promocijo, 18. 10. 2026

## Spremembe in obseg

Obstoječa kartica za objavo in popravek zdaj predstavi brezplačni javni profil, razpoložljive preverjene informacije in deljenje povezave. Isti dve akciji vodita na obstoječi iskalnik in obrazec. Kartica za potrditev loči izrecno potrditev aktualnih podatkov konkretne izvedbe od preverjanja e-naslova in pojasni pogojno pripravo/dostavo osnovnega 30-dnevnega poročila. Kliki niso dejanske prijave.

Na isti poti je bil v `RaceProposalForm.astro` odkrit enak napačen stavek o zagotovljenem poročilu po potrditvi e-naslova. Popravljena sta ta SL/EN odstavek in enako preširoka obljuba v sporočilu po sprejemu zahteve; programski tok ostaja enak. En CSS selektor razširi obstoječo temno barvo napisa na obe svetli kartici. Obstoječi test upošteva slovnično obliko »v zadnjih 30 dneh«.

Hero, glavni CTA za 2027, OrganizerWorkflow, vse povezave, analitične oznake, canonical in hreflang so ohranjeni. Napredna statistika in dodatna promocijska orodja ostajajo izrecno »V pripravi«. Brez novih funkcij, odvisnosti, backend/API/analitičnih sprememb, zapisov v Master, potrjevanja dogodkov ali pošiljanja e-pošte. Brez mergea, deploymenta ali Cloudflare rebuilda.

## Preflight in preverjeni pogoji

- Izhodišče: sveži `origin/main` **3f1a8e5**, veja `codex/organizer-promotion-copy`. Ob začetku ni odprtih PR-jev v stk-website. Nepovezane obstoječe nesledene datoteke niso vključene.
- Prebran AGENTS.md ter OrganizerPage.astro in OrganizerWorkflow.astro. Ponovno uporabljene obstoječe kartice in gumbi.
- Živa produkcija v Chromiumu: obe strani HTTP 200, 390/430/1440 px, brez vodoravnega prelivanja ali JS page errors. Before je produkcija, after lokalni build; **produkcija ni posodobljena**. Zajem: 18. 10. 2026, Europe/Ljubljana. Sam spletni indeks ni uporabljen kot vizualni dokaz.
- Javni [Go4trail 2026](https://tekaski-koledar.si/tek/2026/r000256-go4trail/): značka »Podatke potrdil organizator« je vidna. CTA za ponovno potrditev je pri že potrjenem dogodku skrit. Njegov obstoječi URL iz DOM je bil uporabljen za bralni pregled `mode=confirm` s pravim eventKey/leto; obrazec naloži aktualne podatke. Ni oddaje.
- Prebrana kanonična [razvojna evidenca](https://docs.google.com/spreadsheets/d/1B7fWHfu3ylDTEuU6vKG--riFQMRx7-URriHcuT8F4sc/edit): DEV-001, 004, 014, 018, 038 in 040 so DONE. DEV-024 (javni pregled potrjenih tekov), 025 (moji organizirani teki prek e-poštne povezave) in 034 (Organizer Plus pilot) so NEW in ostajajo zunaj obsega. Evidenca je samo prebrana; javna stran se ne povezuje s Sheets.
- DEV-001 / website #202 in Apps Scripts #79/#83: dokazljiva izrecna potrditev aktualnega snapshota, pravi year + row-based event_id, javna projekcija samo za veljavno potrditev. DEV-004 dokumentira uspešen pretekli Go4trail E2E; to ni nov test pošiljanja v tej nalogi.
- DEV-014 / Apps Scripts #88–92 in Admin #134–135: operativni one-shot preflight, kanonični prejemnik, VERIFIED in aktualni snapshot, ločena preverjanja dostave in varovanje pred ponovnim pošiljanjem; globalni report flag po evidenci false. Zato ni obljube samodejne dostave ali roka.
- Prebrana aktualna backend dokumentacija [ORGANIZER_ACCESS.md](https://github.com/igorkalsek/stk-apps-scripts/blob/main/projects/stk-content-api/ORGANIZER_ACCESS.md), [DEV-014_OPERATOR_REPORT.md](https://github.com/igorkalsek/stk-apps-scripts/blob/main/projects/stk-content-api/DEV-014_OPERATOR_REPORT.md) in [STK_OrganizerConfirmations.md](https://github.com/igorkalsek/stk-apps-scripts/blob/main/projects/stk-orodja/STK_OrganizerConfirmations.md). Poslovna pravila niso spremenjena ali podvojena na strani.

## Končno slovensko besedilo

NA VOLJO ZDAJ

Nimate spletne strani za svoj tek?

Vaš tek lahko na STK dobi brezplačno javno predstavitveno stran z datumom, krajem in razdaljami ter informacijami o prijavah, razpisu in trasi. Podatki in povezave so prikazani glede na razpoložljive, preverjene informacije.

Povezavo do profila lahko delite na Facebooku, v vabilih ali na spletni strani društva. Spodaj poiščite svoj tek ali predlagajte nov tek, dopolnitev oziroma popravek podatkov.

Poiščite svoj tek

Dodajte ali popravite tek

NA VOLJO ZDAJ

Potrdite podatke svojega teka

Poiščite svoj tek, na profilu izberite »Potrdite pravilnost podatkov« in preglejte aktualne podatke za pravo izvedbo teka. Po uspešno preverjeni potrditvi lahko profil prejme oznako »Podatke potrdil organizator«. Sama potrditev e-poštnega naslova ne zadostuje.

Za upravičene potrjene organizatorje je na voljo tudi brezplačen osnovni pregled zanimanja za tek na STK v zadnjih 30 dneh, kadar je na voljo dovolj ustreznih podatkov. Priprava in dostava poročila potekata po preveritvi upravičenosti in pogojev dostave; pošiljanje ni samodejno.

Število klikov na povezavo za prijavo ni enako številu dejanskih prijav na tek.

Poiščite in potrdite svoj tek

V PRIPRAVI

Napredna statistika in promocijska orodja

Naprednejše statistike in dodatna promocijska orodja so še v pripravi in trenutno niso na voljo.

### Pojasnilo v potrditvenem obrazcu

Za upravičene potrjene organizatorje je na voljo brezplačen osnovni pregled zanimanja za tek na STK v zadnjih 30 dneh, kadar je na voljo dovolj ustreznih podatkov. Priprava in dostava poročila potekata po preveritvi upravičenosti in pogojev dostave; pošiljanje ni samodejno.

### Sporočilo po sprejemu zahteve

Zahteva je prejeta. Preverite e-pošto za naslednji korak. Sama potrditev e-naslova ne zadostuje za potrditev podatkov. Morebitno poročilo se pripravi in pošlje po preveritvi upravičenosti in pogojev dostave.

## Final English copy

AVAILABLE NOW

No website for your race?

Your race can have a free public profile on STK with its date, location and distances, plus registration links, official race information and course details where verified information is available.

Share the profile link on Facebook, in invitations or on your club’s website. Find your race below, or suggest a new race, an addition or a correction.

Find your race

Add or correct a race

AVAILABLE NOW

Confirm your race information

Find your race, choose “Confirm race information” on its profile and review the current details for the correct race edition. Once your confirmation has been successfully verified, the profile may display “Data confirmed by organizer”. Verifying your email address alone is not enough.

Eligible confirmed organisers can also receive a free basic overview of interest in their race on STK over the last 30 days, provided enough suitable data is available. Eligibility and delivery are checked before the report is prepared and sent; delivery is not automatic.

Clicks on a registration link do not represent completed race registrations.

Find and confirm your race

IN DEVELOPMENT

Advanced statistics and promotion tools

Advanced statistics and additional promotion tools are still in development and are not currently available.

### Note in the confirmation form

Eligible confirmed organisers can receive a free basic overview of interest in their race on STK over the last 30 days, provided enough suitable data is available. Eligibility and delivery are checked before the report is prepared and sent; delivery is not automatic.

### Message after the request is accepted

Request received. Check your email for the next step. Verifying your email address alone does not confirm the race information. Any report is prepared and sent only after eligibility and delivery checks.

## Primerljivi before/after posnetki

Vsi posnetki so full-page, Chromium, viewport višina 900 px, DPR 1; enaki širina, jezik in brskalnik pri vsakem paru.

| Jezik / širina | Produkcija prej | Lokalno potem |
| --- | --- | --- |
| SL / 390 | [before](evidence/organizer-promotion-2026-10-18/before-sl-390.png) | [after](evidence/organizer-promotion-2026-10-18/after-sl-390.png) |
| SL / 430 | [before](evidence/organizer-promotion-2026-10-18/before-sl-430.png) | [after](evidence/organizer-promotion-2026-10-18/after-sl-430.png) |
| SL / 1440 | [before](evidence/organizer-promotion-2026-10-18/before-sl-1440.png) | [after](evidence/organizer-promotion-2026-10-18/after-sl-1440.png) |
| EN / 390 | [before](evidence/organizer-promotion-2026-10-18/before-en-390.png) | [after](evidence/organizer-promotion-2026-10-18/after-en-390.png) |
| EN / 430 | [before](evidence/organizer-promotion-2026-10-18/before-en-430.png) | [after](evidence/organizer-promotion-2026-10-18/after-en-430.png) |
| EN / 1440 | [before](evidence/organizer-promotion-2026-10-18/before-en-1440.png) | [after](evidence/organizer-promotion-2026-10-18/after-en-1440.png) |

Dodatno: [Go4trail](evidence/organizer-promotion-2026-10-18/production-go4trail-390.png), [produkcijska potrditvena pot](evidence/organizer-promotion-2026-10-18/production-confirmation-390.png). Slednja dokumentira izhodiščno napačno obljubo, ki jo ta sprememba popravlja. Podatki DOM in povezave: [before.json](evidence/organizer-promotion-2026-10-18/before.json), [after.json](evidence/organizer-promotion-2026-10-18/after.json).

## Preverjanje

- `npm test`: **585/585 PASS** na končnem izvoru.
- `npm run build`: **PASS, 661 strani**. Končni browser build uporablja javni testni ključ Turnstile `1x00000000000000000000AA`; build brez ključa je bil prav tako uspešen. Nobene konfiguracije ni v commitu.
- `npx playwright test tests/browser/proposal-form.spec.ts tests/browser/race-profile-ux.spec.ts --project=chromium`: **45/45 PASS**. Po zadnjem besedilnem popravku sporočila po sprejemu zahteve še ciljani ponovni SL/EN confirmation test: **2/2 PASS**.
- Dodatni browser QA končnih SL/EN pojasnil in sporočil po sprejemu: **2/2 PASS**; lokalni `/api/organizer-claim` prestrežen, nobene resnične oddaje ali e-pošte. [Dokaz](evidence/organizer-promotion-2026-10-18/confirmation-qa.json).
- SL/EN × 390/430/1440: **6/6 PASS**; brez overflowa, odrezanega besedila ali JS page errors; isti CTA nazivi, href, analitične akcije in postavitve, canonical, hreflang in jezikovni preklop (primerjava normalizira samo lokalni origin relativnih povezav).
- Vsi obstoječi CTA cilji vrnejo HTTP 200; sidro `#promotion` pokaže obstoječo kartico pod lepljivo glavo. Hero in tri korake ohranjamo.
- Rasterizirano preverjanje kontrasta vseh napisov, naslovov, odstavkov in gumbov v obeh spremenjenih karticah: **najmanj 6,89 : 1**, nad 4,5 : 1. Glavni CTA-ji ≥44 px. Obstoječa kompaktna navigacija ima približno 37 px visoke povezave in ostaja nespremenjena; ne trdimo, da so vsi navigacijski cilji ≥44 px. [Meritve](evidence/organizer-promotion-2026-10-18/qa.json).
- `git diff --check`: **PASS**.
- Prvotni browser zagon je bil ustavljen zaradi napačne lokalne testne konfiguracije (manjkajoči testni Turnstile ključ in sočasen rebuild). Ta zagon ni štet kot veljaven rezultat. Ponovitev je tekla na dokončanem buildu s pravilno konfiguracijo.
- Pregled vseh relevantnih besedil v `src`: odpravljene so stare obljube zagotovljenega poročila po potrditvi e-naslova; osnovni pregled je jasno pogojen, napredne možnosti ostajajo v pripravi.

## P1/P2 in omejitve

Napačna zagotovljena obljuba poročila v nadaljevalnem potrditvenem obrazcu je bila odpravljena v tem PR z vsebinskima popravkoma pojasnila in sporočila po sprejemu zahteve. Drugih novih P1/P2 ugotovitev v pregledanem obsegu ni. Brskalniški pregled uporablja Chromium; fizični telefoni, Safari/Firefox in dejansko pošiljanje poročila niso preverjeni. Uporabniški tok je preverjen brez produkcijskih oddaj ali e-pošte.
