# DEV-044 F4 – poenostavitev domače strani

3. 11. 2026, Europe/Ljubljana. Omejen Website poseg iz main `2dda36c8b1081d67fb99c54a47f0a0c1f853c27a`. Brez mergea, deploymenta ali sprememb produkcijskih zastavic.

## Ciljni pregled in odločitev

- Cloudflare read-only potrdi canonical production `96b80ddc-1625-4ae2-b6a7-ef5661a77f4a`, isti SHA kot main, uspešno objavljen 3. 11. 2026. `STK_INTEREST_PREVIEW_ENABLED=true`. Trenutna produkcija torej ni več zgodovinski 503 iz prve faze DEV-047.
- Prebrani aktualni razvojni backlog (DEV-044 IN_PROGRESS, DEV-047 DONE), njegova Navodila, operativna navodila in obstoječa poročila F2-A/F3-UX ter DEV-047. Backlog potrjuje aktivacijo DEV-047 2. 11. 2026. Zaključenih auditov, podatkovne obnove in rollouta ne ponavljamo.
- Odprta Website Draft PR-ja: #237 (`648f48a`, dokumentacijski audit) in #247 (`92e7994`, GPX raziskava); brez prekrivajoče implementacije domače strani. GPX P1 je že v main in ostane ohranjen.
- Pregledani dejanski produkcijski SL/EN HTML, skripte in postavitev pri 390/1440 px. Samo začetni in ponovljeni SL obisk uporabljata žive API odgovore; ostale kombinacije ponovijo zajete javne odgovore. Vse ne-GET/HEAD zahteve so prestrežene; ni sintetičnih analitičnih zapisov, glasovanja ali zunanjega deljenja.

| Ugotovitev | Dokaz / odločitev |
| --- | --- |
| Osvežitev kronološkega seznama čaka analitiko. | **DOKAZANO:** oba `loadNearestEvents` po Masterju čakata `getInterestPreviewRaces`, nato šele izrišeta seznam. Statični seznam je že v začetnem HTML; problem je čakanje na njegovo svežo osvežitev, ne popolna odsotnost začetne vsebine. **Popravljeno.** |
| Izpostavljeno je tretji izbor istih dogodkov. | **DOKAZANO:** v vseh štirih zajemih so vsi trije izpostavljeni teki tudi med petimi v lestvici. Ob izpadu analitike helper uporabi kronološki fallback, ki se prekriva z Naslednjimi teki. **UX presoja:** ločena vrednost tega dodatnega izbora ni dokazana; odstranjen je njegov blok, renderer in pripadajoči CSS. Kronološki seznam in samostojna lestvica ostaneta. |
| Analitika blokira druge sekcije. | **DOKAZANO samo za osvežitev Naslednjih tekov/izpostavljeni blok.** Statistika, roki, spremembe in Moj STK se že nalagajo ločeno. Njihovega transporta ne spreminjamo; Additional F2-B ostane NO-GO. |
| Tekobot tekmuje z glavnimi potmi. | **DOKAZANO:** povezava je v heroju, glavni navigaciji in nogi. **UX presoja:** ni primerljivega dokaza konverzije teh vstopov. Po zahtevani usmeritvi odstranjen iz heroja in glavne navigacije; dostop SL/EN v obstoječi nogi in strani ostaneta. |
| Datum spremembe in novosti že obstajajo. | **DOKAZANO:** `/recent_updates?days=7&limit=4&years=2026,2027` že daje razvrščene javne spremembe, datum, tip in `public_summary`; ena obstoječa sekcija jih že kompaktno prikaže. Živi zajem pokaže Potrjeno 2. 11. ter Posodobljeno/Dodano 1. 11. Datum teka je ločen od datuma spremembe. **Brez novega prikaza.** |
| »Deli tek« je globoko v podrobnostih. | **DOKAZANO:** native gumb in kopiranje/družbene povezave so v obstoječem delilnem panelu; native gumb je brez podpore pravilno skrit. Dodana je kratka povezava v herojevem panelu Moj tek, ki s tipkovnico pomakne fokus do istih možnosti. Brez novih share handlerjev ali spremembe analitike. |

Najvišji datum v omejenem sedemdnevnem recent odgovoru ni brezpogojno »zadnja sprememba celotnega koledarja«. `generated_at` tudi ni datum spremembe podatkov. Dodatnega globalnega »nazadnje posodobljeno« zato ne prikazujemo. Če je potreben uredniški stavek o projektu, se lahko ročno spremeni besedilo znotraj obstoječega uvoda Svežih sprememb; API nima ločene uredniške vsebine in naloga ne podaja konkretne novice. Nov CMS/endpoint ali podvojen razdelek nista upravičena.

