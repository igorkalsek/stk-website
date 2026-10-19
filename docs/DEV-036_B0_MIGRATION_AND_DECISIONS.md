# DEV-036 B0 — migracijski vrstni red, odločitve in tveganja

Ta načrt je za odobritev. Dokončana specifikacija je
[Race Watch contract v1](DEV-036_RACE_WATCH_CONTRACT_V1.md); nobena naslednja
faza ni dovoljenje za produkcijske zapise, deployment ali merge.

## 1. Najmanjši naslednji korak B1

**En ločen read-only/offline identity audit preview v `stk-apps-scripts`.**
Ponovno uporabi obstoječi identity audit, naloži sheme B0 in na izrecno izbranem
posnetku 2026/2027 pripravi poročilo `UNIQUE / AMBIGUOUS / MISSING / CONFLICT`.
Izpiše predlagane vezave, izvore dokazov in vrzeli v zgodovini; ne dodeli ID-ja,
ne napiše registra, Masterja ali dokazil in ne odpre `/race-watch` poti.
B1 mora imeti negativni test, da enaki V2 tuple za dve generaciji nikoli nista
UNIQUE, ter ohraniti obstoječe audit/import/recovery rezultate.

Predpogoj: pregled in odobritev tega B0 contracta. B1 lahko deluje samo na
sintetičnih ali ročno odobrenih offline posnetkih; izvoz zasebnih podatkov ni
implicitno dovoljen. B1 ne potrebuje Admin ali Website funkcijske spremembe.

## 2. Zaporedje po repozitorijih

| Faza | Repo/podatki | Konkreten rezultat in gate |
| --- | --- | --- |
| B0, ta PR | stk-website | Specifikacija, sheme, sintetični primeri in testi. En commit, en Draft PR; ustavitev za pregled. |
| B1 | stk-apps-scripts | Zgoraj opisani read-only audit preview. Gate: brez lažno unique aliasa, brez zapisov ali runtime route. |
| B2a, posebej odobren model | stk-apps-scripts + kanonične Sheets | Audit vseh writerjev, formul in obeh sezon; fizični načrt RACE_EDITIONS/RACE_REVISIONS/evidence audita; izbor tehnične Master povezave zunaj A:R, transakcijski/publish protokol, backup/rollback načrt. Gate: odobritev sheme pred vsako dejansko spremembo. |
| B2b, priprava kode | stk-apps-scripts | CREATE/UPDATE/MOVE/COPY/DELETE kontrole ID-jev in aliasov, globalna enoličnost, staged zapis + read-back + commit marker, generacije, idempotency in evidence audit; noben GET writer. Gate: negativne/mock regresije in ohranjen recovery. Koda še ne pomeni dovoljenja za zapise ali deploy. |
| B2c, uredniški pilot | odobrene kanonične Sheets operacije | Majhen ločeno odobren seed obeh sezon, vključno s pregledano odpovedjo in konfliktom; svež dokaz za vsako vezavo in trditev. Noben avtomatski masovni backfill iz matcherja ali CHANGE_LOG. |
| B3a | stk-apps-scripts / stk-content-api | Allowlist read-only javna projekcija registryja in revizij; tombstoni, expiry, completeness, brez zasebnih polj; mock upstream testi. |
| B3b | stk-apps-scripts / obstoječi Worker | Ločen `/race-watch?contract=1` na kanonični Content API, timeout/error mapping in mock integracija. Gate: obstoječe poti zamrznjeno združljive, svež runtime/binding preflight ter ločena odobritev uvedbe. D2 je izključen. |
| B3c, če potrebno | stk-admin | Samo ločeno odobrene dopolnitve obstoječega uredniškega predloga za identity/evidence pregled. Za začetni ročni pilot ni nujna sprememba. Ohraniti 15-poljski izvoz, lokalne predloge, SUPERSEDED in semantični JSON. |
| B4 | stk-website | Adapter šele po živem potrjenem contractu; memory-only V2 exact alias povezovanje; pregled navadnega resolverja/status/remove/snapshot/ICS; SL/EN regresije. Nobena lokalna migracija ni samodejno odobrena. |

