# DEV-061 — omejen fotografski pilot (pregled 19. 11. 2026)

## Meja in stanje
Uredniški izbor **ni odobritev objave**. Vsi zapisi ostanejo `CANDIDATE / PENDING`, `assetPath: null`, brez lokalnih fotografij. Katalog in DEV-056 identiteta sta v obstoječem PR-stacku #280 → #281 → #284. Brez novih polj Master/API, backenda ali produkcijskih sprememb.

Pregled temelji na konkretnih Wikimedia Commons straneh (avtorstvo, opis kraja, deklarirana licenca in velikost), DEV-056 `NEARBY_EDITION_BINDINGS` in pregledu enega izrisanega panoramskega predogleda (Kranj). **Končni vizualni pregled polnih izvirnikov, realnih izrezov in pravic za vsako predelavo ostaja PENDING.**

| Prednost | Kraj / identiteta | Izvirnik in avtor | Licenca in ločljivost | Zadevne preverjene vezi | Kuratorsko tveganje |
| --- | --- | --- | --- | --- | --- |
| 1 | Kranj, Q1021 | [Kranj - panorama 02.jpg](https://commons.wikimedia.org/wiki/File:Kranj_-_panorama_02.jpg), Mihael Grmek | CC BY-SA 4.0; 7104 × 2441 | 6 izdaj v DEV-056 (2026/2027) | Zelo dober panoramski kandidat; pri 16:7 preveriti horizontalni izrez in prepoznavnost mesta |
| 2 | Štanjel, Q392333 | [Štanjel 2020.jpg](https://commons.wikimedia.org/wiki/File:%C5%A0tanjel_2020.jpg), ModriDirkac | CC BY-SA 4.0; 1172 × 447 | 1 izdaja (2026!266, 25. Štanjelski tek) | Primeren format, vendar omejena ločljivost za večje/retina zaslone |
| 3, pogojno | Celje, Q1012 | [View over Celje from the Old town.JPG](https://commons.wikimedia.org/wiki/File:View_over_Celje_from_the_Old_town.JPG), Boris Maric | CC0 1.0; 4928 × 3264 | 4 izdaje 2027 | Izvirnik je 3:2; izrez 16:5 lahko odstrani ključen del mesta; preveriti kompozicijo |
| 4, pogojno | Ljubljana, Q437 | [Panorama Ljubljane.jpg](https://commons.wikimedia.org/wiki/File:Panorama_Ljubljane.jpg), August Dominus | CC BY-SA 4.0; 5152 × 3864 | 7 izdaj (2026/2027) | Izvirnik 4:3, zato lahko panoramski izrez izgubi pomemben motiv; v primeru slabega izreza izločiti |

Število vezi pomeni *kandidate za prikaz na točno preverjenih izdajah*, ne števila potrjenih javnih fotografij, štartov ali aktualnih tekmovanj. Slika kraja se ne sme opisovati kot slika štarta/trase. Tudi za dogodke, ki imajo v polju kraj širši opis, velja samo vezana DEV-056 identiteta in jasna oznaka ilustrativnosti.

## Opozorilo: Velenje ni primeren prvi pilot
[File:Velenje-grad-mesto.jpg](https://commons.wikimedia.org/wiki/File:Velenje-grad-mesto.jpg) (Stebunik, CC BY 4.0) je na Commons izrecno datiran v **70. leta 20. stoletja**. Čeprav kraj in licenca ustrezata, je fotografija arhivska in lahko ustvarja napačen vtis današnjega mesta. Kandidata **ne odobri kot sodobno naslovno fotografijo**; pred objavo poišči aktualnejši vir ali ga jasno označi kot zgodovinski prikaz.

## Obvezni naslednji preizkus po pridobitvi izvirnikov
1. Dovoljena pridobitev *točno zgoraj navedenih izvirnih JPG datotek* ali uporabnikova izrecna priloga; ne obidi prejšnje omejitve prenosa iz brskalnika.
2. Preveri izvirni motiv, pravice/licenco in vsaj po dva izreza (16:5 desktop in 16:7 mobile), brez podobe domnevne trase/štarta.
3. Končno odobrene JPG pretvori v lokalne optimizirane WebP/AVIF (`/images/places/`; največ 512 KiB na sliko), ohrani avtorja, povezavi do izvirnika/licence in oznako predelave. Pri CC BY-SA upoštevaj deljenje pod enakimi pogoji.
4. Po **izrecni kuratorski odobritvi** spremeni le potrjene manifestne vnose na `PUBLISHED / APPROVED` in določi `assetPath`. Ostali ostanejo skriti.
5. Preveri SL/EN na 390/768/1440 px: glavni CTA nad sliko, neprelomljene povezave/napisi, ALT, tipkovnica, izrez, brez horizontalnega overflow, prenosne bajte in LCP. Izmeri z dejanskimi lokalnimi slikami; brez slik ni mogoče potrditi teh kriterijev.

## Git/Ahotu preflight — 19. 11. 2026
- `main = 16b4b90`; #280 in #281 sta Draft; #284 je bil vrnjen v Draft. Vsi PR-ji ostajajo odprti in nezdruženi.
- PR #284 preview `f7b546ef.stk-website.pages.dev` se dejansko odpre; SL/EN 390/768/1440 px: brez horizontalnega overflow, `[data-stk-place-photo]` = 0. To **ni** test prikaza dejanske fotografije.
- PR preview še nima aktualnih Ahotu CTA; produkcijski profil 45. Maratona treh src jih ima. Uskladitev PR-stacka z `main` je zato merge pogoj.
- Lokalna poskusna združitev `main` v head #284: brez konfliktov; `git diff --check` PASS; 992/992 enotskih testov PASS, vključno z Ahotu. PR-ji **niso sinhronizirani na GitHubu**.
- Lokalni Playwright race-profile testi niso stekli zaradi manjkajočega Playwrightovega `chromium-headless-shell`; to ni ugotovljena regresija. GitHub Actions na prvotnem headu `3214767` ima 2/2 PASS; po prihodnji sinhronizaciji in s pravimi slikami je potreben nov CI + vizualni QA.

Brez merge, produkcijskega deploya ali avtomatske odobritve fotografij.
