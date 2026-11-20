# STK – Simplification & Complexity Audit

**Datum pregleda: 20. 10. 2026, Europe/Ljubljana.**  
**Priporočilo: ohraniti uporabno jedro, ustaviti širjenje Race Watch infrastrukture in najprej zmanjšati tveganja pri uvozih ter razkorak med kodo in produkcijo.**

Pregled je bil izveden **READ-ONLY**. Kode, podatkov, vej, PR-jev, deploymentov in sprožilcev nisem spreminjal. Rebuilda nisem izvedel.

Oznake dokazov:

- **VERIFIED** – neposredno preverjena koda, GitHub stanje, analitični podatki ali lokalni test.
- **LIKELY** – sklep, podprt s kodo in razpoložljivimi podatki.
- **UNVERIFIED** – trenutnega produkcijskega stanja ali učinka ni bilo mogoče potrditi.

## A. Executive summary

1. **Največje dolgoročno tveganje je pravilnost identitete in izida zapisov.** Master vrstica, Website ID, organizatorski ID, družinski `race_id` in identiteta izvedbe niso zamenljivi. Uvozi, Additional, potrditve in koledarska sinhronizacija se povezujejo prek različnih pravil. DEV-043 je zato pomembnejši od kozmetičnega zmanjševanja kode. **VERIFIED za kodo; konkretni produkcijski incident je potrjen v backlogu, ne neodvisno ponovljen.** [Uvozna logika][imports], [inventar zapisovalcev][writers].

2. **Jedro STK ima izmerjeno uporabniško vrednost.** V zadnjih 30 zaključenih dneh je zabeleženih **1.078 klikov na razpise, 544 na prijave in 197 shranjevanj tekov**. Iskalnik, profili, uradne povezave in Moji teki zaslužijo prednost pred odstranjevanjem funkcij. **VERIFIED.**

3. **Race Watch Lite je smiselno ohraniti; polne infrastrukture trenutno ne nadaljevati.** Draft #109 dodaja 8.031 vrstic v 22 datotekah in ima pet odprtih P2. Velikost sama ni razlog za ustavitev: odločilni so nova transakcijska infrastruktura, migracija zapisovalcev, uredniška odgovornost za dokazila in še nedokazana dodatna korist. **VERIFIED za obseg in odprte pripombe; LIKELY za neugodno trenutno razmerje korist/strošek.** [Lite][lite], [Draft #109][pr109], [odločitveni pregled][gate].

4. **Najboljša tehnična poenostavitev je manj podvojenih odločitev.** Domači strani SL/EN podvajata veliko podatkovne in predstavitvene logike; družinska prijaznost ima različna pravila; homepage in Moj STK ločeno nalagata iste podatke. To povečuje možnost vsebinskih razlik in regresij. **VERIFIED.** [Domača stran][home], [družinska pravila][family-stats], [Moj STK][my-stk].

