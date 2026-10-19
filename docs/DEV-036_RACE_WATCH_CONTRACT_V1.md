# DEV-036 B0 — Race Watch podatkovni contract v1

**Status: specifikacija za pregled; B0 ne pomeni odobritve migracije ali uvedbe.**
Datum: 19. 10. 2026. Verzija javnega contracta: `1.0.0`.

Dokončano: primerjava arhitektur, strojno berljive sheme, pravila identitete,
dokazil, zgodovine in napak, sintetični primeri ter avtomatizirana preverjanja.
Odprte odločitve in izvedbeni koraki so v [migracijskem načrtu](DEV-036_B0_MIGRATION_AND_DECISIONS.md).
Noben predlagani list, stolpec, endpoint, validator v runtime ali prehod lokalnih
identitet s tem PR ni ustvarjen. Vsa nova izvršljiva logika je pod `tests/`.

## 1. Preflight in podlaga

Prebrana sta obstoječa lokalna [Phase B analiza](DEV-036_PHASE_B_IDENTITY_AND_VERIFIED_CHANGES.md)
in njen [preflight](evidence/dev036-phase-b/preflight.json), brez sprememb vsebine.
Njuna SHA-256 sta v [novem B0 dokazilu](evidence/dev036-b0/preflight.json).
Vhodni datoteki sta bili sprva neversionirani; v ta PR sta vključeni za ponovljiv
pregled. Drugi predhodno neversionirani dokumenti niso del spremembe.
Prebrana sta tudi [Race Watch Lite](DEV-036_RACE_WATCH_LITE.md) in
[zaključeni PR #235](https://github.com/igorkalsek/stk-website/pull/235).

Sveže preverjeni `main`:

| Repo | SHA | Odprti PR-ji ob začetku B0 |
| --- | --- | --- |
| stk-website | `c5f2a961c18717a53f0893b9f11addc2126e1ab6` | noben |
| stk-apps-scripts | `82e9ca7838fdf276beffb2571fa14926674044c6` | Draft #100, #103 |
| stk-admin | `71604e2dd89701c9f8ed12c7b10a4fe0269d7af3` | Draft #140, #141 |

Website veja je ustvarjena iz tega `origin/main`; starejši lokalni `main` ni bil
resetiran. Pregled drugih repozitorijev uporablja pripete arhive v `/tmp`.
Website `AGENTS.md` je prebran in nespremenjen. Admin `AGENTS.md` zahteva posebno
odobritev sprememb sheme/API in podatkovnih zapisov; tu gre samo za specifikacijo
v Website. Apps Scripts pripeti arhiv nima `AGENTS.md`.

Sveži GET-i 19. 10. okoli 14:13–14:18 CEST: oba javna Master odgovora HTTP 200,
303/36 zapisov, obstoječi stolpci; SL/EN Moji teki HTTP 200; v2 roki HTTP 200,
tri izvedbe z datumskim, ne opaque `edition_id`. Recent prvič timeout 25 s,
ena omejena ponovitev HTTP 200, 14 NEW + 1 CONFIRMED + 10 UPDATED.
To so ločeni dokazi od Git stanja. Aktivni Apps Script source/version in Worker
bindingi niso bili pregledani. Ni podlage za enačenje `main` z uvedenim runtime.

B0 ne bere Sheets neposredno. Število/glave `RACE_REGISTRY`, formule `PUBLIC_LS`
in zgodovinski Master/CHANGE_LOG primeri so **ugotovitve predhodne Phase B
analize**, ne nov odčitek v B0. Pred migracijo zahtevajo novo read-only preveritev.
Preflight vsebuje samo metapodatke in povzetke javnih odčitkov. Testni payloadi
so ločeni in v celoti sintetični; produkcijski odzivi niso testne fixture.

## 2. Arhitekturna odločitev za odobritev

**Priporočilo C: kanonični `edition_id` živi v trajnem Sheets registru
`RACE_EDITIONS`; poznejša nadzorovana povezava v Masterju je tuji ključ.**
Register ohrani izvedbo tudi po izbrisu Master vrstice. `race_id` še naprej
pripada družini v obstoječem `RACE_REGISTRY`. `RACE_REVISIONS` hrani potrjene
pomembne spremembe. To so predlagane evidence v obstoječih kanoničnih Sheets,
ne Website baza ali dodatna uporabniška hramba.

Oznake A/B/C spodaj sledijo zahtevi B0. Phase B je svoj hibrid imenoval »A«, pod
»C« pa opisal obsežnejši event-sourcing model. Priporočeni hibrid nadaljuje njeno
priporočilo; tukaj ne predlagamo rekonstrukcije celotnega Masterja iz dnevnika.

| Možnost | Koristi | Omejitve in odločitev |
| --- | --- | --- |
| A. Dodaten stolpec v Masterju kot glavna lokacija ID | Preprost neposreden join, preživi spremembo datuma v isti celotni vrstici | Sam ne preživi izbrisa, ne hrani aliasov in ne prepreči kopije ID; nujen je še register. Danes ni varno samo dodati stolpca. Ne izberemo kot samostojne rešitve. |
| B. Ločen kanonični registry brez Master povezave | Ohrani sedanji Master, podpira tombstone in ročno pregledan omejen pilot | Vsak premik potrebuje pregledano vezavo z generacijo. Nedokumentirana ponovna uporaba iste vrstice z istimi vrednostmi je lahko nezaznavna. Sprejemljivo samo za nadzorovan pilot; sicer NO-GO. |
| C. Registry + povezava v Master | Registry je avtoriteta, Master omogoča kontrolno povezavo; dokazani MOVE in aliasi ohranijo zgodovino | Potrebna ločena odobrena migracija tehnične povezave in vseh writerjev. Izbrani ciljni model; predpogoj objave so globalne kontrole, ne zgolj stolpec. |

### Ali je literalni ID v Masterju varen in zaželen?

**Zaželen kot nadzorovana povezava v ciljnem modelu; trenutno ni dokazana njegova
varnost za vnos.** Vsebinski contract ima 15 polj A:O, sledilna polja so P:R.
`STK_Admin_Uvoz.js` definira natanko ta polja, bere 18 celic in uporablja
`row.slice(0,15)`. `STK_Admin_ImportWriteExecutor.js` serializira samo
`STK_ADMIN_MASTER_COLUMNS_`. `STK_Admin_ImportWriteValidator.js` ima allowlist
teh polj. `STK_YearSetup.js` pričakuje vsebinske in sledilne glave.
Dodajanje ID med A:O ali P:R bi spremenilo obstoječe obsege in importer contract.
Dodajanje za R samo po sebi ne zagotovi, da se ID premika skupaj z vsebino.

Predhodna Phase B preveritev ugotavlja, da `PUBLIC_LS.edition_id` nastane iz
`race_id|datum` in family lookup uporablja normaliziran naziv/kraj. To ostane
legacy identiteta za obstoječe porabnike. Novega ID ne smemo pridobiti s to formulo
ali preimenovati sedanjega polja. RACE_REGISTRY ne vsebuje izvedb ali generacij.
Worker je projekcija in proxy; med GET ne sme dodeljevati identitet.

Ločena migracijska odločitev mora določiti dejanski prosti tehnični stolpec
**zunaj A:R po novem auditu vrednosti in formul obeh let**. Ne rezerviramo S na
slepo in ne spreminjamo širine 15-poljne TSV pogodbe. Registry dodeli literalni
ID, Master ga referencira. Kopiranje v naslednjo izvedbo zahteva nov ID;
UPDATE iste izvedbe ga ohrani. Delni sort, kolizija ali manjkajoč bridge pomenijo
REVIEW in zadržanje objave. Vsi writerji, ročne poti, letni setup ter recovery
potrebujejo pregled, preden je to dovoljeno v produkciji.

## 3. Strojno berljiv contract in konvencije

[Sheme v1](contracts/race-watch/v1/) uporabljajo JSON Schema 2020-12 in lokalne
`urn:stk:race-watch:v1:*` identifikatorje; validator jih naloži skupaj, brez
omrežnega razreševanja `$ref`:

| Datoteka | Vsebina |
| --- | --- |
| [common.schema.json](contracts/race-watch/v1/common.schema.json) | ID-ji, datum/UTC čas, vir, locator, vezava in alias |
| [edition-identity.schema.json](contracts/race-watch/v1/edition-identity.schema.json) | javna trajna identiteta izvedbe |
| [verified-change.schema.json](contracts/race-watch/v1/verified-change.schema.json) | ena potrjena pomembna sprememba polja |
| [race-watch-response.schema.json](contracts/race-watch/v1/race-watch-response.schema.json) | celoten javni odgovor, delna razpoložljivost in napake |

Vsi deklarirani ključi so **obvezni**. Nobenega polja ni dovoljeno izpustiti.
Podatkovno opcijske vrednosti so eksplicitni `null`: `race_id`, datum/ura/kraj
javnega posnetka, trenutna Master lokacija, meja zgodovine, čas uradne objave,
čas učinkovanja, supersedes in preklic. `error:null` pomeni brez napake.
Neznana polja so zavrnjena (`additionalProperties:false`), tudi zasebna polja.
Neznana verzija ali enum se ne prevede v potrjen signal. Razširitev take sheme
zahteva nov dogovor verzije, ne tihega dodajanja polj pod `1.0.0`.

Datumi so veljavni gregorijanski `YYYY-MM-DD`; dogodkovni datum je civilni datum
v `Europe/Ljubljana`. Vsi timestampi so UTC RFC3339 z `Z`, največ milisekunde;
leap second ni dovoljen. Ura je `HH:mm`. Potrošnik mora omogočiti preverjanje
`format`, ne zgolj tipa string. Javni viri zahtevajo absolutni HTTPS URL brez
uporabniškega imena/gesla; URL se nikoli ne izvede kot HTML ali koda.

Shema preverja strukturo in tipe. [Izvršljiva specifikacija](../tests/contracts/race-watch/validate.mjs)
preverja še povezave, globalne kolizije v posnetku, idempotentnost, vrstni red,
časovna pravila in zadržanje dvoumnosti. Prihodnji producer mora ista pravila
preveriti nad **celotnim kanoničnim registrom**, tudi čez neizbrana leta; odgovor
za eno leto sam ne more dokazati odsotnosti kolizije v neprebranem delu registra.
Testni validator ni produkcijski resolver, API handler ali writer.

## 4. Edition identity

| Polje | Pomen in invarianta |
| --- | --- |
| `edition_id` | Opaque `ed_<lowercase UUIDv4>`, enkrat dodeljen v registryju; nikoli formula, vrstica, datum, family ID ali hash vsebine. Nikoli se ne reciklira ali spremeni. |
| `race_id` | Obstoječi `Rdddddd` za družino ali null do izrecnega pregleda. Family+leto ne določa izvedbe. |
| `edition_year` | Prvotna sezona, nespremenljiva tudi ob dokazani prestavitvi čez novo leto. Novo leto izvedbe iz javnega datuma je izpeljan prikaz, ne novi ID. |
| `canonical_status` | `scheduled`, `postponed`, `cancelled`, `completed`, `unknown`: zadnje kanonično znano stanje. To polje samo ne dokazuje aktualnosti. |
| `identity_status` | `verified`, `review`, `conflict`. Zadnji dve stanji nikoli ne dovolita aktivne potrjene spremembe. |
| `watch_publication` | `previously_public` ali `approved_public`: izrecna javna upravičenost do Watch projekcije. Skriti neuradni predlogi ne pridejo samodejno v javnost. |
| `public_snapshot` | Odobren javni naslov, nullable datum/kraj/ura in fiksni timezone; brez internih opomb ali kontaktov. Pri dogodkovni aktivni reviziji je prizadeto polje skladno z `after`. |
| `current_master` | Nullable dokazljiva trenutna vezava. null ni odpoved, temveč odsotnost trenutne fizične lokacije. |
| `previous_master` | Vse dokazljive prejšnje vezave; ob izbrisu se zadnja vezava zapre in ostane tu. |
| `aliases` | Izrecno pregledani legacy ključi; ne avtomatski matcher. |
| `history_complete_since` | Nullable UTC meja popolne zgodovine v odobrenem Watch obsegu; ni trditev o času nastanka teka. |

Vezava ima opaque `binding_id`, locator `{sheet,row,generation}`, časovno okno
`[valid_from,valid_to)` in dokaz `reviewed_same_edition` z javnim virom in časom
pregleda. Trenutna vezava ima `valid_to:null`, prejšnje končni čas. Row je celo
število >=2, sheet je letni namespace. Ponovna uporaba iste fizične lokacije
zahteva večjo generacijo. Intervali vseh vezav iste izvedbe se ne smejo
prekrivati niti med različnimi vrsticami ali letnimi listi, tudi med dvema
prejšnjima vezavama. Stik konca ene in začetka druge vezave je dovoljen zaradi
izključne zgornje meje; dovoljene so tudi vrzeli. Poleg tega ostane obvezna
globalna kontrola zasedenosti iste fizične lokacije med izvedbami. En `binding_id` in ena
trenutna lokacija ne smeta pripadati več izvedbam. Časi vezave lahko opisujejo
pregledano zgodovino pred kasnejšim časom pregleda. Če starega časa ni mogoče
zanesljivo potrditi, take vezave ne označimo kot unique; primer ostane REVIEW.

Alias ima `namespace`, `year`, `key`, `saved_date`, `binding_id`, `resolution`
(`unique|ambiguous|conflict`) in nullable dokaz. Unique zahteva dokaz, obstoječo
vezavo iste izvedbe in skladno leto. Podprti namespaces:

- `master_locator`: decimalna vrstica, npr. sintetično `800`;
- `website_event_id`: row-based mali `r`, npr. `r000800`;
- `organizer_event_id`: row-based veliki `R`; nikoli samodejni family ID;
- `legacy_edition_key`: stari `Rdddddd|YYYY-MM-DD`, ne novi edition ID.

Identitetna tuple za legacy razrešitev je
`(namespace,year,key,saved_date)`; generacija je dodatna kanonična zaščita,
**ni podatek, ki bi ga imel V2 uporabnik**. V2 nima `saved_at`. Če tuple skozi
zgodovino pripada dvema izvedbama, ostane dvoumna tudi ob neprekrivajočih se
intervalih in četudi je danes samo ena vrstica. Nikoli ne izberemo novejše.
Alias ne nastane iz podobnega naziva, kraja, datuma, vrstice ali case pretvorbe.
Enoličnost vezave je globalna; pomanjkljiv pregled preteklosti pomeni REVIEW.

Pri spremembi datuma v isti vrstici ostane ID, dodata se dokazani alias starega
in novega datuma. Pri MOVE se zapre stara vezava, z novim `binding_id` se odpre
nova in ohranita oba aliasa iste izvedbe. Bridge je dokaz iste izvedbe v obeh
vezavah, ne samo enako ime. Premik sam ni pomembna sprememba za uporabnika.
Fizični izbris ne izbriše registry zapisa, zadnjega odobrenega posnetka ali revizij.
Dve izvedbi iste družine, tudi istega leta, dobita različna ID-ja.

## 5. Verified change

| Polje | Pravilo |
| --- | --- |
| `revision_id` | Opaque `rv_<UUIDv4>`, trajen ID semantične spremembe, ne CHANGE_LOG vrstica. |
| `edition_id`, `sequence` | Exact izvedba in pozitivna per-edition javna sekvenca; enolična, naraščajoča. |
| `change_set_id` | Opaque `cs_<UUIDv4>` potrjene operacije; več polj iste operacije ima isti change set in različne revision ID-je. |
| `change_type`, `field` | Strogo dovoljene kombinacije spodaj; brez generičnega `other`. |
| `scope` | `{kind:event,route_id:null}` ali `{kind:route,route_id:<pregledan trajni ključ trase>}`. Datum in odpoved sta samo event scope. |
| `before`, `after` | Tipizirani vrednosti istega polja/scope, dejansko različni; prej mora biti znano. |
| `official_source` | Javni varni URL, vrsta in `authority_basis`: zakaj je vir pristojen za to izvedbo in trditev. HTTP 200 ali domena sama ne zadoščata. |
| `source_published_at` | Uradni čas objave, null če ni znan; nikoli izmišljen iz časa vnosa. |
| `confirmed_at` | Čas izrecne uredniške potrditve pomena uradnega dokaza za točno izvedbo. |
| `verified_at`, `valid_until` | Zadnja izrecna ponovna preveritev in izključna zgornja meja aktualnega dokazila. |
| `recorded_at`, `published_at` | Prvi kanonični zapis in prva javna objava revizije; naknadna verifikacija ju ne spreminja. |
| `effective_at` | Kdaj sprememba učinkuje, če je to uradno znano; lahko prihodnji čas ali null. |
| `evidence_state` | `active|expired|superseded|retracted|conflict`; samo active lahko ustvari aktualen konkreten signal. |
| `supersedes_revision_id` | Null ali starejša javno ohranjena revizija iste izvedbe, polja in scope. Brez ciklov ali manjkajočega predhodnika. |
| `retracted_at` | Obvezen timestamp pri retracted, sicer null; razlog in avtor ostaneta v internem auditu. |

| Tip | Polje | Pred/po in potreben dokaz |
| --- | --- | --- |
| `rescheduled` | `date` | znani prejšnji datum → novi datum ali null; izrecen dokaz prestavitve iste izvedbe. null pomeni novi datum še ni potrjen in status postponed. |
| `cancelled` | `status` | scheduled ali postponed → cancelled; izrecna uradna odpoved. Izginotje, NE ali izbris niso dokaz. |
| `time_changed` | `start_time` | znani HH:mm → drugačen HH:mm istega starta/scope; prvi znani čas ni sprememba. |
| `venue_changed` | `venue` | znani kraj/prizorišče → drug znani kraj istega scope; kozmetični popravek imena ni selitev. |

Aktivna revizija `rescheduled` z `after:null` zahteva hkrati
`public_snapshot.date:null` in `canonical_status:postponed`; kombinacija s
`scheduled` ali drugim statusom je neveljavna. To pravilo velja za aktualno
aktivno trditev. Pretekla expired/retracted prestavitev sama ne določa današnjega
statusa in ostane ohranjena v zgodovini.

Popravek podatkovne napake, dopolnitev ali običajen UPDATED se v v1 ne objavi kot
en izmed teh štirih tipov. Cena, rok prijave, razdalja in poljubno prosto besedilo
niso dodatni tipi. Za traso je potreben pregledan ključ; poljubni naziv trase ne
ustvari identitete. Splošni organizer badge ali nepreverjeni INBOX nista dokaz.
Zasebna izrecna potrditev potrebuje odobren javni povzetek
`public_confirmation_summary` in varno povezavo; original in kontakti ostanejo
zasebni. Če tega ni, se konkretna sprememba zadrži.

`confirmed_at <= recorded_at <= published_at <= generated_at`,
`confirmed_at <= verified_at <= generated_at`, `verified_at < valid_until`.
Znan čas uradne objave ni poznejši od potrditve. Reverification sme biti po prvi
javni objavi. Urednik mora potrditi before/after, exact izvedbo, pomen in scope;
sama schema ne more dokazati resničnosti navedb na viru. Novi čas GET ali zadnja
sprememba Master celice teh potrditev ne nadomestita.

### Deduplikacija, spremembe dokazila in konflikt

Kanonični ključ idempotentnosti je
`(edition_id,change_set_id,field,scope.kind,scope.route_id)`. Ponovitev istega
potrjenega zapisa mora vrniti isti revision ID. Isto ID in ista vsebina je en
zapis; exact transportni replay se pri branju združi. Producer praviloma vrne
en primerek. Isto ID z drugo vsebino ali ista operacija z drugim ID pomenita
contract konflikt in nobenega potrjenega signala iz neveljavnega posnetka.
Različni neodvisni operaciji imata različna change seta, tudi če se vrednost
kasneje vrne na prejšnjo. Isti JSON z drugačnim vrstnim redom ključev ni konflikt.

Javni vrstni red je `edition_id` leksikografsko, nato `sequence` naraščajoče,
ne čas prejema, datum vira ali vrstica. Sekvence so brez vrzeli znotraj vrnjenega
ohranjenega obsega; prvi znani sequence sme biti >1 samo ob deklarirani meji
nepopolne starejše zgodovine. Globalnega vrstnega reda med izvedbami ni.
Popravki semantične trditve so nove revizije z večjim sequence in eksplicitnim
supersedes; predhodnik ostane. Aktualni active je samo zadnja nesporna revizija
za polje/scope. Višji sequence sam ne razreši dveh nasprotujočih si uradnih virov:
oba ostaneta conflict do izrecne razjasnitve. Umik ni ponovna vzpostavitev dogodka.

Semantično jedro revizije se ne prepisuje. Izjema javnega prikaza so izpeljano
stanje dokazila in reference na zadnji odobren dokaz. Ponovna preveritev iste
trditve ohrani revision ID in zahteva **nov append-only interni evidence audit**
(z referenco na prejšnji dokaz, časom, virom in rokom); ne ustvari novega alerta.
Tudi umik zahteva novo interno audit revizijo in javni `retracted_at`; starega
dokazila se ne izbriše. Interni audit ni obstoječi nepopolni CHANGE_LOG in ni
javen payload. Njegova fizična hramba in writer protokol zahtevata odobritev B2.

### Veljavnost in zgodovina

Predlagana enotna politika v1 za te štiri tipe, še za odobritev:

| Bližina relevantnega dogodkovnega datuma | Največja starost dokaza |
| --- | --- |
| več kot 30 civilnih dni | 14 × 24 ur |
| 8–30 civilnih dni | 7 × 24 ur |
| največ 7 dni, tudi že pretekel datum | 24 ur |
| brez znanega relevantnega datuma | 7 × 24 ur |

Pri prestavitvi uporabimo bližjega od starega in novega datuma; pri odpovedi
izvirni prizadeti datum, ne čas odstranitve. Dneve primerjamo v Ljubljani,
trajanje dokazila pa v UTC urah. Strožji rok vira vedno prevlada.
`valid_until` ob preveritvi ne sme presegati takratnega maksimuma. Ob branju
veljata oba pogoja: `now < valid_until` in
`now - verified_at < maximum_age_for_current_proximity`. Vstop v krajše okno
lahko dokazilo izteče prej. Po dogodku se maksimum ne vrne na 14 dni.

**Potek dokazila ne izbriše revizije in ne spremeni odpovedi v scheduled.**
`canonical_status` ohrani zadnje znano stanje, evidence_state pa postane expired
in ne dovoljuje aktualne trditve. Zgodovinski prikaz pove »potrjeno takrat;
aktualno stanje ni preverjeno«. Revisions, aliasi, tombstoni in evidence audit
se kanonično ohranijo brez 60-dnevnega reza. Javna v1 podpora sezon 2026/2027
mora med življenjsko dobo contracta vračati vse odobrene ohranjene revizije,
tudi expired/superseded/retracted. Ukinitve sezon ali retencijske politike ni
dovoljeno uvesti tiho; zahteva nov odobren dogovor in izrecno napako namesto
lažno prazne popolne zgodovine. »Popolno« je omejeno na Watch obseg in deklarirano
mejo, nikoli na zgodovino vseh stvarnih sprememb teka pred uvedbo registra.

## 6. Prihodnji read-only `/race-watch`

Predlog: `GET /race-watch?contract=1&years=2026,2027` na **obstoječem Workerju**,
prek njegove kanonične Content API poti. Ni uporabe DEV-031 D2 upstreama,
neposrednega Website→Sheets dostopa, zapisov med GET ali novega Workerja.
GET/OPTIONS brez credentialov ali uporabniškega seznama v queryju. Leta morajo
biti eksplicitna, enolična, urejena; v1 podpira 2026 in 2027. Podvojene parametre,
neznane parametre, nedovoljene oblike in neznan contract zavrne, ne ugiba.

Odgovor je **celoten omejeni odobreni sezonski posnetek**, brez `days=60`, limita
100 ali implicitne paginacije. Izvedbo izbere unija `edition_year`, trenutnega
Master leta in vseh aliasnih let; isto izvedbo vrne enkrat. Tudi pretekle,
odpovedane in iz Masterja odstranjene izvedbe ostanejo. Ne razkriva vseh skritih
predlogov. Za vključeno izvedbo vrne vse odobrene ohranjene revizije, ne le tistih
z aktualnim dokazilom. Velikostna meja mora dati partial z razlogom ali napako;
nikoli tihega reza. Pred produkcijo je treba izmeriti največji payload in čas.

| Del odgovora | Pomen |
| --- | --- |
| `schema_version`, `type`, `ok` | `1.0.0`, `race_watch`, uspeh uporabnega posnetka; delni odgovor sme biti ok:true. |
| `generated_at` | čas vrednotenja odgovora in dokazil; ni nova verifikacija. |
| `projection_revision` | opaque `pr_<UUIDv4>` različica potrjenega kanoničnega posnetka; nova ob vsebinski objavi ali reverifikaciji, ne samo zaradi GET. Časovno izpeljan expiry in razpoložljivost se vrednotita pri generated_at, zato token sam ni cache dokaz aktualnosti. |
| `years` | točno zahtevana leta, urejeno; pri napačni neberljivi zahtevi je [] in ok:false. |
| `period` | mode `full_retained_history`, from nullable skupna meja zanesljive zgodovine, to = generated_at. To je opis pokritosti, ne filter za izbris starejših znanih revizij. |
| `coverage` | availability `available|partial|unavailable`, completeness `complete|partial|unknown`, nullable meja zgodovine, razčlenitev po vseh zahtevanih letih in enum razlogov. |
| `editions`, `revisions` | strogo validirane identitete in revizije; tudi brez active revizije izvedba ostane. |
| `error` | null ali `{code,retryable}` brez upstream URL-jev, kontaktov, tokenov ali internih stackov. |

Globalna razpoložljivost je available samo če so na voljo vsa leta, unavailable
če ni nobenega, sicer partial. Complete zahteva vsa leta available/complete,
znane meje in brez nerešenih identitet ali razlogov. Vsi vključeni aliasi morajo
biti unique, tudi če je edition identity_status verified in odgovor nima
aktivnih revizij. Dvoumen ali konflikten alias zahteva označeno nepopolnost;
pretekla revizija ostane v zgodovini. Skupna meja popolnosti je
najpoznejša od deklariranih letnih mej; če katera ni znana, je null. Ne sme biti
v prihodnosti. Vsaka vključena izvedba mora pokrivati vsako zanjo relevantno
obljubo `complete`: njen `history_complete_since` mora biti znan in časovno
**manjši ali enak** skupni meji, kadar je skupna pokritost complete, ter meji
vsakega ustreznega zahtevanega leta, označenega complete. Ustrezno leto je
`edition_year`, leto trenutne Master lokacije ali leto katerega koli njenega
eksplicitnega aliasa; nepovezana leta ji ne nalagajo zgodovinske meje.
Primerjamo dejanske UTC trenutke, zato enakovredna zapisa z/brez milisekund
pomenita isto mejo.

Če izvedba zagotavlja zgodovino šele od oktobra, pokritost zanjo ne sme
obljubljati avgusta. Producer mora bodisi zagotoviti manjkajočo zgodovino,
pravilno zožiti deklarirano obdobje ali označiti skupno in prizadeto letno
pokritost kot partial z razlogom `history_gap`. Samo skupni partial ne dovoljuje
neutemeljene letne trditve complete. Znane revizije ostanejo v odgovoru in
posamezna aktualna dokazana sprememba lahko ostane veljavna kljub izrecno
navedeni vrzeli v pretekli zgodovini. Neznana obljubljena meja ne dokazuje
popolnosti.

Razlogi so `upstream_timeout`, `upstream_invalid`,
`identity_unresolved`, `history_gap`, `not_seeded`, `payload_limit`,
`request_rejected`, `verification_conflict`.
Izpad leta ne sme znižati kakovosti nepovezanega preverjenega zapisa drugega
leta, mora pa biti jasno naveden. Vrnjeni varni del mora biti samostojen in
zadržati vse konfliktne identitete pred serializacijo.

### Napake in potrošnik

| Situacija | Predlagani HTTP / code / retryable |
| --- | --- |
| napačen query, contract ali leto | 400 / INVALID_REQUEST, UNSUPPORTED_CONTRACT ali UNSUPPORTED_YEAR / false |
| nedovoljena metoda | 405 / METHOD_NOT_ALLOWED / false |
| timeout ali celoten upstream izpad | 503 / UPSTREAM_UNAVAILABLE / true |
| neveljaven JSON ali contract upstreama | 502 / INVALID_UPSTREAM / true |
| nerazrešen kanonični konflikt brez varne delne projekcije | 409 / CONTRACT_CONFLICT / false |
| prevelik posnetek brez varne delne projekcije | 413 / PAYLOAD_LIMIT / false |
| varno dokazljiv del ob izpadu drugega leta | 200, ok:true, partial in razlogi |

Pri ok:false sta editions/revisions prazna, coverage unavailable/unknown
(`completeness` mora biti izrecno `unknown`, nikoli `partial` ali `complete`) in
error obvezen. Če zahtevanih let ni mogoče prebrati, sta obe letni polji [] in
period.from null; sicer navedemo zahtevana leta tudi pri neuspehu. Apps Script
ContentService lahko vrne HTTP 200 z ok:false; **Worker mora pregledati envelope
in preslikati napako**, ne slepo posredovati uspešnega transportnega statusa.
Nobenega fallbacka na `/recent_updates` ali Master status za konkretno odpoved.

Potrošnik najprej preveri verzijo, shemo in semantične invariante. Neveljaven
posnetek pomeni brez potrjenih signalov in jasno nezmožnost preverjanja;
neznana/dvoumna identiteta nikoli ne postane sprememba. Manjkajoč zapis ni
odpoved in uspešen prazen odgovor ni absolutni »ni sprememb«. Pri časovnem
poteku se oznaka umakne tudi na že odprti strani in ob vrnitvi v zavihek.
Pri izpadu se lokalni seznam in statusi ohranijo. Morebitni prihodnji cache ne
sme podaljšati veljavnosti; ob ponovnem obisku nov poskus, brez stalnega pollinga.

## 7. Združljivost in meje dokaza

| Obstoječi contract | Preverjeno izhodišče in specificirana združljivost |
| --- | --- |
| `stkSavedRacesV2` | `utils-saved-races.ts` hrani version/eventId/year/date/title/status, ključ leto:eventId; ni saved_at. V B0 brez spremembe. Prihodnji exact alias lookup je samo v pomnilniku; nikoli prepis V2 datuma, ID-ja ali statusa. Štirje statusi ostanejo. |
| Race Watch Lite | `utils-race-watch.ts` zahteva exact row/leto/shranjeni datum in ima tri pregledana deadline sidra. Ostane trenutni način do ločeno odobrenega adapterja; noben fuzzy fallback. |
| `/recent_updates` | nevtralni NEW/CONFIRMED/UPDATED, največ 60 dni in 100, filtriranje na javne prihodnje potrjene dogodke. Ostane nespremenjen. Njegov ID ni revizija in ne povzroči A-signala. |
| `/deadlines?contract=2` | ohrani `race_id|datum`, komponente in obstoječo date-only inclusive veljavnost. V1 Watch uporablja drug namespace in timestamp exclusive veljavnost. Povezava samo prek izrecno pregledanega legacy aliasa; nobenega preimenovanja obstoječega edition_id. |
| Master 2026/2027 | javna odgovora in A:O vsebinska/P:R sledilna pogodba ostanejo. Nova izvedba dobi svoj ID; dokazani cross-year MOVE ohrani edition_year in ID. |
| `RACE_REGISTRY` | še naprej register družin in njihovih nazivnih ključev; več izvedb iste družine je dovoljeno. B0 ničesar ne dopisuje ali deduplicira. |
| Importerji in formule | obstoječi 15-poljski TSV/JSON, staging, DIRECT/BATCH, backup/read-back/recovery, SUPERSEDED in PUBLIC_LS formula ostanejo. Vsi posegi vanje so B2 migracijska odločitev, ne del B0. |

Prihodnji prehod V2: exact tuple → en pregledan edition ID → ločen prikaz.
Ob MOVE mora status/remove še vedno ciljati izvorni V2 ključ. Dva stara zapisa
iste izvedbe lahko deduplicirata **opozorilo** po revision ID, ne lokalnih zapisov
ali statusov. Ob dvoumnosti ostane prvotni zapis nerazrešen. Ponovno uporabljeni
leto:eventId je za nova shranjevanja V2 prav tako nevaren, četudi se datum
razlikuje: V2 deduplicira brez datuma. Zato je pred B4 potreben operativni prepoved
recikliranja že javnih locatorjev ali ločeno odobren novi lokalni model. V3
migracija ni odobrena s tem contractom.

Navadni `resolveSavedRaces()` danes uporablja leto:eventId in ne preveri
zgodovinskega datuma kot Watch Lite. Zgolj novi Watch adapter zato ne bi zadoščal
za varen celoten prikaz po MOVE/reuse. B4 mora pregledati še kartice, profile,
completed snapshots, save/remove/status in koledarske izvoze. B0 tega ne popravlja
in ne trdi, da je prehod že integracijsko dokazan.

## 8. Ponovljiva validacija

```sh
npm ci --ignore-scripts
npm run test:race-watch-contract
npm test
git diff --check
```

Ajv 8.20.0 je eksplicitna **razvojna** odvisnost, že prisotna v dotedanjem locku
prek Astro orodij. Runtime odvisnosti se ne spreminjajo. Sheme se meta-validirajo,
format datumi/časi in varni URL-ji preverijo, nato se preverijo medzapisna pravila.
Novi omejeni GitHub Actions workflow preverja contract tudi ob spremembi samo
shem/fixture; vsi testi so vključeni tudi v obstoječi `npm test` glob.

[Manifest](../tests/fixtures/race-watch-contract/manifest.json) označuje celotno
zbirko kot sintetično, vsebuje pričakovan uspeh/napako, število aktivnih in
dedupliciranih revizij. Domene `.example`, imena SINTETIČNO, family R999999 in
vrstice 800/801 so izmišljeni testni podatki, nikoli predlog produkcijskega seeda.
Pozitivni primer pomeni veljaven varen odgovor; lahko vsebuje konflikt ali
nedostopnost, vendar tedaj brez konkretnega active alarma.

Pokriti so vsi zahtevani scenariji: prestavitev v isti/novi vrstici, izbrisana
odpoved, dve izvedbi družine, reciklirana vrstica, dvoumni/konfliktni alias,
idempotentna in konfliktna podvojitev, manjkajoče/poteklo dokazilo, upstream
izpad/delnost, vrnitev po 60 dneh. Dodani so datum pending, cross-year MOVE,
časovne meje z DST, supersedes/cikel, neveljavni datumi in varni URL-ji.
Ločeni compatibility testi uporabijo **obstoječe** V2 validatorje in status/remove
operacije na sintetičnih podatkih ter testno razlago exact alias pravila.
To dokazuje izvedljivost pravila brez spremembe V2; ne simulira uvedenega API-ja.

Rezultati začetnega B0 zagona in omejitve so v [validation.json](evidence/dev036-b0/validation.json);
poznejši review popravki in dopolnilna validacija so opisani v razdelkih 10 in 11.
B0 se po enem commitu in Draft PR ustavi za pregled; noben merge, deployment,
pisanje Master/RACE_REGISTRY/CHANGE_LOG ali uporabniška funkcija ni del rezultata.

## 9. Pripeti viri kode

- [15 Master polj, tracking, import](https://github.com/igorkalsek/stk-apps-scripts/blob/82e9ca7838fdf276beffb2571fa14926674044c6/projects/stk-orodja/STK_Admin_Uvoz.js),
  [writer serializacija](https://github.com/igorkalsek/stk-apps-scripts/blob/82e9ca7838fdf276beffb2571fa14926674044c6/projects/stk-orodja/STK_Admin_ImportWriteExecutor.js),
  [writer validator](https://github.com/igorkalsek/stk-apps-scripts/blob/82e9ca7838fdf276beffb2571fa14926674044c6/projects/stk-orodja/STK_Admin_ImportWriteValidator.js),
  [letni setup](https://github.com/igorkalsek/stk-apps-scripts/blob/82e9ca7838fdf276beffb2571fa14926674044c6/projects/stk-orodja/STK_YearSetup.js).
- [Content API recent collector in filtri](https://github.com/igorkalsek/stk-apps-scripts/blob/82e9ca7838fdf276beffb2571fa14926674044c6/projects/stk-content-api/Code.gs),
  [Worker](https://github.com/igorkalsek/stk-apps-scripts/blob/82e9ca7838fdf276beffb2571fa14926674044c6/projects/stk-master-api/worker.js).
- [Website V2](https://github.com/igorkalsek/stk-website/blob/c5f2a961c18717a53f0893b9f11addc2126e1ab6/src/utils-saved-races.ts),
  [Watch Lite](https://github.com/igorkalsek/stk-website/blob/c5f2a961c18717a53f0893b9f11addc2126e1ab6/src/utils-race-watch.ts),
  [navadni resolver](https://github.com/igorkalsek/stk-website/blob/c5f2a961c18717a53f0893b9f11addc2126e1ab6/src/utils-my-races.ts).

## 10. Popravki treh P2 pripomb na PR #236

Za vsako pripombo je bil najprej dodan sintetični regresijski test in potrjen
neuspeh pred popravkom, nato najmanjši popravek v testnem semantičnem validatorju:

- [Prekrivanje vezav](https://github.com/igorkalsek/stk-website/pull/236#discussion_r4314195163):
  primerjava vseh intervalov ene izvedbe poleg obstoječe globalne kontrole
  fizične lokacije. Regresije pokrivajo previous/current, previous/previous in
  premik med letoma; stikajoče meje in vrzeli ostanejo dovoljene.
- [Popolnost aliasov](https://github.com/igorkalsek/stk-website/pull/236#discussion_r4314195177):
  complete zahteva vse vključene aliase unique tudi ob verified izvedbi brez
  aktivne revizije; ambiguous/conflict z označeno partial pokritostjo ohrani
  zgodovino brez potrjenega signala.
- [Neuspešen odgovor](https://github.com/igorkalsek/stk-website/pull/236#discussion_r4314195190):
  ok:false zahteva completeness unknown pri navedenih letih in praznem years.

Dodani testi so v
[regresijskem sklopu](../tests/race-watch-contract-review.test.mjs), ki ga
izvajata `npm run test:race-watch-contract` in `npm test`; CI sproži tudi
sprememba te datoteke. Gre za uveljavitev in pojasnitev semantičnih invariant,
ne spremembo oblike JSON Schema ali verzije 1.0.0. Rezultati red/green zagonov
in končne validacije so v
[review-regressions.json](evidence/dev036-b0/review-regressions.json).
B0 contract-only obseg ostaja: spremembe samo v testih, dokumentaciji in
priključitvi teh testov v obstoječe preverjanje.

## 11. Dodatni P2 pripombi na commitu c8886d7

Obe napaki sta bili najprej dokazani z negativnimi testi na nespremenjenem
validatorju `c8886d7`, nato odpravljeni z medzapisnima kontrolama samo v testnem
validatorju:

- [Pending reschedule](https://github.com/igorkalsek/stk-website/pull/236#discussion_r4314575822):
  aktivni `rescheduled` z neznanim novim datumom zahteva postponed. Štiri
  negativne kombinacije statusov so prej padle; veljavna aktivna prestavitev
  ter ohranjena expired/retracted zgodovina so pozitivne kontrole.
- [Meje zgodovine](https://github.com/igorkalsek/stk-website/pull/236#discussion_r4314575829):
  meja vsake izvedbe mora podpreti skupno in vse ustrezne letne obljube
  complete. Sedem negativnih primerov vključuje cross-year, alias, drugo
  izvedbo, neznano mejo in napačno letno obljubo ob skupnem partial.
  Pozitivne kontrole preverjajo enake/starejše meje, ekvivalentne UTC čase,
  nepovezana leta in pravilno označeno delno zgodovino brez brisanja revizij.

Vsi primeri so sintetični in dodani v obstoječi
[review regresijski sklop](../tests/race-watch-contract-review.test.mjs).
Dokazilo z rezultati pred popravki in po njih je v
[review2-regressions.json](evidence/dev036-b0/review2-regressions.json).
Oblika JSON Schema, verzija 1.0.0 in B0 contract-only obseg ostanejo.
