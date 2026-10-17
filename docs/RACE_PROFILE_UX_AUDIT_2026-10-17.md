# STK: ciljni pregled profilov tekov, 17. 10. 2026

Rezultat je omejen popravek dveh pravil CSS, regresijski browser test in dokazila. Brez sprememb podatkov, API, organizatorskih potrditev, analitike, infrastrukture ali objave.

## Izhodišče in preflight

- `main`: `8c36b1ffe3bb168aeda4efd3e916357c6198ab39`; ponovno preverjen z GitHubom. Ob preflightu ni odprtih Website PR-jev ali GitHub issues. Delovna veja iz tega main: `codex/race-profile-ux-audit`.
- Prebran repo `AGENTS.md`, SL/EN Astro profila, `global.css`, `BaseLayout`, helperji prikaza, share/calendar/saved-race/registration-deadline/organizer-confirmation logika in obstoječi unit/browser testi.
- Prebran kanonični [razvojni backlog](https://docs.google.com/spreadsheets/d/1B7fWHfu3ylDTEuU6vKG--riFQMRx7-URriHcuT8F4sc/edit), samo read-only. Podatki dogodkov so pridobljeni izključno prek javnega STK Workerja; Master Sheet ni neposredno bran ali spreminjan.
- **DEV-018 DONE**: [#218](https://github.com/igorkalsek/stk-website/pull/218) in [#220](https://github.com/igorkalsek/stk-website/pull/220) že rešujeta širine Finderja, mobilno gostoto in višino glavnih akcij.
- **DEV-020 DONE**: [#225](https://github.com/igorkalsek/stk-website/pull/225). Sveži produkcijski odčitki že kažejo belo besedilo značk in `rgba(255,255,255,.9)` pri naslovih dejstev. Starega kontrastnega problema ne ponavljamo.
- **DEV-031 DONE**: [#227](https://github.com/igorkalsek/stk-website/pull/227) in [#228](https://github.com/igorkalsek/stk-website/pull/228), nevtralni roki in preverjeni v2 pomeni. Ostajajo nedotaknjeni. Apps Scripts Draft #100–102 so ločen obseg; prav tako #97–99 in incidentni #103.
- Relevantni odprti backlog: DEV-024 javni pregled organizatorskih potrditev, DEV-025 dostop do organiziranih tekov, DEV-034 Organizer Plus, DEV-035 terminski radar, DEV-036 opozorila in DEV-037 promocijski pilot. Ni novih seznamov, portalov, računov, opozoril, plačljivih storitev ali outreach aktivnosti. DEV-033/038 sta že v main in nista del tega popravka.
- Predhodne neprijavljene datoteke v `docs/` in `docs/evidence/website-p2-dev031-t3-2026-10-15/` niso vključene ali urejane.

## Svež produkcijski pregled

Chromium, SL in EN, širine **390, 430 in 1440 px**; mobilni viewport 844 px, namizni 1000 px. Pregledani vsi štirje zahtevani profili ter skopi [Hrastnik Trail 2027](https://tekaski-koledar.si/tek/2027/r000018-hrastnik-trail-2027/): 30 produkcijskih stanj, vsi HTTP 200, brez horizontalnega prelivanja v odčitkih. Za sklepe so uporabljeni sveži browser/HTTP odčitki, saj spletni indeks še kaže stare podatke in stare značke.

| Profil | Potrjene ugotovitve |
| --- | --- |
| [Go4trail 2026](https://tekaski-koledar.si/tek/2026/r000256-go4trail/) | Jasni naziv, datum, ura, 13/28/64 km; prijava in razpis ter shrani so že vidni visoko. Prijavnina 40–100 €, 2900 m+, trasa, organizator in dejanska organizatorska značka so prikazani. Na mobilniku orodja potisnejo vsebino pod dva zaslona. |
| [Kočevsko 2027](https://tekaski-koledar.si/tek/2027/r000017-kocevsko-outdoor-festival-2027/) | Celoten dolg naziv se prelomi; datum/leto, razdalje in družinska ponudba so prikazani. Manjkajoča ura/prijavnina/trasa ne ustvarijo izmišljenih kartic. Značka organizatorske potrditve je trenutno pravilno skrita. Ista težava z mobilnim vrstnim redom. |
| [Ormož 2026](https://tekaski-koledar.si/tek/2026/r000053-25-ormoski-polmaraton/) | Pretekli dogodek je označen; povezave ostanejo uporabne kot arhiv. Javni družinski razdelek vsebuje uredniški zapis INBOX. Organizatorska značka je trenutno skrita, drugače kot v starem indeksu. |
| [Bistriški tek 2026](https://tekaski-koledar.si/tek/2026/r000064-23-bistriski-tek/) | Pretekli dogodek, brez prijavnega URL; samo veljaven razpis. Ta je oranžen na mobilniku, na namizju pa zgolj sekundaren bel gumb. Opombe vsebujejo »Osnutek koledarja«. |
| Hrastnik 2027 | Brez ure, razdalj, prijave in dodatnih podatkov; prikazana sta znana kraj/podlaga, uradna napoved in razpis. Brez praznega razdelka poudarkov, prijavnin ali izmišljenih povezav. Isti mobilni vrstni red in namizni sekundarni razpis. |

»Kaj izstopa« je podatkovni povzetek, ne izmišljen promocijski opis: ultra razdalja, vzpon, družinska ponudba, pokal in razpon razdalj. Razpon razdalj in družinska oznaka deloma ponovita glavo; to ni dovolj močan dokaz za spreminjanje pravil izbire poudarkov. Razdelek ostane pogojen z vsaj dvema podatkoma. Tudi kraj/regija se v glavi delno ponovita, vendar trenutno pomagata pri orientaciji; brez prelivanja ali potrebe po dodatnem krčenju.

Na namizju je pri skopih profilih pod levo vsebino veliko prostora, ker so orodja desno daljša. To je posledica obstoječe dvostolpčne mreže; ta audit ne uvaja masonryja ali novega sistema kartic. Fotografska oprema, logotipi organizatorjev in dolgi opisi niso pogoj za uporaben profil.

## Izvedeni popravek

1. Odstranjen mobilni `order: -1` iz `.event-detail-action-panel` pri ≤900 px. Prikaz zdaj sledi obstoječemu DOM vrstnemu redu: vsebina teka, nato orodja. Poudarki, prijavnina, roki, trasa in opombe so hitreje dosegljivi. Uradni CTA in osebni status ostaneta v glavi; vsa pomožna orodja so ohranjena.
2. Obstoječi mobilni oranžni poudarek za samostojni »Razpis« velja pri vseh širinah. Če prijava obstaja, njen primarni poudarek in sekundarni razpis ostaneta. Brez nove oznake, povezave, interakcije ali spremembe stanja prijav.

Edina produkcijska datoteka s spremembo je `src/styles/global.css`. Ni sprememb Astro vsebine, metadata, JS ali podatkovnega preslikovanja.

## Primerljiva dokazila

Ločena builda main in kandidata; isti datum 17. 10. 2026 v Ljubljani, enaki viewporti, svež browser context za vsako stanje in zamrznjeni javni Worker odgovori za organizatorske potrditve ter v2 roke. Go4trail je dodatno zajet z odgovorom za dejansko profilno okno `from=2026-10-17&to=2026-11-07&limit=100`, da je preverjena semantična oznaka v obeh slikah enaka. Pokrit je tudi nevtralni v2 fallback. Vsi ne-GET zahtevki med zajemom so blokirani.

Y začetka vsebine, SL pri 390 px (zaokroženo):

| Profil | Main | Kandidat | Premik navzgor |
| --- | ---: | ---: | ---: |
| Go4trail | 2146 px | 904 px | 1242 px |
| Kočevsko 2027 | 1957 px | 994 px | 963 px |
| Ormož | 1947 px | 983 px | 964 px |
| Bistriški tek | 1906 px | 942 px | 964 px |
| Hrastnik 2027 | 1796 px | 832 px | 964 px |

Višina prijave/razpisa in shranjevanja je v vseh primerjanih stanjih ohranjena; pri 1440 px ostane geometrija mreže enaka. Orodja so na mobilniku temu primerno nižje: to je namerna prednost vsebine dogodka. [Meritve vseh 30 parov](evidence/race-profile-ux-2026-10-17/comparison.json) vsebujejo tudi primerjavo URL-jev, analitičnih atributov, metadata, JSON-LD, opomb in značk.

| Dokaz | Prej: main | Potem: kandidat |
| --- | --- | --- |
| Go4trail, SL 390 px | [posnetek](evidence/race-profile-ux-2026-10-17/before-go4trail-sl-390.png) | [posnetek](evidence/race-profile-ux-2026-10-17/after-go4trail-sl-390.png) |
| Bistriški tek, SL 1440 px | [posnetek](evidence/race-profile-ux-2026-10-17/before-bistriski-sl-1440.png) | [posnetek](evidence/race-profile-ux-2026-10-17/after-bistriski-sl-1440.png) |

Preostali lokalni posnetki vseh profilov, SL/EN in širin ter celotni meritveni odčitki: `/tmp/stk-profile-audit/`. V PR so vključeni štirje izbrani PNG in celotna primerjalna matrika; začasni lokalni API zajemi niso podatkovna odvisnost spletne strani.

## SEO, akcije in dostopnost

Naslov in description opisujeta konkreten dogodek; canonical, `og:url`, SL/EN hreflang, `og:locale` in Event JSON-LD so prisotni in nespremenjeni. OG uporablja obstoječi STK logo, katerega produkcijski URL vrne 200/image/jpeg; Twitter uporablja `summary`. Ne potrebujemo novih fotografij. Dejanski predpomnilnik predogledov Facebook/WhatsApp ni bil osveževan ali neodvisno preverjen. JSON-LD vsebuje datum brez startne ure; to ostane izven CSS popravka. Pretekli datum sam po sebi ne pomeni odpovedi in ni razlog za spreminjanje `EventScheduled`.

Uradne povezave, calendar/ICS, deljenje, shranjevanje in osebni status so ohranjeni. Analitični atributi in vse primerjane povezave so enaki; primerjava normalizira samo spremenljivi ICS `DTSTAMP`. Med browser testi je produkcijska analitika izključena/prestrežena. Test ne trdi, da je bil preverjen dejanski produkcijski ingest.

Kontrole uradnih akcij ostanejo ≥44 px in imajo viden tipkovniški fokus. Kontrast novega namiznega poudarka je enak že preverjenemu mobilnemu, približno 6,89 : 1. Obstoječi rasterizirani kontrastni nabor preverja naslove dejstev, značke, datume, status, poudarke in pomožno besedilo: vse meritve ≥4,5 : 1. Odstranitev CSS preurejanja obenem uskladi vizualni vrstni red z DOM. Brez novega prelivanja ali opaženih novih težav dostopnosti v preverjenem obsegu.

## Validacija in omejitve

- `npm test`: **582/582 PASS**.
- Relevantni Chromium testi: **81/81 PASS** — 6 novih profilnih scenarijev (5 profilov × SL/EN × 3 širine), 24 obstoječih kontrastnih, 16 rokov in 35 Mojih tekov.
- Nov test preverja vsebino pred orodji, namizno mrežo, samostojni razpis, obe uradni akciji, dimenzije in fokus, canonical/OG/hreflang/JSON-LD, pretekle dogodke, prazna polja 2027, save/status/reload, koledar in kopiranje povezave. Obstoječi testi pokrivajo potrjeno/nepotrjeno značko ter preverjene, nevtralne, nedosegljive in potekle v2 roke.
- `npm run build`: **PASS, 661 strani**, main in kandidat.
- `git diff --check`: **PASS**.
- `npx astro check`: isti **2 obstoječi napaki**, reproducirani tudi v ločenem arhivu main: `tests/browser/finder.spec.ts:567` (`placement` na `{}`) in `tests/browser/race-detail-contrast.spec.ts:19` (`remove` na `Node`). **0 opozoril**, brez novih diagnostik.
- Produkcija in kandidat: brez horizontalnega prelivanja v pregledanih 390/430/1440 stanjih; browser regresije brez JS page errors. Fizične naprave, Safari/Firefox, screen reader in zunanji prijavni procesi niso preverjeni. Oddaje, glasovi, potrditve, koledarski vpisi in sporočila niso bili izvedeni.

Lokalni browser ukaz uporablja začasni Playwright config z izključeno analitiko (`stkAnalyticsOptOut=true` v localhost storage state) in že zagnanim previewjem. Repo konfiguracija ni spremenjena. Zagon: `npx playwright test tests/browser/race-profile-ux.spec.ts tests/browser/race-detail-contrast.spec.ts tests/browser/registration-deadlines.spec.ts tests/browser/my-races-statuses.spec.ts --project=chromium --config=/tmp/stk-profile-audit/playwright.config.ts`. Nov profilni test sam prestreže zunanje zahteve.

## Ločene uredniške zadeve: brez avtomatskega popravka

1. **Ormož 2026, Worker row 53 / javni ID R000053**: javni `opombe_javne` vsebuje »Dopolnjen opis iz INBOX: Dopolnitev: Razdalje (km): 5, 10, polmaraton; Prijava) | Družinam prijazno: otroške kategorije.« Izvor je potrjen v svežem Worker `/?year=2026`, ne v hardkodiranem besedilu spletne strani. `mapPublicRaceEvent` prevzame polje v `publicNotes`; `buildFamilyInfo` zaradi družinskega dela izbere celoten stavek, zato se zraven pokaže uredniški uvod. Urednik mora po preveritvi vira sestaviti čisto javno besedilo, obdržati veljavne družinske informacije in ločiti interno sled v obstoječem uredniškem postopku. Predlog javne formulacije je šele predmet uredniške potrditve, ne tega commita.
2. **Bistriški tek 2026, row 64 / R000064**: isto javno polje vsebuje »Osnutek koledarja; preveri razpis in morebitne dodatne razdalje.« Prikazuje ga `buildPublicNotes`. Besedilo meša interno stanje osnutka z morebitno koristno javno negotovostjo. Potreben je uredniški pregled uradnega razpisa in odločitev o ustrezni javni formulaciji; opozorila ni varno slepo odstraniti.
3. EN vmesnik ni zagotovilo prevoda poljubnih prostih opomb. Del izvornega slovenskega besedila pri teh profilih ostane; to je obstoječa omejitev vsebine/prevodov, ne nova regresija. Brez generičnega prevajanja ali odstranjevanja besedila.

Koda ne filtrira besed INBOX/osnutek in ne sklepa, kateri podatki so napačni. Nobene spremembe Masterja, Content API, uradnih informacij ali organizatorskega confirmed snapshota. Do uredniške odločitve se sporna javna vsebina ohrani in je izrecno evidentirana tukaj.
