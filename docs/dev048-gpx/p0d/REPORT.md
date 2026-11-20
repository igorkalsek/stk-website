# DEV-048 P0D — rezultat 3. 11. 2026

Dejansko prenesenih in na novo strukturno validiranih je **40 različnih GPX**
pri **12 prireditvah**. S prejšnjimi desetimi je zbirka na **50 različnih
bajtnih GPX pri 14 prireditvah**. To ni trditev o 50 neodvisnih geometrijah ali
o potrjenih trasah za 2027. Dva para sta možna geometrijska dvojnika.

## Izplen in ohranitev izhodišča

| Merilo | Rezultat |
| --- | ---: |
| Prednostnih kandidatov, dejansko prenesenih in validiranih | **15/15** |
| Novi različni veljavni GPX po SHA-256 | **40** |
| Prejšnji veljavni GPX, ponovno uporabljena dokazila | **10** |
| Vsi različni veljavni GPX | **50** |
| Različni ciljni GPX/ZIP URL v P0D, vključno s primerjalnim prenosom | 42 |
| Veljavni GPX z bajti preverjenimi v P0D | 41 |
| ZIP-arhivi, pregledani v P0D | 13 |
| Neveljavni GPX v berljivem ZIP | **1** |
| Napake HTTP pri ciljnih datotekah / blokade okolja | **0 / 0** |
| Ocenjene trenutno potrjene uradne neposredne zunanje povezave | **36** |
| Datoteki z izrecno oznako 2027 in živo organizatorsko povezavo | **2** |
| Nove kanonično potrjene vezave izvedb | **0** |

P0D je ponovno prenesel samo en prej preverjen GPX: GM4O 2026 zaradi primerjave
z novo pridobljenim GM4O 2025. Njegov SHA se ujema s P0 in ni prištet med 40
novih datotek. OBALA 108 km je bila v dveh serijah vključena z istim URL;
drugi korak je uporabil lokalni cache, datoteka in kandidat se štejeta enkrat.

**Vseh 134 izhodiščnih zapisov in vseh 47 izhodiščnih stolpcev je ohranjenih.**
Osnova je aktualni list `GPX_AKTUALNO_03-11`, ki ima 134 zapisov; starejši
`GPX_KANDIDATI` jih ima samo 121. Dodanih je pet res novih prog, ID
`GPX-0135`–`GPX-0139`: K24 24/10 km in Hg Laufar/Berkmandlc/Čipka. Spremembe
datotek pri isti progi ne ustvarjajo dodatnih kandidatov.

Posodobljeni katalog ima **139 ohranjenih/dodanih vrstic**, kar ni 139
nepodvojenih prog: izhodiščna `GPX-0040` in `GPX-0134` se nanašata na GM4O
2025 in sta označena kot isti kandidat, torej največ **138 skupin kandidatov
po tej dokazani združitvi**. Druge letnice ostajajo ločene, kjer enakost ni
dokazana. Kočevsko `GPX-0022`/`GPX-0106` deli GPX URL, vendar sta imeni
30/35 km neskladni; to je pregled poimenovanja, ne druga pridobljena datoteka.

Izvirnih 12 listov Excela je ohranjenih z vsemi nespremenjenimi vrednostmi
in formulami. Aktualni rezultati so na treh novih listih `P0D_POVZETEK`,
`P0D_KATALOG`, `P0D_DATOTEKE`. CSV vsebuje izvirne stolpce in dodatna polja P0D.
Za proge z več različicami katalog kaže izbrano različico in reference na
**vse** rezultate; datotečni CSV/JSON ohrani vsako različico in SHA posebej.

## Vseh 15 prednostnih poskusov

Vsi imajo ciljni HTTP 200 in `VALID`/`FILE_VALID`; oznaka pomeni strukturni
GPX pregled, ne polne XSD validacije ali potrditve izvedbe.

