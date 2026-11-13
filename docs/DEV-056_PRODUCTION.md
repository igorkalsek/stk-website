# DEV-056: Teki v bližini — produkcijski pregled

Preverjeno 13. 11. 2026. Nadaljevanje Draft PR #267 na `work/dev056-p1-nearby-core`.
Privzeti produkcijski vklop je **izključen**. V tej nalogi ni merge ali deploy koraka.

## Izvedena rešitev

- `src/data/nearby-geography.ts`: verzioniran katalog 54 geografskih referenc in 86 povezav na izvedbe. Koordinate kraja so zapisane samo enkrat. Izvedba je vezana na `year + masterRow + expectedDate + expectedTitle + expectedPlace + expectedRegion`.
- `src/utils-nearby-index.ts`: preveri enoličnost kataloga in izvedb ter sestavi obstoječi indeks za izračun razdalj. Neveljaven katalog se ne aktivira. Spremenjen datum, naziv, kraj ali regija pomeni manjkajočo lokacijo za posamezno izvedbo, brez ponovne uporabe starih koordinat.
- `src/finder/nearby-production-index.ts`: isti katalog zagotavlja izhodiščne kraje in reference dogodkov. Približne točke so `settlement-approximate` ali `venue-approximate`; ohranjen je en `start`. Stari raziskovalni JSON in trije prvotni pilotni vnosi se v produkcijski Finder ne uvažajo.
- Obstoječi Finder: izbira kraja brez dovoljenja GPS, prostovoljni klik za lokacijo naprave, 10/25/50/100 km, zračna razdalja, ohranjeno izbrano razvrščanje in izrecna oznaka približne reference na kartici. Ostali filtri se presekajo z geografskimi zadetki.
- Neznani dogodki so izključeni samo iz geografskih zadetkov. Opozorilo šteje manjkajoče lokacije glede na celotno izbrano leto, tudi pri nič zadetkih in pri drugih aktivnih filtrih. Splošno čiščenje filtrov izbriše tudi izhodišče. Meja radija je vključena z mikrometrsko toleranco za računsko napako; za primerjavo se ne uporablja zaokrožena prikazana razdalja. Urejanje ročnih koordinat takoj razveljavi stare zadetke.
- Lokacija in izbrani kraj ostaneta v pomnilniku zavihka. Ni vnosa v URL, piškotke, localStorage, sessionStorage ali analitiko. Med aktivnim geografskim iskanjem se ne pošiljajo iskalni/personalizirani agregati; že čakajoči iskalni zapis se prekliče. Običajna analitika ostalih uporabnikovih dejanj deluje brez geografskih podatkov.

## Izmerjena pokritost

Vir dogodkov: aktualni javni STK Worker API za 2026 in 2027. Uporabljeni so enaki pogoji kot v javnem Finderju: potrjen, javno viden, veljaven datum od 13. 11. 2026 dalje. Google Sheets ni bil neposredno bran ali spreminjan.

| Leto | Vse izvedbe | Uporabna lokacija | Potrjen štart | Približna | Manjka |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2026 | 26 | 24 | 1 | 23 | 2 |
| 2027 | 67 | 62 | 0 | 62 | 5 |
| Skupaj | 93 | 86 (92,5 %) | 1 | 85 | 7 |

Približne reference: 80 naselij in 5 prizorišč. To so števila izvedb, ne različnih točk.

| Regija | Lokacija / vse izvedbe |
| --- | ---: |
| Gorenjska | 22 / 22 |
| Goriška | 7 / 7 |
| Jugovzhodna | 5 / 6 |
| Koroška | 1 / 1 |
| Obalno-kraška | 8 / 10 |
| Osrednjeslovenska | 12 / 13 |
| Podravska | 8 / 8 |
| Pomurska | 1 / 1 |
| Primorsko-notranjska | 3 / 3 |
| Savinjska | 16 / 16 |
| Zasavska | 3 / 6 |

Zadržane izvedbe ne blokirajo izdaje:

| Identiteta | Izvedba | Razlog |
| --- | --- | --- |
| 2026!263 | Zimski jamatlon | Wikidata za Trbovlje ima deklarirano natančnost 0,1297° (približno 14 km), neprimerno za mali radij. |
| 2026!305 | 2. dobrodelni TriD Božičkov tek | Dve koordinati Brezovice pri Ljubljani se razlikujeta za več kot 1 km; izbira reference ni razrešena. |
| 2027!2 | Knap Trail 2027 | Enaka zadržana referenca Trbovelj. |
| 2027!3 | 5. Parenzana Ultra Trail | Več krajev/držav; enotna referenca ni določena. |
| 2027!4 | Punce v jami 2027 | Trbovlje–Hrastnik in podzemna trasa; enotna referenca ni določena. |
| 2027!5 | 9. Parenzana Marathon | Več čezmejnih prizorišč; enotna referenca ni določena. |
| 2027!50 | Gas na Gače trail 2027 | Razpoložljivi Q5529257 je naselje Gače; ustreznost za smučišče ni potrjena. |

