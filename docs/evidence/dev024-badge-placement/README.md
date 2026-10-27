# DEV-024 – značka neposredno pod naslovom profila

27. 10. 2026, Europe/Ljubljana. Kandidat za pregled; brez mergea, deploymenta ali spremembe backloga.

## Izhodišče in poseg

- Veja temelji na aktualnem `main` `eac41b10328b9c2e9af5b7b803bae0d8368b36a2` (PR #244). DEV-024 PR #241 je že združen. Edini odprti PR ob začetku je dokumentacijski #237, brez prekrivanja. Obstoječa evidenca DEV-024 je bila prebrana; zaključenih upstream auditov nismo ponavljali.
- Dejanski produkcijski profil R000011 ima eno vidno značko v organizatorskem razdelku in skrit potrditveni gumb. Produkcijski profili so spodaj primerjani z lokalnim kandidatom.
- Obstoječa komponenta je v SL in EN premaknjena neposredno za `h1`, pred `event-detail-hero-facts`. Prejšnja umestitev je odstranjena. Besedilo značke in oznake statusa dogodka ostajajo enaki.
- Na temnem ozadju hero razdelka ima značka svetlo neprosojno ozadje in izrecno temno besedilo. To prepreči dedovanje bele barve ob obstoječi nedefinirani spremenljivki `--green-dark`. Slog velja le za značko v hero razdelku; širina je omejena na razpoložljivi prostor.
- Po uspehu nespremenjene funkcije `hasConfirmedOrganizerData` skripta poišče potrditveni gumb znotraj istega `main` in ga skrije samo pri natančnem ujemanju `data-year` ter `data-event-id`. Povezava za predlog popravka ostane na voljo.
- API, Master, Apps Script, podatkovna pogodba in postopek potrjevanja niso spremenjeni. Ostaja en javni GET za potrditve na profil; brez nove hrambe ali funkcionalnosti.

## Preverjanje

`npm test`: **810/810 PASS**. `npm run build`: **PASS, 685 strani**. Živa primerjava: **20/20 PASS** (40 nalaganj profilov). `git diff --check`: **PASS**. Ciljna browser matrika: **148/148 PASS** (70 javni organizatorski seznam, 24 obstoječi kontrastni, 46 novih profilnih potrditev, 8 obstoječih profilnih UX). Ukazi:

```sh
npm test
npm run build
npx playwright test tests/browser/race-detail-contrast.spec.ts tests/browser/race-profile-ux.spec.ts tests/browser/organizer-confirmed-races.spec.ts --project=chromium
git diff --check
```

Nove browser regresije so dodane v obstoječo datoteko `race-detail-contrast.spec.ts`, ki jo obstoječi CI že izvaja. Preverjajo SL/EN × 390/1440 px, štiri pozitivne profile, eno značko neposredno pod naslovom, razporeditev, odsotnost stare umestitve, oba organizatorska gumba, statusno oznako, identiteto povezave, odsotnost prelivanja in eno zahtevo API. Negativni scenariji pokrivajo PENDING_EMAIL, PENDING_CONFIRMATION, samo potrjen e-naslov, prazno projekcijo, false, napačno leto/ID ter napake HTTP, omrežja in JSON. Dodatna testa preverita, da ob vidni veljavni znački gumb z drugim letom ali ID ostane viden. Enotski testi dodatno zavračajo statuse ali email-only brez eksplicitne potrditve in neveljavne projekcije. Obstoječi kontrastni testi ohranijo prag 4,5 : 1.

[Živa primerjava produkcije in lokalnega kandidata](live-check.json) uporablja dejanske odgovore javnega Workerja, brez nadomeščanja podatkov: pet profilov × SL/EN × 390/1440 px, vsak v produkciji in lokalno. Preverja HTTP 200, eno značko, vidnost, gumbe, nespremenjene organizatorske povezave, status in ključne podatke, odsotnost napak ter prelivanja. Zabeležen je tudi vsak dejanski odgovor projekcije.

Živi javni API potrjuje R000011/R000012/R000019 v letu 2027 ter R000256 v letu 2026; R000034 ni v pozitivni projekciji. Javna pogodba ne izpostavlja zasebnih statusov VERIFIED/PENDING_CONFIRMATION, zato dokaz trdi le prisotnost ali odsotnost veljavne javne potrditve. Zasebni Sheet podatki niso bili brani.

Vizualno pregledani lokalni posnetki z živimi podatki: [SL 390](sl-390.png), [SL 1440](sl-1440.png), [EN 390](en-390.png), [EN 1440](en-1440.png).

## Omejitve, uvedba in povrnitev

Nova umestitev še ni v produkciji. Preverjen je Chromium pri navedenih širinah; fizična naprava in Safari nista preverjena. Lokalni profilni build ostaja posnetek obstoječih javnih virov; organizatorska potrditev se preveri ob nalaganju z obstoječim Workerjem. API odpoved pusti značko skrito in potrditveni gumb na voljo.

Commit in naslov PR vsebujeta `[CF-Pages-Skip]`. Po odobrenem mergeu in ločeno odobreni uvedbi je treba ponoviti dejanski produkcijski ter mobilni SL/EN preizkus, vključno z vsemi petimi primeri in aktualno projekcijo. **DEV-024 do takrat ni DONE.**

Povrnitev: revert enega implementacijskega commita oziroma squash merge commita in običajen odobren deploy reverta; brez podatkovne migracije.
