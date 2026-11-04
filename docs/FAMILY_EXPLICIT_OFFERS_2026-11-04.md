# Družinam prijazni teki: skupna semantika SL/EN

## Izhodišče in produkcija

Pregled 4. 11. 2026 pred spremembo:

- `origin/main`: `4ba1f5c` (DEV-037 P2, PR #253).
- Odprta PR-ja: #247 (GPX raziskava) in #237 (dokumentacijski audit); brez prekrivanja teh družinskih strani.
- Produkcijski strani: https://tekaski-koledar.si/druzinam-prijazni-teki/ in https://tekaski-koledar.si/en/family-friendly-races/ sta dosegljivi. Prenesena HTML in dejanska JS paketa (`B-21vT0w`, `P_4vEkSe`) v obeh jezikih še uporabljata dobesedni `includes` oznake »družinam prijazno« ob pogojih potrditve, vidnosti in 2026.
- Javni Worker `https://stk-master-api.igor-kalsek.workers.dev/`: 309 vrstic. Preverjene javne opombe pri vrsticah 102, 267 in 303; regresijski posnetek vsebuje le izbrane javne podatke. Brez neposrednega dostopa do Sheets ali sprememb podatkov.

## Sprememba

Obe strani neposredno uporabljata obstoječi `hasExplicitFamilyOffer` iz `utils-home-stats.ts`. Implementacija in pravila te funkcije ostajajo nespremenjeni; posodobljen je le komentar o skupni uporabi. Slovensko statusno besedilo je usklajeno z izborom otroških ali družinskih ponudb. To je edina vedenjska sprememba. Potrditev, javna vidnost, letnica 2026, datum od danes naprej z obstoječim prikazom preteklih ob odsotnosti prihodnjih, razvrščanje, filtri, paginacija in povezave ostajajo isti.

- Tek na Friderikov stolp 2026: izključen; javne opombe omejujejo tek na polnoletne (18+), brez otroške/družinske ponudbe.
- Velenje Trail 2026: vključen; »Družinski trail 10 km ob 09:00«.
- 11. Tek občine Mengeš 2026: vključen; »Otroški tek 600 m ob 10:30«.

Na pregledanem posnetku API se letni izbor razširi s 134 na 143 prireditev, prihodnji izbor na dan 4. 11. 2026 pa z 11 na 13 (dodana Velenje in Mengeš). Noben prej izbran dogodek v tem posnetku ne odpade. Številke so trenutni posnetek, ne nov podatkovni vir ali pogodba. `/stats` ostaja nespremenjen.

## Preverjanje

- `npm test`: 868/868 PASS, vključno z regresijo vseh treh javnih opomb.
- `npm run build`: PASS; 697 strani, preverjenih 670 SL/EN profilov.
- `npx playwright test tests/browser/family-offers.spec.ts --project=chromium --output=/tmp/stk-family-playwright`: 16/16 PASS.
- Brskalnik: SL/EN pri 390 in 1440 px, vrstni red in obe vključitvi, izključitev Friderika tudi z datumom pred njegovim tekom, zavrnitev zasebnih opomb/naslova/kratke razdalje/splošne brezplačnosti/zanikanih ponudb, potrditev, vidnost, napačne letnice, vsi štirje filtri in čiščenje, povezave do profila/prijave/razpisa, koledar in shranjevanje, prihodnji prikaz in pretekli fallback, današnja meja in dobesedna družinska oznaka.
- API napake: HTTP 503, prekinjena povezava in neveljaven JSON v obeh jezikih; lokalizirano obvestilo, brez kartic ali gumba za več.
- Vizualni pregled posnetkov obeh jezikov pri 390 in 1440 px; brez vodoravnega prelivanja. Posnetki QA so lokalno v `/tmp/stk-family-{sl,en}-{390,1440}.png`.
- `git diff --check`: PASS.

Prvi zagon Chromiuma je blokiral macOS sandbox (MachPort permission denied); ponovitev z dovoljenim zagonom zunaj sandboxa je uspela. Aplikacijske napake zaradi tega niso bile zaznane.

## Tveganja in povrnitev

Izbor je odvisen od kakovosti javnih opomb in obstoječe jezikovne hevristike. Ponovno uporabljena semantika ni nov preverjevalnik uradnih razpisov; prihodnje spremembe helperja vplivajo tudi na obe družinski strani. Obstoječa dobesedna oznaka še vedno šteje kot ponudba. Angleški prikaz za neprepoznan povzetek ohrani obstoječe splošno besedilo in razširljivo izvorno opombo (npr. družinski trail). Podrobnejši prevodi in širitev jezikovnih pravil niso del tega popravka.

Ena veja `codex/family-explicit-offers`, en commit in Draft PR z oznako `[CF-Pages-Skip]`, ki prepreči samodejni Pages build ob pushu. Brez mergea, deploy hooka ali deploymenta. Master, Content API, `/stats`, Admin in konfiguracija ostajajo nespremenjeni. Povrnitev: revert tega enega commita; brez migracije ali povrnitve podatkov. Produkcijo je po ločeno odobreni uvedbi treba preveriti z aktualnimi javnimi podatki.