| ID | Proga | Format | Izmerjeno km | Točke |
| --- | --- | --- | ---: | ---: |
| GPX-0012 | Ponikva4trail TEK | GPX | 22,841 | 1.038 |
| GPX-0134 | PTRF GM4O 2025 | GPX | 39,822 | 6.928 |
| GPX-0092 | RIBN’CA Kuhavn’ca | GPX | 13,061 | 625 |
| GPX-0093 | RIBN’CA Čebular’ca | GPX | 25,572 | 1.558 |
| GPX-0094 | RIBN’CA Ribežn | GPX | 40,291 | 1.108 |
| GPX-0132 | Gozdarski Bukev, ogledna | GPX | 33,260 | 4.057 |
| GPX-0133 | Gozdarski Jelka, ogledna | GPX | 12,834 | 656 |
| GPX-0121 | Savinjski K6, arhivska 28 km | GPX | 26,823 | 7.340 |
| GPX-0122 | Kriška gora Košuta | GPX | 47,912 | 1.696 |
| GPX-0025 | UTVV Emperor 2026 | ZIP → 1 GPX | 161,959 | 22.376 |
| GPX-0026 | UTVV Centurion 2026 | ZIP → 1 GPX | 110,189 | 9.382 |
| GPX-0027 | UTVV Gladiator 2026 | ZIP → 1 GPX | 62,996 | 9.818 |
| GPX-0019 | Kočevsko 5 km | ZIP → 1 GPX | 5,917 | 440 |
| GPX-0020 | Kočevsko 10 km | ZIP → 1 GPX | 10,223 | 808 |
| GPX-0022 | Kočevsko 30 km | ZIP → 1 GPX | 32,211 | 1.372 |

Zapis vsakega poskusa, HTTP/preusmeritve, SHA arhiva in članov ter izvor so v
`first15-results.json`; končne meritve z deklariranimi razdaljami so v
`technical-results.csv/json`. Ne štejejo zgolj HTML strani ali URL-ji.

## Pomembne ugotovitve

