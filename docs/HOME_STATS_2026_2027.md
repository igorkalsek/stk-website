# Statistika na domači strani: 2026 in 2027

Preverjeno 17. 10. 2026. Izhodišče: `main` `ccaf837`.

## Preflight in izvedba

- Pregledani produkcijski strani https://tekaski-koledar.si/ in https://tekaski-koledar.si/en/: pred spremembo samo trak STK 2026.
- Ob začetku dela ni odprtih PR-jev v `stk-website`. Pregledani odprti PR-ji v `stk-apps-scripts` (#97–103: Content Pack/visuals, DEV-031 in incident); brez odvisnosti za ta prikaz.
- Pregledan `stk-apps-scripts/main` (`599a6dc`): Master podpira ekspliciten `year=2027`, privzeto 2026; Worker ohranja javni API contract. Brez sprememb tega repozitorija ali deploymentov.
- Pregledani `loadStats()`, `/stats`, `/group-runs`, `getPublicYearData`, `utils-public-year`, mapper in year-aware iskalnik ter obstoječi CSS in unit/Playwright vzorci.
- Obe domači strani uporabljata skupno komponento `HomeYearStats.astro`. 2026 ostane poudarjeno; 2027 ima diskreten napis in neposredno povezavo v ustrezen SL/EN iskalnik. Desktop: dva bloka v vrstici; mobilno: zložena bloka.

## Viri in metodologija

Vsi podatki prihajajo iz javnega Workerja `https://stk-master-api.igor-kalsek.workers.dev`.

- **2026:** nespremenjeni `loadStats()` bere `confirmed_public_events_total` in `family_friendly_total` iz `/stats`, skupinske teke iz `row_count` v `/group-runs`. Iste vrednosti še vedno napolnijo »Moj STK«.
- **2027:** ena zahteva `/?year=2027` na ogled strani, prek obstoječega `loadJson` in njegovega request cache. Pot sestavi `buildMasterApiPath`; štetje ponovno uporabi `mapPublicRaceEventForDetail`, enak canonical mapper kot year-aware javni prikazi. Potrebni so potrjen status, javna vidnost DA, datum v izbranem letu in veljaven javni dogodek. Šteje se celo leto, brez omejitve na prihodnje dogodke.
- **Družinska vsebina 2027:** `hasExplicitFamilyOffer` bere samo `opombe_javne`: izrecno oznako, otroške/predšolske teke, družinsko prijavo/kategorijo/popust, varstvo ali drugo jasno družinsko ponudbo. Sam naziv, kratka razdalja, zasebna opomba ali brezplačna prijava brez družinskega konteksta ne zadostujejo; izrecno odsotne ponudbe in omejitve samo za odrasle ne štejejo. Popravek je omejen na statistiko 2027; finder mapper ostane nespremenjen.
- `getPublicYearData` ostaja obstoječi build-time vir za statične prihajajoče teke in profile. Za sprotno statistiko se ponovno uporabijo njegove osnovne year-aware funkcije; nove statične kopije podatkov ni.
- Pri praznem/manjkajočem/neveljavnem/neuspešnem odgovoru ali brez veljavnih javnih dogodkov za 2027 se izpiše »Ni podatka« / »Not available«. Resnična ničla družinskih oznak ob veljavnih dogodkih ostane 0. Napaka posameznega leta ne skrije drugega.
- Skupinskih tekov za 2027 ne prikazujemo.

Kontrolni javni API odčitek 17. 10. 2026 okoli 09:59 CEST:

| Leto | Potrjeni javni teki | Družinam prijazni | Skupinski teki |
| --- | ---: | ---: | ---: |
| 2026 | 281 | 138 | 22 |
| 2027 | 36 | 10 | — |

2027 se ujema z referenco 36/10, razlike ni. To so odčitki za poročilo in testi uporabljajo ločene sintetične podatke; prikaz nima hardcoded števil.

## Preverjanje

- `npm test`: 574 uspešnih testov.
- Novi Playwright testi: 22 uspešnih (ponovno tudi na končnem buildu); SL/EN pri 320, 390, 641, 768 in 1440 px, pravilne povezave za obe leti, izključevanje neuradnih/skritih tekov, izrecna družinska oznaka, nevtralna stanja API, neodvisnost obeh let, nespremenjeni »Moj STK«, enkratne zahteve in viden fokus povezav.
- Končni lokalni build preverjen tudi z dejanskim javnim API: v obeh jezikih 2026 = 281/138/22 in 2027 = 36/10; brez horizontalnega pomikanja pri vseh petih širinah.
- Vseh deset posnetkov SL/EN postavitve ročno vizualno pregledanih; brez horizontalnega pomikanja. Preverjene semantične oznake blokov, vidne vrednosti in 44 px visoke povezave.
- Celotna browser zbirka (`npx playwright test --project=chromium`): 266/266 uspešno.
- `npm run build`: uspešno, 661 strani.
- `git diff --check`: uspešno.
- `npx astro check`: 2 že obstoječi napaki, 5 namigov. Na čistem `main` v ločeni začasni kopiji je rezultat enak: `tests/browser/finder.spec.ts:567` (`placement` na `{}`) in `tests/browser/race-detail-contrast.spec.ts:19` (`remove` na `Node`). V spremenjenih datotekah ni novih diagnostik. Teh nepovezanih napak ta PR ne popravlja.

## Tveganja in obseg

Novih P1/P2 regresij v preverjenem obsegu ni. Prikaz je odvisen od razpoložljivosti javnega API; nevtralno stanje je prisotno že pred nalaganjem 2027. Družinsko štetje prepozna izrecne otroške in družinske vsebine, obstoječi `/stats` pa ima širša pravila; podrobna primerjava je v [dodatnem pregledu](evidence/pr229/README.md).

Brez sprememb Masterja/Sheets, Apps Script/Worker deploymentov, endpointov, DEV-033, recent updates, organizer workflowa ali analitike. Brez novih odvisnosti. Brez merge ali produkcijske objave. Commit/PR uporablja `[CF-Pages-Skip]`.

## Dodatni pregled PR #229

Na isti veji je opravljen [dodatni vizualni in podatkovni pregled z desetimi posnetki](evidence/pr229/README.md), vključno s 320 in 641 px. Aktualni rezultati in razlike v družinskih pravilih so v dodatnem poročilu. PR ostane Draft do odobritve.