## Dejanska latenca in ozko grlo

[Živi zahtevki](evidence/dev044-f4/live-requests.json), [glave, velikosti in SHA-256 zadnjih odgovorov](evidence/dev044-f4/public-timing.json), [produkcijski DOM in resource časi](evidence/dev044-f4/production.json).

| Meritev | Prvi obisk, svež brskalnik | Ponovljeni obisk, isti kontekst |
| --- | ---: | ---: |
| Master 2026, GET + telo | 3.055 ms | 3.453 ms |
| interest-preview 2026, GET + telo | **35.945 ms** | **4.342 ms** |
| Osvežene kronološke kartice od začetka dokumenta | **39.309 ms** | **8.046 ms** |
| Izris lestvice od začetka dokumenta | 39.305 ms | 8.043 ms |

To sta vzorca prvega in ponovljenega odziva, ne p50/p95 ali zagotovljen strežniški cold/warm cache: predpomnilnikov nismo praznili. Pri prvem zajemu je napaka merilnika (`APIResponse.allHeaders` namesto `headers`) preprečila shranitev dveh odgovorov; popravljeni zajem ima zgornja dva izmerjena odziva. Skupaj štirje živi poskusi lestvice, brez nadaljnjih produkcijskih izračunov, pollinga, drugega letnika ali neposrednega RAW/community-insights benchmarka. Preostale meritve so replay/offline.

Frontend pred posegom zaporedno sestavi **Master + počasni relay**. Časovno zaporedje zahteve/DOM in kontrolirani zadržani odgovor potrdita to odvisnost. V kandidatu se osnovni seznam osveži neposredno po Masterju, lestvica pa neodvisno začne Master in relay sočasno. Validacija obeh virov, leto/vrstica/datum/naziv/status, expiry, preklop let, prazen rezultat in pošten 503 ostanejo ohranjeni. Timeouta 55 s v relayu / 60 s v odjemalcu nista podaljšana.

**Preostali počasni del je strežniška pot Pages → Worker → Content API.** 35,9 s je čas čakanja na odgovor, ne izris CSS ali urejanje 20 kartic. [Offline ponovitev](evidence/dev044-f4/offline-validation.json) nad istim odgovorom in 309 Master vrsticami: parse + Master match, 50 ponovitev, mediana 0,082 ms in maksimum 15,736 ms v Node 26. To ni meritev brskalniškega ali Apps Script CPU.

Prebrana aktualna Apps `RecentInterest.gs` in `RecentInterestCore.gs` pojasnita različni poti: pred preverjanjem cachea se vedno prebereta oba Masterja in CHANGE_LOG; ob missu še celotna timestamp projekcija RAW, sedemdnevni A:H/Q blok, drugo branje za drift ter izračun za obe leti. Ponovljeni odziv je 31,6 s hitrejši, kar je skladno s to razliko poti; konkreten CacheService hit in deleži posameznih Apps faz **niso merjeni**. Natančen najdražji Apps klic zato ni razglašen za dokazan. [Ločen implementation brief](DEV-044_F4_INTEREST_BRIEF.md) poda najmanjši nadaljnji korak. Nobena backend datoteka ni spremenjena.

## Primerjava pred/po

PREJ: aktualna produkcija. POTEM: lokalni kandidat. Obe strani dobita iste zajete API odgovore, z nadzorovanimi 150 ms za običajne GET in 4.000 ms za interest-preview. Čas je fiksiran na 2 s po nastanku zajetega veljavnega odgovora. To je kontrolirana primerjava kritične poti in postavitve, **ne obljuba produkcijske latence po objavi**. Začetno statično vsebino obe strani že imata. Brez shranjenih tekov; dodatna lokalna stanja pokrivajo obstoječi GET/Moj STK browser testi.

| Jezik / širina | Osvežitev Naslednjih tekov prej → potem | Lestvica prej → potem | Aktualno višje |
| --- | ---: | ---: | ---: |
| SL / 390 | 4.444 → **221 ms** | 4.441 → 4.067 ms | **338,6 px** |
| EN / 390 | 4.454 → **225 ms** | 4.451 → 4.069 ms | **338,6 px** |
| SL / 1440 | 4.413 → **228 ms** | 4.411 → 4.072 ms | **156,2 px** |
| EN / 1440 | 4.359 → **243 ms** | 4.357 → 4.086 ms | **203,2 px** |

