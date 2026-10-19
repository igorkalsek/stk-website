# DEV-036 Phase B — trajna identiteta in preverjene spremembe

Datum pregleda: **19. 10. 2026**. Vrsta dela: feasibility in arhitektura.

**Odločitev: REQUIRES DATA CONTRACT.** Konkretnih opozoril o odpovedi,
prestavitvi, uri ali kraju še ni varno implementirati. Podatki vsebujejo uporabne
revizijske sledi, vendar nimajo zagotovljene nespremenljive identitete izvedbe,
popolne zgodovine aliasov in enotnega dokazila za konkretno spremembo.

Priporočilo: enkrat dodeljen, neizpeljan `edition_id` v kanoničnih Sheets,
ohranjen register izvedb in aliasov ter strukturirane preverjene revizije.
Javna projekcija naj bo **nov, ločen read-only `/race-watch` endpoint na
obstoječem Workerju**. Obstoječi endpointi in njihove semantike ostanejo.

Ta dokument je predlog za odobritev. Nobena spodaj predlagana nova evidenca,
shema, veljavnost ali pot API danes še ni vzpostavljena s tem delom.

## 1. Preflight in meje dokazov

### Repozitoriji

Prebrani so posnetki aktualnih `main`, pridobljeni prek GitHub API v začasni
imenik; ob koncu preverjanja so SHA ostali enaki:

| Repozitorij | `main` | Odprti PR-ji |
| --- | --- | --- |
| `stk-website` | `c5f2a961c18717a53f0893b9f11addc2126e1ab6` | noben |
| `stk-apps-scripts` | `82e9ca7838fdf276beffb2571fa14926674044c6` | Draft #100, #103 |
| `stk-admin` | `71604e2dd89701c9f8ed12c7b10a4fe0269d7af3` | Draft #140, #141 |

Lokalni Website checkout je na starejšem `0cc0bdff`; ob začetku že vsebuje
neversioniran imenik `docs/`. Checkout ni bil posodobljen ali resetiran;
obstoječe datoteke niso bile spremenjene. Analiza kode temelji na zgornjih
aktualnih posnetkih, ne na starejšem lokalnem `main`.

Prebrana sta Website in Admin `AGENTS.md`. Apps Scripts posnetek nima
`AGENTS.md`. Sheets ostaja vir resnice; Website bere dogodke samo prek Workerja.
Admin zahteva posebno odobritev sprememb sheme in API contracta. V tej nalogi ni
bilo implementacije, PR-ja, mergea, deploymenta, `clasp push`, pisanja v Sheets,
pošiljanja sporočil ali spreminjanja uporabnikove lokalne zbirke.

### Phase A in odvisnosti