Pri ligah SZTL se uporablja skupna približna referenca Žalca. Pri KZTL so Mače, Kranj, posestvo Brdo in Grad pri Cerkljah **približne krajevne reference**, brez trditve o skupnem natančnem štartu. Za Krvavec je izbran Grad ob spodnji postaji, ne vrh Krvavca. Pri večštartnih prireditvah (npr. Kočevsko, Rogla, Julian Alps) je prikazan kraj prireditve; oddaljenost drugih štartov je lahko večja. Referenca Ilirske Bistrice pri Črnih njivah je izrecno mestna približna referenca.

## Viri in ponovna uporaba

54 krajevnih referenc je bilo ponovno prebranih neposredno iz Wikidata `Special:EntityData` in preverjenih z identiteto kraja, državo Q215, občino, Master krajem/regijo ter obstoječo raziskavo DEV-056. Vir številčnih koordinat je P625. Katalog vsebuje ID trditve, revizijo, deklarirano natančnost in datum preveritve. Dokazi vključujejo neposredno povezavo na nespremenljivo revizijo in izvorne alternativne P625 trditve.

[Wikidata:Licensing](https://www.wikidata.org/wiki/Wikidata:Licensing) določa **CC0 za strukturirane podatke**. Besedila drugih imenskih prostorov in slik ne uvažamo. Pri več trditvah uporabimo prednostno Wikidata trditev; sicer najfinejšo deklarirano natančnost, nato število virov in stabilni ID, vendar samo kadar so vse neopuščene enakovredne reference znotraj 1 km. S tem izberemo ponovljivo približno točko istega kraja, nikoli štartne črte. Markovci so Q8009642 v občini Markovci, ne istoimenski kraj v občini Šalovci. Sv. Andrej je Q2842447 pri Škofji Loki, ne Q2216290 v Moravčah.

Edina natančna koordinata je **2026!266 Štanjelski tek**: [uradni organizator](https://skd-hrusevica.si/25-stanjelski-tek/) izrecno objavlja štart/cilj pri Lovski koči z `N 45 49.100; E 13 49.507`. Pretvorba je 45 + 49,100/60 in 13 + 49,507/60. Prevzet je en javno objavljen številčni dejanski podatek, brez kopiranja besedila strani ali zbirke. Organizatorjevi strani ne pripisujemo licence CC0. Koordinata velja samo za to izvedbo 2026.

GURS, GeoNames, Mapcarta, Hribi.net in drugi portali niso viri produkcijskih koordinat. Ni odvisnosti od GURS datuma stanja zbirke. Med iskanjem ni zahtev na geokodiranje ali Wikidata; katalog je del statičnega paketa.

Dokazi:

- [Aktualni javni dogodki](evidence/dev056-release/public-events.json), z izvoroma in časoma `generated_at` API.
- [Preverjanje virov](evidence/dev056-release/source-verification.json), vključno z izločitvami in natančnim štartom.
- [Strojno poročilo pokritosti](evidence/dev056-release/coverage.json).
- Posnetki SL/EN desktop/mobile v isti mapi, ustvarjeni z realnim indeksom in zajetim javnim API odgovorom.

## Vzdrževanje

Za trenutne podatke izvedi:

```sh
npm run nearby:coverage
```

Ukaz bere samo obstoječi javni Worker in ničesar ne vpisuje. Izpiše pokritost po letih/regijah, neujemajoče identitete in že znane kraje za nove izvedbe. Napaka ali prazni API odgovor ustavi preverjanje; ni tihega prehoda na star zajem.

Za ponovljiv pregled zajetih podatkov:

```sh
npm run nearby:coverage -- --snapshot docs/evidence/dev056-release/public-events.json --today 2026-11-13
```

Nov tek v že znanem kraju dobi novo povezavo v `NEARBY_EDITION_BINDINGS`: leto, Master vrstica, aktualni datum/naziv/kraj/regija ter obstoječi `placeId`. Koordinat ni treba ponovno vpisati. Preglej izpis `knownPlaceCandidates`, preveri občino in dodaj povezavo. Do takrat ostane nova izvedba jasno brez lokacije.

Pri spremembi obstoječe identitete najprej preveri dogodek in kraj, nato popravi pričakovano identiteto. Starih podatkov nikoli ne prenašaj samodejno na ponovno uporabljeno vrstico. Nov kraj zahteva en nov preverjen zapis v katalogu. Pri nejasnosti izvedba ostane izločena. Posodobitev Wikidata koordinat/revizije je namerna sprememba kataloga, ne omrežna operacija v brskalniku.

Za poznejši potrjeni štart dodaj `start` samo pripadajoči izvedbi (koordinate, uradni vir, datum preveritve). S tem preglasiš približno referenco samo zanjo. Kataloga in drugih izvedb ni treba spreminjati. Več natančnih štartnih vlog podpira obstoječi osnovni modul; približna referenca nikoli ne predstavlja vseh prog kot enega natančnega štarta.

## Aktivacija po odobritvi

1. Preveri končni SHA in zelenih vseh pet GitHub CI workflowov v Draft PR #267. Pred objavo ponovno izvedi `npm run nearby:coverage`; nova manjkajoča izvedba je dovoljena ob pravilnem opozorilu, nepričakovane spremembe identitet pa preglej.
2. Po ločeni odobritvi v produkcijskem **build** okolju nastavi `PUBLIC_STK_NEARBY_ENABLED=1`. Za izklop spremenljivko odstrani ali nastavi `0`. Samo točna vrednost `1` omogoča funkcijo. Sprememba je nastavljena v običajnem `astro.config.mjs`; URL ali brskalniška shramba je ne moreta vklopiti.
3. Objavi običajni preverjeni `npm run build` z odobrenega SHA. Ne uporabljaj `tests/dev056-private-astro.config.mjs` in ne objavljaj izhoda lokalnih testov. Zgolj sprememba okolja brez novega builda ne spremeni statičnega paketa.
4. V produkciji odpri SL in EN Finder, leto 2026/2027, na mobilnem in namiznem zaslonu. Izberi Zagorje ob Savi, preveri 10 in 100 km, približno oznako in opozorilo o manjkajočih lokacijah. Preveri regijo, shranitev teka in čiščenje filtrov. Ob nalaganju ne sme biti GPS poziva; dovoljenje se zahteva šele ob kliku.
5. Preveri, da izhodišče ni v URL, shrambi ali analitičnih zahtevah. Sveža stran nima aktivnega izhodišča. Pri primerjavi števila dogodkov upoštevaj trenutni datum; zajetih 93 ni trajna konstanta.

## Povrnitev

Najhitrejši izklop: odstrani `PUBLIC_STK_NEARBY_ENABLED` ali nastavi `0`, nato ponovno objavi isti odobreni SHA z običajnim buildom. Finder nadaljuje brez geografskega panela. Po potrebi v Cloudflare izberi zadnjo odobreno različico pred aktivacijo. Lokacij uporabnikov ni treba brisati, ker niso shranjene. Master in javni API se ne spreminjata. Za povrnitev razvoja uporabi `git revert` zaključnega commita tega PR; stari pilot ostane privzeto zaprt.

## Preverjanje

- `npm test`: 966 testov, vključno s produkcijsko pokritostjo, identitetami, novimi izvedbami, dvoumnostjo, ligami, mejami vseh radijev in poznejšo nadgradnjo na natančen štart.
- `npm run test:browser:nearby-release`: 8 scenarijev (obe leti × SL/EN × 390/1280 px), normalen produkcijski build z vklopno nastavitvijo in dejanski geografski indeks. Dogodki so determinističen zajem aktualnega Worker API, brez spreminjanja geografije za test. Vključeni so vsi radiji, filtri in URL, shranjeni teki, GPS/zavrnitev, prazni rezultati, ročni popravki, reset, zasebnost in horizontalni preliv.
- `npm run test:browser:finder`: obstoječe Finder regresije in izolirano geografsko komponentno preverjanje.
- `npm run test:browser:nearby-private`: dodatna obstoječa sintetična integracija za delno pokritost in robne primere; ni dokaz produkcijskih virov.
- `npm run build`: običajen produkcijski build s preverjenimi SL/EN profili in izklopljeno funkcijo po privzetem stanju.
- `git diff --check`.

Novi CI uporablja enake ukaze; ponavljajoči se obsežni raziskovalni job Wikidata je odstranjen iz Finder regresij, ker preverjeni produkcijski katalog nadomesti raziskovalne kandidate. Samostojni zgodovinski raziskovalni workflow ostane na voljo. Končne CI povezave in SHA so v opisu PR.