[Surovi PREJ](evidence/dev044-f4/before.json), [POTEM](evidence/dev044-f4/after.json), [povzetek primerjave](evidence/dev044-f4/comparison.json). Isti štirje kronološki teki in istih pet rangiranih tekov v istem vrstnem redu, nič JS page errors in nič horizontalnega preliva v vseh kombinacijah. Razlika 0,27–0,38 s pri lestvici vključuje sočasni začetek branj in različen lokalni/produkcijski čas statičnih skript; ni čista izolirana meritev samo `Promise.all`. Odstranitev čakanja na celotne štiri sekunde analitike je dodatno dokazana z zadržanim zahtevkom v regresijskih testih.

| Postavitev | Prej | Potem |
| --- | --- | --- |
| SL / 390 | [posnetek](evidence/dev044-f4/before-sl-390.jpg) | [posnetek](evidence/dev044-f4/after-sl-390.jpg) |
| EN / 390 | [posnetek](evidence/dev044-f4/before-en-390.jpg) | [posnetek](evidence/dev044-f4/after-en-390.jpg) |
| SL / 1440 | [posnetek](evidence/dev044-f4/before-sl-1440.jpg) | [posnetek](evidence/dev044-f4/after-sl-1440.jpg) |
| EN / 1440 | [posnetek](evidence/dev044-f4/before-en-1440.jpg) | [posnetek](evidence/dev044-f4/after-en-1440.jpg) |

## Uporaba brez nove telemetrije

Ni aktualnega primerljivega CTR dokaza, ki bi ločil korist vseh treh izborov ali Tekobot heroja od drugih vstopov. Ne razglašamo izboljšanja uporabe. Obstoječi ingest že vsebuje `placement`, jezik, `release_id`, profilne klike, uradne/prijavne klike, shranitve, koledarske akcije ter share/copy. Prikazi `featured_race_impression` in `race_card_impression` imajo različne površine/pogoje; `home_this_week`/`home_interest` nimata enakega imenovalca, zato absolutnih klikov ne primerjamo kot CTR. Obstoječe beleženje drugih površin ostane, odstranjeni blok pa upravičeno ne pošilja več svojih prikazov.

Zaključeni audit #237 že navaja 1.078 razpisnih klikov, 544 prijavnih klikov in 197 shranitev v svojem 30-dnevnem obdobju. Backlogov GSC zajem 22. 10. navaja 73,5 % mobilnih klikov. To sta **zgodovinska konteksta**, ne nov baseline ali dokaz učinka F4. Novih analitičnih izračunov zanju nismo izvajali. Po morebitni objavi je smiselna primerjava enakih zaključenih obdobij in istih vrst dogodkov po površini/jeziku/release, ob upoštevanju sezone in drugačne izpostavljenosti. Kliki/share ne dokazujejo prijave, objave ali unikatnega uporabnika.

## Testi in meje

- `npm test`: **861/861 PASS**, 0 fail/skip; vključno z aktualnimi pogodbenimi, letnimi, timeout in expiry kontrolami. Odstranjen je test wiring-a odstranjenega featured bloka, ostale analitične kontrole so ohranjene.
- `npm run build`: **PASS**, 697 strani, 670 preverjenih SL/EN profilov, completion/parity gate uspešen.
- Playwright na dokončanem buildu: **278/278 PASS**, 0 skip. finder 41, home-stats 22, home 96, my-races-statuses 35, public-get-dedup 28, race-profile-ux 8, race-share 32, registration-deadlines 16.
- Novi F4 scenariji SL/EN × 390/1440: svež kronološki seznam in spremembe med povsem zadržano analitiko, nato pošten 503 brez fallback lestvice; sočasni začetek lestvice med zadržanim Masterjem. Deljenje: hero povezava, ≥44 px, fokus obstoječega panela ter ohranjene native/copy zmožnosti.
- `git diff --check`: **PASS**.

Testni strežnik je uporabljal 4322, ker je 4321 zasedal že obstoječi proces. Za to je bila uporabljena samo ignorirana lokalna kopija Playwright konfiguracije, brez repozitorijske spremembe portov ali CI. Zajemi: Chromium, ne fizični telefon/Safari ali screen reader. Dev orodna vrstica je skrita samo v screenshot QA. Lighthouse/Core Web Vitals niso merjeni; Chrome DevTools MCP ni na voljo. API replay je le začasna datoteka v `/private/tmp`, ne runtime cache ali podatkovna plast spletnega mesta.

## Povrnitev in stanje

En commit z `[CF-Pages-Skip]`, ena veja, en Draft PR. Revert tega commita povrne prejšnjo hierarhijo, povezave in zaporedno nalaganje; podatkovne migracije/povrnitve ni. Brez spremembe Workerja, Apps Scripta, Google Sheets, analitičnih uteži, iskalnika, registracij, shranjevanja, GPX ali obstoječih profilnih identitet. Backend pospešitev ostane ločen predlog. Krovni DEV-044 se s tem dokumentom ne označi DONE.
