# Dodatni pregled Draft PR #229

17. 10. 2026, ista veja `codex/home-stats-2026-2027`. Pregled vključuje dejansko zgrajeni SL/EN domači strani z javnim Worker API, ne samo DOM testov ali mock podatkov. PR je bil ob začetku nadaljevanja Ready; po izrecnem navodilu uporabnika je ponovno Draft.

## Vizualni pregled

Ročno pregledanih vseh deset posnetkov pri 320, 390, 641, 768 in 1440 px. Podatki na posnetkih so dejanski: 2026 = 281/138/22, 2027 = 36/10. Posnetki vključujejo uvod, oba statistična bloka in naslednjo sekcijo. CSS in struktura kartic ostaneta nespremenjena: pregled ni pokazal težave, ki bi upravičila popravek postavitve.

| Širina | SL | EN | Rezultat |
| --- | --- | --- | --- |
| 320 px | [Posnetek](home-sl-320.png) | [Posnetek](home-en-320.png) | Brez prekrivanja, en stolpec |
| 390 px | [Posnetek](home-sl-390.png) | [Posnetek](home-en-390.png) | Brez prekrivanja, en stolpec |
| 641 px | [Posnetek](home-sl-641.png) | [Posnetek](home-en-641.png) | Brez prekrivanja, dva stolpca, besedilo se prelomi |
| 768 px | [Posnetek](home-sl-768.png) | [Posnetek](home-en-768.png) | Brez prekrivanja, dva stolpca |
| 1440 px | [Posnetek](home-sl-1440.png) | [Posnetek](home-en-1440.png) | Brez prekrivanja, dva stolpca |

Dodatno izmerjene meje kartic, naslovov, opombe 2027, posameznih statističnih besedil in povezav ter naslednje sekcije: noben element ne zapusti svoje kartice in nobena od teh mej se ne prekriva. Brez horizontalnega pomikanja. Meritve so v [layout.json](layout.json); enaka preverjanja notranjih elementov so dodana Playwright regresiji. Fokus povezav in pravilne SL/EN poti ostajajo preverjeni.

## Družinska pravila: dokazana razlika

Pregledana [izvorna implementacija Content API v repozitoriju](https://github.com/igorkalsek/stk-apps-scripts/blob/599a6dc584bfcb250553a190822b553ad58b8ff6/projects/stk-content-api/Code.gs#L7070): `isFamilyFriendly_` uporablja podnize v javnih opombah, med drugim `otroški`, `otrok`, `družinski`, `mladinski`, `cici`, pa tudi samostojni `brezplačna prijava` in `brezplačna udeležba`. `buildOverallStatsBlock_` uporablja ta filter za 2026.

Prvotni PR #229 je za 2027 uporabljal samo `družinam prijazno` iz javnega mapperja. To zgreši izrecni otroški tek ali družinski popust brez te oznake. Popravek `hasExplicitFamilyOffer` je omejen na statistični helper PR-ja: poleg oznake prepozna konkretne otroške/predšolske teke, družinske prijave, popuste in jasno družinsko ponudbo. Naziv in razdalja nista dokaz; samostojna brezplačna prijava/udeležba ni družinska vsebina. Negativne omembe in omejitev samo za odrasle ne ustvarijo zadetka. Obstoječi javni mapper/iskalnik in `/stats` ostaneta nespremenjena.

Kontrolni odčitek javnih virov okoli 11:25 CEST:

| Metoda | 2026 | 2027 |
| --- | ---: | ---: |
| Samo dobesedna oznaka iz prvotnega PR | 129 | 10 |
| Širše pravilo Content API, reproducirano na javnih vrsticah | 138 | 10 |
| Popravljeno ožje pravilo PR, primerjalno na javnih vrsticah | 138 | 10 |

Produkcijski `/stats` dejansko vrne 138 za 2026. Primerjalno štetje 2026 je izvedeno samo za analizo; spletna stran 2026 še naprej bere nespremenjeni `/stats`.

Dodatno preverjen obstoječi javni Worker `/family?limit=1000`: vrne vseh 138 dogodkov, vključuje row 102 in ne vključuje row 188. Tako razlika ni samo sklepanje iz izvorne kode.

**Enaka številka 138 ne pomeni enakega nabora:**

- Master 2026 row 102, **Tek na Friderikov stolp 2026**: javna opomba vsebuje »Obvezna brezplačna prijava« in »Tek je samo za polnoletne osebe (18+)«. Stari Content API ga zaradi brezplačne prijave šteje za družinskega; novo ožje pravilo ga izključi.
- Master 2026 row 188, **4. Kraljevski vzpon na Kamniško sedlo**: »20 % popust za družine s 3 ali več udeleženci.« Novo pravilo prepozna izrecno družinsko ugodnost, stari seznam podnizov je ne prepozna.
- Devet zadetkov širšega pravila 2026 brez dobesedne oznake: rows 45, 102, 204, 208, 241, 267, 298, 302, 303. Večina ima izrecne otroške teke ali družinsko vsebino; row 102 je navedena preširoka izjema.

**2027 ostaja 36 potrjenih javnih / 10 družinam prijaznih.** Vseh deset izrecnih družinskih ponudb že vsebuje oznako, zato popravek ne spremeni števila niti nabora. Družinske vrstice 2027: 6, 7, 8, 11, 13, 17, 19, 25, 33, 36. Pregledane so bile tudi ostale javne opombe vseh 36 dogodkov; ni dodatne otroške ali družinske ponudbe brez oznake. Prazni in negotovi opisi ne dodajo zadetkov. Število ostaja dinamično; navedene vrednosti niso konstante v implementaciji.

## Aktualni testi in tveganja

- `npm test`: 574/574 uspešno, vključno z izrecnimi otroškimi teki, družinskimi ugodnostmi in negativnimi primeri (odrasli, samo brezplačna prijava, kratek tek, odsotni otroški teki).
- `npx playwright test --project=chromium`: 266/266 uspešno (3,3 minute), med njimi vseh 22 statističnih scenarijev; preverjene notranje meje, povezave, ohranitev 2026/»Moj STK« in nevtralna stanja API.
- `npm run build`: uspešno, 661 strani.
- `git diff --check`: uspešno.
- `npx astro check`: enaki 2 obstoječi napaki v `tests/browser/finder.spec.ts:567` (`placement` na `{}`) in `tests/browser/race-detail-contrast.spec.ts:19` (`remove` na `Node`), 5 namigov; brez novih diagnostik. Na izhodiščnem main sta bili neodvisno potrjeni že ob prvem preverjanju PR-ja.
- Prvi ročni celotni browser zagon je bil prekinjen, ker je lokalni preview uporabil build brez `PUBLIC_STK_TURNSTILE_SITE_KEY`, ki ga običajna Playwright konfiguracija sicer nastavi. Testi obrazcev so zato odpovedali zaradi testnega okolja. Končni celotni zagon prek nespremenjene konfiguracije s testnim ključem je uspešen; obrazcev ali njihove kode nismo spreminjali.

Brez novih ugotovljenih P1/P2 regresij v pregledanem obsegu. Dokumentirana je že obstoječa preširoka klasifikacija dogodka 2026 v produkcijskem `/stats`; ta PR je ne popravlja. Morebitna nadaljnja uskladitev mapperja, family strani in Content API je ločen obseg. Brez merge, deploy, sprememb Masterja ali novih endpointov.
