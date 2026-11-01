# DEV-048 — P0: izvor, letnice in identitete GPX

**P0 raziskava je zaključena. P1 za uradne trase 2027: NO-GO.**
Zajem 1. 11. 2026: sedem datotek `OFFICIAL_HISTORICAL`, dve `REVIEW`, ena
`NOT_AVAILABLE`, nič `OFFICIAL_2027_CONFIRMED` in nič `UNOFFICIAL`.
Varen arhivski pilot zunanjih povezav je izvedljiv ob spodnjih omejitvah;
ni bil implementiran ali objavljen.

## Kaj pomenijo statusi

| Status | Pomen |
| --- | --- |
| `OFFICIAL_HISTORICAL` | Organizator datoteko objavlja ali nanjo povezuje; zgodovinsko leto v GPX je podprto tudi s stranjo izvedbe/proge. Ne dokazuje dejanske uporabe vsake točke na dan tekme ali veljavnosti za 2027. |
| `OFFICIAL_2027_CONFIRMED` | Izrecno potrjena točna datoteka za točno progo izvedbe 2027. Takšnega dokazila ni. |
| `UNOFFICIAL` | Sled brez dokazljive organizatorske povezave. Med temi desetimi kandidati je ni. |
| `REVIEW` | Dokazila so nepopolna ali neskladna; sem sodita tudi vgrajena XML brez potrjenega neposrednega GPX prenosa in letnice. |
| `NOT_AVAILABLE` | Predvideni prenos ne vrne dosegljive GPX datoteke. |

Status izvora je ločen od `file_status`, `file_edition_year`, kandidatne letnice
2027 in registry povezave. Zgodovinska letnica ne pomeni, da je datoteka
neuradna. Povezava na strani z datumom 2027 sama ne odpravi zgodovinske letnice
v datoteki. Čas nastanka datoteke ali snemanja točk ni datum izvedbe.

## Sedem preverjenih zgodovinskih datotek

Izvirnih sedmih uspešnih prenosov in XML preveritev nismo ponavljali. Njihovi
bajti so določeni s SHA-256 v `technical-evidence.json`; datotek ne gostimo.
Novo preverjanje je dopolnilo uradno povezavo, zgodovinsko izvedbo, ustvarjalca
na platformi in razdalje.

| Proga | Podprta zgodovinska izvedba | GPX meritev | Zgodovinska stran proge | Status |
| --- | --- | ---: | ---: | --- |
| Knap T’ SREDNA | 6. 1. 2024 | 30,433 km | 30,6 km | `OFFICIAL_HISTORICAL` |
| Knap T’ DOUGA | 6. 1. 2024 | 50,895 km | 51,4 km | `OFFICIAL_HISTORICAL` |
| PTRF UTP 100+ | 19. 6. 2026 | 105,791 km | 107,1 km | `OFFICIAL_HISTORICAL` |
| PTRF UTP 70+ | 20. 6. 2026 | 70,022 km | 70,86 km | `OFFICIAL_HISTORICAL` |
| PTRF GM4O 40+ | 20. 6. 2026 | 39,804 km | 40,56 km | `OFFICIAL_HISTORICAL` |
| PTRF GT 20+ | 20. 6. 2026 | 22,568 km | 22,94 km | `OFFICIAL_HISTORICAL` |
| PTRF RT 10+ | 18. 6. 2023 | 10,207 km | 10,3 km | `OFFICIAL_HISTORICAL` |

