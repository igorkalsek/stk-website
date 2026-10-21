# DEV-044 / F2-A – javni GET-i homepage in Moj STK

Datum: 21. 10. 2026 (Europe/Ljubljana). **GO samo za sočasne Master zahteve.** Additional ostaja nespremenjen zaradi različnih obstoječih pravil časovne omejitve. AFTER je lokalna meritev predlagane kode, ne produkcijski rollout.

## Preflight

- Pregledan oddaljeni `main`: `6182e0098d58be4099ffb29942369a9ea4da9302`; ponovno preverjen pred pripravo PR-ja.
- Produkcijski SL in EN homepage: HTTP 200, dejansko izveden JavaScript v Chromiumu. [Produkcijski zajem](evidence/dev044-f2a/production-before.json) vsebuje naslove, skripte, izdane zahteve, odgovore in resource timing. Deployment SHA iz brskalnika ni bil potrjen.
- Edini odprti Website PR ob preflightu: [Draft #237](https://github.com/igorkalsek/stk-website/pull/237), HEAD `648f48a6777ba56e1e20432b7f9824167d6ae202`. Pregledan opis in celoten diff: dokumentacijski audit, brez prekrivajoče implementacije.
- Pregledani SL/EN homepage, `my-stk-client.ts`, `utils-additional.ts`, `utils-public-year.ts`, build cache, statistični year helper, shranjeni teki ter timeout/fallback in obstoječe regresije rokov/dokazil.
- Homepage že deli svoje obljube v `apiRequestCache`; to ni manjkajoča implementacija. Moj STK tega cachea ne uporablja in ob vsakem lokalnem dogodku spremembe ponovno bere podatke.
- Za primerjavo uporabljen ločen začasni checkout aktualnega `main`. Začetna uporabnikova veja in nepovezane lokalne datoteke ostanejo nedotaknjene. Apps Script, Worker, Master in DEV-043/AB niso spremenjeni.

## Meritve

Produkcija: svež kontekst za vsako kombinacijo SL/EN in prazno / 2026 / 2026+2027 lokalno stanje. Sintetične shranjene reference vplivajo samo na lokalni brskalnik. Vsi ne-GET zahtevki so prestreženi, vključno z obstoječo analitiko.

Kontrolirana primerjava: ista matrika dodatno pri **390 in 1440 px**, fiksni čas in enaki odgovori API. Štejejo dogodki `page.on('request')` za GET na Worker, ne klici helperjev. Testni odgovori so prestreženi v brskalniku; to niso dodatne zahteve do produkcijskega Workerja. Podatkovni odgovori imajo nadzorovano zakasnitev, ki zagotovi prekrivanje. [Celotni BEFORE/AFTER](evidence/dev044-f2a/controlled-before-after.json).

Število začetnih GET-ov je enako v SL/EN in pri obeh širinah. BEFORE je potrjen tudi neposredno na produkciji.

| Shranjeni teki | Master `/` | Master `/?year=2027` | `/additional` | `/additional?year=2027` | Vsi javni Worker GET-i |
|---|---:|---:|---:|---:|---:|
| Brez | 1 → 1 | 1 → 1 | 1 → 1 | 0 → 0 | **6 → 6** |
| 2026 | 2 → 1 | 1 → 1 | 2 → 2 | 0 → 0 | **8 → 7 (−12,5 %)** |
| 2026 + 2027 | 2 → 1 | 2 → 1 | 2 → 2 | 1 → 1 | **10 → 8 (−20 %)** |

Ostale tri poti so `/stats`, `/group-runs` in `/recent_updates?days=7&limit=4&years=2026,2027`, vsaka po enkrat pred in po spremembi. `interest-preview` ni Worker GET in ni v zgornji vsoti.

Pomembna razlika: testna instrumentacija Vite odgovora zabeleži **10 klicev homepage `loadJson`**: Master 2026 štirikrat, Master 2027 dvakrat, ostale poti po enkrat. Obstoječi cache že zmanjša teh 10 klicev na **6 mrežnih GET-ov**, kadar ni shranjenih tekov. Predlagani helper odstrani samo dodatno prekrivanje z Moj STK. Instrumentacija živi samo v meritvenem skriptu, ne v kodi strani.

| Dodatni scenarij | BEFORE → AFTER |
|---|---|
| En običajen statusni dogodek, brez shranjenih tekov | 0 → 0 |
| En običajen statusni dogodek po zaključenih odgovorih, 2026 | 2 → 2: svež Master in Additional |
| En običajen statusni dogodek po zaključenih odgovorih, obe leti | 4 → 4: svež Master in Additional za vsako leto |
| Shranjevanje prvega teka po nalaganju | 2 → 2 |
| Odstranitev zadnjega teka | 0 → 0 |
| Odstranitev 2026, medtem ko ostane 2027 | 4 → 4; obstoječa sezonska osnova 2026 se ohrani |
| Dva statusna dogodka med zakasnjenim Masterjem, 2026 | Master 2 → 1; Additional 2 → 2; skupaj 4 → 3 |
| Po mrežni napaki, HTTP 503 ali neveljavnem JSON-u, obe leti | Ponoven lokalni prikaz sproži po en svež Master GET za vsako leto; napaka ni zadržana |
| Master 2027 ali Additional nedosegljiv | Master 2026 in osnovni Moj STK ostaneta neodvisna; naslednji poskus uspe |
| Odstranitev vseh tekov med zakasnjenim Masterjem | Zapozneli odgovor ne prepiše začetnega povabila |
| Additional preseže 15 s | Master je že prikazan; ponoven poskus pozneje dopolni rok |

**Prikaz:** v vseh 12 osnovnih BEFORE/AFTER kombinacijah je `main.innerHTML` bajtno enak. Nobena kombinacija nima vodoravnega preliva. Ločeni brskalniški testi preverjajo dejanski gumb za shranjevanje, lokalne statuse, leto naslednjega teka, rok in svež odgovor po ponovnem prikazu.

## Velikost in čas

[Ločen javni GET zajem](evidence/dev044-f2a/public-response-sizes.json): Master 2026 **273.798 B**, Master 2027 **38.863 B** razpakiranega JSON-a. Prihranek začetnega nalaganja je zato približno **274 kB** pri 2026 oziroma **313 kB** pri obeh letih. Additional: 183.968 B / 35.901 B, brez spremembe.

To niso bajti prenosa po žici: strežnik uporablja Brotli, `PerformanceResourceTiming` pa za te medizvorne odgovore vrne ničelne `transferSize`/`encodedBodySize`. Ničle ne pomenijo praznih odgovorov ali cache zadetkov. Posamezni produkcijski Master resource časi v zajemu so približno **1,43–3,26 s**. Zahteve se prekrivajo; krajšanje kritične poti ali hitrejše nalaganje ni dokazano in se ne obljublja.

## Minimalen poseg in omejitve

- En skupen zemljevid **samo tekočih Master obljub**, ločen po podprtem letu in z obstoječim `buildMasterApiPath`.
- Branje JSON-a je vključeno v deljeno obljubo. Uspeh, HTTP/mrežna napaka in napaka JSON počistijo vnos. Poznejši prikaz Moj STK dobi svež odgovor.
- Homepage ohrani lasten obstoječi cache za svoje porabnike; zavrnjen Master vnos odstrani, da je nov poskus mogoč.
- Brez TTL, nove invalidacije, shranjevanja cachea ali novih API pogodb. Master nima nove časovne omejitve. Obstoječa zaščita pred zastarelim prikazom `renderVersion` ostane.
- **Additional: NO-GO za združevanje med homepage in Moj STK v tej fazi.** Moj STK uporablja 15-sekundni AbortController, homepage nima te omejitve. Deljenje odpovedljive zahteve zahteva ločeno upravljanje čakanja/odpovedi porabnikov; to presega ta majhen dokazani poseg. Nespremenjeni so tudi mapper, year filter in obogatitev.
- Prihranek je omejen na prekrivajoče se zahteve. Zaporedne spremembe statusa namenoma ostajajo sveže. Master, ki se nikoli ne zaključi, še vedno nima timeouta; to je obstoječa omejitev.
- Noben poseg v identiteto dogodkov, statuse, analitiko ali pravila uradnih dokazil. Ni nove telemetrije ali produkcijskih zapisov.

## Verifikacija in ponovitev

- `npm test`: **770 uspešnih**, vključno s štirimi novimi testi deljenja, ločitve let, svežine in obnovitve po napaki.
- Lokalni `npm run build`: **uspešen**, 667 strani; ni produkcijski rebuild ali deployment.
- `tests/browser/public-get-dedup.spec.ts`: **28/28 BEFORE**, **28/28 AFTER v dev**, **28/28 AFTER na zgrajenem paketu**.
- Obstoječi `home.spec.ts`, `home-stats.spec.ts`, `my-races-statuses.spec.ts`, `registration-deadlines.spec.ts`, `race-watch.spec.ts`: **163/163**, tudi SL/EN, mobile/desktop, 2026/2027, potek dokazil, polnoč Europe/Ljubljana in pozni odgovori.
- `git diff --check`: uspešen.

Ponovitev s trenutnim checkoutom in nameščenim Chromiumom:

```sh
npm test
npm run build
npx playwright test tests/browser/public-get-dedup.spec.ts --project=chromium
npx playwright test tests/browser/home.spec.ts tests/browser/home-stats.spec.ts tests/browser/my-races-statuses.spec.ts tests/browser/registration-deadlines.spec.ts tests/browser/race-watch.spec.ts --project=chromium
```

Za BEFORE se isti novi brskalniški spec prenese v začasni checkout navedenega `main` in zažene s `STK_GET_BASELINE=1`. To spremeni samo pričakovana števila zahtev v testu.

Ohranjeni so tudi samostojni merilni skripti: `measure-production.mjs` (živi brskalniški GET-i, blokirani ne-GET-i), `measure-response-sizes.mjs` (štirje javni odgovori) in `measure-local.mjs` (kontrolirana matrika, instrumentacija samo v dev odzivu). Lokalni skript pričakuje `npm run dev -- --host 127.0.0.1 --port 4344`; `STK_OUTPUT=/private/tmp/stk-dev044-before.json` oziroma `STK_OUTPUT=/private/tmp/stk-dev044-after.json` določi datoteko zajema. Primerjavo HTML vsebuje izvirni lokalni zajem; v repozitoriju je shranjen pregled s kontrolnimi zgoščenimi vrednostmi in številom zahtev.

Predlagana veja ima en commit z [oznako `[CF-Pages-Skip]`](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/#skipping-a-build-via-a-commit-message), da push ne sproži Cloudflare Pages deploymenta. Brez merge, sprožitve deploy hooka, produkcijskega rebuilda ali spremembe produkcijskih podatkov.
