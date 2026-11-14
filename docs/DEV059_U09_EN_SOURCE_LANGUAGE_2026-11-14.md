# DEV-059/U09 – angleška vsebina in jezik virov

## Odločitev in preflight

**GO za omejen popravek.** Pregled 14. 11. 2026, Europe/Ljubljana. Osnova je aktualni oddaljeni `main` `4247191310f00f2152fbbb1ef64068b39105425e`; potrjeno prek svežega klona in GitHub API. Veja `codex/dev059-u09-english-source-language`. Izvirna delovna mapa in njene nepovezane datoteke so ohranjene; delo poteka v ločenem checkoutu.

Odprti Draft PR-ji [#266](https://github.com/igorkalsek/stk-website/pull/266), [#247](https://github.com/igorkalsek/stk-website/pull/247) in [#237](https://github.com/igorkalsek/stk-website/pull/237) ne vsebujejo prekrivajočih sprememb. Upoštevani so DEV-044 (izrecna družinska ponudba, #254–256), DEV-053 (#261, `24d2772`), U03 (`f8d992f`), U07 (#275) in obstoječa hierarhija U04/U08. Njihove podatkovne semantike in razporeditve se ne spreminjajo.

Produkcija je preverjena z neposrednim svežim GET HTML petih spodnjih strani in branjem obstoječega javnega Worker API. Produkcijski družinski uvod že vsebuje U07. Indeksirani spletni izvleček je pokazal starejše besedilo, zato ugotovitve temeljijo na neposrednem HTML. Produkcijski deployment SHA ni potrjen; ni bilo Cloudflare sprememb, mergea ali deploymenta.

## Reprezentativne ugotovitve

| URL | Trenutno besedilo / prikaz pred popravkom | Težava in odločitev |
| --- | --- | --- |
| [Family-friendly races](https://tekaski-koledar.si/en/family-friendly-races/) | “Races with explicit children’s or family activities.”; “other family offers” | Manjša vsebinska jasnost: neroden uvod in nejasen izraz »offers«. Krajše: “Races with children’s runs, family categories or activities.” ter “other options for families”. Merila vključitve ostanejo enaka. |
| [Family-friendly races](https://tekaski-koledar.si/en/family-friendly-races/) – Velenje | “Free participation for children or selected categories.”; ob prepoznanem povzetku ni izvorne opombe; pri rezervnem povzetku je “Source note:” omejen na 160 znakov brez `lang` | Resnična težava: splošni cenovni povzetek ne vsebuje pogojev in lahko nadomesti celoten vir. Odstranjen je samo ta sklep o brezplačnosti. Celotna javna opomba je dosegljiva v zaprtem native `details`, pri prepoznani slovenščini “Source note (Slovenian)” in `lang="sl"`. Odstranjeno je tudi odvečno rezervno pojasnilo o tem, da je informacija na voljo v viru: razširitev že ponuja ta vir. Ni nove značke na kartici. |
| [For organizers](https://tekaski-koledar.si/en/for-organizers/) | “Email verification alone does not count.” | Manjša, konkretna nejasnost: kaj se ne šteje? Nadomestilo: “Verifying your email address alone does not confirm the race information.” Postopek, upravičenost, pogoji statistike in povezave ostanejo enaki. |
| [Velenje Trail 2026](https://tekaski-koledar.si/en/races/2026/r000267-velenje-trail-2026/) | “Family activities are available. Check the official race information for details.”; opombe “Največ 50 družin. Pozoj 18 km ob 09:30…” brez jezikovne oznake | Resnična izguba pomembne razlage: splošno EN besedilo nadomesti sestavo družine in njen start. Ohranjen je slovenski družinski opis z 09:00, 2–5 člani in najmanj enim odraslim; preostale ure, kapaciteta in prijavni pogoji ostanejo v opombah. Oba sklopa dobita diskretni “(Slovenian)” v naslovu in `lang="sl"` na besedilu. |
| [11. Tek občine Mengeš 2026](https://tekaski-koledar.si/en/races/2026/r000303-11-tek-obcine-menges-2026/) | Isto splošno “Family activities are available…” je izpisano dvakrat; “Predprijave do 12. 11. 2026; prijave tudi na dan dogodka.” nima `lang` | Resnična težava: ponovljeni rezervni razlagi nadomestita konkretne ure in razdaljo. Prikažeta se konkretni slovenski povedi o otroškem teku in programu, ločeno ostanejo prijavni pogoji; vsak sklop je označen kot slovenski. Ni podvojene splošne EN razlage. |
| [KZTL – Kališče, 1. krog](https://tekaski-koledar.si/en/races/2026/r000311-kztl-2026-27-kalisce-1-krog/) | “Skupinska štarta: 08:45 za počasnejše tekače in 09:00 za ostale. Individualno od ponedeljka do sobote pred nedeljskim tekom; potrebna ID štartna številka.” brez `lang` | Resnična težava jezika in dostopnosti. Besedilo ostane slovensko, z označenim naslovom opomb in `lang="sl"`. Pomena ID številke se ne interpretira, podatki in uradna povezava ostanejo nespremenjeni. Dolgi URL v izvorni opombi se lahko prelomi; to odpravi pri 390 px zaznani vodoravni preliv (398 → 390 px). |
| Ista profila Velenje in Mengeš – prijavnina | “Entry fee details” → “Organizer information in Slovenian”; izvorni opis že ima `lang="sl"` | **Brez popravka.** U03 že pravilno ohranja kategorijske pogoje in jezik. DEV-053 ohranja razliko med prijavnino, donacijo in prostovoljnim prispevkom. |

Britanski/ameriški zapis “organiser/organizer”, “Official info”, naslovi prireditev, organizatorjev, prog in kategorij so slogovne razlike oziroma uradne oznake. Zaradi njih ni sprememb. Številske ure `07:30`, `10:30`, `08:45` ne potrebujejo slovenske jezikovne oznake.

## Omejen poseg

Spremembe zadevajo samo EN družinsko stran, EN predlogo profila, eno EN poved organizatorske komponente ter majhen skupni jezikovni namig v obstoječem `utils-english.ts`. Namig prepozna omejen nabor slovenskih besed v javni opombi; ne sklepa iz številk ali lastnih imen in ne predstavlja splošnega detektorja vseh jezikov. Neprepoznano besedilo ne dobi izmišljene oznake jezika. Testi vključujejo tudi angleške povedi, številke, prazno vrednost in uradna imena.

Pri prepoznani slovenščini EN profil uporabi obstoječo slovensko obdelavo opomb in obstoječe odstranjevanje podvojitve med družinskim sklopom in opombami. Tako se prepreči delno prevajanje besed in nadomestitev pogojev s splošno EN razlago. Slovensko oblikovanje je isto kot na SL profilu; ni novega prevajalnika. Ni novih prevodov organizatorskih pogojev: ohranjen in označen izvirnik je v tem posegu zanesljivejši od dodatne interpretacije.

Ni sprememb Masterja, Content API, datumov, cen, rokov, identitet, povezav, klasifikacije, shranjevanja, analitike, SEO ali SL predlog. Ni novih polj, odvisnosti, zahtevkov ali storitev.

## Preverjanje

- `npm test`: **980/980 PASS**; vključena regresija ohranitve celotnih preverjenih povedi, družinskih pogojev, ur in prijavnih opomb iz treh javnih Worker zapisov.
- `npm run build`: **PASS**, 749 strani, 722 preverjenih SL/EN profilov.
- `git diff --check`: **PASS**.
- Chromium: **62/62 PASS** (`family-offers` 44, `race-profile-hierarchy` 6, `registration-fees` 6, novi `source-language` 6). Preverjeni so 390/768/1440 px, oba jezika in leti pri družinskem izboru, vsi trije EN profili, EN organizatorska stran, razširitve z Enter/Space, izvorni pogoji, prijavnine, arhiv in odsotnost vodoravnega preliva. U07 cilj dosegljivosti prvega naslova pri 390 px ostane izpolnjen.
- Vizualno pregledani posnetki družinske strani in profilov ter organizatorske strani pri zahtevanih širinah. [Družinska kartica 390](evidence/dev059-u09/family-source-390.png), [KZTL opombe 390](evidence/dev059-u09/kztl-notes-390.png), [Velenje družine 768](evidence/dev059-u09/velenje-family-768.png), [organizatorji 1440](evidence/dev059-u09/organizers-1440.png).

[Primerjava builda](evidence/dev059-u09/build-invariants.json) aktualnega main pred posegom in kandidata: vseh **361 SL profilov je identičnih** po izločitvi samo generiranega ICS `DTSTAMP`. Pri treh pregledanih EN profilih so identični SEO elementi (tudi canonical/hreflang), JSON-LD, vse povezave in analitični atributi, z isto izločitvijo časa generiranja ICS. Razponi prijavnin in datumi ostajajo iz istega Worker API. V obeh buildih so uporabljeni javni produkcijski podatki, brez posega v Master.

Ponovitev:

```sh
npm test
npm run build
npx playwright test tests/browser/source-language.spec.ts tests/browser/family-offers.spec.ts tests/browser/race-profile-hierarchy.spec.ts tests/browser/registration-fees.spec.ts --project=chromium
git diff --check
```

Preverjanje je omejeno na Chromium; fizične naprave, Firefox/Safari in dejanski bralnik zaslona niso preverjeni. Označevanje jezika ni popolno za neprepoznana ali večjezična besedila; to ni razlog za nov prevajalski sistem v U09.

## Dostava in naslednji korak

Ena veja in en commit z `[CF-Pages-Skip]`, majhen Draft PR z oznako DEV-059/U09. Brez samodejnega mergea ali deploymenta. Povrnitev: revert tega PR oziroma edinega commita; ni podatkovne migracije.

Po pregledu U09 je smiseln naslednji korak **U10 – »Moji teki«**, z omejenim pregledom vrha in pomembnih akcij pri 390/768/1440 px. U10 ni začet.
