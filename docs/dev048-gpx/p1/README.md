# DEV-048 P1 – GPX Lite

Implementiran je razdelek »GPX-sledi in trase« na obstoječih SL/EN profilih: 13 prireditev, 31 zunanjih povezav (28 GPX, 3 ZIP). GPX/ZIP se ne gostijo pri STK. Ni novih API-jev, podatkovne zbirke, sprememb Sheets ali Cloudflare konfiguracije.

## Izhodišče in ločitev raziskave

- Preverjeno 3. 11. 2026: raziskovalni [PR #247](https://github.com/igorkalsek/stk-website/pull/247) je OPEN/DRAFT, HEAD `92e7994fa66b154b415b36153e12722ad2acef16`.
- Razvojna veja `codex/dev048-gpx-lite-p1` iz aktualnega `origin/main` `624bc3d`. Raziskovalna veja ni bila združena ali cherry-pickana.
- P0F `CANDIDATE_FINAL_RECHECK` sam po sebi ni dovoljenje za objavo. Za P1 je bilo ponovno pregledanih 39 datotek; 31 jih je izrecno izbranih za zunanje arhivske povezave. Štiri so izpuščene zaradi omejitve obsega, štiri ostajajo REVIEW.
- [recheck.json](./recheck.json) vsebuje ločena `technical_result` in `publication_decision`, anonimen HTTP GET, končni URL, SHA-256, preverjanje povezave na izvorni strani in validacijo koordinat GPX. ZIP-i so bili razpakirani samo v pomnilniku. Vsi izbrani izvorni in ciljni URL-ji so vrnili HTTP 200; datoteke se ujemajo s P0F SHA-256.
- Minimalni javni manifest je `src/data/gpx-links.ts`. Raziskovalni manifest in ta dokazila se ne uvažajo v strani ali odjemalski JavaScript. Izbor ne potrjuje trase aktualne izvedbe in ne vzpostavlja pravice do ponovnega gostovanja.

## Izbrane prireditve

| Prireditev | Javna izvedba / Master vrstica | Povezave |
| --- | --- | ---: |
| RIBN’CA Trail | 2027 / 40 | 3 |
| Kriška gora Trail | 2027 / 35 | 3 |
| Ultra Trail Vipava Valley | 2027 / 8 | 3 ZIP |
| K24 Ultra Trail | 2027 / 20 | 2 |
| Hg Trail | 2027 / 33 | 3 |
| OBALA Ultra Trail | 2026 / 255 | 3 |
| Slovenski gozdarski trail | 2027 / 41 | 1 |
| Go4Trail | 2026 / 256 | 3 |
| Sabotin Trail Evening | 2026 / 248 | 1 |
| Velenje Trail | 2026 / 267 | 3 |
| Hrastnik Trail | 2027 / 18 | 2 |
| Lahinja Trail | 2026 / 254 | 3 |
| Vzpon na Široko | 2026 / 181 | 1 |

Posamezne proge, URL-ji, letnice in izvorne strani so navedeni v minimalnem manifestu; povezava na organizatorjev vir je vidna ob vsaki sledi.

## Vezava in javni prikaz

Obstoječa javna identiteta je leto + Master `row` (profil ima `r000NNN`), ne trajni ID družine. P0F ima le posnetek Master vrstice. Zato se mora ujemati celoten preverjeni posnetek: **leto, vrstica, datum, izvirni `naziv_prireditve`, kraj**. Vseh 13 vezav je bilo preverjenih prek obstoječega javnega Worker GET za 2026/2027, brez neposrednega dostopa do Sheets. GPX se poveže z dogodkom med Astro buildom. Neskladje ob spremembi datuma, naziva, kraja, leta ali Master vrstice se zazna pri naslednjem buildu in razdelek se takrat skrije. Do naslednjega builda lahko ostane javno prikazana prejšnja različica statične strani. Ob pomembni spremembi identitete je zato treba preveriti GPX vezavo in obnoviti javni prikaz. Ni sklepanja po podobnem naslovu, razdaljah ali vrstnem redu. Predhodni podatkovni model in javni Worker filtriranje ostajata nespremenjena.

Zgodovinski GPX se sme prikazati na izrecno preverjenem profilu 2027 kot arhivska sled iste prireditve, z opozorilom, da ne potrjuje aktualne trase. Vezava se ne prenese samodejno na 2028 ali drugo vrstico/izvedbo. K24 izvorna stran na primer ne potrjuje, da je arhivska geometrija veljavna za 2027.

Sled, starejša od izvedbe profila, ima oznako »Arhivska GPX-sled« z letnico. Sled istega ali novejšega leta ima oznako »GPX-sled z oznako« z dejansko letnico. Pri 13 povezavah je letnica neznana: »GPX-sled · letnica ni potrjena«. Letnice ne sklepamo iz mape ali GPS časa. Centurion z oznako 2027 ima isto opozorilo o nepotrjeni veljavnosti kot druge sledi, brez trditve »Potrjena trasa 2027«. Angleščina ima enakovredne oznake.

Pod seznamom je opozorilo: »Prikazane sledi so lahko iz preteklih izvedb. Njihova veljavnost za aktualno prireditev ni potrjena. Pred uporabo preverite informacije organizatorja.«

ZIP je izrecno označen »Odpri ZIP z GPX«. Enak ciljni URL se ob prikazu združi v en gumb s seznamom imen prog; to velja tudi za več različic. Ciljni in izvorni URL prestaneta obstoječo HTTP(S) validacijo, povezave imajo `target="_blank" rel="noopener noreferrer"`. Razdelek uporablja navaden Astro/CSS, brez novih kontrol ali odjemalskega pridobivanja GPX.

## REVIEW in izpuščeni primeri

- `P0D-F046` Jelka: kljub dosegljivi datoteki ostaja REVIEW zaradi nerešene možne geometrijske podvojitve s `P0D-F017`.
- `P0E-F039–041` Gozdni tek: isti javni ZIP je tehnično pravilen; za P1 ostaja REVIEW, ker je potreben dodaten izrecen dokaz povezave organizatorja na prijavno platformo. Ni treh podvojenih gumbov.
- Kočevsko Outdoor Festival ni v javnem izboru. Neveljavni Kočevski vertikal je izključen; 50-kilometrska datoteka na izvorni strani `/60-km/` zahteva dodatno vsebinsko presojo. Drugih prog nismo širili v ta izbor.
- EAORC Kamnik ni vključen: v raziskavi se pojavljajo različne discipline pri dveh Master vrsticah; potrebna je presoja vezave posamezne discipline na profil, ne le družino prireditve.
- Julian Alps ni vključen v ta obseg in v P1 ni ponovno preverjen.
- `P0D-F037/F038` ter `P0D-F048/F051` so tehnično ponovno potrjeni, vendar izpuščeni zaradi omejitve števila prog UTVV/OBALA.
- Vseh 37 P0F HOLD in neveljavni zapis ostajajo zunaj javnega manifesta. Nerazrešenih ali nepreverjeno zasebnih Drive datotek ni vključenih. Ostali neizbrani kandidati niso avtomatsko odobreni.

## Analitika in regresija

Obstoječi delegirani handler že pretvori `data-analytics-link-type="gpx"` v `external_link_clicked / gpx_click`. Novi gumbi pošiljajo leto, stabilni ID, naslov, datum in `race_detail`. Izvorna povezava uporablja obstoječi `official_site_click`. Običajna trasa ostaja `route_click`; analitičnega sistema nismo spreminjali.

Obstoječi `trasa_url`, razpis, prijava, glasovanje, shranjevanje, koledar in drugi elementi profila ostanejo v obstoječi kodi. V obe strani sta dodana le uvoz in skupni razdelek.

## Preverjanje

- `npm test`: **862/862 uspešnih**. Pet novih testov pokriva eksplicitno P1 dovoljenje in dokazila, natančno vezavo in negativne primere, letnice, podvojene ZIP/različice in nevarne URL-je.
- `npm run build`: uspešno, 697 strani, 670 preverjenih SL/EN profilov. Build pridobi podatke iz obstoječega Worker API-ja.
- `npx playwright test tests/browser/gpx-links.spec.ts tests/browser/race-profile-ux.spec.ts --project=chromium`: **13/13 uspešnih**. Novi testi preverijo vseh 13 profilov v SL/EN na 390/1440 px, odsotnost na nepovezanih profilih ter dejanska ločena analitična dogodka za GPX in običajno traso. Regresijski testi preverjajo profile na 390/430/768/1440 px.
- Testi brskalnika preprečijo zunanjo navigacijo/pisanje; analitični dogodek se prestreže lokalno. Chromium je zaradi macOS peskovnika potreboval dovoljen zagon zunaj njega.
- Ročni vizualni pregled lokalnih posnetkov UTVV: SL 390 px in EN 1440 px, jasne letnice 2026/2027, ZIP gumbi, opozorilo in brez vodoravnega prelivanja. Posnetka sta lokalno v `.cache/dev048-gpx/`.
- `git diff --check`: uspešno.

## Dostava in vzdrževanje

En ločen Draft PR, brez mergea ali deploymenta. Commit uporablja `[CF-Pages-Skip]`, da push ne sproži samodejne Pages objave. Pred produkcijo je treba pregledati izbor/vezave in odobriti PR ter objavo.

Ni dodatnih infrastrukturnih stroškov ali naročnin. Vzdrževanje je ročni ponovni pregled zunanjih povezav in identitet ob spremembah, pred objavo ali dodajanjem nove izvedbe. Nedosegljive ali vsebinsko spremenjene povezave se odstranijo oziroma vrnejo v REVIEW; ni scheduled preverjanja. Zunanji organizator lahko datoteko pozneje spremeni ali odstrani. Povrnitev je revert tega PR, brez podatkovne migracije.
