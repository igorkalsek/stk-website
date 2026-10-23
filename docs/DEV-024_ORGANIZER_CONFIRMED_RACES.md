# DEV-024 – javni pregled organizatorsko potrjenih tekov

23. 10. 2026, Europe/Ljubljana. Kandidat za pregled; brez mergea ali deploymenta in brez spremembe statusa backloga.

## Preflight

- Oddaljeni `main`: `fdef5ffb57fe51d47b52f96b7aba489afff3fff8`; [PR #240](https://github.com/igorkalsek/stk-website/pull/240) MERGED 23. 10. ob 17:05 CEST. Edini odprti PR ob začetku: dokumentacijski Draft #237, brez prekrivanja.
- Cloudflare Pages read-only preverjanje: kanonična produkcija `8e68592f-1345-4cea-9aad-187854708b54`, `success`, isti SHA `fdef5ff…`, branch main. Deploy končan ob 17:21:12 CEST; domene vključujejo tekaski-koledar.si in www.tekaski-koledar.si. DEV-044 F3-UX je torej že v main in dejanski produkciji.
- Obstoječa produkcijska SL/EN stran ima postopek potrjevanja in opis osnovnega poročila; javnega seznama še nima. `OrganizerPage` uporablja obe jezikovni poti. Obstoječa značka uporablja pozitivno projekcijo `organizer_confirmations`.
- Živi javni Worker `/organizer-confirmations?year=2027`: `ok:true`, `type:organizer_confirmations`, `year:"2027"`, točno R000011/R000012/R000019 z `data_confirmed:true`; R000034 manjka. Kontrolni 2026 odgovor vsebuje R000256 (Go4trail), ki ni vključen v seznam 2027.
- Živi `/?year=2027`: vsi štirje izhodiščni dogodki imajo `status_dogodka=potrjeno` in `vidno_v_javnem_koledarju=DA`. To samo po sebi ne zadostuje za organizatorsko značko. Javni profil Slivnice obstaja, njene organizatorske potrditve pa javni endpoint ne objavi.
- Pregledana obstoječa pogodba v `stk-apps-scripts/projects/stk-content-api/OrganizerAccess.gs`, `STK_buildOrganizerConfirmationsResponse_`: preverja eksplicitno potrditev, year + Master row + event_id, javno upravičenost in ujemanje aktualnega snapshot hasha. Vrne samo minimalno pozitivno projekcijo. Website ne preverja zasebnih access vrstic in ne sklepa iz VERIFIED ali race_id. Noben Sheet ni bil neposredno bran ali spremenjen.

## Implementacija

Majhen razdelek za leto 2027 na SL/EN strani Za organizatorje. En javni Master GET in en organizer-confirmations GET ob nalaganju strani; brez hrambe odgovorov. Prikaz je dinamičen, urejen po datumu in nato nazivu. Uporabi obstoječe preslikovanje javnih dogodkov, gradnjo profilnih povezav, preverjanje pozitivne projekcije in nespremenjeno komponento `OrganizerConfirmationBadge`.

Značka v inertni predlogi zagotovi obstoječo vsebino in slog. Pri kopiranju se odstrani njen profilni script: seznam že preveri projekcijo enkrat za vse dogodke. Test zagotavlja eno zahtevo za potrditve, ne ene na kartico.

Prikaz zahteva aktualni javni Master za 2027, enolično pozitivno Master vrstico, potrjen in viden dogodek z datumom v letu 2027, nazivom in krajem ter natančno pozitivno potrditev za row-based `R` + šest mest. Podvojene Master identitete so izločene; neveljavna ali podvojena projekcija je zavrnjena. Odpoved, napačno leto, nepopoln odgovor ali 12-sekundni timeout pustijo razdelek skrit. Obstoječi postopek potrjevanja ostane viden. Brez JavaScripta ni potrjenih kartic.

Besedilo razlikuje uradno potrjen datum od organizatorjevega pregleda aktualnih podatkov in ne obljublja neodvisne preveritve vseh podrobnosti. Novi CSS je omejen na novo komponento. Ni sprememb osnovnega poročila, značke, analitike, iskalnika, podatkov ali infrastrukture.

## Dokazi preverjanja

- `npm test`: **795/795 PASS**, vključno s 25 novimi testi: tri pozitivne potrditve, vrstni red in profilne poti, negativne projekcije, napačni year/event_id, false, manjkajoč row, podvojene identitete, nepopolni odgovori, napake HTTP/JSON/omrežja in prekinitev ob timeoutu.
- `npm run build`: **PASS, 677 strani**.
- `npx playwright test tests/browser/organizer-confirmed-races.spec.ts tests/browser/race-detail-contrast.spec.ts --project=chromium`: **72/72 PASS** (48 novih scenarijev, 24 obstoječih profilnih/kontrastnih regresij).
- Končni ponovni zagon: **48/48 PASS**, vključuje čakanje na zaključene mrežne zahteve pred preverjanjem praznih stanj. Novi testi so vključeni v obstoječi browser CI.
- Izbranih **13/13** obstoječih offline testov javne upstream projekcije PASS, vključno z VERIFIED po spremembi snapshota, neustreznimi statusi, email-only in napačnim letom. [Izpis](evidence/dev024/upstream-projection-tests.txt). Uporabljen obstoječi fake-Sheets harness; runner je bil v pomnilniku omejen na teste projekcije. Prvi poskus celotnega upstream runnerja je naletel na nepovezano obstoječo report/HMAC assertion pri vrstici 2498; upstream koda ni spremenjena in celotni upstream suite ni razglašen za uspešen.
- [Živi brskalniški pregled](evidence/dev024/live-browser.json): SL/EN × 390/1440 px, pravi Worker odgovori, tri značke in datumi, odsotnost R000034/R000256, točno dva javna GET-a, brez page errors ali horizontalnega prelivanja. Vseh šest lokalnih in produkcijskih profilnih povezav HTTP 200. Besedilo vseh obstoječih vrhnjih razdelkov ostane enako produkcijskemu.
- Posnetki: [SL 390](evidence/dev024/sl-390.png), [EN 390](evidence/dev024/en-390.png), [SL 1440](evidence/dev024/sl-1440.png), [EN 1440](evidence/dev024/en-1440.png). Vizualno pregledana mobilna in namizna postavitev; dolg neprekinjen naziv/kraj dodatno preverjen z browser testi.
- `git diff --check`: PASS.

Za ponovitev živega pregleda: lokalni `npm run build`, `npm run preview -- --host 127.0.0.1`, nato iz korena repozitorija `node docs/evidence/dev024/verify-live.mjs`. Skript blokira ne-GET/HEAD zahteve in analitiko; primerjava obstoječih razdelkov velja za produkcijo pred uvedbo te funkcije. Posnetki celotne strani vsebujejo lepljivo glavo na položaju zajema.

## Omejitve in tveganje

Nizko preostalo tveganje za UI; podatkovna pravilnost se opira na obstoječo javno projekcijo in njeno preverjanje aktualnega snapshota. Website ne more dodatno primerjati zasebnega hasha, ker javna pogodba tega ne razkriva. Dva javna GET-a nista atomski posnetek; veljajo obstoječa pravila osveževanja Workerja. Novi dogodki potrebujejo tudi obstoječi redni build profilnih strani; seznam ne dodaja novega deployment mehanizma. Odprta stran se samodejno ne osvežuje.

Produkcijski API, obstoječe strani in profilne povezave so dejansko preverjeni. **Nova funkcija še ni v produkciji.** Preverjen Chromium pri simuliranih širinah; Safari in fizične naprave niso preverjeni. Ni bilo e-pošte, potrjevalnih zapisov, sprememb Master/Additional/CHANGE_LOG/ORGANIZER_RACE_ACCESS ali posegov v DEV-042/DEV-036/Apps Script deployment.

## Varen merge, en deploy in povrnitev

1. Preglej Draft PR, počakaj na obvezne CI preglede in primerjaj morebitne nove spremembe main. Commit/PR imata `[CF-Pages-Skip]`; brez samodejnega mergea/deploymenta iz te naloge.
2. Po odobritvi mergeaj in izvedi **en** obstoječi produkcijski Pages deploy s pregledanim main SHA; uskladi redni rebuild, da ne sprožiš podvojenega deploya.
3. Preveri success kanoničnega deploymenta in ujemanje serving SHA. Odpri `/za-organizatorje/` in `/en/for-organizers/` pri 390/1440 px. Ponovno preberi javni 2027 Master in organizer-confirmations, preveri aktualni upravičeni nabor, značke, vrstni red in vse profilne povezave. Pri nespremenjenem viru pričakuj R000019, R000012, R000011; R000034 in 2026 R000256 ne sodita na seznam.
4. Šele po uvedbi in dejanskem produkcijskem preverjanju spremeni status DEV-024 po obstoječem postopku.
5. Povrnitev: revert enega implementacijskega commita (ali squash merge commita) in običajen deploy reverta. Podatkovna migracija ali čiščenje ni potrebno.

## CI popravek – PR #241

Pregledan [neuspešni run 40010321143](https://github.com/igorkalsek/stk-website/actions/runs/40010321143), HTML report in oba retry trace artefakta (artifact 12525867363). PR je bil še vedno na `86eba6f`, main na `fdef5ff`, brez novih commitov ali review pripomb.

Oba trace odgovora za EN stran vsebujeta `planning-2027-data-en = null` in `<div data-planning-content hidden>`. Test z API napako prejme pričakovani runtime HTTP 503; test nalaganja zadrži runtime odgovor, ki ga obstoječi 4-sekundni timeout pozneje prekine. Kontrole so zato pravilno skrite. `initial:true` v starem helperju ni vstavil začetnega payloada; pustil je rezultat živega build-time GET-a. Tudi test nalaganja je implicitno zahteval uspešen build-time GET. Vsaka jezikovna stran kliče `fetchPlanning2027()` posebej; ta lahko vrne null brez neuspeha celotnega builda. Razlog posamezne build-time odpovedi (HTTP, omrežje, timeout ali neveljaven payload) ni zabeležen; dokazano pa je, da je bil rezultat null. Dodatno čakanje ne odpravi napačne testne predpostavke.

Težava je obstajala že na main. Vse štiri relevantne aplikacijske datoteke in prvotni browser test so med main in izhodiščem PR identični. Nespremenjeni main je bil razširjen v začasen imenik z `git archive`; kontrolirani null začetni payload in runtime loading/503 na njem povzročita isti skriti select kot na PR buildu. [Sanitizirani dokazi in identiteta artefakta](evidence/dev024/ci-root-cause.json).

Spremenjena je samo testna priprava v `planning-comparison.spec.ts`: skupni helper vedno vstavi obstoječi deterministični snapshot, pri `initial:false` pa null. Uporabi ga tudi test nalaganja. HTML kontrol in njihovo vidnost še naprej upravlja dejanska aplikacija; timeouti, pričakovanja in runtime negativni odgovori niso sproščeni. Brez sprememb src, API, potrditev, značk, podatkov ali infrastrukture.

Lokalno preverjanje: **795/795 enotskih testov PASS**, build **677 strani PASS**, `git diff --check` PASS. Celotni radar (20) in DEV-024 (48) sta preverjena tudi na generiranih SL/EN straneh z namensko odstranjenimi začetnimi podatki in skrito vsebino, kar ponovi pogoj iz CI. Izvirna generirana HTML-ja sta nato povrnjena. Rezultat: **68/68 PASS**. Stari neuspešni run ni prepisan s ponovitvijo; majhen popravek sproži nove obvezne kontrole na novem head commitu. Končni rezultat GitHub CI je naveden v opisu PR po dejanskem zaključku kontrol.

PR ostane Draft za ločeno odobritev. Brez mergea ali produkcijskega deploymenta.

## P2 review – poti profilov iz trenutnega builda

Pripomba [discussion_r4363698125](https://github.com/igorkalsek/stk-website/pull/241#discussion_r4363698125) na `550f24e` je utemeljena: generiranje sluga iz aktualnega API naziva lahko kaže na še nezgrajeno stran. `OrganizerConfirmedRaces` zdaj po vzoru radarja vgradi samo dejanske jezikovne poti iz `getDetailStaticPaths(lang)`, ki uporablja obstoječe build podatkovne cache. Ne dodaja API branja.

Runtime povezovanje zahteva enolično ujemanje year + Master row + datum + kraj. Naziv ni del ključa, zato se preimenovan tek lahko poveže na svoj stari, dejansko zgrajeni slug. Če ni ujemanja, je kandidat podvojen ali manifest manjka/ni veljaven, ostane naziv navadno besedilo. Sprememba datuma ali kraja konservativno odstrani povezavo do naslednjega builda. Upravičenost dogodka in značke je nespremenjena.

Preverjanje: **799/799 enotskih testov in 114/114 browser testov PASS** (70 DEV-024, 20 radar, 24 obstoječi profilni/kontrastni). Browser matrika SL/EN × 390/1440 preverja tudi preimenovane teke, novo vrstico brez profila, manjkajoče/neveljavne/dvoumne poti in ohranjene značke. Vsak scenarij preveri točno dva runtime Worker GET-a. Dva integracijska testa prebereta dejanski build manifest in preverita HTTP 200 vsake vgrajene lokalne SL/EN profilne poti. Regresijski preverjanji radarja in obstoječih profilnih značk ostaneta vključeni.

`STK_BUILD_TIMING=1 npm run build`: PASS, 677 strani, `master_requests=2`, 280 profilov 2026 + 45 profilov 2027 za vsak jezik; brez dodatnih Master zahtev. `git diff --check`: PASS. Končni browser in CI rezultati so zapisani v odgovoru na P2 pripombo po preverjanju.

Brez sprememb Masterja, API-jev, značk, infrastrukture ali backloga; brez mergea ali deploymenta. Trenutni PR je že v stanju za pregled (ni Draft); njegovega stanja ta popravek ne spreminja.


Dodatna CI ugotovitev na `fd9f8dd`: [run 40016991549](https://github.com/igorkalsek/stk-website/actions/runs/40016991549) uspešno opravi vseh 70 DEV-024 testov, nato pade en obstoječi SL desktop home test pri primerjavi y koordinat (2 px, retry 36 px). Retry trace pokaže scrollTop **892 → 928** med dvema ločenima klicema za bounding box; razlika **36 px** je natančno prijavljeni odmik. Obstoječi CSS uporablja smooth scroll, test pa po fokusiranju/klikih primerja viewport koordinati iz različnih trenutkov. Home aplikacijska koda in test na izhodišču sta identična main; P2 komponenta na domači strani ni uporabljena. Prvotni test lokalno prestane 10/10 ponovitev (SL/EN × 5), zato napake ne razglašamo za stalno poravnalno regresijo.

Najmanjši popravek home testa prebere oba pravokotnika v enem sinhronem `evaluate` klicu. Iste zahteve glede namizne poravnave (< 1 px), mobilnega vrstnega reda in širine ostanejo; ni čakanja, višjega praga ali spremembe CSS. To odstrani dokazano dirko meritev med smooth scrollom, brez spremembe aplikacije.

Po popravku meritev: celotna matrika Aktualno SL/EN × 390/1440 × full/missing/empty, trikrat: **36/36 PASS**. Brez spremembe pragov ali aplikacijskega CSS.