5. **Produkcijska evidenca potrebuje manjšo, vendar nujno ureditev.** DEV-031 je bil delno uveden iz še nezdruženega PR-ja; trenutni `main` Workerja zato ne predstavlja celotne dokumentirane produkcijske poti. Starejši NO-GO dokumenti in novejše potrditve ostajajo skupaj. To otežuje varen naslednji poseg. **VERIFIED za razhajanje kode in dokumentiranega rollouta; sveži runtime bindingi UNVERIFIED.** [Worker `main`][worker], [PR #100][pr100].

### Pregledano izhodišče

| Repozitorij | Aktualni pregledani `main` SHA |
|---|---|
| `stk-website` | `6182e0098d58be4099ffb29942369a9ea4da9302` |
| `stk-admin` | `71604e2dd89701c9f8ed12c7b10a4fe0269d7af3` |
| `stk-apps-scripts` | `7f6845c3e7a19a8c31fc76b66a94ad6d8fdb04b8` |

Website in Admin sta bila lokalno na drugih commitih, vendar se pregledana izvorna drevesa ujemajo z aktualnim oddaljenim `main`. Apps Scripts je bil pregledan na zgornjem oddaljenem SHA; lokalnih sprememb nisem uporabil kot dokaz produkcije.

**Vsi odprti PR-ji ob pregledu:**

| PR | Pregledani HEAD | Stanje in pomen |
|---|---|---|
| [Admin #140][pr140] | `364b57863b6f8aa5703998a91b2553d19b874cc3` | Draft; pripravljen v2 porabnik rokov, privzeta pogodba ostaja v1. |
| [Admin #141][pr141] | `493612674aeb83caced4a4ff671ce79ac57267be` | Draft; podpora `SUPERSEDED` in ohranitev semantike rokov v predogledu. |
| [Apps #100][pr100] | `d76a169e4fb41891076de57a216731e7d1fcff96` | Draft; širok DEV-031 paket. Del Worker/D2 je po novejših dokazilih uveden selektivno. |
| [Apps #103][pr103] | `306b07419d47f34b6564e6406b44292af8df307a` | Draft; omejeno zaprtje drugega, nadomeščenega incidenta. |
| [Apps #109][pr109] | `e61a75de545da09e5959686dcb33ac65a3ac0488` | Draft; sintetično registry jedro, pet odprtih P2. |

Website nima odprtih PR-jev. Pregledani so bili opisi, spremenjene datoteke in relevantni deli razlik oziroma izvorne kode.

Razvojni vir: [https://docs.google.com/spreadsheets/d/1B7fWHfu3ylDTEuU6vKG--riFQMRx7-URriHcuT8F4sc/edit](https://docs.google.com/spreadsheets/d/1B7fWHfu3ylDTEuU6vKG--riFQMRx7-URriHcuT8F4sc/edit)

**Omejitev produkcijskega pregleda:** neposredni HTTP dostop iz okolja je za Website, Admin in Worker vračal 403. Spletno orodje je vrnilo besedilni prikaz [domače strani](https://tekaski-koledar.si/) in [načrtovalnika 2027](https://tekaski-koledar.si/za-organizatorje/termini-2027/), vendar brez izvedbe interakcij. Prikaz iskalnika je bil označen kot starejši. To ne zadošča za svežo produkcijsko verifikacijo DOM, CSS, API-jev ali deployment SHA.

## B. Inventar funkcionalnosti

Kompleksnost vključuje kodo, podatkovne odvisnosti in operativno delo. Priporočila temeljijo na pregledani kodi in spodnji analitiki; produkcijska aktivacija je ločena omejitev izhodišča.

| Funkcija | Konkretna korist | Kompleksnost in podvajanje | Odločitev |
|---|---|---|---|
| Glavni iskalnik in profili | Najti ustrezen tek ter preveriti razpis in prijavo | Srednja; osnovni Master, Additional in neobvezna glasovalna obogatitev | **KEEP** |
| Hitri izbori in dodatni filtri | Hitro zožijo ponudbo | Deloma ponujajo isto kot ročni filtri; uporabljajo obstoječe podatke | **SIMPLIFY** predstavitev, ohraniti zmožnosti |
| Teki zame | Ponovna uporaba lokalnih preferenc | Srednja; isti seznam in filtri, brez novega backenda | **KEEP**, dodatni razvoj **MEASURE FIRST** |
| Izpostavljeni teki | Hiter izbor bližnjih dogodkov | Prekrivanje z Naslednjimi teki; lasten izbor in prikaz | **SIMPLIFY** skupno logiko kartic in izbora |
| Naslednji teki | Neposreden kronološki pregled | Deluje tudi iz statičnega HTML, nato se osveži | **KEEP** |
| Največ zanimanja | Drug način odkrivanja dogodkov | Ločen analitični vir, povezovanje z Masterjem, Pages relay | **KEEP / SIMPLIFY** podatkovno pot |
| Sveže spremembe | Pojasnijo, kaj je novega ali popravljeno | CHANGE_LOG klasifikacija in year/row povezovanje | **KEEP** |
| Moj STK na domači strani | Hiter dostop do osebnega načrta in sezone | Ponovi del sezone in ločeno pridobiva Master/Additional | **SIMPLIFY** v kompakten povzetek |
| Moji teki in statusi | Shranjevanje, načrtovanje, prijavljen/opravljen | Srednja; lokalna hramba, razreševanje referenc, koledarski izvoz | **KEEP** |
| Moja sezona, zemljevid in dosežki | Osebni pregled opravljenih tekov | Deljena lokalna osnova, a dodatni prikazi in pravila | **KEEP / MEASURE FIRST**; ostane sekundarni zavihek |
| Race Watch Lite | Povzetki sprememb in preverjeni roki za shranjene teke | Obstoječi API-ji, strogo omejena identiteta in pokritost | **KEEP** |
| Polni Race Watch | Sledenje izvedbi skozi premike, odpovedi in zgodovino | Zelo visoka; registri, revizije, dokazila, transakcije, migracije | **MEASURE FIRST**; nadaljevanje odložiti |
| Glasovani teki | Skupnostna preferenca, drugačna od zanimanja | `/top`, zunanji obrazci, registry in veriga formul | **MEASURE FIRST**, kandidat za **DEPRECATE** |
| Družinam prijazni teki | Pomembna nišna potreba staršev | Samostojen seznam in delno podvojeni filtri; različne definicije | **MERGE** izvedbo z iskalnikom, ohraniti vstopno stran in vsebino |
| Skupinski teki | Redna vadba in skupnost | Lasten podatkovni model, filtri in obrazec | **KEEP / SIMPLIFY**; ni enakovredno tekmovalnemu koledarju |
| Tekobot | Naravna vprašanja in usmerjanje | Website je predvsem povezava v zunanji ChatGPT; ločena odvisnost | **KEEP** kot dodatna pot; DEV-005 odložiti |
| Osebni koledar in sinhronizacija | Spremljanje STK v vsakdanjem koledarju | Backend sinhronizacija in naročnina | **KEEP** |
| Posamezni in skupinski `.ics` izvoz | Dodajanje izbranih dogodkov | Del iste koledarske koristi, vendar drugačen način uporabe | **KEEP / MERGE** skupne helperje |
| Organizatorske potrditve in poročila | Zaupanje v podatke ter uporabne povratne informacije | Visoka, vendar upravičena zaradi identitete, snapshotov in zasebnosti | **KEEP** |
| Termini 2027 in primerjava | Pregled sovpadanj za organizatorja | Obstoječi `/planning-2027`; brez nove baze ali endpointa | **KEEP** |
| Dodaj/popravilo teka | Prispevki in popravki podatkov | Javni obrazec, Turnstile, podpisani relay, ločeni intake in uredniški pregled | **KEEP** |

Viri izvedbe: [homepage][home], [iskalnik][finder], [Moji teki][my-races], [Lite][lite], [načrtovalnik][planning], [skupinski teki][groups], [koledar][calendar], [predlogi][proposals].

### Dejanska uporaba: 20. 9.–19. 10. 2026

**VERIFIED:** analiziranih je **23.099 zapisov** iz obstoječega `STK_SITE_EVENTS`. Vsota se natančno ujema z `DAILY_SUMMARY` za vseh 30 dni. Dan pregleda je izključen.

Brane so bile vrste dogodkov, poti strani, vrste akcij, strukturirani filtri in placementi. Iskalnih besedil, kontaktov in identifikatorjev obiskovalcev nisem analiziral.

| Meritev | Zabeleženo | Kaj podpira |
|---|---:|---|
| Ogledi profilov `event_detail_viewed` | 10.498 | Profili so pomemben del jedra. |
| Kliki na razpise | 1.078 | Ohranjanje jasnih uradnih povezav. |
| Kliki na prijave | 544 | Ohranjanje neposredne prijavne poti. |
| Iskalne akcije | 650 | Ohranjanje iskalnika in filtrov. |
| Iskanja brez rezultatov | 115 | Pregled praznih rezultatov pred dodajanjem filtrov. |
| Shranjevanja / odstranitve | 197 / 33 | Osebni načrt ima dokazano uporabo. |
| Ogledi Mojih tekov | 159 | Ohranjanje obstoječega načrta. |
| Ogledi sezone / dosežkov | 22 / 23 | Sekundarna funkcija; premalo za odstranitev. |
| Aktivacije preferenc / personalizirani prikazi | 12 / 47 | Omejen signal koristi, brez dokaza za širitev. |
| Koledarske akcije / skupinski `.ics` izvozi | 31 / 2 | Nišna uporaba; strošek odstranitve bi bil nesorazmeren. |
| Kliki na glasovanje | 5 | Kandidat za presojo postopnega umika. |
| Kliki Tekobota | 78 | Zunanja pot se uporablja; uspeh pogovora ni merjen. |
| Organizatorske akcije | 55 | Organizatorski tok ima uporabo. |

Analitični vir: [https://docs.google.com/spreadsheets/d/13mNMHdt_D-bmdIkK_llNM6-ez9clqJxj-ygvRq22Lms/edit](https://docs.google.com/spreadsheets/d/13mNMHdt_D-bmdIkK_llNM6-ez9clqJxj-ygvRq22Lms/edit)

Pomembne omejitve:

- To so **zabeleženi dogodki**, ne unikatni uporabniki, seje ali dejanske prijave.
- Skupnih obiskov ključnih strani ni mogoče nadomestiti s številom njihovih interakcij. Cloudflare prometni endpoint ni bil dostopen.
- `my_stk_viewed` ima 2.093 zapisov, vendar označuje prikaz komponente, tudi v praznem stanju. Ne dokazuje uporabe osebne nadzorne plošče.
- Pri homepage karticah je zabeleženih 135 klikov iz zanimanja, 77 iz naslednjih tekov, 54 iz sprememb in 34 iz izpostavljenih tekov. **To ni primerjava CTR:** izpostavljenost in čas uvedbe merjenja nista enaka.
- Race Watch Lite je bil združen šele **19. 10.** Tridesetdnevno okno njegove vrednosti še ne more oceniti; ločena Watch uporaba tudi ni merjena.
- Pogostost filtrov pomeni prisotnost v zabeleženem stanju, ne nujno števila zavestnih sprememb posameznega filtra.

Vir pomena dogodkov: [obstoječa analitična implementacija][analytics].

## C. Tehnični dolg – pet najpomembnejših področij

### 1. Uvozi in identitete: ista varnostna pravila morajo veljati na vseh poteh

**VERIFIED:** final importer že vsebuje fingerprint, operation ID, backup, read-back, preverjanje formul in recovery stanja. Te kontrole rešujejo dejanske nevarnosti in jih je treba ohraniti.

Pri posodobitvah se identiteta preverja tudi nad **končno združeno vrstico** in parnim indeksom. To samo po sebi ni dokaz, da je izbrana obstoječa ciljna vrstica pravi dogodek pred prepisom. DEV-043 izrecno opisuje napačen indeks ter zamaknjena polja. [Preverjanje identitete][import-identity], [final importer][final-import].

**Priporočilo – SIMPLIFY:** enotno opredeliti predpogoje ciljne identitete in sheme za obstoječe uvozne poti; najprej razjasniti konkretni incident. Ne graditi novega splošnega transakcijskega sistema kot rešitve prvega koraka.

Posebej:

- DEV-043 z operacijo `973f…` in Draft #103 z incidentom `5b2d…` sta **različna primera**.
- `WRITE_STARTED` ni dokaz uspeha, niti samodejen razlog za rollback.
- `SUPERSEDED` ni `COMMITTED`.
- Google Calendar, Additional in organizatorski podatki potrebujejo ohranitev svojih vezav in kontrol.

### 2. Razkorak med Gitom, selektivnimi rollouti in produkcijo

**VERIFIED:** trenutni Worker na `main` uporablja običajno Content vezavo. Draft #100 vsebuje posebno v2 usmerjanje in D2 paket, novejši backlog ter dokazila pa opisujejo njuno selektivno produkcijsko uvedbo. Website že vsebuje v2 porabnika za tri pregledane izvedbe. [Worker][worker], [PR #100][pr100], [Website v2][profile-deadlines].

**Priporočilo – SIMPLIFY:** v obstoječi evidenci vzdrževati eno aktualno vrstico na komponento:

`izvorni SHA/paket → aktivna različica → porabniki → rollback → datum dokaza`.

Vrednosti skrivnosti ne sodijo v to evidenco. Stare NO-GO zapise je treba označiti kot zgodovinske, kadar jih novejši dokaz nadomesti.

**UNVERIFIED:** današnji aktivni bindingi, immutable različice, ACL in sprožilci niso bili neodvisno preverjeni. Uspešen [rebuild workflow][rebuild] sam ne potrjuje končnega produkcijskega DOM.

### 3. Podvojena predstavitvena logika in različna družinska semantika

**VERIFIED:**

- SL/EN homepage imata približno 1.500 vrstic vsak.
- Profila SL/EN imata po 513 vrstic.
- Iskalnik že uporablja skupni controller in locale podatke, torej primer primerne obstoječe rešitve.
- Družinski seznam in mapper uporabljata izrecno oznako »družinam prijazno«.
- Statistika 2027 uporablja širše preverjanje konkretne družinske ponudbe.
- Content API statistika uporablja še širše podnize, tudi splošno »brezplačna prijava«. [Homepage][home], [finder][finder], [družinska statistika][family-stats], [Content klasifikacija][content-family].

**Priporočilo – MERGE:** najprej dogovoriti pomen družinske oznake in primerjalne primere; nato postopno deliti mapperje, kartice in nalaganje med jeziki ter vstopnimi stranmi.

Ne priporočam zamenjave vseh Astro strani z generičnim konfiguracijskim sistemom. Prav tako sprememba definicije družinske prijaznosti ni samo refaktor: lahko spremeni rezultate in številke.

### 4. DEV-036: razvoj infrastrukture je prehitel dokaz dodatne vrednosti

**VERIFIED:** B2a predlaga deset registry/operation/publication listov ter migracijo oziroma nadzor vseh relevantnih zapisovalcev. B2b je sintetični engine; ni produkcijski register in ne javni Watch API. [Fizični načrt][physical], [writer inventar][writers].

Na pregledanem HEAD Draft #109 ostaja pet odprtih P2:

1. Nova revizija lahko ne nadomesti prejšnje aktivne revizije.
2. Preklic pred prvo objavo lahko ustvari neveljavno časovno sled.
3. Uredniški popravek lahko pusti aktivno trditev, neskladno z novim snapshotom.
4. Potrditev tombstona ni nujno začetni dokaz njegove verige.
5. Nepopolna priprava operacije ni vedno vključena v zadržanje branja.

Pripombe se ujemajo s pregledanimi deli kode. V tem auditu jih nisem dodatno reproduciral z novimi testi. [Aktualni pregled PR-ja][pr109-review].

**Priporočilo – MEASURE FIRST:** ohraniti Lite, B2 nadaljevanje odložiti. Varnostnih pravil polnega sistema ni smiselno odstranjevati, da bi bil cenejši. Smiselno je trenutno ne prevzeti njegovega celotnega obsega.

### 5. Razpršeno nalaganje in več podatkovnih poti

**VERIFIED:**

- Homepage uporablja svoj pomnilniški cache, Moj STK pa ločene zahteve za Master in Additional.
- Ob spremembi shranjenih tekov se Moj STK ponovno inicializira in podatke znova pridobi.
- Iskalnik po Masterju ločeno naloži Additional in pri 2026 še `/top`.
- `interest-preview` uporablja neposredno, trdo zapisano Apps Script povezavo.
- Nekateri osnovni brskalniški GET-i nimajo časovne omejitve; Additional in v2 roki jo že imajo. [Homepage][home], [Moj STK][my-stk], [finder][finder], [interest relay][interest].

**Priporočilo – SIMPLIFY:** majhen skupni pomnilniški sloj za iste javne zahtevke med obiskom ter dosledna omejitev čakanja. Brez trajne hrambe. Ohraniti ločitev obveznih in neobveznih podatkov ter obstoječe umikanje poteklih dokazil.

Za zanimanje preveriti uporabo obstoječe Worker poti z isto pogodbo. Analitičnega ingest POST-a ne gre avtomatično vključiti v tak refaktor.

## D. Najboljših pet poenostavitev

Razvrstitev upošteva korist, tveganje in zahtevnost. XS pomeni majhen poseg, S omejen poseg, M več povezanih sprememb.

| # | Predlog in uporabniška korist | Kompleksnost ter pričakovani učinek | Tveganje / zahtevnost | Testi, odvisnosti in povrnitev |
|---|---|---|---|---|
| **1** | **Ohraniti Lite in odložiti polni Race Watch.** Obstoječa korist ostane. | Prepreči prevzem novih registrov, migracij in uredniških obveznosti. | Nizko; XS za odločitev in evidenco. Izguba je odložena prihodnja zmožnost. | Ohraniti Lite regresije; ne spreminjati backenda. Ponovno odprtje ob konkretnem dokazu potrebe. |
| **2** | **Združiti aktualno release/incident evidenco.** Hitrejši in varnejši naslednji posegi. | Manj ponovnih preflightov in napačnih predpostavk o uvedenih delih. | Nizko; S. Odvisno od dostopnih produkcijskih dokazov. | Ujemanje SHA/paketa, porabnika in rollbacka; zgodovino ohraniti. Povrnitev dokumentacijske spremembe. |
| **3** | **Odstraniti dokazano nedosegljive ostanke.** Manj zavajajočih poti za vzdrževalca. | Odstrani mrtvi glasovalni helper na homepage in neuporabljene notranje datoteke. | Nizko; XS–S. Pričakovan učinek na hitrost je majhen ali ničen. | Iskanje referenc, obstoječi home/SL/EN testi in build v prihodnji izvedbi; enostaven revert. |
| **4** | **Deliti javne zahteve homepage/Moj STK.** Manj čakanja in ponovnih zahtev. | Odpravi dejansko podvojene Master/Additional GET-e; poenoti transport. | Nizko–srednje; S–M. Nevarnost zastarelih odgovorov. | Prešteti zahteve, preveriti izpad, spremembo statusa, polnoč in potek dokazil. Povrnitev po porabniku. |
| **5** | **Postopno deliti SL/EN logiko ter družinski seznam z iskalnikom.** Doslednejši rezultati in manj regresij. | Zmanjša vzdrževanje vzporednih mapperjev, kartic in filtrov. | Srednje; M. Najprej mora biti dogovorjena družinska semantika. | Primerjalni rezultati obeh let/jezikov, družinski primeri in mobilni prikaz. Stari renderer do potrjene enakovrednosti. |

**DEV-043 je prednostna varnostna naloga pred izvedbo večjih refaktorjev.** Njegov namen je zanesljivost uvoza; ni ga primerno ocenjevati po zmanjšanju števila vrstic.

## E. Kandidati za odstranitev

### Dokazano smiselni, majhni kandidati

**REMOVE, po običajni regresijski kontroli:**

- `getTopUpcomingRaces` v obeh homepage datotekah: najdena je definicija brez klica. Aktivni prikaz zanimanja uporablja drug vir.
- `PlaceholderPage.astro`: v pregledanem repozitoriju ni porabnika.
- `utils-analytics.ts`: neuporabljen re-export ob obstoječi neposredni uporabi kanoničnega analitičnega modula.
- Neuporabljen `isRecentUpdatesEnabledForYear`, ki še izraža staro omejitev na 2026.

To je **vzdrževalni cleanup**, ne dokaz pomembnega zmanjšanja produkcijskega prenosa. Odvisnih helperjev ne odstranjevati samo zato, ker je ena vhodna funkcija mrtva. [Homepage][home], [stari letni helper][public-year].

### Pogojni kandidat: glasovalna funkcionalnost

**MEASURE FIRST → morebitni DEPRECATE.**

Pet zabeleženih klikov na glasovanje kaže malo aktivnosti, vendar ne dokazuje petih oddanih glasov ali neuporabnosti celotne zgodovine. Pred odločitvijo preveriti obstoječe dejanske odzive in vse porabnike `/top`.

Ločiti je treba:

1. umik povezave iz navigacije;
2. umik glasovalnih akcij in nepotrebnih obogatitev;
3. zaprtje sprejemanja novih glasov;
4. odstranitev kode, formul in podatkov.

Zadnja stopnja trenutno **nima dovolj dokazov**. `PUBLIC_LS`, `RACE_REGISTRY`, `LIKES_*` in drugi pogledi tvorijo povezano verigo. Starejši dependency audit je opozorilo, ne dovoljenje za današnje brisanje. [Dependency audit][sheet-audit].

**Za odstranitev ne priporočam:** CHANGE_LOG, uvoznih backupov, varnostnih kontrol, Additional podatkov, koledarske sinhronizacije, organizatorskih snapshotov ali poljubnega starega deploymenta brez svežega popisa porabnikov.

## F. Performance in reliability baseline

### Velikost prenosa

Produkcijskih datotek ni bilo mogoče neposredno prenesti. Pregledal sem **že obstoječi lokalni `dist` z dne 19. 10. ob približno 11:42 CEST**, nastal pred mergeom Lite. Njegov izvorni SHA ni dokazan.

| Lokalni artefakt | Zunanji JS, skupaj s statičnimi uvozi | Vsota lokalno gzipanih JS datotek |
|---|---:|---:|
| Domača stran | 109,3 kB | 41,9 kB |
| Iskalnik | 100,8 kB | 37,0 kB |
| Moji teki | 99,9 kB | 37,8 kB |

Skupni CSS v tem artefaktu: **112,0 kB**, lokalni gzip **20,6 kB**. HTML vsebuje še približno 5,2 kB inline skript.

**VERIFIED za ta lokalni artefakt; UNVERIFIED za aktualno produkcijo.** Gzip izračun ni meritev omrežnega prenosa, Brotli ali dejanskega cachea. Te številke ne upravičujejo menjave Astro ali uvedbe novega ogrodja.

### Zahtevki in interaktivnost

**VERIFIED iz aktualne kode:**

- Homepage uporablja šest različnih Worker GET poti ter same-origin `interest-preview`, brez analitičnih POST-ov in statičnih datotek.
- Moj STK pri shranjenih tekih doda ločene zahteve; njegov cache ni skupen homepage cacheu.
- Iskalnik 2026 najprej prikaže osnovni Master seznam, nato ločeno obogati Additional in glasovanje.
- Vnos iskanja ima 250 ms zamik pred ponovnim filtriranjem.
- Moji teki najprej izrišejo lokalne reference in statuse.
- Lite uporablja omejeni zahtevi in nima stalnega pollinga.

**LIKELY:** zmanjšanje podvojenih zahtevkov in dosledne časovne omejitve bosta koristnejša prva koraka kot agresivno razbijanje CSS. Dejanski prihranek latence ostaja neizmerjen.

### Build in objava

- Dokumentirano preverjanje Lite navaja **661 strani, build 16,87 s**, predhodno 18,98 s. To so zgodovinske lokalne meritve, ne današnja ponovitev. [Poročilo Lite][lite].
- Aktualna koda združuje build zahteve prek pomnilniških obljub in prepreči objavo brez obveznih profilov. To je koristna zaščita. [Build podatki][build-data].
- Master ima do pet poskusov po 15 sekund ter vmesne zamike: samo ta faza lahko ob izpadu traja približno 90 sekund.
- Playwright konfiguracija sproži build pred previewjem. Zato današnjih browser testov nisem zagnal, saj je zahteva izrecno prepovedala rebuild.

### Testi, uporabniški prikaz in terenske metrike

**Sveže lokalno preverjeno:** **133/133 testov PASS** za Race Watch pogodbo, robne pogoje, pokritost in združljivost lokalnih statusov. Uporabljeni obstoječi prevedeni modul shranjenih tekov je bil dodatno preverjen kot enak trenutnemu izvornemu modulu. Brez produkcijskih zapisov.

**Obstoječi dokazi:** mobilni/namizni SL/EN pregledi pri prejšnjih spremembah, med drugim 390–1440 px, so dokumentirani. To niso današnji produkcijski testi. [UX dokazila][ux].

**UNVERIFIED:** aktualni LCP, INP, CLS, produkcijska latenca API-jev, Safari/iPhone in današnji vizualni prikaz. Dostop do Cloudflare metrik ni uspel; nadomestnih številk ne podajam.

### Upravičena varnostna kompleksnost

Ohraniti:

- Turnstile, podpisovanje in preverjanje izvora javnih predlogov;
- zasebni strežniški dostop do organizatorskih podatkov;
- snapshot ter hash preverjanje potrditve;
- operation ID, request hash, backup, read-back in pogojni rollback;
- zavrnitev dvoumne identitete ter poteklih dokazil;
- nevtralni prikaz ob odsotnosti preverjene semantike.

Dvojna kontrola na odjemalcu in strežniku ni samodejno nepotrebno podvajanje.

## G. Predlagani razvojni načrt

### Faza 1 – Utrditi pravilnost in trenutno stanje

Minimalni obseg:

- DEV-043: read-only razjasnitev izida konkretne operacije in nato omejeni, dokazano potrebni guardi.
- Uskladitev evidence selektivnega DEV-031 rollouta.
- Ohranitev blokade polnega DEV-036.
- Razjasnitev neskladja dokazil: starejši DEV-031/Lite viri navajajo veljavnost do **22. 10.**, DEV-036 zapis pa do **26. 10.** Brez aktualnega API/uradnega dokaza ni mogoče določiti današnje veljavnosti.

**Uspeh:** noben neznan izid ni označen kot uspeh; spornih staging vrstic ni mogoče uporabiti; uvedene komponente in rollback so nedvoumno navedeni.

### Faza 2 – Odstraniti majhne ostanke in podvojene zahteve

Minimalni obseg:

- dokazano mrtvi helperji in datoteke;
- skupne Master/Additional zahteve med homepage in Moj STK;
- dosledna omejitev čakanja ob ohranjenih fallbackih.

**Uspeh:** isti zahtevek se med obiskom ne podvaja brez razloga; SL/EN, shranjeni statusi, koledarski izvozi in potek dokazil ostanejo pravilni.

### Faza 3 – Združevati samo ob dokazani enakovrednosti

Minimalni obseg:

- skupna homepage logika;
- dogovorjena družinska semantika in deljena izvedba z iskalnikom;
- odločitev o glasovanju na podlagi obstoječih podatkov;
- polni Race Watch ponovno odpreti samo ob konkretni potrebi, ki je Lite ne rešuje.

**Uspeh:** manj vzporednih pravil in podatkovnih poti ob ohranjeni uporabniški vrednosti. Brez nove baze, računov, telemetrije ali dodatnega API-ja kot stranskega učinka refaktorja.

## H. Priporočilo za DEV_BACKLOG

Backlog že vsebuje dobro pravilo preverjanja produkcije, `main`, PR-jev in obstoječih funkcij. Potrebna je majhna dopolnitev obstoječih stolpcev, ne nov sistem.

**Pred `READY` naj bo v predlagani rešitvi odgovorjenih pet kratkih vprašanj:**

1. Kateri konkreten problem in kateri dokaz uporabe rešujemo?
2. Ali ga lahko rešimo z obstoječo funkcijo?
3. Katere nove trajne obveznosti nastanejo: endpoint, deployment, list, trigger ali ročni postopek?
4. Kaj bomo združili ali umaknili?
5. Kateri je najmanjši sprejemljiv rezultat, test in način povrnitve?

Konkretne spremembe:

| Naloga | Minimalni predlog |
|---|---|
| **DEV-005** | Status `READY` uskladiti z izrecnim odlogom v naslednjem koraku. Vgrajenega AI/TTS ne začeti na podlagi same oznake READY. |
| **DEV-031** | Ohraniti DONE za doseženi Website obseg. Jasno zapisati ločen status neaktiviranih Admin/Content porabnikov in selektivno uvedenega paketa. |
| **DEV-036** | Ohraniti BLOCKED za nadaljevanje; Phase A/Lite navesti kot zaključeno. Privzeta odločitev: ohraniti Lite in odložiti B2. |
| **DEV-043** | Prednost pred funkcionalnimi razširitvami. Ločiti ugotovitev izida incidenta od splošnih uvoznih izboljšav. |
| **DEV-029 / DEV-039** | Ohraniti razliko med produkcijsko verifikacijo osnovnega popravka in opcijskim robnim UI popravkom; izvedbo slednjega združiti z naslednjim ustreznim posegom. |
| **DEV-024 / DEV-025 / DEV-042** | Pred razvojem preveriti ponovno uporabo obstoječega organizatorskega toka. DEV-042 ne sme postati splošni bypass potrjevanja. |
| **DEV-034 / DEV-037** | Ohraniti ročni pilotni pristop; brez infrastrukture pred dokazanim povprašševanjem. |

Pri zaključevanju zadostuje dopolnitev obstoječe opombe:

> **Koda:** merged/nezdružena. **Produkcija:** preverjena/nepreverjena. **Preostanek:** povezani PR ali operativna obveznost.

Tako DONE ne bo pomotoma pomenil, da so vsi povezani osnutki že uvedeni, odprt Draft pa ne bo razlog za nadaljevanje razvoja sam po sebi.

**Audit je zaključen. Implementacije nisem začel.**

[home]: https://github.com/igorkalsek/stk-website/blob/6182e0098d58be4099ffb29942369a9ea4da9302/src/pages/index.astro
[finder]: https://github.com/igorkalsek/stk-website/blob/6182e0098d58be4099ffb29942369a9ea4da9302/src/finder/race-finder-controller.ts
[my-stk]: https://github.com/igorkalsek/stk-website/blob/6182e0098d58be4099ffb29942369a9ea4da9302/src/my-stk-client.ts
[my-races]: https://github.com/igorkalsek/stk-website/blob/6182e0098d58be4099ffb29942369a9ea4da9302/src/my-races-client.ts
[family-stats]: https://github.com/igorkalsek/stk-website/blob/6182e0098d58be4099ffb29942369a9ea4da9302/src/utils-home-stats.ts
[analytics]: https://github.com/igorkalsek/stk-website/blob/6182e0098d58be4099ffb29942369a9ea4da9302/src/lib/stkAnalytics.ts
[lite]: https://github.com/igorkalsek/stk-website/blob/6182e0098d58be4099ffb29942369a9ea4da9302/docs/DEV-036_RACE_WATCH_LITE.md
[planning]: https://github.com/igorkalsek/stk-website/blob/6182e0098d58be4099ffb29942369a9ea4da9302/docs/DEV-035_TERM_RADAR_2027.md
[groups]: https://github.com/igorkalsek/stk-website/blob/6182e0098d58be4099ffb29942369a9ea4da9302/src/components/GroupRunsSection.astro
[calendar]: https://github.com/igorkalsek/stk-website/blob/6182e0098d58be4099ffb29942369a9ea4da9302/src/utils-calendar.ts
[proposals]: https://github.com/igorkalsek/stk-website/blob/6182e0098d58be4099ffb29942369a9ea4da9302/functions/api/proposals.ts
[profile-deadlines]: https://github.com/igorkalsek/stk-website/blob/6182e0098d58be4099ffb29942369a9ea4da9302/src/profile-deadline-v2.ts
[public-year]: https://github.com/igorkalsek/stk-website/blob/6182e0098d58be4099ffb29942369a9ea4da9302/src/utils-public-year.ts
[interest]: https://github.com/igorkalsek/stk-website/blob/6182e0098d58be4099ffb29942369a9ea4da9302/functions/api/interest-preview.ts
[build-data]: https://github.com/igorkalsek/stk-website/blob/6182e0098d58be4099ffb29942369a9ea4da9302/src/utils-build-data.ts
[ux]: https://github.com/igorkalsek/stk-website/blob/6182e0098d58be4099ffb29942369a9ea4da9302/docs/UX_CLEANUP_2026-10-17.md
[rebuild]: https://github.com/igorkalsek/stk-website/actions/runs/39377828805
[imports]: https://github.com/igorkalsek/stk-apps-scripts/blob/7f6845c3e7a19a8c31fc76b66a94ad6d8fdb04b8/projects/stk-orodja/STK_Admin_Uvoz.js
[import-identity]: https://github.com/igorkalsek/stk-apps-scripts/blob/7f6845c3e7a19a8c31fc76b66a94ad6d8fdb04b8/projects/stk-orodja/STK_Admin_Uvoz.js#L465
[final-import]: https://github.com/igorkalsek/stk-apps-scripts/blob/7f6845c3e7a19a8c31fc76b66a94ad6d8fdb04b8/projects/stk-orodja/STK_FinalImport.js
[worker]: https://github.com/igorkalsek/stk-apps-scripts/blob/7f6845c3e7a19a8c31fc76b66a94ad6d8fdb04b8/projects/stk-master-api/worker.js
[content-family]: https://github.com/igorkalsek/stk-apps-scripts/blob/7f6845c3e7a19a8c31fc76b66a94ad6d8fdb04b8/projects/stk-content-api/Code.gs#L7143
[writers]: https://github.com/igorkalsek/stk-apps-scripts/blob/7f6845c3e7a19a8c31fc76b66a94ad6d8fdb04b8/docs/DEV-036_B2A_WRITER_INVENTORY.md
[physical]: https://github.com/igorkalsek/stk-apps-scripts/blob/7f6845c3e7a19a8c31fc76b66a94ad6d8fdb04b8/docs/DEV-036_B2A_REGISTRY_PHYSICAL_DESIGN.md
[gate]: https://github.com/igorkalsek/stk-apps-scripts/blob/7f6845c3e7a19a8c31fc76b66a94ad6d8fdb04b8/docs/DEV-036_B2A_DECISION_GATE.md
[sheet-audit]: https://github.com/igorkalsek/stk-apps-scripts/blob/7f6845c3e7a19a8c31fc76b66a94ad6d8fdb04b8/docs/STK_SHEET_DEPENDENCY_AUDIT.md
[pr100]: https://github.com/igorkalsek/stk-apps-scripts/pull/100
[pr103]: https://github.com/igorkalsek/stk-apps-scripts/pull/103
[pr109]: https://github.com/igorkalsek/stk-apps-scripts/pull/109
[pr109-review]: https://github.com/igorkalsek/stk-apps-scripts/pull/109#discussion_r4326691214
[pr140]: https://github.com/igorkalsek/stk-admin/pull/140
[pr141]: https://github.com/igorkalsek/stk-admin/pull/141