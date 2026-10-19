# DEV-036 – Phase A: Race Watch Lite

## Obseg in preverjeno izhodišče

Veja iz `origin/main` `38cd3e1d3c4024805acc0a3fa25bc035e9080bcb`, preverjeno 19. 10. 2026.
Uporabljena zaključena feasibility analiza »Oceni izvedljivost Race Watch« z istega dne.
Ob preflightu Website nima odprtih PR-jev. Apps Scripts ima odprta Draft #100
(deadline v2) in #103 (zaključek nadomeščenega incidenta); ta sprememba ne posega vanju.
DEV-017 in DEV-033 sta zaključena. Selektivno uvedeni v2 dejansko deluje, čeprav
[#100](https://github.com/igorkalsek/stk-apps-scripts/pull/100) še ni merged.

Živi read-only preflight:

- Produkcijski `/moji-teki/` in `/en/my-races/`: HTTP 200, pravilen naslov,
  prazno lokalno stanje, obstoječe kontrole in obvestilo o lokalni hrambi. Dodaten
  začasni Chromium profil z Lahinjo v statusu Planiram v obeh jezikih potrdi
  razrešen profil, ohranjen status in koledarski meni.
- Master 2026 in 2027: HTTP 200; 303 oziroma 36 javnih zapisov. Master nima `race_id`.
- `/recent_updates?years=2026,2027&days=60&limit=100`: HTTP 200; potrjeni obe leti,
  obdobje 21. 8.–19. 10. 2026, 25 kanoničnih povzetkov (10 UPDATED, 14 NEW, 1 CONFIRMED).
- `/deadlines?contract=2&year=2026&from=2026-10-19&to=2026-12-31&limit=100`:
  HTTP 200, contract 2, tri pregledane izdaje. Dejansko vrnjena omejitev je 50.
  Privzeti 14-dnevni odgovor je prazen; za funkcijo je zato izrecno zahtevano 30-dnevno okno.
- Prvi recent GET je potekel po 40 s; ponovljeno branje je uspelo. Dva dodatna
  poskusa branja neobveznega `/top?scope=upcoming&limit=1000` sta potekla.

## Delujoči signali in integracija

Na obstoječih SL/EN »Mojih tekih« je en razdelek s povzetki iz `/recent_updates`.
UPDATED ostane »Podatki teka so bili posodobljeni«; NEW in CONFIRMED ohranita
svoj pomen in datum vira. Poljubna prosta besedila ne ustvarijo konkretne trditve
o datumu, kraju, odpovedi ali ceni. Noben zapis ni označen kot novo neprebrano obvestilo.

Razdelek za preverjene roke navede povezane teke; datumi in komponente nadgradijo
obstoječe kartice ter najbližji rok. Ne dodaja drugega seznama istih rokov. V2
lahko doda preverjen rok tudi brez `/additional`. Isti datum se prikaže in izvaža
samo enkrat, tudi kadar vsebuje več komponent. Vse povezave iz novega razdelka
vodijo na ustrezen SL/EN profil teka.

| Preverjena povezava | Dokazana semantika | Rok | Stanje 19. 10. 2026 |
| --- | --- | --- | --- |
| `2026:256` → `R000211\|2026-11-07` | predprijave + cenejša prijava | 2. 11. | prikaz v 30 dneh |
| `2026:254` → `R000217\|2026-11-07` | spletne prijave | 4. 11. | prikaz v 30 dneh |
| `2026:265` → `R000218\|2026-12-05` | končni rok | 20. 11. | zunaj 30-dnevnega okna; semantika pokrita s testom |

Vsa dokazila so preverjena 15. 10. in veljavna do vključno 22. 10. 2026.
Obstoječi validator preverja uradni vir, komponente, datume, edition/deadline ID,
`valid_until` in največjo starost 45/14/7 dni glede na bližino roka. Funkcija jih
nikoli ne osveži ali podaljša. Potek umakne preverjene oznake ob ljubljanski
polnoči in ob vrnitvi v zavihek; ne opravlja periodičnega omrežnega spremljanja.
Vsa tri dokazila potečejo pred sedemdnevnim opomnikom, zato ga ta faza ne obljublja.

Obstoječi nevtralni datumi iz `/additional` in koledarski izvozi ostanejo.
To ni dokazilo za nov Race Watch signal; ob izteku v2 se semantična nadgradnja
umakne, obstoječi prikaz datuma pa ostane. UI jasno omeji preverjeno pokritost.

## Identiteta, popolnost in hramba

Adapter `src/utils-race-watch.ts` zahteva uspešen Master odgovor s pravilnim
letom, popolnim številom vrstic in natanko enim ustreznim zapisom. Lokalni
`eventId` se mora natančno ujemati z Website ID iz vrstice. Podvojitve, neveljavni
ali konfliktni dodatni locatorji se zavrnejo. Enaka vrstica v dveh letih sta dve
izdaji; `r000254` se nikoli ne spremeni v `R000254`.

Ker javni Master nima kanonične identitete izdaje, adapter dodatno zahteva
ujemanje shranjenega in trenutnega datuma. Sprememba datuma, premik vrstice,
ID brez vrstice ali nerazrešena referenca izpustijo signal. Podobnost naziva ali
kraja ne pomaga pri ujemanju. V2 uporablja le tri že pregledane sidrne povezave;
preveri še točen profil in `master_sheet`/`master_row` iz javnega v2 odgovora.
`race_id` je družina, `race_id|datum` pa trenutni v2 locator, ne trajni watch ključ.

Recent velja le za potrjeni leti in obdobje, ki se konča na današnji dan.
Preverijo se števci, struktura in globalni limit; ob delnem odgovoru se pokažejo
le samostojno dokazljivi zadetki z nevtralnim obvestilom. Enaki signali
`leto:vrstica|datum_spremembe|tip` se deterministično združijo; konfliktni zadetki
iste izdaje se izpustijo. Izpad, zastarel feed, odrezan odgovor in nerazrešena
identiteta ne pomenijo »ni sprememb«. Tudi uspešen prazen izbor govori le o
razpoložljivem povzetku, ne o celotni zgodovini.

`stkSavedRacesV2`, migracija in vsi štirje statusi ostanejo. Dodatnih zapisov v
localStorage ni; podatki iz API so samo v pomnilniku trenutnega obiska. Ni
zgodovine prikazanih obvestil, računov, strežniške hrambe ali sinhronizacije.
Prazna lokalna zbirka ne pokaže razdelka in ne sproži watch zahtev. API zahteve
za Watch imajo 12-sekundno omejitev in ne blokirajo lokalnega prvega prikaza.

## Preverjanja in posnetki

Živi odčitki so povzeti v [preflight.json](evidence/dev036/preflight.json).

Končna lokalna preverjanja:

- `npm test`: **633/633 PASS**.
- Playwright Race Watch, My races statuses in registration deadlines: **64/64 PASS**.
- Običajni `npm run build` s pravimi javnimi API-ji: **PASS, 661 strani, 18,98 s**.
  Uspešen je bil tudi predhodni build z opisanim izpadom neobveznega `/top`.
- `git diff --check`: **PASS**.

 Regresije pokrivajo ujemanje,
trke let, napačne/manjkajoče identitete, podvojitve, nevtralni UPDATED, veljavnost,
starost in semantiko v2, izpade/delne odzive, lokalne statuse, SL/EN,
mobile/desktop, odprti zavihek čez polnoč ter vse obstoječe izvoze in roke.
Novi testi so vključeni v obstoječi workflow `My races browser tests`.

Build in brskalniške regresije uporabljajo pravi Worker za Master in obstoječe
statične podatke. Zaradi opaženega izpada neobveznega `/top` je lokalni,
necommitani testni preload za ta endpoint takoj vrnil omrežno napako, da se
15-sekundni timeout ne ponovi za vsako generirano stran. Uporabljena je obstoječa
obravnava izpada v buildu, brez spremembe produkcijske kode ali izmišljenih
rezultatov glasovanja. Ta predhodni zagon ni dokaz delujočega produkcijskega `/top`. Kasnejši
živi retry je vrnil HTTP 200; nato je uspel tudi običajni končni build brez preloada.
Brskalniške interakcije uporabljajo dokumentiran izsek javnih odgovorov z
19. 10. ter posebej označene sintetične negativne scenarije.

| Jezik | Mobilni prikaz, 390 px | Namizni prikaz, 1440 px |
| --- | --- | --- |
| SL | [Posnetek](evidence/dev036/sl-mobile.png) | [Posnetek](evidence/dev036/sl-desktop.png) |
| EN | [Posnetek](evidence/dev036/en-mobile.png) | [Posnetek](evidence/dev036/en-desktop.png) |

## Ugotovitve in naslednja faza

- P1, obvladano: napačna izdaja ali neutemeljena semantika lahko ustvari napačen
  alarm. Stroga povezava, pregledana sidra in obstoječa validacija v2 zato
  izpustijo vsak nepreverljiv signal. Odpovedi, prestavitve in cenovne spremembe
  se ne sklepajo iz UPDATED, izginotja dogodka ali lokalnega predhodnega stanja.
- P2, omejitev: recent ima največ 60 dni in 100 elementov, brez zagotovljene
  popolne zgodovine ali nadoknaditve dolge odsotnosti. Obisk druge naprave ni povezan.
- P2, omejitev: javni locator ne more dokazati premika ali ponovne uporabe
  Master vrstice. Enak datum na ponovno uporabljeni vrstici tudi ni dokaz trajne
  identitete. Za stabilno spremljanje je potreben ločeno odobren contract.
- P2, omejitev: le tri pregledana v2 sidra 2026 in le aktualna dokazila; 2027
  ne dobi semantičnih rokov. Safari/iOS ni bil posebej preizkušen.
- P2, zunaj obsega: opaženi timeouti obstoječega neobveznega `/top` otežujejo
  običajen build; poznejši retry in končni običajni build sta uspela. Ta PR ne
  spreminja njegovega predpomnjenja ali backend delovanja.

Naslednji korak je ločeno odobrena javna projekcija obstoječih kanoničnih evidenc
prek Workerja: nespremenljiva identiteta izdaje, dokazani aliasi vrstic,
revizija spremembe, natančno polje in vrednosti prej/potem, uradni vir ter
`verified_at`/`valid_until`. Odpovedane izdaje morajo ostati dosegljive v tej
projekciji. S tem postanejo strukturirane odpovedi/prestavitve preverljive.

E-pošta ostane ločena prihodnja faza po stabilizaciji teh dokazil: izrecna prijava
na izdajo, double opt-in, varen preklic, omejevanje pogostosti in zlorab,
idempotentna dostava ter končna kontrola soglasja/identitete/veljavnosti pred
pošiljanjem. Naročniška hramba in dostava potrebujeta posebno odobritev.

Brez merge, deploy, Apps Script push, Cloudflare sprememb ali zapisov v Master,
CHANGE_LOG in deadline evidence. Commit uporablja `[CF-Pages-Skip]`.

## Popravek predpomnjenja na PR #235

Pregled `9c5b1b0` je potrdil napako: `watchCache.requests` je ohranil zaključene
Promise objekte. Tako je tudi neuspeh (`null`) postal trajno stanje obiska;
menjava dneva je ponovno uporabila ista odgovora. Vidnostni dogodek istega dne
sploh ni sprožil ponovnega preverjanja.

Pred popravkom sta browser regresiji za vrnitev po 503 in prehod dneva padli:
namesto obnovljenega preverjenega prikaza sta ostali brez ujemajočih se novosti
in rokov. Preverjeno na izvornem commitu, ne samo s pregledom kode.

Minimalni popravek v `my-races-client.ts`:

- Mapa hrani samo aktivne zahteve; `finally` odstrani le svoj Promise.
  Napaka HTTP, JSON, `ok:false` ali timeout ne blokira naslednjega poskusa.
- Predpomnilnik ima ljubljanski datum. Nov dan ali ponovni obisk vidnega
  zavihka/BFCache zamenja zaključene podatke; zahteva uporabi novo obdobje
  `from=today`, `to=today+30`. Med osveževanjem stari Watch signali niso prikazani.
- Sočasni ponovni obiski istega dne delijo aktivne zahteve. Ob zamenjavi dneva
  se stare zahteve prekličejo. Tudi transport, ki prezre preklic, ne more prepisati
  novega predpomnilnika: zapisovanje preverja lastništvo trenutnega objekta.
- Obstoječi časovnik polnoči ohrani umik dokazil. V skritem zavihku ne začne
  Watch zahtev; pridobivanje počaka na vrnitev. Ni intervala, samodejnih zank
  ponovnih poskusov, pollinga ali nove infrastrukture.
- Validatorji identitete/dokazil, statusi, koledarji in localStorage se ne spreminjajo.

Pet novih browser testov pokriva 503, pravi 12-sekundni timeout, prehod dneva,
skriti zavihek, sočasne obiske, transport brez učinkovitega preklica in pozne
odgovore ter uspešen ponovni obisk istega dne brez pollinga. Lokalno:
`npm test` **633/633 PASS**, relevantni Playwright testi **69/69 PASS**.
Običajni `npm run build` **PASS, 661 strani, 16,87 s**; `git diff --check` **PASS**.
Rezultat CI na novem commitu je dokumentiran v PR.
PR ostaja isti, brez mergea ali deploymenta.