- [Website #235][phase-a-pr] je **MERGED**, 19. 10. ob 10:12:12 UTC; merge je
  trenutni Website `main`. Prebran je [DEV-036_RACE_WATCH_LITE.md][phase-a].
  Phase A ima strogo omejeno povezovanje leto/vrstica/datum, nevtralni UPDATED,
  tri pregledana sidra za roke in preverjanje ob obisku. Ne zagotavlja trajne
  identitete, odpovedi, prestavitev ali popolne zgodovine.
- DEV-033: [Apps Scripts #106][dev033-api] in [Website #230][dev033-web] sta
  združena. Svež javni odgovor potrjuje opt-in večletni contract. Starejša
  oznaka REVIEW v izvornem dokumentu ni aktualno stanje PR-ja ali produkcije.
- DEV-031: [Apps Scripts #100][dev031-api] in [Admin #140][dev031-admin] ostajata
  odprta Draft. Kljub temu javni `/deadlines?contract=2` dejansko deluje za tri
  pregledane izvedbe 2026. Merge stanje ni dokaz stanja deploymenta in obratno.
  D2 paket iz #100 dovoljuje le deadline v2; **ni gostitelj novega Race Watch API**.
  Opisani HEAD/release pogoji v #100 niso bili ponovno preverjeni in s tem
  dokumentom niso razrešeni.
- [Apps Scripts #103][incident-pr] obravnava namensko zaprtje nadomeščenega
  additional-import incidenta; [Admin #141][admin-parser-pr] parser SUPERSEDED
  in ohranitev deadline JSON. Nista rešitev identitete izvedbe. Pri prihodnjih
  posegih v skupne importerje je treba ohraniti njune varovalke in ponovno
  preveriti aktualna HEAD-a. Novega modela ne vgrajevati v incidentni popravek.

### Produkcija — sveži read-only odčitki

GET-i so bili opravljeni 19. 10., približno **13:49–13:53 CEST**. Javni podatki
so bili prebrani prek obstoječega Workerja. Rezultati so povzeti v
[preflight.json](evidence/dev036-phase-b/preflight.json).

| Preverjanje | Rezultat |
| --- | --- |
| [SL Moji teki][production-sl], [EN My races][production-en] | oba HTTP 200, pravilna naslova |
| Objavljeni skupni `my-races-client.DwATYz2j.js` | HTTP 200; vsebuje Race Watch kodo, `/recent_updates`, SL naslov in cleanup `finally` |
| `/?year=2026` | HTTP 200, `ok:true`, 303 zapisov; 281 potrjeno/DA, 20 neuradno/NE, 2 odpovedano/NE |
| `/?year=2027` | HTTP 200, `ok:true`, 36 zapisov; vsi potrjeno/DA |
| `/recent_updates?years=2026,2027&days=60&limit=100` | prvi poskus timeout 30 s; ponovitev HTTP 200, 25 povzetkov: 14 NEW, 1 CONFIRMED, 10 UPDATED; obdobje 21. 8.–19. 10. |
| `/deadlines?contract=2&year=2026&from=2026-10-19&to=2026-12-31&limit=100` | HTTP 200; v2, 3 eligible/returned, pregledana sidra Lahinja/Go4trail/Miklavžev |
| `/organizer-confirmations?year=2026` | prvi poskus timeout 30 s; ponovitev HTTP 200, samo `R000256`, `data_confirmed:true` |
| `/organizer-confirmations?year=2027` | HTTP 200, prazen seznam |
| `/additional?year=2026` | HTTP 200, 168 zapisov, brez javnega immutable ID-ja |
| `/planning-2027` | HTTP 200, 67 zapisov; načrtovalni prikaz, ne register identitete |

303/36 sta števili Master zapisov v javnem API odgovoru, **ne** števili trenutno
vidnih prireditev. Odpovedani vrstici 89 in 207 sta danes še v root Master
odgovoru, vendar to ni jamstvo za fizično izbrisane vrstice ali za zgodovino.

Svež deadline odgovor in Sheets Y109/Y111/Y117 potrjujeta `verified_at=2026-10-19`
in `valid_until=2026-10-26` za aktualne komponente. Stari cenovni dokaz Lahinje
ostaja 15.–22. 10. V CHANGE_LOG 1021–1023 je sled ločene predhodne osvežitve.
Ta analiza ni ničesar osvežila. Phase A dokument opisuje starejši posnetek
15.–22. 10.; njegovih datumov ni primerno obravnavati kot današnje stanje.

Python HTTP odčitki so vrnili 403; običajni `curl` GET-i so zgornje odčitke
uspešno opravili. Spletni bralnik je strani prikazal iz svojega predpomnilnika,
zato za svežo verifikacijo štejejo neposredni GET-i. Nova interaktivna browser
regresija ni bila izvedena. Pregled bundlea ne dokazuje celotnega build SHA-ja.
Niso bili preverjeni aktivne immutable Apps Script verzije, njihovi izvorni
hashi, Cloudflare bindingi ali runtime nastavitve. Ni podlage za trditev, da je
vsa koda na `main` tudi že uvedena v produkciji.

## 2. Prebrane kanonične evidence in dejanske zmogljivosti

Pred analizo povezav je bila prek povezanega Drive/Sheets dostopa prebrana
[kanonična preglednica][master]. Metapodatki: `2026` sheetId 1058687042,
`2027` 355171432, `RACE_REGISTRY` 1492791259, `CHANGE_LOG` 247150136,
`PUBLIC_LS` 1177614555, `ORGANIZER_RACE_ACCESS` 1831519530.

Prebrane vsebinske meje: `2026!A1:Z310`, preostanek A311:R1039 prazen;
`2027!A1:R38`, preostanek A39:R1038 prazen; `RACE_REGISTRY!A1:Z310` in
preostanek A311:D998 brez vrednosti; `CHANGE_LOG!A1:Z6` in A7:L1024;
`PUBLIC_LS!A1:AC310` ter formule S1:V3; glave organizatorskih evidenc,
`ORGANIZER_RACE_ACCESS!A2:AI50` in dodatni podatki A100:Y125.
Privatni kontakti, tokeni, hashi in citati organizatorskih sporočil niso vključeni
v javno dokazno datoteko ali predlagani javni API. Predlog ne pomeni javne objave
celotnih kanoničnih evidenc.

| Evidenca/mehanizem | Kaj je danes dokazano | Česa ne zagotavlja |
| --- | --- | --- |
| Master 2026/2027 | 15 vsebinskih polj in metapodatki zadnje spremembe; datum, status in vidnost | nima `race_id` ali immutable `edition_id`; vrstica je lokacija |
| RACE_REGISTRY | glava `race_key,race_id,,novi_race_key`; 297 vnosov, 285 različnih race_id, 12 ID-jev ima več ključev | nima izvedb, generacij vrstice, veljavnih časov povezave ali dokazil prestavitve |
| PUBLIC_LS | 281 potrjenih javnih dogodkov 2026; `race_id` iz exact VLOOKUP po normaliziranem naziv/kraj | `edition_id` je formula `race_id + '|' + datum`, zato se ob prestavitvi spremeni |
| CHANGE_LOG | `timestamp,list,celica_ali_obseg,vrstica,stolpec,polje,staro,novo,opis,naziv_prireditve,datum,kraj`; enopoljske in večcelične sledi | nima stabilnega revision ID, edition ID, enotnega vira/potrditve/veljavnosti; ni popoln življenjski dnevnik |
| Organizatorska potrditev | originalni posnetek, original/final hash, izrecni popravki, evidence ID, request ID, confirmed_at, kontrola aktualnega posnetka | ne pomeni vsakega INBOX vnosa; ni splošni changelog ali trajni register |
| `/organizer-confirmations` | objavi samo leto in row-based `event_id` ter pozitivni boolean, če aktualni javni posnetek ustreza | ne objavi polja/prej/potem/časa/dokazila; skrite in odpovedane izvedbe izloči |
| `/recent_updates` | kanonični nevtralni povzetki z letom, vrstico, datumom spremembe; večletni opt-in | izloči skrite/nepotrjene in pretekle dogodke; največ 60 dni, globalni limit 100; ni celotna revizijska zgodovina |
| DEV-031 v2 | preverjene semantične komponente rokov in omejena veljavnost za tri izvedbe | datum v `edition_id` ni trajen; dokaz roka ne dokazuje spremembe datuma, odpovedi ali ure |
| Admin verification history | lokalne uredniške sledi; ključ leto/master_sheet/master_row | ni kanonična trajna zgodovina ali dokaz uradnega obvestila |

V `ORGANIZER_RACE_ACCESS` so trije zapisi: dva PENDING_EMAIL in en VERIFIED
za Go4trail `2026!256`. Slednji ima originalni posnetek in pet izrecnih
popravkov: razdalje, najmanjšo ceno, opis cene, rok prijave in višince. To je
uporabna obstoječa osnova za preverjanje sprememb, ni pa danes dokaz odpovedi,
prestavitve ali spremembe ure/kraja. Snapshot polja **ne vključujejo
`status_dogodka`/vidnosti**; obstoječi resolver zahteva javno izvedbo. Zgolj
razširitev javnega booleana zato odpovedi ne reši.

### Konkretni kontrolni primeri

- **Lahinja:** Master `2026!254`, Website `r000254`, PUBLIC_LS vrstica 238,
  registry vrstica 218 → `R000217`; datum 7. 11. 2026. PUBLIC_LS ni Master
  vrstica. Master ura/opombe navajajo 08:00, metapodatek starejše spremembe pa
  še opisuje popravek na 09:00. CHANGE_LOG 1010 je naknadni zapis z dne 28. 9.
  o popravku 24. 9. nazaj na 08:00 in izrecno pove, da obrazec **ni VERIFIED
  organizatorska potrditev**. Datumi zapisa, dejanske spremembe in preveritve
  niso isto. Tega ne objaviti kot novo spremembo ure samo iz proste vsebine.
- **Tek na Svetino:** `2026!207`, odpovedano/NE; CHANGE_LOG 889 dokazuje
  podatkovni prehod potrjeno → odpovedano, 890 DA → NE, Master pa opisuje
  uradno objavo 16. 8. na profilu organizatorja. To je kandidat za uredniško
  potrjeno odpoved po preveritvi konkretne objave, identitete in veljavnosti.
  URL korenskega FB profila in star opis sama še nista aktualno dokazilo.
- **Obretanovo:** `2026!89`, odpovedano/NE, podlaga je predlog tekača in
  pretekla organizacija. Status sam ne dokazuje uradne odpovedi 2026.
- **Mad Mountain Mini Ultra:** `2026!137`, neuradno/NE, javna opomba omenja
  prestavitev premiere v 2027. Ni dokazane nove izvedbe ali aliasa. Brez
  ročnega dokaza iste izvedbe se ne poveže z nobenim dogodkom 2027.
- **Ponovna uporaba vrstice:** CHANGE_LOG 5 in 6 v razmiku približno minute
  opisujeta `2026!155` z različnima nazivoma in krajema ter večceličnim obsegom.
  Dnevnik ni varna globalna identiteta vrstica → izvedba. V drugem, javnem
  Calendar workbooku [zgodovinski audit][calendar-audit] posebej dokumentira
  premike vsebine mimo tehničnih ID-jev. To ni dokaz današnje napake v Masterju,
  je pa opozorilo za načrtovanje vseh pisalnih poti.
- **Konflikt uradnih virov:** Master `2027!16` (Nočni tek Maribor) navaja
  različni uri 20:30/20:00 in zato prazno skupno uro. Podobna omejitev je
  dokumentirana pri Kriški gori `2027!35`. Varno stanje je nerazrešen podatek.

## 3. Identiteta — obvezno ločevanje imenikov

| Identifikator | Dejanski pomen | Pravilo Phase B |
| --- | --- | --- |
| `race_id=R000217` | stabilna družina teka, prek registry aliasov | ni ključ izvedbe; ista družina sme imeti več izvedb v istem letu |
| izvedba / izdaja | konkretna organizirana prireditev, lahko z več dnevi in trasami | dobi enkrat dodeljen immutable ID |
| Master `2026!254` | trenutna fizična lokacija podatkov | locator, ne identiteta |
| Website `r000254` + leto | ID profila iz številke Master vrstice | legacy locator, namespace `website_event_id` |
| organizatorski `R000243` + leto | row-based ID, izpeljan iz Master vrstice 243 | namespace `organizer_event_id`, nikoli samodejno `race_id` |
| obstoječi `R000217\|2026-11-07` | datumni ključ PUBLIC_LS/deadline/vote izvedbe | `legacy_edition_key`, ne novi immutable ID |
| `event_key` | sestavljen datum/naziv/kraj, v dodatnih podatkih tudi leto | fingerprint ali pomoč pri pregledu, ne trajni ključ |

Primer trka: organizatorski `2026:R000243` pomeni Master `2026!243`, danes
22. Tek miru; registry `race_id=R000243` pomeni Mastodontov tek okoli Škalskih
jezer. Sprememba velikosti črke `r` → `R` ni pretvorba v družino.

Registry že izrecno ponovno uporablja `R000124` za Trail Maribor 2026/2027 in
`R000163` za Backyard Ljubljana 2026/2027. `race_id + leto` zato prav tako ne
sme predpostaviti natanko ene izvedbe; zimske lige, ponovitve in več dogodkov
iste družine v istem letu zahtevajo ločene ID-je. Prestavljena izvedba čez novo
leto ob dokazu ohrani isti ID in prvotni `edition_year`; `scheduled_year` sledi
novemu datumu. Nova naslednja letna izvedba dobi nov ID. Odločitev je uredniška,
ne izpeljana iz novega datuma.

### Obstoječi matcherji niso dokaz identitete

- Website `getStableEventId()` vrne row-based ID, brez vrstice pa slug datuma,
  naziva in kraja. `resolveSavedRaces()` za navaden seznam uporablja leto/ID;
  strožji Phase A Watch dodatno zahteva shranjeni datum, enolično vrstico in
  konsistentne locatorje. Pred povezavo po novem modelu je treba pregledati tudi
  navadni resolver, profile, izvoze in completed snapshots, da ne prikazujejo
  druge izvedbe prek stare vrstice.
- [STK_DodatniPodatki.js][additional-matcher] vsebuje exact datum/naziv/kraj in
  nato loose substring ujemanje imena/kraja z istim datumom. Tega ni dovoljeno
  ponovno uporabiti kot dokaz za alias, migracijo ali opozorilo.
- Content API vote lookup uporablja več ključev, tudi naziv/kraj in samo
  race_id. To so kompatibilnostna pravila glasov, ne watch identiteta. Glasovalne
  logike ne spreminjamo.
- Admin match scoring po imenu/dnevu/kraju je predlog uredniku; pri update brez
  izbrane vrstice zahteva ročno povezavo. Deduplikacija predlogov in lokalna
  verification history prav tako ne izdata dokazila iste izvedbe.

### Tri izvedljive arhitekturne možnosti

| Možnost | Identiteta in način delovanja | Prednosti/združljivost | Tveganja, zahtevnost in vzdrževanje |
| --- | --- | --- | --- |
| **A. ID v Masterju + kanonični register in revizije (priporočeno)** | tehnični literal `edition_id=ed_<UUID>` v vsaki pregledani Master izvedbi; register ohrani ID in lokacije tudi po izbrisu; ločene strukturirane revizije | neposreden join, datum in vrstica nista več ključ; podpira obe leti, premike, odpovedi; stare ključe ohrani kot aliase; Sheets ostane master | potrebna odobrena razširitev sheme in pregled vseh writerjev; UUID se lahko napačno kopira, zato obvezna enoličnost; srednja razvojna zahtevnost, najmanj stalnega ročnega usklajevanja |
| **B. Samostojen register izvedb in eksplicitnih vezav brez novega Master stolpca** | register dodeli opaque ID, hrani locator z generacijo in pregledanim posnetkom; vsaka ustvaritev/premik/prestavitev gre skozi nadzorovan postopek z ID-jem | Master A:R ostane; pilot mogoč z omejenim številom uredniško pregledanih dogodkov; legacy API ostane | vsi premiki/ponovne uporabe morajo biti evidentirani pred objavo; hash je kontrola vsebine, ne identiteta; nedokumentirana ponovna uporaba iste vrstice z istimi vrednostmi je nezaznavna; zato izvedljivo le ob uveljavljeni prepovedi obhodnih pisalnih poti, sicer NO-GO; srednja koda, visoko operativno breme |
| **C. Življenjski dnevnik izvedb kot kanonični vir projekcije** | začetni pregledani seed in append-only CREATE/MOVE/CHANGE/CANCEL/CORRECT/RETRACT dogodki z edition ID; trenutno stanje se deterministično sestavi iz dnevnika | najboljša sled in ponovljivost, identiteta obstaja tudi brez Master vrstice; brez zunanje baze; stare podatke je mogoče vključiti z izrecnimi seedi | obstoječi CHANGE_LOG ni tak dnevnik in ga ni dovolj preimenovati; vsi writerji potrebujejo transakcijski protokol, sekvence, obnovo in kontrole replaya; visoka zahtevnost in več vzdrževanja za MVP |

`race_id + trenutni datum`, `leto + trenutna vrstica`, content hash in približno
ujemanje so izločene bližnjice, ne dodatne izvedljive trajne arhitekture.

**Zakaj A:** pregledani register aliasov je potreben pri vseh možnostih zaradi
starih lokalnih zapisov in izbrisanih vrstic. En literalni ID v Masterju odstrani
največ vsakodnevnega ugibanja in omogoči neposredno kontrolno branje. Dodatna
tehnična kolona ni dovolj brez registrov in writer varovalk; pri delnem sortu
se lahko premaknejo samo vsebinske celice. Zato so kontrola celotne vrstice,
pregledani premiki in zavrnitev neskladnih posnetkov del priporočila.

## 4. Predlagani kanonični data contract

To je **predlog spremembe Sheets**, ki potrebuje ločeno odobritev. Ne ustvarja
baze, podatkovnega skladišča ali uporabniške/naročniške hrambe za Website.

### Minimalne evidence za možnost A

1. **Master tehnični `edition_id`** v obeh letih, literal, nikoli formula iz
   vrstice/datuma/naziva. Točno mesto stolpca potrditi po auditu hardcoded
   obsegov/importerjev; A:O in obstoječega A:R ne premikati. ID se dodeli
   enkrat, ni uporabniško prepisljiv in se ne reciklira.
2. **Predlagani `RACE_EDITIONS`**: `edition_id`, prvotni `edition_year`,
   pregledani `race_id` ali prazno, življenjsko stanje, trenutni Master locator
   ali null, trenutni javni posnetek, zgodovinski locatorji in legacy aliasi z
   dokazom vezave, čas nastanka in zadnje potrjene projekcije. Za MVP so
   locatorji/aliasi lahko validiran JSON v eni celici, brez tretjega novega lista.
   Uporabiti omejeno velikost in kontrolno branje. Zgodovina se ne prepisuje.
3. **Predlagani `RACE_REVISIONS`**: en zapis na preverjeno spremenjeno polje
   oziroma lifecycle dogodek; stabilen `revision_id`, `edition_id`, per-edition
   `sequence`, `change_set_id`, vrsta in semantika, polje/scope/prej/potem,
   dokazilo, potrditveni časi, stanje objave, `supersedes_revision_id` oziroma
   preklic. Identitetni MOVE je lahko tu tudi dokaz prehoda med locatorjema.

Register izvedb je za odpovedane/odstranjene izvedbe trajno dosegljiv v okviru
podprtih let. Brisanje Master vrstice ne izbriše registra ali revizij. Hranijo
se samo odobrena javna polja; zasebni source dokaz, evidence ID in urednikova
sled ostanejo v kanoničnem zasebnem delu. Javni endpoint ni splošni pregled
skritih neuradnih predlogov. Objavi le izvedbe, odobrene za Watch, predvsem že
objavljene in pozneje odpovedane izvedbe.

### Neodložljive invariante

- En immutable ID predstavlja eno izvedbo, ne družine. Enoličnost se preveri
  globalno, med obema letoma, aktivnimi vrsticami in registrom/tombstoni.
- Prestavitev ali MOVE sme prenesti obstoječi ID samo ob pregledanem dokazu iste
  izvedbe. Ob kopiranju za naslednjo sezono nastane nov ID.
- Alias ima namespace, leto, locator, zgodovinski shranjeni datum, generacijo,
  javni posnetek in provenance. Ne nastane iz podobnosti vsebine. Konflikt
  katerega koli aliasa ali ID-ja postavi prizadeto izvedbo v REVIEW.
- V2 nima `saved_at`, zato dve zgodovinski uporabi istega `(year,eventId,date)`
  nista razločljivi. Tak alias mora biti neprimeren za avtomatsko razrešitev,
  tudi če trenutno obstaja samo ena Master vrstica. Časovna okna aliasov brez
  časa shranitve ne rešijo te dvoumnosti.
- Nepoznani family ID ne prepreči ohranitve lokalnega teka. Ne ugibamo družine;
  family je lahko nerazrešen, dokler urednik ne potrdi povezave.
- Revizija ni pripravljena za javni prikaz, dokler niso uspešni preverjanje
  identitete, dokazila, before/after in kanonični read-back. Ob delni operaciji
  ne ustvarimo alarma. Uporabiti obstoječe lock/backup/recovery vzorce;
  spreadsheet append sam po sebi ni transakcija.
- Popravek napake, zapolnitev praznega polja in dejanska organizatorjeva
  sprememba so različne semantike. `null → 09:00` pomeni nov znan čas, ne
  »ura je bila spremenjena«. Popravek tipkarske napake datuma ni avtomatično
  prestavitev prireditve. `date_changed` in `rescheduled` nista sinonima.
- Read endpoint nikoli ne dodeljuje ID-jev, ne osvežuje dokazil in ne popravlja
  registrov med branjem. Nedokumentirani premik/pisanje pomeni REVIEW.

## 5. Dokazi in dovoljene trditve

**A — dokazljiva sprememba:** ista izvedba, strukturiran dejanski prehod,
izrecno uradno dokazilo, uredniška potrditev in veljavnost. Edina kategorija,
ki sme ustvariti konkretno opozorilo.

**B — splošna posodobitev:** obstoječi NEW/CONFIRMED/UPDATED s svojim pomenom;
UPDATED ostane nevtralen tudi ob prostem opisu spremembe. Nobene pretvorbe v A
iz `zadnja_sprememba_podrobno` ali preproste razlike med obiskoma.

**C — nezanesljiv signal:** izginotje, skrita vrstica, premik, drugačen datum
brez identitete, sekundarni vir, kontaktni/formularski zapis brez potrditve ali
nasprotujoči si podatki. Lahko sproži uredniški pregled, ne konkretnega alarma.

### Pravila po tipih

| Tip A | Potreben uradni dokaz in strukturiran podatek | Zanesljivost in veljavnost | Konflikt |
| --- | --- | --- | --- |
| `cancelled` | izrecna odpoved točno določene izvedbe od organizatorja; neposredna javna objava ali pregledana izrecna organizatorska potrditev; prej znano stanje → cancelled | visoka samo ob potrjeni identiteti in aktualnem dokazu; datum/čas potrditve in preveritve obvezna | ne iz statusa NE, izginotja ali preteklega leta; morebitna ponovna izvedba/reinstatement zahteva novo uradno revizijo |
| `rescheduled` | izrecno »ista izvedba je prestavljena« s starim in novim datumom; če novi datum še ni znan, `after:null` in `date_pending:true`; pregledan bridge lokacije, če je vrstica nova | visoka za dokazano trditev; nikoli iz family+nov datum; ohrani isti immutable ID tudi čez koledarsko leto | nova letna prireditev ni prestavitev; tipkarski popravek dobi `data_corrected`, ne rescheduled |
| `time_changed` | uradni urnik/razpis ali izrecni popravek z znano prejšnjo uro in novo uro istega starta; timezone Europe/Ljubljana; scope celotna prireditev ali točno določena trasa | visoka samo za dokazani scope; skupnega prvega starta ne predstavljamo kot časa vseh tras | dve uradni različici ali neznan scope → REVIEW; nova objava prve znane ure ostane nevtralna dopolnitev |
| `venue_changed` | izrecna uradna sprememba prizorišča, starta ali cilja z vrednostma prej/potem in točnim scope | visoka; kozmetična normalizacija naziva kraja ni selitev | širši kraj ≠ startno prizorišče; različno poimenovanje iste lokacije ni dokaz spremembe |
| druga pomembna sprememba | samo vnaprej odobren enum, javno polje, primerjalni vrednosti, scope in uradna izrecna izjava; npr. pomembna sprememba trase | ni generičnega text-to-alert mehanizma; prvi MVP jo izpusti, dokler ni potrjen contract za ta tip | nikoli »other« z neomejenim prostim besedilom; cena/višinci/razdalja ne dobijo avtomatično oznake kritično |

Uradni dokaz pomeni pristojni organizatorjev kanal ali z njegove strani
pooblaščen razpis/portal za konkretno izvedbo, ne zgolj domeno iz allowlista.
HTTP 200, `zanesljivost=visoka`, splošen organizatorjev badge ali e-poštni
kontakt sami ne zadoščajo. Zasebna izrecna potrditev je lahko dokaz, vendar
potrebuje pregledano javno povzetje na STK ali javno uradno objavo za povezavo
uporabnika. Ne objavimo Gmail ID-ja, privatnega sporočila ali kontaktov.
Če varne javne evidence ni, se konkretni MVP alarm zadrži do njene priprave.

### Časi, veljavnost in razreševanje

Obvezno ločiti `source_published_at` (lahko null), `effective_at` (če znan),
`confirmed_at` (uradna/uredniško zabeležena potrditev), `verified_at` (STK
preveritev), `recorded_at` in prvi STK `published_at`. Naknadni vnos v dnevnik
ne prestavi časa dejanske spremembe na današnji dan. Neznanega časa ne izmislimo.

**Predlagana politika za odobritev**, enaka zgornjim štirim začetnim tipom:
veljavnost največ 14 dni pri več kot 30 dneh do prizadete izvedbe, največ 7 dni
pri 8–30 dneh, največ 24 ur pri 0–7 dneh. Pri prestavitvi se bližina računa do
najbližjega relevantnega starega ali novega datuma; pri odpovedi do starega
datuma, pri neznanem datumu največ 7 dni. Strožji rok iz vira ima prednost.
Pri vstopu v krajše okno velja tudi krajša največja starost, zato star dokaz
ne postane sprejemljiv samo zaradi dolgega vpisanega `valid_until`.

Novi contract uporablja ISO timestamp in **izključno zgornjo mejo**
`now < valid_until`; obstoječi deadline v2 date-only/inclusive contract se
ne spreminja. Časovne izračune in prikaz se preveri za Ljubljano in DST.
GET, HTTP 200 ali nov `generated_at` nikoli ne podaljšajo `verified_at`.
Preveritev in podaljšanje sta izrecna uredniška operacija z audit sledjo.

To ni brisanje zgodovinskega dejstva: poteklo/prekinjeno dokazilo ostane v
zgodovini kot tedaj potrjena objava. Ne dobi aktualne opozorilne oznake.
Pretekle odpovedi se ne spremenijo v »tek bo izveden«; trenutno stanje ostane
nepreverjeno, zgodovinska odpoved pa je jasno datirana. Revizije ohraniti tudi
po izvedbi, da povratnik po 60 dneh vidi omejeno, pošteno zgodovino.

Dva pristojna uradna vira z različnima vrednostma pomenita CONFLICT. Novejši
čas preveritve, višji sequence ali zadnja Master vrednost sami ne izberejo
zmagovalca. Potrebna je izrecna razjasnitev/superseding objava in uredniška
odločitev. Preklic in popravek sta novi reviziji; zgodovina se ne izbriše.
Po razrešitvi UI upošteva verigo supersedes, ne prikazuje zastarelega alerta kot
aktualnega. Manjkajoča before vrednost prepreči trditev »iz X v Y«.

## 6. Minimalna javna read-only projekcija

### Izbira endpointa

**Predlog:** `GET /race-watch?contract=1&years=2026,2027` na sedanjem Workerju,
posredovan kanoničnemu Content API. GET/OPTIONS, javni podatki, brez credentialov
in uporabniškega seznama v queryju. Veljavna so samo izrecno podprta leta in
contract; neznana kombinacija vrne jasen neuspeh.

Razširitev `/recent_updates` ni priporočena: njegov temelj je seznam trenutno
javnih, potrjenih, prihodnjih dogodkov in 60-dnevni povzetek. Vključitev
odpovedanih/tombstonov bi spremenila pomen tudi drugim porabnikom. Razširitev
root Master prav tako ne reši izbrisanih vrstic in dokazil. Opt-in dodatni blok
bi bil mogoč, vendar bi za ločeno retencijo/napake/validacijo nosil skoraj enako
kodo. Ločen endpoint je najmanj zahtevna zanesljiva rešitev s čistimi mejami.

V MVP se vrne **celoten omejen posnetek odobrenih izvedb in ohranjenih revizij
iz zahtevanih sezon**, tudi odpovedanih, preteklih in fizično odstranjenih.
Število je trenutno približno 339 Master dogodkov pred uredniškim izborom;
dejanski payload in Apps Script čas je treba izmeriti. Ni 60-dnevnega reza,
ni implicitnega limita 100. Velikostna omejitev mora vrniti explicit incomplete
ali napako, nikoli tihih manjkajočih dogodkov. Če bo potrebna paginacija, mora
imeti pripet `projection_revision` in ponovno branje ob njegovi spremembi;
to ni predpogoj prvega majhnega pilota.

`years` zajame prvotno sezono in aliasno leto tudi pri prestavitvi v drugo leto.
Odsotnost v odgovorjeni množici ni dokaz odpovedi niti dokazana odsotnost
sprememb. Vsaka izvedba potrebuje deklarirano pokritost (`identity_status`,
`history_complete_since`, `verification_status`). Neznani/nerazrešeni primeri
ostanejo unknown; ne izginejo zato, ker nimajo veljavnega alerta.

### Obvezna polja

| Del | Minimalna vsebina |
| --- | --- |
| envelope | `ok,type,contract_version,generated_at,projection_revision,years,coverage,complete,stats,editions` |
| izvedba | immutable `edition_id`, `edition_year`, `scheduled_year`, nullable `race_id`, `identity_status`, zadnji odobren javni posnetek, `lifecycle_status`, `verification_status` |
| lokacije | nullable `master.current`, `master.history[]` s sheet/row/generation/veljavnostjo in `link_revision_id`; premik/datum imata ekspliciten bridge iste izvedbe |
| legacy alias | namespace, leto, Website ID ali drug legacy ključ, shranjeni datum, pregledan fingerprint, `resolution`, `binding_revision_id`; brez implicitnih pretvorb ID |
| revizija | stabilen `revision_id`, sequence, `change_set_id`, enum tipa/semantike, točno polje, scope, typed before/after, identity/locator bridge, published/confirmed/verified/valid_until, source |
| dokaz | `verification_status`, varen javni `official_source.url`, vrsta vira, `source_published_at`, odobren kratek javni povzetek; privatni dokaz ostane interni |
| popravek | `supersedes_revision_id`, `retracted_at`, stanje ACTIVE/SUPERSEDED/RETRACTED/CONFLICT/EXPIRED; neznan enum ne ustvarja alerta |

`projection_revision` označuje vsebino projekcije in se ne spremeni samo zaradi
GET-a. `revision_id` se dodeli enkrat; ni številka CHANGE_LOG vrstice ali hash
imena/datuma. Ponovitev iste potrjene operacije in istega polja vrne isti ID.
Enaka vsebina pod različnima ID-jema zahteva server-side idempotency kontrolno
pravilo za `edition_id + confirmation/change_set + field + scope`. Različna
vsebina pod istim ID-jem je napaka contracta in se zadrži. Osvežitev dokazila
ohrani semantični revision ID, doda audit preveritve in spremeni projekcijo;
ne ustvari novega opozorila o isti spremembi.

### Ilustrativni JSON

**Povsem sintetičen primer** premika v novo Master vrstico. Ne opisuje nobenega
dejanskega teka, dokazila ali obstoječega endpointa. UUID in `.example` sta
ilustrativna. V produkciji je uradni vir dejansko pregledan javni URL.

```json
{
  "ok": true,
  "type": "race_watch",
  "contract_version": 1,
  "generated_at": "2026-10-19T12:00:00Z",
  "projection_revision": "rw-demo-17",
  "years": ["2026", "2027"],
  "complete": true,
  "coverage": { "history_complete_since": "2026-10-01T00:00:00Z" },
  "stats": { "editions_total": 1, "returned_total": 1 },
  "editions": [{
    "edition_id": "ed_64c9a86d-9cf4-4a2f-a367-b63c1ba58320",
    "edition_year": "2026",
    "scheduled_year": "2026",
    "race_id": "R999999",
    "identity_status": "VERIFIED",
    "lifecycle_status": "rescheduled",
    "verification_status": "VERIFIED",
    "current": { "title": "Ponazoritveni tek", "date": "2026-11-14", "place": "Primer" },
    "history_complete_since": "2026-10-01T00:00:00Z",
    "master": {
      "current": { "sheet": "2026", "row": 400, "generation": 1 },
      "history": [{
        "sheet": "2026", "row": 320, "generation": 1,
        "valid_from": "2026-10-01T00:00:00Z",
        "valid_to": "2026-10-19T09:00:00Z",
        "link_revision_id": "rev-demo-move-1"
      }]
    },
    "legacy_aliases": [{
      "namespace": "website_event_id", "year": "2026",
      "event_id": "r000320", "saved_date": "2026-11-07",
      "snapshot_title": "Ponazoritveni tek",
      "resolution": "UNIQUE_VERIFIED",
      "binding_revision_id": "rev-demo-bind-1"
    }],
    "revisions": [{
      "revision_id": "rev-demo-reschedule-1", "sequence": 3,
      "change_set_id": "change-demo-1", "status": "ACTIVE",
      "type": "rescheduled", "semantic": "organizer_change",
      "field": "datum", "scope": { "kind": "event" },
      "before": "2026-11-07", "after": "2026-11-14",
      "identity_bridge_revision_id": "rev-demo-move-1",
      "source_published_at": "2026-10-19T08:00:00Z",
      "confirmed_at": "2026-10-19T08:30:00Z",
      "recorded_at": "2026-10-19T08:45:00Z",
      "published_at": "2026-10-19T09:00:00Z",
      "verified_at": "2026-10-19T08:40:00Z",
      "valid_until": "2026-10-26T08:40:00Z",
      "verification_status": "VERIFIED",
      "official_source": {
        "kind": "organizer_notice",
        "url": "https://organizer.example/2026/prestavitev"
      },
      "supersedes_revision_id": null,
      "retracted_at": null
    }, {
      "revision_id": "rev-demo-bind-1", "sequence": 1,
      "type": "identity_binding", "status": "ACTIVE",
      "edition_id": "ed_64c9a86d-9cf4-4a2f-a367-b63c1ba58320"
    }, {
      "revision_id": "rev-demo-move-1", "sequence": 2,
      "type": "master_moved", "status": "ACTIVE",
      "before": { "sheet": "2026", "row": 320, "generation": 1 },
      "after": { "sheet": "2026", "row": 400, "generation": 1 },
      "confirmed_at": "2026-10-19T08:30:00Z"
    }]
  }]
}
```

Primer prikazuje različni obliki interne identitetne in javne vsebinske
revizije; stroga schema mora uporabiti discriminated union. `master_moved` in
`identity_binding` nikoli nista uporabniški opozorili. Predlagani production
contract mora še izrecno določiti dokazna polja teh dveh variant. Pri odpovedi
je `current.date` zadnji znani termin, `lifecycle_status=cancelled`; fizični
izbris pomeni `master.current=null`, ne izbris izvedbe. To ni nov javni profil
ali sprememba obstoječih URL poti.

### Validacija in napake

Server in odjemalec zavrneta nekonsistenten ID, podvojene locatorske generacije,
konfliktne aliase, neveljavne datume/čase, nevaren URL, neznano polje/enum,
manjkajoče dokazilo, iztek, preklic ali nepopoln bridge. Delno dokazljivi
neodvisni dogodki se smejo prikazati samo ob jasnem opozorilu o delni pokritosti;
konfliktna izvedba ne dobi konkretnega alerta. Nepopoln rezultat ni uspešen
»ni sprememb«. Javna allowlist projekcija nikoli ne serializira surovega
CHANGE_LOG, INBOX, original_snapshot_json ali organizatorskih audit vrstic.

Ohraniti 12-sekundni Watch timeout, deljenje aktivnih zahtev in cleanup iz
Phase A, sveže preverjanje ob ponovnem obisku/vrnitvi v zavihek in umik
pretečenih dokazil. Brez pollinga in samodejnih retry zank. Za prazno zbirko ni
zahteve. Pri očitno napačni uri naprave/neskladnem času odgovora prikaz ostane
nepreverjen; UI ne sme podaljšati dokazila zaradi predpomnilnika.

## 7. Prehod za `stkSavedRacesV2`

Danes je zapis `{version:2,eventId,year,date,title,status}`; ključ je
`year:eventId`, največ 500 zapisov. Statusi so `following`, `planning`,
`registered`, `completed`. Obstajata tudi prehod V1→V2 in ločena
`stkCompletedRaceSnapshotsV1`; obojega je treba ohraniti.

**Priporočen prvi prehod je razrešitev v pomnilniku brez migracije hrambe.**
V2 ostane uporabnikov izvirnik. Ne dodajamo accountov, obveznega novega ključa,
seen zgodovine ali nove strežniške hrambe uporabnikov.

1. Preberi V2 z obstoječim validiranjem. Napaka API ne piše ničesar.
2. Pridobi javno projekcijo podprtih sezon 2026/2027. Kandidat sme izhajati
   izključno iz pregledanega legacy aliasa pravega namespaca.
3. Zahtevaj natanko eno dokazano povezavo za shranjeni `(year,eventId,date)`
   ter skladnost shranjenega posnetka, kolikor obstaja. Naziv je lahko kontrola
   ali razlog za REVIEW, nikoli iskalni ključ. Ne normaliziraj `r` v družinski `R`.
4. Premik in nov datum razreši samo prek dokazanih zgodovinskih aliasov istega
   ID-ja. Brez bridgea ne uporabi današnje vrstice. Nerazrešen zapis ostane v
   seznamu z lastnim nazivom, datumom in statusom.
5. Trenutni uradni termin prikaži kot podatek razrešene izvedbe, stari datum
   ohrani v V2. Uporabnikov status se nikoli ne spremeni zaradi odpovedi ali
   prestavitve; `completed` ostane completed. Snapshotov opravljenih tekov ne
   prepisuj s prihodnjo ali napačno izvedbo.
6. Če dva stara zapisa dokazano kažeta na isti edition ID, opozorilo dedupliciraj
   po revision ID, **lokalnih zapisov in statusov pa ne združuj ali briši**.
   Različna statusa ne dobita avtomatsko izbranega zmagovalca.
7. Status update/remove iz razrešene kartice mora še vedno ciljati izvorni
   legacy ključ. Ne zapisuj nove vrstice/datuma iz prikaza nazaj v identiteto,
   ker bi naslednji obisk izgubil zgodovinski alias. To preveriti tudi v
   saved-races gumbih, completion toku, osebnem koledarju in izvozih.

Novi uporabniški save po premiku lahko še uporablja obstoječi row-based V2 le,
če novi locator že ima objavljen enoličen alias. Ob ponovni uporabi iste
vrstice V2 ključ ne loči dveh izvedb istega leta: nevaren nov save je treba
zadržati in ponuditi jasno obvestilo. Popolno shranjevanje takih novih izvedb
potrebuje ločeno odobreno verzijo lokalnega modela. To ni razlog za tihi V3
upgrade ali prepis obstoječega teka. Dokler V2 ostaja primarni ključ, je smiselno
operativno prepovedati recikliranje že javno uporabljenih locatorjev.

Če bo pozneje odobrena V3, je to ločen PR: ohranitev originalnega V2, validiran
copy-on-write, read-back, rollback in eksplicitna obravnava nerazrešenih zapisov.
V3 ni predpogoj za prvi omejeni Phase B prikaz. Brez `saved_at` in popolne
zgodovine ni mogoče obljubiti razrešitve vseh preteklih V2 identitet; mogoče in
obvezno pa je ohraniti vse lokalne zapise brez neutemeljenih povezav.

### Lahinja Trail 2026

Začetni pregledani alias je `website_event_id:2026:r000254` + shranjeni datum
`2026-11-07` → še dodeljeni opaque edition ID; family `R000217` se potrdi iz
registry 218, PUBLIC_LS 238, dodatnih podatkov 109 in Master 254. Obstoječe
pregledano Phase A sidro je dodaten dokaz za ta točen posnetek, ne splošno
pravilo za vse vrstice. Novi ID se v tej analizi ni dodelil.

`R000217|2026-11-07` ostane legacy deadline/vote alias. Če se datum spremeni,
se stari ključ ne izbriše in ne prepiše v novo letno izvedbo. Stari Website
`r000254` ne postane `R000254`. Pred vključitvijo v register je potreben
izrecen pregled zgodovine tega locatorja; ob dvomu ostane nerazrešen. Ohraniti
vse štiri statuse, tudi če se kasneje potrdi odpoved. Današnje dokazilo za
spletne prijave do 4. 11. ni dokaz spremembe ure ali trajne identitete.

## 8. Testna matrika varnega obnašanja

Gre za načrt prihodnjih preverjanj, ne trditev, da so novi testi že izvedeni.

| # | Scenarij | Pričakovano varno obnašanje |
| --- | --- | --- |
| 1 | Prestavitev, ista Master vrstica | isti immutable ID; samo uradno dokazan `rescheduled` z before/after in veljavnim dokazom; datum v V2 ostane; sprememba celice brez dokazila je nevtralna/REVIEW |
| 2 | Prestavitev, nova Master vrstica | star in nov locator poveže eksplicitni MOVE/bridge istega ID-ja; star V2 se razreši prek aliasa; brez bridgea oba ostaneta nepovezana |
| 3 | Odpoved in odstranitev iz javnega prikaza, tudi fizični izbris | register/tombstone in revizija ostaneta v `/race-watch`; veljaven dokaz ustvari odpoved; izginotje samo ne; uporabnikov status in zapis ostaneta |
| 4 | Dve izvedbi iste družine, tudi v istem letu | različna edition ID, ločene revizije; opozorilo prve ne doseže druge; family/year ne zadostuje |
| 5 | Enaka Master vrstica 2026/2027 | ločena namespaces/letna locatorja; brez povezave zgolj zaradi številke; eksplicitna cross-year prestavitev je izjema samo z dokazom |
| 6 | Premik ali ponovna uporaba vrstice | UUID in pregledan MOVE potujeta z izvedbo; druga izvedba dobi nov ID/generacijo; delni sort ali V2 nerazločljiva ponovna uporaba pomeni REVIEW, brez dedovanja starega alarma |
| 7 | Napačna/manjkajoča identiteta | lokalni tek ostane; brez konkretnosti; obvestilo o nezmožnosti preverjanja; brez fallbacka po nazivu/kraju/datumu |
| 8 | Dva nasprotujoča si uradna vira | prizadeta vrednost CONFLICT; brez izbire po latest timestamp; ohranjena datirana zgodovina, do razjasnitve brez aktualnega konkretnega alerta |
| 9 | Podvojene revizije | isti ID/ista vsebina en prikaz; isti ID/druga vsebina zavrnitev; različna ID/ista potrjena operacija server-side idempotency; nobene izgube lokalnih statusov |
| 10 | Neveljavno, pretečeno ali preklicano dokazilo | brez aktualnega preverjenega alarma; veljavnost se ne podaljša z GET; zgodovina ostane označena; umik tudi na odprti strani in ob vrnitvi v zavihek |
| 11 | API timeout, 503, neveljaven JSON, delni odgovor | lokalni prvi prikaz/statusi delujejo; jasno »preverjanje ni mogoče«; nikoli »ni sprememb«; ob naslednjem obisku nov poskus, brez pollinga; pozen odgovor ne prepiše novejšega |
| 12 | Vrnitev po več kot 60 dneh | prebere ohranjeno stanje in revizije za podprto sezono, tudi cancelled/tombstone; ne označi kot neprebrano; pred `history_complete_since` ne obljublja zgodovine; potekli dokaz ostane zgodovinski, ne aktualen |

Dodatne obvezne regresije: vsi štirje statusi × SL/EN × leti 2026/2027;
prazna zbirka, omejitev 500 in nedostopen localStorage; dve stari referenci iste
izvedbe z različnima statusoma; odstranjevanje in sprememba statusa po MOVE;
completed snapshot in ICS po prestavitvi; izvoz neznane/odpovedane izvedbe po
obstoječih pravilih brez izmišljenega termina; prihodnja prestavitev čez leto;
neznan novi datum; popravek tipkarske napake proti dejanski prestavitvi;
prvi znan čas proti spremembi časa; različni starti tras; nevarni URL/XSS;
supersedes/retract; čas Ljubljana/DST, veljavnost tik pred/ob/po meji; cap ali
truncation; mešana uspešna/neuspešna sezona; osebni podatki nikoli v projekciji.

Priporočeni sloji: pure contract/identity validator testi s sintetičnimi fixture,
Apps Script read-only projection testi, dejanska Worker→upstream integracija
z mock upstreamom, Website adapter testi ter obstoječi Playwright tokovi za
Moje teke in roke. Pred vklopom še read-only produkcijska primerjava z izbranimi
kanoničnimi primeri; noben test ne spreminja produkcijskih podatkov.

## 9. Minimalen UX SL/EN

Ostane isti razdelek **»Novosti pri mojih tekih« / »Updates to my races«**.
V njem kratke vrstice z nazivom teka, konkretno informacijo, datumom preveritve
in povezavo **»Uradni vir« / »Official source«**. Obstoječa kartica, status,
filtri in postavitev ostanejo. Opozorilo ne sme biti označeno kot novo ali
neprebrano, ker nimamo evidence zadnjega ogleda.

| Pomen | SL | EN |
| --- | --- | --- |
| Prestavitev | »Datum prestavljen: 7. 11. → 14. 11. 2026.« | “Rescheduled: 7 Nov → 14 Nov 2026.” |
| Neznan novi datum | »Tek je prestavljen. Novi datum še ni potrjen.« | “The race has been postponed. A new date has not been confirmed.” |
| Odpoved | »Prireditev je odpovedana.« | “The event has been cancelled.” |
| Ura | »Start na 30 km: 09:00 → 08:00.« | “30 km start: 09:00 → 08:00.” |
| Kraj | »Start je prestavljen: [prej] → [potem].« | “Start location changed: [before] → [after].” |
| B — UPDATED | »Podatki teka so bili posodobljeni.« | “Race details have been updated.” |
| Neuspešno preverjanje | »Sprememb tega teka trenutno ni mogoče preveriti.« | “Changes to this race cannot currently be verified.” |
| Nerazrešena povezava | »Shranjeni tek ostaja v seznamu. Njegovih sprememb še ne moremo zanesljivo povezati.« | “Your saved race remains in the list. We cannot yet reliably match its updates.” |
| Staro dokazilo | »Pretekla objava: [podatek], potrjeno [datum]. Aktualno stanje ni preverjeno.« | “Earlier notice: [detail], confirmed [date]. The current status has not been verified.” |

Zgornji datumi/30 km so primeri besedila, ne predlog današnjega alarma Lahinje.
Prvi MVP pokaže aktivna preverjena opozorila pred nevtralnimi povzetki;
preverjeno in nevtralno za isto operacijo se ne podvojita. Barva ni edini nosilec
pomena. Uporabnik ohrani status tudi pri odpovedi. Ob praznem uspešnem izboru
uporabimo »V preverjenem obsegu ni prikazanih pomembnih sprememb« z obsegom in
časom preveritve, ne absolutnega »Ni sprememb«.

Zgodovinska objava se prikaže kratko, če pomaga povratniku; ne uvajamo timeline
aplikacije. Vir je dosegljiv tudi, ko javnega profila odpovedanega teka ni več;
uporabi se lokalni naslov in javni uradni dokaz. Brez e-pošte, SMS, push,
računov, nastavitev naročnin ali novega kompleksnega UI.

## 10. Izvedba po repozitorijih, tveganja in ocena

| Del | Predvideno delo po potrditvi |
| --- | --- |
| `stk-apps-scripts` — dokumenti/model | kanonični contract, lifecycle/alias pravila, zasebna in javna schema, podatkovni audit in pilotni seznam za ročni pregled |
| `stk-apps-scripts` — `stk-orodja`/writerji | nadzorovano dodeljevanje/ohranitev ID, globalne kontrole kopij/premikov; staged evidence in revizije po read-backu; brez text matcher kot dokaza; ohranitev importer recovery |
| `stk-apps-scripts` — `stk-content-api` | allowlist read-only projekcija iz odobrenih registrov; statusi, dokazila, expiry/conflict, tombstoni; nič pisanja med GET |
| `stk-apps-scripts` — `stk-master-api/worker.js` | nov route v obstoječem Workerju na odobren canonical upstream; GET/OPTIONS, napake in timeout; obstoječe poti/binding semantike nedotaknjene |
| `stk-admin` | najprej ni nujna funkcionalna sprememba za majhen ročni pilot; pozneje obstoječi uredniški predlog dopolniti z edition ID, dokazilom in before/after pregledom; brez novega login ali avtomatskih zapisov |
| `stk-website` | ločen validator/adapter, memory-only alias razrešitev V2, pregled navadnega resolverja/status write ključev/snapshotov/izvozov, minimalne SL/EN vrstice in browser regresije |
| Kanonični Sheets, izven tega dela | odobrena tehnična kolona in evidenci, pregledani pilotni seedi/aliasi, operativni postopek dokazil; nobenega avtomatskega masovnega backfilla |

### P1

- Napačna povezava različnih izvedb ali recikliranega locatorja: neposredno
  napačen alarm. Kontrola: immutable ID, namespaces, globalna enoličnost,
  pregledani aliasi in nerazrešeno stanje ob dvomu.
- Neutemeljena odpoved/prestavitev iz statusa ali diffa: kategorija A zahteva
  izrecen dokaz iste izvedbe in semantike organizatorjeve spremembe.
- Delni Sheets zapisi ali kopiran ID: staging, read-back, commit/publish gate,
  locki in obstoječi recovery; API zadrži nekonsistentno izvedbo.
- Razkritje zasebnih potrditev/INBOX: javna allowlist, zasebni dokaz ostane
  zaseben; brez javnih tokenov, e-pošte, hashov originalnih zasebnih vsebin.
- Izguba ali prepis lokalnega statusa ob »migraciji«: v prvem koraku nič
  pisanja v V2, nič združevanja zapisov ali spremembe ključa.

### P2

- Stare in nepopolne evidence: pokritost začetnega backfilla bo omejena;
  zgodovina pred seed datumom je izrecno nepopolna.
- Potek dokazil in nasprotujoči si viri: vidno unknown/review, potrebna
  uredniška ponovna preveritev, ne samodejno podaljševanje.
- Timeouti Apps Script: opaženi tudi danes; omejen javni payload, kontrole
  timeouta in prikaz delne razpoložljivosti; nobene obljube stalnega nadzora.
- `main`/runtime odstopanja, DEV-031 D2 in odprti incidentni PR-ji: ločen
  preflight pred vsako uvedbo; ne preusmeriti canonical API na D2.
- V2 shranjevanje ob ponovni uporabi row ID: za stare zapise ohranitev brez
  razrešitve, za nove konfliktne save varna zavrnitev do posebej odobrenega
  lokalnega modela; operativno prepovedati ponovno uporabo javnih locatorjev.
- Rast zgodovine/JSON celic: merjenje payloadov in quota, brez tihega reza;
  poznejša paginacija ali normalizacija znotraj Sheets samo po potrebi.

### Operativno vzdrževanje

Za izvedbe, vključene v Watch, urednik pred objavo poveže nespremenljiv ID,
preveri exact izvedbo in scope, navede javni uradni vir, loči dejansko spremembo
od popravka podatka, potrdi before/after ter rok veljavnosti. Po zapisu preveri
read-back in javno projekcijo. Ob izteku evidence gre v pregled, ne v lažno
potrditev. Odpoved ali MOVE ne pomenita odstranitve zgodovine.

Treba je popisati vse pisalne poti: Admin/staging final import, DIRECT/BATCH,
ročna urejanja in kopiranje/sortiranje, letni setup, dodatni podatki ter
organizatorski popravki. Obstoječi `onEdit` v orodjih ni popoln mehanizem:
cilja konfigurirano leto, večcelični vnos pa nima natančnih before/after za
vsa polja. Ne predpostavimo, da zazna programske zapise ali vse premike.

Pilot naj obsega nekaj izrecno pregledanih primerov v obeh sezonah, vsaj en
odpovedani zgodovinski primer in negativni primer identitete. Vsaka nepokrita
pisalna pot mora ostati izključena iz avtomatske objave preverjenih revizij.
Pri pilotu okvirno 5–15 minut uredniškega dela na preprosto spremembo plus
čas raziskave uradnega vira; konflikti in zgodovinske migracije lahko trajajo
bistveno dlje. To je planska ocena, ne izmerjena produktivnost.

### Okvirna razvojna ocena

Ocena za enega razvijalca po potrditvi modela, brez uvedb, časa čakanja na vire
in masovnega ročnega popravka zgodovine:

| Faza | Okvir |
| --- | --- |
| Contract, fixture, read-only audit in pilotni načrt | 1–2 razvojna dneva |
| ID/registry/revision varovalke in integracija začetnih writerjev | 4–7 dni |
| Content API projekcija + Worker route + integracijski testi | 2–3 dni |
| Website adapter, ohranitev V2, minimalni UX in regresije | 2–4 dni |
| Operativni pilot, read-only primerjave in odprava ugotovljenih vrzeli | 1–2 dni |

Skupaj približno **10–18 razvojnih dni** za omejen zanesljiv pilot.
Celovit audit in prilagoditev vseh zgodovinskih writerjev/ročnih poti lahko
obseg razširita; zato API/UI datuma ni pošteno obljubiti pred modelom.
Možnost B prihrani stolpec, ne nujno dela; možnost C je večji ločen projekt.

## 11. Faze in konkretna odločitev za nadaljevanje

1. **B0 — contract in preverjanje brez produkcijskih učinkov.** Najmanjši
   naslednji PR: v `stk-apps-scripts` samo arhitekturni contract, stroga
   javna/zasebna schema, sintetični primeri vseh 12 scenarijev in seznam
   pregledanih pisalnih poti/pilotnih kandidatov. Brez runtime route, writerja,
   dodelitve ID ali UI. To je prvi varen naslednji PR za pregled modela.
2. **B1 — po odobritvi contracta:** offline validatorji in read-only identity
   audit preview; pokažejo UNIQUE/AMBIGUOUS/MISSING/CONFLICT in načrtovane
   povezave, nikoli ne zapišejo povezave. To je prvi varen implementacijski PR.
3. **B2 — posebej odobrena kanonična priprava:** shema, writer varovalke in
   omejen ročno pregledan seed za 2026/2027 z obnovljivim načrtom; register
   odpovedi in dokazil. Pripravljena koda ne pomeni dovoljenja za podatkovne
   zapise ali deployment. Gate: noben dvoumen alias ni označen UNIQUE.
4. **B3 — ločen API PR:** read-only projekcija in nov Worker route; najprej
   lokalni testi in mock integracija. Uvedba zahteva nov runtime preflight in
   odobritev. Gate: zadržanje conflict/expired, ohranjeni tombstoni in popolnost.
5. **B4 — Website PR:** šele po potrjenem in prebranem živem contractu
   memory-only V2 razrešitev ter prve preverjene odpovedi/prestavitve; ura/kraj
   samo, kjer je scope dokazan. Gate: matrika, SL/EN, brez statusne izgube.
6. **B5 — razširitev pokritosti:** drugi pomembni tipi in več zgodovine po
   ločenih dokaznih pravilih. Računi in zunanja obvestila niso del tega načrta.

Za odobritev so odprte štiri odločitve: možnost A in mesto tehničnega ID-ja;
kanonični register/alias/revision model z ohranitvijo tombstonov; predlagana
politika dokazil/veljavnosti in javnega vira; ločeni `/race-watch` contract ter
nedestruktivni memory-only prehod V2. Do takrat ostane Phase A obseg.

**READY velja le za pripravo B0. Phase B uporabniške funkcije ostajajo
REQUIRES DATA CONTRACT.** Dostop do ključnih Sheets in javne produkcije je bil
na voljo; blokada je podatkovno jamstvo, ne domnevna odsotnost vseh podatkov.
Analiza se tukaj ustavi za odobritev naslednje faze.

## Viri za ponovljiv pregled

- [Phase A poročilo in omejitve][phase-a], [PR #235][phase-a-pr].
- [Aktualni Website Watch adapter][watch-code], [V2 lokalni model][saved-code],
  [navadni resolver shranjenih tekov][resolver-code].
- [Content API recent collector][recent-code], [CHANGE_LOG standard][log-standard],
  [organizatorski resolver in javna projekcija][organizer-code],
  [izrecne organizatorske potrditve][organizer-doc].
- [Worker routes][worker-code], [read-only identity audit][identity-audit-code],
  [additional matcher][additional-matcher], [Calendar zgodovinski audit][calendar-audit].
- [Admin import povezovanje][admin-reconcile], [lokalna verification history][admin-history].
- [Kanonični workbook][master]; v reportu so uporabljeni zgoraj navedeni
  konkretni razponi in formule. Gre za omejen aktualni odčitek, ne za preverjanje
  vseh zasebnih prvotnih sporočil ali celotne Drive version history.

[master]: https://docs.google.com/spreadsheets/d/1xmuX8CvUNIW60-TE9i2CzExy7Abo3wVjIMnhHhaX7B0/edit
[production-sl]: https://tekaski-koledar.si/moji-teki/
[production-en]: https://tekaski-koledar.si/en/my-races/
[phase-a-pr]: https://github.com/igorkalsek/stk-website/pull/235
[phase-a]: https://github.com/igorkalsek/stk-website/blob/c5f2a961c18717a53f0893b9f11addc2126e1ab6/docs/DEV-036_RACE_WATCH_LITE.md
[watch-code]: https://github.com/igorkalsek/stk-website/blob/c5f2a961c18717a53f0893b9f11addc2126e1ab6/src/utils-race-watch.ts
[saved-code]: https://github.com/igorkalsek/stk-website/blob/c5f2a961c18717a53f0893b9f11addc2126e1ab6/src/utils-saved-races.ts
[resolver-code]: https://github.com/igorkalsek/stk-website/blob/c5f2a961c18717a53f0893b9f11addc2126e1ab6/src/utils-my-races.ts
[dev033-api]: https://github.com/igorkalsek/stk-apps-scripts/pull/106
[dev033-web]: https://github.com/igorkalsek/stk-website/pull/230
[dev031-api]: https://github.com/igorkalsek/stk-apps-scripts/pull/100
[dev031-admin]: https://github.com/igorkalsek/stk-admin/pull/140
[incident-pr]: https://github.com/igorkalsek/stk-apps-scripts/pull/103
[admin-parser-pr]: https://github.com/igorkalsek/stk-admin/pull/141
[recent-code]: https://github.com/igorkalsek/stk-apps-scripts/blob/82e9ca7838fdf276beffb2571fa14926674044c6/projects/stk-content-api/Code.gs#L6370
[log-standard]: https://github.com/igorkalsek/stk-apps-scripts/blob/82e9ca7838fdf276beffb2571fa14926674044c6/projects/stk-content-api/CHANGE_LOG_STANDARD.md
[organizer-code]: https://github.com/igorkalsek/stk-apps-scripts/blob/82e9ca7838fdf276beffb2571fa14926674044c6/projects/stk-content-api/OrganizerAccess.gs
[organizer-doc]: https://github.com/igorkalsek/stk-apps-scripts/blob/82e9ca7838fdf276beffb2571fa14926674044c6/projects/stk-orodja/STK_OrganizerConfirmations.md
[worker-code]: https://github.com/igorkalsek/stk-apps-scripts/blob/82e9ca7838fdf276beffb2571fa14926674044c6/projects/stk-master-api/worker.js
[identity-audit-code]: https://github.com/igorkalsek/stk-apps-scripts/blob/82e9ca7838fdf276beffb2571fa14926674044c6/projects/stk-orodja/STK_IdentityAudit.js
[additional-matcher]: https://github.com/igorkalsek/stk-apps-scripts/blob/82e9ca7838fdf276beffb2571fa14926674044c6/projects/stk-orodja/STK_DodatniPodatki.js#L1315
[calendar-audit]: https://github.com/igorkalsek/stk-apps-scripts/blob/82e9ca7838fdf276beffb2571fa14926674044c6/projects/stk-gcal-sync/IDENTITY_AUDIT_2026-09-25.md
[admin-reconcile]: https://github.com/igorkalsek/stk-admin/blob/71604e2dd89701c9f8ed12c7b10a4fe0269d7af3/src/lib/stk-import-reconcile.ts
[admin-history]: https://github.com/igorkalsek/stk-admin/blob/71604e2dd89701c9f8ed12c7b10a4fe0269d7af3/src/lib/stk-verification-history.ts