Knapovi [uradna srednja](https://www.knaptrail.si/razdalje/t-sredna/) in
[dolga trasa](https://www.knaptrail.si/razdalje/t-douga/) povezujeta GPX z imenom
2024. Organizatorjevi strani na Trace de Trail
([222517](https://tracedetrail.fr/en/trace/222517),
[222629](https://tracedetrail.fr/en/trace/222629)) potrjujeta prireditev Knap
Trail 2024, datum 6. 1. 2024 in račun ustvarjalca `KnapTRAIL`.
[Razpis 2027](https://www.knaptrail.si/razpis-tekmovanja-2027/) navaja 50 km,
trenutna stran dolge trase pa 51 km. Razlike ostanejo evidentirane, brez
popravljanja Masterja ali enačenja razpisne in izmerjene dolžine.

Štiri daljše [PTRF proge](https://www.ptrf.si/) povezujejo datoteke z letnico
2026 v URL-ju in imenu. [Objava izvedbe 2026 na Trace de Trail](https://tracedetrail.fr/en/event/podbrdo-trail-running-festival-2026)
in pripadajoče organizatorjeve proge
([UTP100](https://tracedetrail.fr/en/trace/344370),
[UTP70](https://tracedetrail.fr/en/trace/324639),
[GM4O](https://tracedetrail.fr/en/trace/324637),
[GT](https://tracedetrail.fr/en/trace/324636)) potrjujejo iste discipline,
kraj, leto in datume; ustvarjalec je `Podbrdo-Slovenija`.
[RT stran pri organizatorju](https://www.ptrf.si/razdalje/rt-10-km/) povezuje
GPX z letnico **2023 v metapodatkih**. [Izvorna proga 192055](https://tracedetrail.fr/en/trace/192055)
potrjuje Rapallo Trail v izvedbi PTRF 2023 dne 18. 6. 2023, čeprav datoteko
še povezuje trenutna stran za 2027. Ne označujemo je kot datoteko 2026.

Razdalje na platformi in naše haversine meritve niso identične. Zgoraj je
podprt pripis datoteke zgodovinski progi; **bajtna oziroma geometrijska enakost
platformne različice in prenesenega GPX ter nespremenjenost na dan tekme nista
dokazani**. Prav tako aktualna PTRF stran vključuje starejša UTP zemljevida
247250/247252 iz 2024, ločena od GPX z oznako 2026. Nista zamenljivi dokazili.
Trenutni uradni strani UTP100 in GM4O navajata 107,1 oziroma 40,6 km;
`current_source_declared_km` zato popravi prvotni orientacijski vrednosti
100 in 42. Prvotni tehnični rezultat ostane nespremenjen.

## Trije preostali kandidati

**Knap T’ KRATKA — `NOT_AVAILABLE`.** Uradna stran za 16 km še vedno povezuje
Bagus `download.php?file=Knap_Trail_TKratka_16km_GPX.gpx`. Ciljni pregled zaradi
prejšnje napake potrdi HTTP 404, HTML odgovor, brez preusmeritve ali GPX.
Alternativni uradno povezani [zemljevid 221821](https://tracedetrail.fr/en/trace/221821)
je Knap Trail 2024, 6. 1. 2024, 15,93 km; ni tehnično preverjena nadomestna
datoteka. Novih poti za prenos nismo ugibali in prijavnih omejitev nismo obšli.

**Kras 12,3 km in 19,5 km — `REVIEW`.** [Organizatorjeva stran 2027](https://www.srd-kras.si/trail-2027)
oba gumba povezuje na View GPX
([dG9nJZrm](https://www.viewgpx.com/route/dG9nJZrm),
[aTFxjY78](https://www.viewgpx.com/route/aTFxjY78)), torej HTTP HTML strani.
Prejšnji `DTD is forbidden` je posledica HTML doctype, ne dokaz pokvarjenega
izvornega GPX. Dodatna lokalna analiza javnih aplikacijskih podatkov je v obeh
straneh našla vgrajen XML: GPX 1.1, veljavne koordinate, približno 12,024 in
19,155 km. To sta **dva preverjena vgrajena payload-a, ne dva neposredna
GPX prenosa**, in nista prišteta sedmim datotekam. Imeni nimata letnice;
časi točk iz septembra 2025 je ne potrjujejo. Neposredni javni URL ali dejanski
izvoz še ni potrjen. Pregled izvoza v brskalniku ni bil mogoč, ker je lokalni
brskalnik v Work nastavitvah izključen. Ni zahteve po novem računu ali ročnem
prilaganju. Povzetek XML, kontrolne vsote in omejitve so v
`provenance-evidence.json`; izvirni XML ni del repozitorija.

## RACE_REGISTRY in kontinuiteta

Bralni pregled [kanonične evidence](https://docs.google.com/spreadsheets/d/1xmuX8CvUNIW60-TE9i2CzExy7Abo3wVjIMnhHhaX7B0/edit#gid=1492791259)
je izrecno omejen na identitete in PUBLIC_LS povezavo. Spletna stran ostaja
odjemalec javnega Worker API; nobena nova povezava s Sheets ni implementirana.

| Družina dogodka | Obstoječi race_id | Registry vrstica | Potrjeni PUBLIC_LS edition_id | Kandidatna vrstica 2027 |
| --- | --- | ---: | --- | ---: |
| Knap Trail, Trbovlje | R000070 | 71 | R000070\|2026-01-10 | 2 |
| Trail po kraških klancih, Križ pri Sežani | R000032 | 33 | R000032\|2026-03-01 | 19 |
| PTRF, Podbrdo | R000089 | 90 | R000089\|2026-06-19 | 21 |

Vsi trije registry ključi vsebujejo 2026. Omejena iskanja po imenih čez celoten
obstoječi registry A1:D998 ne vrnejo izrecnih aliasov 2027. PUBLIC_LS potrjuje
zgornje identitete 2026. PTRF ni združen z ločeno identiteto MINI GM4O
R000009 ali tekom na Črno prst R000038. Dokazila in netruncirani rezultati
bralnih iskanj so v `registry-evidence.json`.

Javni [Worker odgovor za 2027](https://stk-master-api.igor-kalsek.workers.dev/?year=2027)
iz prvega pregleda potrjuje imena, kraje in tri vrstice, ne pa stabilnih
registry ID-jev. Podobnost imen, isti organizator in isti kraj podpirajo
**kontinuiteto družine dogodka**, niso pa dokaz obstoječe kanonične vezave
izvedbe 2027. Status: `EXISTING_2026_CONFIRMED_2027_REVIEW`.
`registry_reference.race_id` je prebrana identiteta 2026, ne nova dodelitev;
`edition_2027_id=null`. Za datoteke 2024/2023 ne izmišljamo zgodovinskih
edition_id. Nobenega ID-ja ali registry zapisa nismo ustvarili ali spremenili.

## Presoja zunanjih arhivskih povezav

**Pogojno DA za sedem `OFFICIAL_HISTORICAL`.** Najmanjši varen pilot bi prikazal
povezavo na organizatorjevo stran točne proge z letom datoteke, npr.
»Arhivska trasa 2024 – T’ SREDNA – pri organizatorju« ter pojasnilom, da trasa
za 2027 ni potrjena. Trenutna ciljna organizatorska stran lahko govori o 2027;
tega ne bi smeli predstaviti kot dokaz letnice GPX. Neposredni zunanji GPX link
je možen samo do iste uradno povezane, dosegljive datoteke z enako jasno
arhivsko oznako. Spremenjena datoteka zahteva nov pregled izvora.

Praktična presoja temelji na javni organizatorski objavi in običajnem zunanjem
odkazu. [Svensson, C-466/12](https://curia.europa.eu/site/upload/docs/application/pdf/2014-02/cp140020en.pdf)
podpira povezovanje na prosto objavljena dela s soglasjem imetnika pravic,
brez obhoda omejitev dostopa.
[GS Media, C-160/15](https://curia.europa.eu/site/upload/docs/application/pdf/2016-09/cp160092en.pdf)
opozarja na nezakonito objavljeno gradivo, vednost povezovalca in skrbnost pri
pridobitnem povezovanju. Organizatorski vir zato ni splošno pravno zagotovilo;
ob opozorilu imetnika pravic ali spremembi vira povezava zahteva pregled.

Ta presoja ne daje dovoljenja za kopiranje, gostovanje, proxy prenos,
vgradnjo zemljevidov ali redistribucijo. `NO_REHOST_PERMISSION_ESTABLISHED`
ostaja nespremenjen. Arhivska sled tudi ni zagotovilo današnje prehodnosti ali
varnosti poti. Za tri preostale kandidate ni gumba »Prenesi preverjen GPX«.

## Paket in ponovljivost

- `manifest.json`: kandidatna izvedba 2027, dejanska zgodovinska letnica,
  statusi, registry reference in pregled vezan na SHA-256.
- `technical-evidence.json`: nespremenjeni izvirni tehnični posnetek.
- `evidence.json`: isti posnetek z dopolnjeno, ločeno presojo izvora.
- `provenance-evidence.json`, `registry-evidence.json`: nova dokazila in meje.
- `api-evidence.json`, `backlog-source.csv`, `availability.json`: izhodišče.
- `validate.py`, `test_validate.py`, `test_review.py`: validator in testi.
- `test-results.txt`: prvotni **10/10 PASS**, ponovno uporabljen brez ponovitve.
- `review-test-results.txt`: **7/7 PASS** samo za novo plast presoje.
- `SHA256SUMS`: kontrolne vsote paketa.

To je P0 raziskovalna dokumentacija, ne podatkovni vir spletne strani.
Izvirnega paketa trinajstih kandidatov nismo našli; teh deset predstavlja
deset različnih prog, ne trinajst navidezno različnih jezikovnih povezav.

Lokalna ponovitev presoje brez omrežja, Python 3.10+:

```sh
python3 docs/dev048-gpx/validate.py \
  --existing-evidence docs/dev048-gpx/technical-evidence.json \
  --output /tmp/dev048-reviewed.json
```

Samo novi testi, brez ponavljanja prvotnih desetih:

```sh
python3 -m unittest discover -s docs/dev048-gpx -p test_review.py -v
```

Nov omrežni zajem uporabite šele, ko je potreben zaradi spremembe vira/datoteke:

```sh
python3 docs/dev048-gpx/validate.py --output /tmp/dev048-new-network.json
```

Validator ima HTTPS allowlist, omejitev 12 MiB, preverjanje preusmeritev/DNS,
zavrnitev DTD tudi pri UTF-16, namespace/verzijo/creator GPX 1.0/1.1,
koordinate, segmentno haversine razdaljo in opozorila o preskokih. To je
strukturno preverjanje, ne polna XSD validacija ali navigacijska certifikacija.
Specifikaciji: [GPX 1.1](https://www.topografix.com/GPX/1/1/) in
[GPX 1.0](https://www.topografix.com/GPX/1/0/gpx.xsd).
Nova presoja se veže na izvorni in ciljni URL, HTTP status ter SHA-256.
Sprememba bajtov ali povezave zniža status v `REVIEW`. Validator ne razglasi
2027 zgolj iz besedila strani in nikoli ne dovoli javnega prikaza samodejno.

## Končna odločitev

- **Arhivski pilot:** izvedljiv za sedem zgodovinskih datotek z jasno letnico,
  zunanjimi organizatorskimi povezavami in brez dodeljevanja novih identitet.
  Njegov prikaz in umestitev bi potrebovala ločen omejen P1 obseg.
- **GPX 2027:** manjkajo izrecne potrditve organizatorjev za točno datoteko in
  progo, razjasnitev Knap 50/51 km, potrjen prenos obeh kraških datotek,
  nadomestilo nedelujočega kratkega Knapa in dokaz kanoničnih registry vezav
  2027. Tudi geometrijske razlike se ne smejo skriti pod enotno razdaljo.
- **DEV-048 pripravljen na prvotni P1? NE.** Tehnični prag sedmih datotek je
  dosežen, zahtevani pilot treh pravilno mapiranih strani z uradnimi GPX 2027
  pa ne. Ni podlage za READY/DONE ali javno uvedbo.

Spremembe so omejene na to mapo. Master, registry, backlog, API, aplikacijska
koda in produkcija ostajajo nespremenjeni. Ena veja, en commit in Draft PR;
brez mergea, workflow dispatcha ali deploymenta. Commit uporabi
`[CF-Pages-Skip]`, da priprava dokumentacije ne sproži Pages gradnje.
