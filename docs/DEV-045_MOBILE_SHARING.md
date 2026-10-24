# DEV-045: mobilno in Facebook deljenje

24. 10. 2026, Europe/Ljubljana. GO za omejen frontend popravek; kandidat za pregled, brez mergea ali deploymenta.

## Precheck in reprodukcija

- Kanonični razvojni backlog: DEV-045, NEW/P2, prebran read-only prek Google Drive (osebni račun). Brez spremembe backloga ali Masterja.
- Osnova: `origin/main` `8c7217271b877b3c1d29971ec478ee000367e9fb`. Lokalna prejšnja veja je imela enako vsebino kot aktualni main; uporabnikove nepovezane untracked datoteke ostajajo nedotaknjene.
- Odprti website PR-ji: samo dokumentacijski Draft [#237](https://github.com/igorkalsek/stk-website/pull/237); brez prekrivajoče izvedbe deljenja.
- Produkcija: [Go4trail SL](https://tekaski-koledar.si/tek/2026/r000256-go4trail/) in [EN](https://tekaski-koledar.si/en/races/2026/r000256-go4trail/), Chromium, prikaza 390/1440 px. Ni horizontalnega overflowa, kanonični URL-ji in uradni Facebook sharer so pravilni.
- Na vseh štirih kombinacijah ni sistemskega gumba niti z izpostavljenim `navigator.share`. Facebookov klik dvakrat pokliče `clipboard.writeText`, ker isti anchor ujame tudi splošni `[data-copy-share-text]` listener. Splošno povratno sporočilo prepiše Facebookovo sporočilo; ob zavrnitvi obeh načinov kopiranja se pokaže samo »Opisa ni bilo mogoče kopirati.« / »Could not copy the description.«
- Preverjena je tudi privzeta navigacija v nov zavihek na uradni sharer s kanoničnim SL/EN URL-jem. Facebookov cilj je prestrežen lokalno; ni prijave ali objave. Produkcijski clipboard je simuliran za štetje klicev oziroma napako; vsi ne-GET/HEAD zahtevki so blokirani, analytics opt-out je vključen.

## Omejen popravek

- »Deli tek« / »Share race« je privzeto skrit in se pokaže le ob `navigator.share` ter pozitivnem `canShare`, če je ta na voljo. Uporablja ime teka, lokaliziran datum/kraj in obstoječi kanonični URL. Gumb je širok in visok vsaj 46 px.
- Sistemski dialog se odpre neposredno iz klika. Med čakanjem je gumb onemogočen in sporočilo prazno. Razrešitev obljube uporabnika napoti v izbrano aplikacijo; ne potrjuje objave. Preklic/odsotnost ciljev (`AbortError`) in napaka imata ločeni sporočili ter ohranita druge možnosti.
- Facebook ima stalno pojasnilo, da deli povezavo in besedila ne vstavi samodejno. Kopira samo enkrat; uspeh kopiranja izrecno zahteva ročno lepljenje. Napaka ne trdi, da je Facebook odprt ali da je bila objava ustvarjena.
- Ohranjen Clipboard fallback; uporabi se tudi, če obstajajoči Clipboard API zavrne zapis. Neuspešen `execCommand` ne pokaže uspeha, začasni textarea se odstrani tudi ob izjemi.
- Facebook/WhatsApp/X/email, kopiranje povezave/opisa, kanonični URL-ji, hreflang, JSON-LD in Open Graph ostajajo. Obstoječi `share_clicked` in `copy_clicked` atributi ostanejo; novi gumb uporablja isti click tracking z `share_native_click`, brez novega tipa dogodka ali merjenja uspešnih objav. Analytics knjižnica in podatkovna pot se ne spreminjata.

## Preverjanje

- `npm test`: 799/799 PASS.
- Ciljni unit testi `race-share`, `frontend-analytics-v3`, `stk-analytics`: 41/41 PASS.
- `npx playwright test tests/browser/race-share.spec.ts tests/browser/race-profile-ux.spec.ts --project=chromium`: 40/40 PASS (32 deljenje + 8 obstoječih profilnih testov).
- `npm run build`: PASS, 679 strani. `git diff --check`: PASS.
- Browser matrika: SL/EN × 390/1440; native pending/resolve/cancel/error, manjkajoči `share`, `canShare=false`/izjema/manjkajoč, Clipboard success/manjkajoč/zavrnjen in fallback success/false/izjema; Facebook navigacija, enkratno kopiranje, odstranitev starega uspeha, dostopno statusno sporočilo, tipkovnica, velikost gumba, overflow, obstoječe povezave in analytics atributi, canonical/OG/hreflang.
- Dodatne obstoječe regresije profilov: SL/EN × 390/430/768/1440, pet profilov, koledarji, prijave/razpisi, shranjevanje/statusi, metapodatki in postavitev.
- Native Web Share odzivi so simulirani v Chromiumu. Fizični iOS/Android share sheet in zunanja objava nista preverjena. [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share) izrecno razlikuje razrešitev obljube od dejanske dostave v ciljno aplikacijo; zato ni sporočila »uspešno objavljeno«.
- Prvi browser zagon je bil prekinjen zaradi sočasnega lokalnega builda, ki je zamenjal servirani `dist`. Nato je bil popravljen test tipkovničnega fokusa, da pred preverjanjem `:focus-visible` dejansko uporabi tipkovnico. Končni čist zagon vseh 40 testov je PASS.

## Povrnitev in uvedba

Ena veja `codex/dev045-mobile-sharing`, en Draft PR s prefiksom `[CF-Pages-Skip]` za preprečitev samodejne Pages objave. Pred morebitno uvedbo je potreben pregled PR in ločena odločitev. Rollback: revert tega commita/PR; ni migracije, konfiguracije, backend ali podatkovnih sprememb. Brez novih zapisov v STK, mergea, deploymenta ali Meta povezovanja.
