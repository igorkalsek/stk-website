# DEV-036 B0 — celovit pregled pokritosti in časovnih invariantov

Pregled temelji na commitu `587e2e4` in obeh novih P2 pripombah na
[PR #236](https://github.com/igorkalsek/stk-website/pull/236).
Obseg: javni contract v1, njegov testni semantični validator in sintetični testi.
Noben API, podatkovna migracija ali uporabniška funkcija ni implementirana.

## Prijavljeni napaki in dokaz pred popravkom

- [Coverage timestamps](https://github.com/igorkalsek/stk-website/pull/236#discussion_r4314857104):
  dva negativna primera napačno sprejete 100 ms starejše skupne meje sta padla
  na nespremenjenem `587e2e4`. Štiri pozitivne kombinacije enakovrednih UTC
  zapisov so bile napačno zavrnjene. Izbira maksimuma in primerjave skupne meje,
  `period.from` ter `period.to` zdaj uporabljajo `Date.parse`; null ostane null.
- [Failed-year coverage](https://github.com/igorkalsek/stk-website/pull/236#discussion_r4314857114):
  sedem negativnih regresij je na `587e2e4` sprejelo nedostopno leto z oznako
  complete/partial ali ohranjeno zgodovinsko mejo. Nedostopno leto zdaj zahteva
  unknown/null tudi znotraj uporabnega delnega odgovora. Veljavni večletni,
  enoletni in prazni neuspešni odgovori ostanejo sprejeti.

Rezultati pred popravki, po njih in neodvisnega ponovnega zagona na izvirnem
commitu so v [review3-regressions.json](evidence/dev036-b0/review3-regressions.json).

## Dovoljene letne kombinacije

| Letna availability | Letna completeness | history_complete_since |
| --- | --- | --- |
| available | complete | znan UTC trenutek |
| available | partial ali unknown | znan UTC trenutek ali null |
| partial | partial ali unknown | znan UTC trenutek ali null |
| unavailable | unknown | samo null |

Vse druge kombinacije so neveljavne. Pri partial/unknown znana meja opisuje
omejeno ohranjeno območje; sama ne dokazuje complete zgodovine. Konservativna
skupna partial/unknown oznaka je dovoljena tudi ob boljši letni pokritosti,
vendar zahteva razlog in ne odpravi nobene letne obljube complete.

Test vsebuje neodvisno tabelo dovoljenih letnih stanj in preveri vseh **5.832**
kombinacij: 18² letnih trojic za dve leti × 3 skupne availability ×
3 skupne completeness × 2 vrednosti ok. Tabela se ne izpelje iz validatorja.

## Pregled vseh skupin invariantov

| Skupina | Preverjeno pravilo | Pokritost in rezultat pregleda |
| --- | --- | --- |
| Letni seznam | Root years so urejeni in enolični; coverage.years vsebuje točno ista leta v istem vrstnem redu | Matrika in negativni primeri manjkajočega, podvojenega in napačno urejenega leta; neznani statusi se zavrnejo že s shemo. |
| Podprta leta | Uspeh v1 samo za 2026/2027; neuspeh sme navesti nepodprto leto z ustrezno napako | Dodatna varovalka za uspešen nepodprt obseg; napaka za 2028 ostane dovoljena. |
| Availability | available samo za vsa available leta; unavailable za vsa unavailable ali prazen neuspešen obseg; sicer partial | Vseh 5.832 kombinacij; ok ne more biti uspešen brez uporabnega letnega obsega. |
| Complete | Znan obseg, available/complete leta, brez razlogov ali nerešenih identitet/aliasov | Najdena vrzel pri complete/null in partial/complete letih brez izvedb; letni guard zdaj velja tudi za prazen seznam izvedb. |
| Letna complete obljuba | Vsaka ustrezna izvedba ima preverjeno identiteto, unique aliase in dovolj staro zgodovino | Dodatne padajoče regresije so odkrile nerešeno identiteto pod skupnim partial, če je leto ostalo complete; sedaj se zavrne. |
| Letni neuspeh | unavailable pomeni unknown/null ne glede na skupni ok | Ciljne večletne regresije in matrika. |
| Časovni maksimum | Skupna meja je najpoznejši dejanski letni trenutek, ali null, če manjka katera meja | 100 ms razlika v obeh letnih razporeditvah, .000Z/Z, .100Z/.1Z/.10Z in različna stara leta. |
| Časovne enakosti | Meje in period se primerjajo po UTC vrednosti; enakovreden zapis je dovoljen, 1 ms razlika ne | Popravljeno tudi za period.to/generated_at. Lexicographic sort ostane samo za edition ID-je in štirimestna leta. |
| Prihodnost | Letna, skupna in edition meja niso za generated_at; bound proof preveritve tudi niso iz prihodnosti | Novi milisekundni primeri dopolnjujejo obstoječe intervalne teste. Future effective_at je namerno dovoljen, ker opisuje prihodnji učinek uradne objave. |
| Edition zgodovina | Meja vsake izvedbe podpira skupno in vsa ustrezna zahtevana complete leta | Obstoječe regresije za cross-year, current locator, alias-only, drugo izvedbo in delno zgodovino ostanejo vključene. |
| Izolacija delnega odgovora | Izvedba potrebuje vsaj eno uporabno zahtevano letno projekcijo | Najden in zavrnjen primer podatka izključno nedostopnega leta. Isti preverjeni edition ID prek drugega uporabnega zahtevanega leta ostane dovoljen. Nedostopnost tu pomeni projekcijo, ne fizične odsotnosti Master vrstice. |
| Napake | ok:false zahteva prazne editions/revisions, unavailable/unknown/null na skupni in letni ravni ter error | Večletni, mešani, enoletni in prazni primeri; ok:true z error se zavrne. |
| Retryable | true samo za UPSTREAM_UNAVAILABLE in INVALID_UPSTREAM | Testi vseh osmih dokumentiranih kod so odkrili manjkajočo kontrolo; napačne oznake se zdaj zavrnejo. |
| Razlogi | Vsaka omejena razpoložljivost ali nepopolnost potrebuje razlog; complete nima razlogov | Matrika in negativne mutacije. Razlog ni nadomestilo za pravilno letno stanje ali dokaz identitete. |
| Aktivna identiteta | Samo verified in unique; dvoumnost nikoli ne ustvari potrjenega signala | Vseh 9 kombinacij identity_status/alias resolution ter obstoječi testi vseh štirih change tipov. |
| Aktivni lifecycle | Pending after:null zahteva postponed; odpoved zahteva cancelled; event polje mora biti enako after | Vsi kanonični statusi za pending/cancelled, neujemanja datuma/ure/kraja ter route kontrola. Statusa ne izpeljujemo avtomatsko iz datuma ali Master izginotja. |
| Zgodovinski status | Expired/retracted trditev ne vsiljuje trenutnega statusa; supersedes mora imeti veljaven predhodnik | Obstoječi review testi ohranitve zgodovine, ciklov, sekvenc in preklica ostanejo vključeni. |
| Veljavnost dokazila | Izključna zgornja meja in bližina dogodka se preverita pri uporabi | Prej/na/po meji za 1 ms, DST/bližina iz obstoječega sklopa in unknown-date 7 dni. |
| Prvotna TTL politika | Tudi arhivirana revizija ne sme trditi daljšega originalnega roka, kot ga je dovoljevala politika ob preveritvi | Najdena kontrola, omejena samo na active; premaknjena na vse revizije. Veljavne archived revizije ostanejo ohranjene. |
| Časovna sled | confirmed ≤ recorded ≤ published ≤ generated; confirmed ≤ verified ≤ generated; verified < valid_until | Obstoječi validator uporablja UTC vrednosti. Novi testi dopuščajo legitimno reverifikacijo po published in zavrnejo prihodnjo preveritev/uradno objavo. |
| Formati in varna zavrnitev | Strogi koledarski datum, UTC Z do milisekund, znani enumi; neveljaven posnetek nima active signalov | Novi neveljavni koledarski datumi, strukturne mutacije ter obstoječa schema/URL validacija. |

## Obseg dodatnih popravkov

Poleg dveh prijavljenih napak so zgornje povezane vrzeli dobile negativne teste
**pred** dodatnimi spremembami. Popravki so samo lokalne kontrole v testnem
validatorju: veljavna letna complete kombinacija, preverjena identiteta tudi pri
letni complete obljubi, usable-year izolacija, podprta uspešna leta, retryable
kod in prvotna TTL politika. Niso dodana polja, statusi, endpointi ali writerji.
Verzija in JSON Schema oblika ostaneta `1.0.0`; dokumentacija pojasnjuje pravila.

Vsa izvršljiva preverjanja so v [coverage testih](../tests/race-watch-coverage.test.mjs),
[obstoječih review testih](../tests/race-watch-contract-review.test.mjs) in
[contract testih](../tests/race-watch-contract.test.mjs). `npm run test:race-watch-contract`
vključuje vse tri sklope; `npm test` dodatno izvede V2 compatibility in ostale
regresije. Novi CI path zagotovi zagon tudi ob spremembi samo coverage testov.

To je pregled končnega contracta in njegovega izvršljivega modela. Resničnosti
uradnega vira ali popolnosti dejanskega kanoničnega registra ne more potrditi
sintetični test; pred producerjem ostajajo prej določeni read-only audit, pregled
writerjev ter posebej odobrena migracija. S tem delom ni bilo produkcijskih zapisov.