- **UTVV:** šest veljavnih datotek: pet z oznako 2026 in nova Centurion 2027.
  Centurion 2027 meri **99,190 km**, stari 2026 **110,189 km**. Vzorčna
  geometrijska primerjava potrjuje razliko; različici nista zamenljivi.
  [Uradna stran Centurion](https://ultratrail.si/sl/centurion/) zdaj povezuje
  točno ZIP 2027; druge strani še povezujejo datoteke 2026.
- **Kočevsko:** šest veljavnih prog. Datoteka za 50 km ima oznako **2027**
  v imenu člana ZIP in v GPX; meri **50,851 km**. Nasprotno 30 km URL vodi
  na [35 km stran](https://kocevsko-outdoor.si/razdalje/35-km/), ki še povezuje
  `KOF_30_km.zip`, izmerjeno 32,211 km. Stara stran 60 km preusmeri na 50 km.
  Vertikalni ZIP vsebuje GPX brez dveh točk proge in je **INVALID**.
- **Gozdarski trail:** stari ogledni in novi datoteki Bukev/Jelka so vse
  tehnično veljavne. Aktualni povezavi sta `/2026/08/Bukev_34.gpx` in
  `/2026/08/Jelka_14.gpx`; letnica mape sama ni dokaz izvedbe. Jelka ogledna
  in nova imata različna SHA, vendar 95. percentil razmika pri vzorčni
  primerjavi le **3,5 m**: `POSSIBLE_GEOMETRY_DUPLICATE`. Bukev ima razlike
  do približno 483 m pri enaki metodi; ni samodejno združena.
- **PTRF:** PDF 2025 izrecno vsebuje povezavo na pridobljeni GM4O 2025,
  kar je dodatno preverjeno v PDF anotacijah. GM4O 2025/2026 imata različna
  SHA, a 95. percentil razmika le **12,4 m**: drugi možni geometrijski dvojnik.
- **RIBN’CA:** tri veljavne trenutno povezane datoteke imajo v imenih prog
  oznako **2022**. To so oznake zgodovinskih datotek; današnja stran ni dokaz
  njihove uporabe v 2026/2027.
- **Kriška gora:** štiri veljavne datoteke; Košuta, Gams in Muflon nosijo
  oznako 2025, Vertikal nima dokazane letnice. Gams »10 km« meri **11,447 km**.
- **K24:** štiri veljavne datoteke. Proga »24 km« meri **20,429 km** in
  zahteva pregled. Aktualne strani opisujejo 2027; iz tega ni mogoče potrditi
  datotek za izhodiščna kandidata 100/50 km **2026**, niti sklepati leta iz
  imen `Morning_Run` ali datumov GPS-točk.
- **Hg Trail:** tri javno povezane in veljavne datoteke: 48,504 / 27,120 /
  14,016 km. Datoteke nimajo izrecne letnice izvedbe. Mapi 2025/04 in 2022/02
  je ne potrjujeta; povezane so z aktualnimi stranmi, ne potrjene za 2027.
- **Čaven:** dve veljavni datoteki 2026, **16,402 / 4,290 km**, javno povezani
  v [uradnem roadbooku](https://www.caven.run/sl/roadbook2026/).
  Master 2026!251 navaja 24. 10. 2026, organizator 21. 11. 2026. Neskladje
  je zapisano; Master ni popravljen.
- **Ponikva:** dokumentirani `/razdalje/` danes preusmeri na pohod. Pravo
  povezavo na datoteko 2024 potrjuje [stran teka](https://ponikva4trail.si/razdalje-tek/).
- **OBALA:** vseh pet aktualnih razdalj ima neposredni organizatorski GPX,
  HTTP 200 in oznako 2026 v datoteki; vseh pet je veljavnih.

Za štiri primerjane pare je uporabljenih 256 vzorcev po normalizirani
kumulativni dolžini znotraj segmentov, v obeh smereh. To je orientacijski
pregled, ne dokaz popolne geometrijske enakosti; ne poravnava cikličnih
začetkov in ne primerja vseh možnih parov. Za preostale stare datoteke brez
lokalnih bajtov geometrijska deduplikacija ni bila izvedena. Število **50**
je zato izrecno število različnih bajtnih GPX, ne unikatnih geometrij.

## Drugi viri in preostale omejitve

Pregledanih je 63 različnih izvornih strani/dokumentov. Soča Outdoor FAQ
napoveduje končne GPX v vodniku pred dogodkom; neposredni GPX pri pregledu ni
bil najden. Parenzana in Trail Ljubljana ponujata kartografske povezave,
Trail Celje predvsem Plotaroute. Teh HTML/map povezav ne štejem med prenose
GPX. Izvoz iz omejenih platform ni bil izvajan. Pri Kras Trail stari strani
15/32 km dejansko vrneta 404; novi 29/52 km strani sta dosegljivi, brez
najdenega neposrednega GPX. To nista napaki prenosa GPX.

Vseh 42 različnih ciljnih URL je bilo dosegljivih; blokad okolja ali ciljnih
403/CAPTCHA ni bilo. Robots pravila so zabeležena. Pri prvem PTRF zajemu je
bil upoštevan osnovni razmik približno 1 s, **ne** robots `Crawl-delay: 10`.
To metodološko pomanjkljivost sem odpravil pred nadaljevanjem; nadaljnji
dostop upošteva tudi ta zamik. Ni ponovnih poskusov ob zaščitah ali obhodov
prijav/omejitev. Ne razglašam, da robots pravila dokazujejo pravice uporabe.

Podatki Master 2026/2027 so prebrani izključno prek obstoječega Worker API.
`master-snapshot.json` vsebuje izbrane dejanske vrstice z imeni, kraji,
datumi in viri; SHA HTTP se nanaša na celotni izvorni API odgovor.
`backlog-snapshot.txt` je samo prebrani DEV-048 iz backloga (list Backlog,
vrstica 49, izvozna oznaka 47). Vezave kandidatov na Master so raziskovalne
reference, ne novi race_id/edition_id. Dva podprta napisa 2027 ne pomenita
potrjene kanonične identitete izvedbe ali zagotovila nespremenjene trase.

Sedem P0 datotek ima predhodna podrobna dokazila v PR #247; tri Snežnikove
so ponovno uporabljene iz priloženega Excela. Njihovih bajtov v tej seji
nisem znova pridobil ali neodvisno validiral. Zbirka to jasno označuje.

## Uporabnost in prednostni viri

Ocenjenih **36 živih neposrednih uradnih povezav** je konservativen nabor za
poznejšo presojo zunanjih povezav. Število vključuje tudi različice iste
proge, zato ne pomeni 36 novih gumbov na spletni strani. Izključuje zgolj
prejšnje povezave brez novega pregleda in ne daje dovoljenja za objavo.
`rehost_permission=NOT_ESTABLISHED` velja za vse zapise.

Najbolj uporaben aktualni vir je **OBALA** (pet jasno označenih GPX 2026),
nato **UTVV** (šest datotek, z nujno ločitvijo Centurion 2026/2027),
**PTRF** (dobra arhivska dokazila) in **Kriška gora** (tri označene 2025 sledi).
Za razjasnitev imajo prednost Kočevsko 30/35/50 km in neveljavni vertikal,
K24 24 km ter letnice Hg/Gozdarski. Soča in kartografski portali ostanejo
viri strani, dokler ni dokazano dovoljen dejanski GPX prenos. To je preostanek
raziskave, ne predlog novega razvojnega projekta.

## Preverjanje in ponovljivost

Razširjen je obstoječi `../validate.py`: isti HTTPS allowlist, DNS in
preusmeritveni pregledi, GPX 1.0/1.1, DTD zavrnitev, koordinate in segmentna
haversine meritev. ZIP pregled poteka samo v pomnilniku: največ 12 MiB
prenosa/posamezne datoteke, 32 MiB deklarirane razširitve, 100 članov in
razmerje stiskanja 200. Zavrne nevarne poti, symlink/special datoteke,
šifriranje, podvojena imena in vgnezdene arhive, tudi preimenovan ZIP.
Arhiv in vsak GPX dobita ločen SHA-256. Polna XSD validacija ni izvedena.

- **32/32 testov PASS:** obstoječih 17 in 15 dodatnih testov ZIP/geometrije.
- Izvirnih 12 Excel listov: vse neprazne vrednosti in formule enake izhodišču.
- Izvirnih 134 CSV vrstic in 47 stolpcev: ohranjeno; nove vrstice imajo nove ID.
- Neodvisna uskladitev: 40 novih + 10 starih = 50 SHA; 14 prireditev;
  Excel formule 50/40/1 se ujemajo z JSON/CSV.
- Trije novi Excel listi vizualno pregledani; brez napak formul.
- `git diff --check`: PASS; aplikacijski build ni potreben za raziskovalne
  datoteke in samostojni Python validator.

```sh
python3 -m unittest discover -s docs/dev048-gpx -p 'test_*.py' -v
```

`research.py` izvaja omejene prenose z lokalnim cache zunaj Git; manifesti
beležijo natančne cilje. `assemble.py` iz zamrznjenih rezultatov in lokalnih
bajtov sestavi CSV/JSON brez omrežnih zahtev. Za ponovno preverjanje uporabite
nov izhodni posnetek; ne prepisujte P0/P0D dokazil. Lokalni GPX/ZIP bajti niso
del paketa; njihovega dolgoročnega arhiva ali pravice redistribucije ni.

**Obseg ostaja raziskovalen.** Master, PUBLIC_LS, registry, produkcijski podatki,
spletni UI in API niso spremenjeni. Brez organizatorskih sporočil, novih
storitev, R2, baz, računov, scheduled nalog, mergea ali deploymenta.