Pri B2 morajo biti popisani vsaj: staging/final import; DIRECT in BATCH;
ročni paste in single/multi-cell edit; sort, kopija in izbris vrstice;
letni setup; dodatni podatki; organizatorski popravki; backup/recovery.
`onEdit` ne pokriva vseh programskih zapisov in ne zagotavlja vseh before vrednosti.
Vsaka nepokrita pisalna pot je izključena iz samodejne objave verified revizij.

Sheets append ni transakcija. Predlog je pripravljena operacija z idempotency
ključem, zaklep, kontrola predpogojev, zapis, read-back in šele nato public commit
marker/posnetek. Negotov commit pomeni REVIEW, ne retry z novim ID-jem.
Rollback ne sme vrniti before-image čez novejše neodvisno potrjene vrednosti.
Podroben fizični protokol in vrstni red objave registrskih/evidence zapisov sta
B2 odločitev, ne implementacija B0. Do takrat ni producerja, ki bi jamčil v1.

## 3. Aktualne odprte odvisnosti

Preverjeni HEAD-i so v [B0 preflightu](evidence/dev036-b0/preflight.json).

| PR | Stanje in posledica |
| --- | --- |
| [Apps Scripts #100](https://github.com/igorkalsek/stk-apps-scripts/pull/100), `d76a169…` | Odprt Draft. DEV-031 deadline v2 in omejeni read-only D2 paket; HEAD/rollout gate ostaja blokiran v opisu PR. D2 dovoljuje samo v2 deadlines, ni kanonični Race Watch upstream. Ohraniti DIRECT/BATCH varovalke. |
| [Apps Scripts #103](https://github.com/igorkalsek/stk-apps-scripts/pull/103), `306b074…` | Odprt Draft za nedestruktivno zaključitev nadomeščenega additional-import incidenta. Ne rešuje edition identitete. Ne sprožati recovery/close v okviru Watch. |
| [Admin #140](https://github.com/igorkalsek/stk-admin/pull/140), `364b578…` | Odprt Draft v2 contracta; ohraniti komponente in časovne semantike. Ni dovoljenje za spremembo Masterja ali javnih ID-jev. |
| [Admin #141](https://github.com/igorkalsek/stk-admin/pull/141), `4936126…` | Odprt Draft parserja SUPERSEDED in ohranitve semantika_rokov_json. B2 importer delo mora ohraniti te varovalke ter uskladiti dejansko tedanje main/HEAD stanje. |

B0 ne zahteva mergea teh PR-jev in ne spreminja njihovih vej. Pred B1/B2 ponovno
preveri dejansko stanje; trenutno odprt PR ni dokaz odsotnosti selektivne
produkcijske uvedbe. V B0 se ne ustvarjajo PR-ji v drugih repozitorijih.

## 4. Odločitve, ki še zahtevajo odobritev

| ID | Predlog B0 | Kaj je treba odobriti |
| --- | --- | --- |
| D1 | Hibrid C: RACE_EDITIONS je kanonična lokacija, Master le foreign key | Ali sprejeti ciljni model; točen list/stolpci, lastništvo in tehnična kolona šele po svežem auditu. A:O in P:R ostaneta nespremenjena do ločene migracije. |
| D2 | Globalno pregledani aliasi, generacije, trajni tombstoni | Kdo in kako potrjuje zgodovinsko identiteto, prepoved recikliranja javnih locatorjev, kateri writerji so vključeni. V2 brez saved_at ne more rešiti vseh starih zapisov. |
| D3 | 14 dni / 7 dni / 24 ur ter strožji rok vira | Uredniški SLA reverifikacije, javni povzetek zasebne potrditve, evidence audit/retraction proces, obravnava konfliktnih virov. |
| D4 | Štirje pomembni tipi v1, eksplicitni scope | Sprejem semantike reschedule proti popravku podatka, stabilni route ključi in obseg prvega pilota. Neodobrene vrste ostanejo izključene. |
| D5 | Celoten ohranjeni sezonski posnetek prek kanoničnega Workerja | Velikost/latenca/quota meja na meritvah, politika ohranitve podpore sezon, HTTP mapping; morebitna prihodnja paginacija le z verzioniranim posnetkom in novim dogovorom. |
| D6 | Immutable semantične revizije + append-only evidence audit | Fizična hramba, publish/commit/recovery protokol, omejitve JSON celic in nadzor dostopa. Sam B0 JSON ne določa odobrene nove strukture Sheets. |
| D7 | Memory-only prehod V2, brez pisanja ali združevanja statusov | Integracijski obseg B4 in odločitev za morebitni poznejši V3. B0 ne odobri nove lokalne shrambe ali trajnega prepisovanja ključev. |

D1–D7 so odločitve za izvedbo, ne manjkajoče deklaracije sheme. Contract v1 je
konkreten preverljiv predlog za skupni pregled; odobritev lahko zahteva usklajeno
spremembo dokumentacije, shem in primerov, preden ga producer implementira.

## 5. P1/P2 tveganja in varovalke

| Resnost | Tveganje | Varovalka / preostali gate |
| --- | --- | --- |
| P1 | Napačna izvedba zaradi family/date/row inferenc, delnega sorta ali kopiranega ID | Immutable registry ID, dokazani bridge, generacija, globalni audit, zadržanje dvoumnosti. Brez pregledanih writerjev ni objave. |
| P1 | Lažna odpoved/prestavitev iz izginotja ali prostega opisa | Pozitivno uradno dokazilo, exact izvedba, before/after in potrjen pomen; schema sama ne dokazuje resničnosti vira. |
| P1 | Delni večlistni zapis ali neprimeren recovery | Staging + read-back + commit marker, idempotency in pogojna obnovitev; protokol mora prestati napake v B2. |
| P1 | Razkritje internih kontaktov, tokenov ali neobjavljenih predlogov | Stroga javna allowlist, watch_publication, varen javni dokaz, dodatna polja zavrnjena; interni audit ločen od projekcije. |
| P1 | Izguba V2 statusa ali prikaz drugega teka po MOVE/reuse | Brez pisanja v V2; izvorni key za operacije; pred B4 pregled vseh resolverjev, snapshotov in izvozov. |
| P2 | Nepopolna zgodovina in V2 brez časa shranitve | Meja history_complete_since, REVIEW ob neznanem, nobenega zagotovila popolnega backfilla. |
| P2 | Potek ali umik dokaza izgubi zgodovino | Trajno ohranjene revizije/tombstoni/audit; expiry odstrani samo aktualno veljavnost, ne zgodovinskega zapisa. |
| P2 | Timeout, delna sezona, prevelik payload | Eksplicitna coverage/reasons, bounded requests, brez lažnega »ni sprememb« ali tihega reza. Potrebne meritve pred B3. |
| P2 | Poteče dokaz tik pred dogodkom, uporabnik ostane na odprti strani | Preveritev pri uporabi, krajšanje bližine in umik ob časovni meji/vrnitvi. TTL ni napoved stalnega spremljanja. |
| P2 | Drift odprtih PR-jev in uvedenega runtime | Nov preflight po repozitorijih, uvedenih verzijah in bindingih pred vsako uvedbo. B0 ne rešuje DEV-031 HEAD blokade. |
| P2 | Dolgoročna rast Sheets audita in JSON celic | Trajna semantična zgodovina; merjenje, ločena poznejša normalizacija/arhiviranje, brez neodobrene zunanje baze ali tihega brisanja. |

## 6. Meja dokončanega dela

B0 vsebuje dokumente, JSON Schema, izključno sintetične pozitivne/negativne
primere in avtomatizirano validacijo. Spremembe package/workflow so samo za
razvojno preverjanje. Obstoječi runtime, lokalna shramba, API-ji, podatki in
uporabniške funkcije so nespremenjeni. Produkcijski Master nikoli ne dobi
sintetičnih vrstic ali dokazil iz tega PR.

Po odprtju enega Draft PR se delo ustavi za pregled in odobritev. Najmanjši B1 je
zgornji read-only audit preview; B2/B3/B4 niso začeti in merge ni dovoljen.
