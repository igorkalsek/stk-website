# DEV-047 — zaščitena povezava nove lestvice in EN profili

Povezano z Apps Script Draft PR #119. Website se še naprej povezuje samo z
obstoječim `stk-master-api` Workerjem. Ne bere neposredno Sheets, ne zapisuje
analitike nove vrste in ne dodaja storitve/baze.

`/api/interest-preview?year=2026|2027` ostane **503/no-store**, dokler ni runtime
binding `STK_INTEREST_PREVIEW_ENABLED` izrecno nastavljen na `true`. URL parametri
ne obidejo varovalke in ne določajo upstreama. Relay bere samo fiksni
`/site-analytics?scope=recent-interest&year=...&limit=20`, ima timeout ter zavrne
legacy ali neveljaven rezultat. Apps stran ima ločeno, default-OFF Script
Property `STK_RECENT_INTEREST_ENABLED`; nič od tega ta PR ne aktivira.

Skupna validacija v relayu in obeh brskalnikih zahteva `recent-interest-v1`,
score v2, zadnjih sedem zaključenih dni Ljubljana, neodvisno svežino
capture/Master/generation, največ 300 s veljavnosti, pravilne identitete in
deterministični vrstni red. Klient ponovno spoji leto + fizično Master vrstico
R###### + datum + normaliziran naziv + javni status. Konflikt zavrne celotno
lestvico, ne ugiba alternative. Izbira letnika takoj počisti prejšnji rezultat;
odziv stare zahteve ne prepiše nove izbire. Iztek počisti/osveži rezultat.
Prazno ostane prazno, izpad ostane nedosegljivo; glasovi in pasivni ogledi se ne
uporabijo za rezervno razvrstitev. Obstoječa SL/EN vsebina pojasnjuje aktivno zanimanje.

## Kaj je bilo potrjeno pri EN 404

Na aktualnem main `f731eac` oba generatorja uporabljata isto slug funkcijo in
iste podatke za 2026/2027. Lokalni popoln build izdela 685 strani, vključno s
658 SL/EN profili in EN r000257. Povezava/slug nista napačna.

Cloudflare canonical deployment `ab77e1ed-2d42-4f8a-974b-c0ec459af7b0` iz istega
commita ima samo 114 naloženih datotek. Log konča sredi generacije EN načrtovalnika,
brez Astro zaključka. Neposredni deployment URL vrne 404 tudi za SL r000257 in
EN r000262. Javna domena nekatere stare poti še vrača iz predpomnilnika, zato
gre za širši nepopoln deployment, ne za napako enega EN profila. Točen notranji
vzrok zgodnjega konca builderja ni potrjen; generator ni spremenjen na podlagi ugibanja.

Build je zdaj ovit s preverjanjem resničnega `astro:build:done` potrdila,
prisotnosti vseh manifestiranih profilov in SL/EN parnosti obeh let. Uspešen
exit 0 brez dokončanih strani ne zadostuje za objavo. Preverjanje ne kliče
dodatnega podatkovnega API in ne spreminja slugov ali poti.

## Uvedba samo po ločeni odobritvi

1. Merge usklajenih Draft PR-jev; Apps selektivno uvede dispatcher + dve `.gs`
   datoteki na preverjeni v48 baseline, brez drugih projektov/scopes ali Sheets
   sprememb. Oba vklopa ostaneta false/odsotna.
2. Izvedi nov **celovit** Website build/deploy. Preveri SL/EN r000257 ter vsaj
   en javni profil 2027 na neposrednem deployment hostu in javni domeni: vsi 200.
   Relay mora še vedno vrniti 503.
3. Po **2. 11. 2026** potrdi celotni 26. 10.–1. 11. vzorec; pred tem ni GO.
   Nato odobri Apps vklop, preveri oba dejanska Worker odziva in hladni odzivni čas.
   Šele potem odobri Website runtime vklop in potreben Pages redeploy.
4. Preveri javni relay in SL/EN na mobilnem/namiznem zaslonu, oba letnika ter
   prazni/stari/neveljavni odgovor. Ob napaki Website flag false takoj zapre
   lestvico; nato izklopi Apps flag. Podatkovne povrnitve ni. Ne vračaj se
   samodejno na znani nepopolni Pages artifact; varni izklop ostane na novi kodi.

Produkcija, Pages konfiguracija, javni 503 in analitični podatki niso spremenjeni.
Celoten podatkovni/release postopek je v Apps PR #119, dokument
`docs/DEV-047_PRODUCTION_CONNECTION.md`. DEV-047 ostaja IN_PROGRESS.
