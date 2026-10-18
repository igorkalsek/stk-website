# DEV-035 – Terminski radar 2027

## Obseg

Na obstoječih SL/EN straneh za načrtovanje terminov je dodan en blok
»Primerjaj termin«. Letni pregled, tedenske skupine, filtri in organizatorske
poti ostanejo. Brez novega endpointa, sprememb Masterja ali backend kode.

- Dan primerja točen datum; vikend pomeni soboto in nedeljo istega tedna.
  Nedelja se poveže s predhodno soboto, ponedeljek–petek s prihodnjo soboto.
- Bližina je vključujočih sedem dni pred začetkom in sedem dni po koncu izbora.
  Potrjeni dogodki iz izbora se ne ponovijo med bližnjimi.
- Pričakovani dogodki so ocene STK in imajo svojo skupino. Znana časovna okna
  imajo še ločeno skupino, brez trditve o potrjenem točnem datumu.
- Regija in podlaga omejujeta oba prikaza; mesec omejuje samo letni pregled.
- Neveljavnega datuma, manjkajoče meje ali obrnjenega obdobja primerjava ne
  dopolnjuje. Razpoložljivost termina ni nikoli zagotovljena.
- Med svežim branjem so rezultati primerjave zadržani. Če branje ne uspe,
  primerjava prikaže nedosegljivost, tudi kadar obstoječi pregled še ima podatke
  iz builda. Uspešen prazen odgovor je drugo stanje, z opozorilom o nepopolnosti.

## Podatki in identiteta

Primerjava uporablja obstoječi Worker `/planning-2027`. Testni posnetek
`tests/fixtures/planning-2027.json` je dejanski javni odgovor z
`generated_at: 2026-10-18T21:27:51.560Z`: 67 dogodkov, od tega 36 potrjenih in
31 pričakovanih, brez statusa `termin_znan`. Dva dogodka sta brez obdobja.
Znana okna in nepravilni zapisi so posebej označeni podatki `TEST ONLY` v testih.

Načrtovalni contract nima ID-jev ali povezav. Neobvezne povezave pridejo iz
obstoječega, predpomnjenega branja javnega Workerja `/?year=2027`, ki se že
uporablja za generiranje profilov. Komponenta shrani samo ključ, uradni URL
in dejansko profilno pot istega builda, brez dodatnega klica v brskalniku.

Povezava je mogoča samo pri potrjenem dogodku z veljavnim datumom in natanko
enim enakim zapisom na vsaki strani: surov naziv, datum, kraj, regija, podlaga.
Ni normaliziranja imen, približnega ujemanja, povezovanja preteklih izvedb ali
trajnega predpomnilnika identitet. Neenolično ujemanje izpusti povezave.
Uradni URL mora biti HTTP(S); profilna pot mora biti lokalna pot 2027.
Prednost ima javno polje `povezava_razpis`, nato `povezava_prijava`.
Oznaka »Uradna povezava« ne zagotavlja, da je cilj razpis: vir lahko navaja
domačo stran ali uradno napoved. Napaka obogatitve ne blokira primerjave.

## Scenariji in rezultati

| Scenarij | Preverjen rezultat |
| --- | --- |
| A: 15.–16. maj | Štirje potrjeni teki 15. maja; Wings for Life 9. maja in Kriška gora Trail 22. maja samo med bližnjimi. Nedelja 16. maja vrne isti rezultat. |
| B: 10.–11. april | Istrski maraton 11. aprila potrjen; Hop na grad 4.–25. aprila samo kot ocena STK. |
| C: 10.–11. julij | Noben znan datiran dogodek v izboru ali bližini; opozorilo, da termin ni zagotovljeno prost. Dva nedatirana dogodka ostaneta razkrita. |
| D: TEST ONLY | Znano okno ločeno; manjkajoče, obrnjene in neveljavne datume primerjava izloči iz časovnega ujemanja. |
| Meje in filtri | Dan/vikend, nedelja, vključujoča ±7 dni, sosednji meseci, 2026/2027/2028, DST, natančne vrednosti regije/podlage, čiščenje filtrov. |
| Napake in povezave | API napaka z začetnim posnetkom in brez njega; nalaganje proti uspešnemu praznemu odgovoru; manjkajoče/neveljavne povezave, dvoumno ujemanje, varni URL-ji, ubežano javno besedilo. |

Preverjanja 18. 10. 2026:

- `npm test`: **594/594 PASS**, vključno z devetimi novimi testi primerjave.
- `npx playwright test tests/browser/planning-comparison.spec.ts tests/browser/finder.spec.ts tests/browser/race-profile-ux.spec.ts --project=chromium`:
  **69/69 PASS** — 20 primerjava, 41 iskalnik, 8 profili.
- Končna ponovitev samo primerjave po utrditvi testa neobveznih povezav:
  **20/20 PASS**.
- `npm run build`: **PASS**, 661 strani.
- `git diff --check`: **PASS**.
- SL/EN, širini 390/1440 px: brez vodoravnega prelivanja in neobravnavanih JS
  napak, kontrole/povezave najmanj 44 px v višino ter viden tipkovniški fokus.

## Posnetki

Izbran je 23. maj, način vikend: izpis pravilno kaže 22.–23. maj. Potrjena je
Kriška gora Trail; bližnji potrjeni dogodki in dve oceni STK so v ločenih skupinah.
Posnetki izrežejo primerjalni blok. Samo med zajemom je lepljiva glava skrita,
da ne prekriva naslova izreza; interakcije in postavitev so testirane z vidno glavo.

| Jezik | Mobilni prikaz | Namizni prikaz |
| --- | --- | --- |
| SL | [390 px](evidence/dev-035-term-radar-2027/sl-390.png) | [1440 px](evidence/dev-035-term-radar-2027/sl-1440.png) |
| EN | [390 px](evidence/dev-035-term-radar-2027/en-390.png) | [1440 px](evidence/dev-035-term-radar-2027/en-1440.png) |

## Znane omejitve

- Javni načrtovalni vir pokriva samo 2027. Izračun pravilno prečka leto, vendar
  izrecno opozori, da dela razpona zunaj 2027 ni mogoče oceniti. Ne sklepa o
  dogodkih v 2026/2028 in ne dodaja drugih virov.
- Primerjava ob obisku osveži načrtovalne podatke; povezave so posnetek istega
  builda kot profili. Novi ali spremenjeni zapisi do naslednjega builda lahko
  ostanejo brez povezave, primerjava pa deluje. `row` ni trajni ID med buildi.
- Dogodki brez regije ali podlage lahko ob teh filtrih izpadejo; UI to pojasni.
  Iz enega datuma se ne sklepa o trajanju večdnevne prireditve.
- Brskalniška avtomatizacija je izvedena v Chromiumu; Safari/iOS ni bil ločeno
  preizkušen. Brez JavaScripta ostaja obstoječi statični pregled.

Pripravljeno za Draft PR. Brez merge, deploymenta, `clasp push` ali sprememb
produkcijskih podatkov. Commit uporablja `[CF-Pages-Skip]`.
