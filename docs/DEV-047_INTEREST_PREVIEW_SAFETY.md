# DEV-047: omejitev javne lestvice (24. 10. 2026)

## Odločitev

**GO:** en website PR začasno zapre javno lestvico z HTTP 503, `ok:false`, praznim `items` in `Cache-Control: no-store`. Obstoječi SL/EN frontend pokaže nedosegljivost brez nadomestne lestvice. Opis loči aktivne akcije od ogledov. To je varnostna začasna omejitev, ne uvedba delujoče v2 lestvice.

**NO-GO:** ponovno rangiranje, osveževanje/agregiranje in njegova produkcijska aktivacija. Ne izdelujemo v2 iz omejenega legacy top-20 odgovora: ta nima 30-dnevnih aktivnih bucketov ali v2 ocene in bi izpustil možne kandidate. Tudi zgolj preverjanje datuma ne odpravi rangiranja po ogledih. Namesto novega score sistema je izbrano jasno nedosegljivo stanje, dovoljeno v nalogi.

**NO-GO:** preusmeritev vsakega obiska domače strani na surovi `community-insights`. Obstoječa pot že uporablja v2, toda svež javni GET z `days=30&year=2026&limit=50` je presegel 25 sekund; izvedba ponovno bere surovi dnevnik, omeji kandidate pred Master filtriranjem in ne rešuje varnega osveževanja. Noben nov obremenilni preizkus ni bil zagnan.

**GO:** ohranitev organizatorske analitike brez sprememb API, zasebnosti ali podatkov. Organizatorsko pošiljanje ni bilo sproženo.

## Svež preflight (samo branje)

- Website main: `46fa6827c5294a25db562f76f9a3bfe6b5b1319d`; Cloudflare API potrdi isti produkcijski SHA, deployment `47f3dced-06d7-4820-a36d-19d2a6bce661`, ustvarjen `2026-10-24T14:46:19.992282Z`.
- `/api/interest-preview` v tem commitu uporablja Apps Script deployment `AKfycbzn9QzNSCE1oyKDFsm0TEFIzGSaettC6ErglCLWzlmwXiOd0wcnwsQVFJglFlnFpuNR` neposredno. Popravek to neposredno povezavo odstrani; ne dodaja povezave na Sheets.
- Svež Script API GET potrdi, da ta deployment pripada Content API projektu `1g_uMUONNlmhf4cujthA1_SWMLSkanEDgz2CMFIU3tY-9tLNgNqkQcuWu` in uporablja **v48**. Serving in HEAD imata iste štiri datoteke in iste SHA-256. `Code.gs` je bajtno enak GitHub main Apps repozitorija `f76fbf6c23874433b82fb7726701bbc0d6b4ba43`; SHA-256 je `f4731b8f89a58dbb2ccac18cd5c3e9343663a1f679c8ca1f863d3b154f1f2b31`. Lokalni Apps checkout je drugačen in ni bil uporabljen kot produkcijski dokaz.
- Obstoječi v49 deployment ni serving zgornje spletne poti; ni bil aktiviran ali spreminjan. Drugi Orodja projekt je bil prebran ločeno in ni zamenjan za Content API.
- Ob 18:42–18:43 Europe/Ljubljana javni website GET in Worker `/site-analytics?scope=interest-preview&year=2026&include_past=false&include_fallback=false&min_interest=1&limit=20` vrneta istih 13 ID-jev v istem vrstnem redu. Workerjev odgovor navede `STK_SITE_EVENT_AGGREGATES`, 126 izvornih vrstic in za vseh 13 rezultatov `updated_at=2026-07-06T20:14:50+02:00`. `generated_at` je današnji, vendar označuje nastanek odgovora, ne osvežitve podatkov.
- R000260 je tretji (`total_interest_actions_30d=4`, `detail_views_all=0`, zadnji dogodek 4. julija); R000262 je sedmi (2, 0, 20. junij); R000268 je dvanajsti (1, 0, 5. julij). Oktobrski ogledi v tem preverjenem odgovoru niso vključeni. Ni dokazano, da bi aktualna javna lestvica odražala oktobrske bote.
- Serving v48 potrjuje legacy razvrščanje po `total_interest_actions_30d`, nato `_all`, in vključitev `detail_views` v legacy total. V2 obstaja; utež `detail_views` in `event_card_clicks` je 0.
- Odprti website PR #237 je dokumentacijski audit. Pregledani odprti Apps PR #100, #103, #109, #112, #114 ter Admin #140, #141 ne rešujejo te javne lestvice in niso vključeni v vejo.
- Admin main je `71604e2dd89701c9f8ed12c7b10a4fe0269d7af3`. Njegov analytics modul uporablja obstoječi Worker: `community-insights` za aktivni score in `interest-preview` za ločen legacy pregled. Neodvisna potrditev trenutnega Admin produkcijskega builda: **NOT_VERIFIED**.

## Shema, osveževanje in organizatorske metrike

Serving v48/HEAD/main imajo **67 agregatnih stolpcev**. Pisanje je ročni helper; `doGet` ga ne kliče. V serving kodi ni `newTrigger`, `STK_writeAnalyticsAggregates` pa uporablja `clearContents()` pred `setValues()` brez validacije obstoječe sheme ali rollbacka. Javno branje agregatov ne sproži njihove obnove; community/organizer vpogledi izračunajo podatke iz `readSiteAnalyticsRows_()` brez zapisa agregatnega lista.

**NOT_VERIFIED:** fizična širina 34 stolpcev, datum `aggregate_date` in število >42.000 raw vrstic so iz uporabnikovega izhodišča, ne današnjega neposrednega branja Sheets. Svež API potrjuje julijski `updated_at`. Najverjetnejša razlaga je nespremenjen stari materializirani posnetek po razširitvi kode; zgodovina zadnjega writer zagona, dejanski sprožilci (tudi drugih lastnikov/projektov) in razlog neuspelega/izpuščenega osveževanja ostajajo **NOT_VERIFIED**. Odsotnost `newTrigger` v tej kodi ne dokazuje odsotnosti nameščenih triggerjev.

Serving `STK_buildOrganizerPreviewFromRows_` loči `detail_views`, uradne/prijavne klike, shranitve in koledarske akcije. Ogledi so del `discovery`, ne dokaz prijav. `explanatory_notes` povejo, da to niso unikatni obiskovalci, da klik ne pomeni dokončane prijave in da shranitev/koledar ne pomeni udeležbe. Javni organizer GET vrne `PRIVATE_ONLY`, kar je ohranjeno. Oktobrski surovi ogledi lahko vplivajo na števce ogledov/discovery v teh izračunih; konkretnih dnevnih vrednosti v tej nalogi nismo ponovno odčitali. Izvora posameznega ogleda ali dejanske prijave ne dokazujemo.

## Testi

- `npm test`: **801/801 PASS**, brez skipov. Vključuje novo preverjanje 503, praznih rezultatov, prepovedi predpomnjenja, odsotnosti upstream klicev in nemožnosti obvoda prek query parametrov.
- Astro produkcijski build: PASS (v okviru Playwright priprave). Playwright `home.spec.ts --grep "interest http-error"`: **4/4 PASS**, SL/EN na 390 in 1440 px. Prvi sandbox zagon je blokiral zagon Chromiuma; dovoljen ponovni lokalni zagon je uspel. Testi preverijo jasen status, prazno lestvico in odsotnost nadomestnega glasovalnega rangiranja.
- Obstoječi `site-analytics-aggregates-local-test.cjs` nad izoliranim arhivom Apps **main**, ne lokalno Apps vejo: PASS; obstoječe kontrole vključujejo v2 in ločevanje 2026/2027.
- `node tests/offline/dev047-analytics-safety.cjs /path/to/verified/Code.gs`: PASS nad SHA-pripetim serving v48. 100 umetnih ogledov = legacy total 100, v2 score 0. Klik na prijave (5), razpis (2), shranitev (4) in koledar (4) = 15; dodanih 100 ogledov ohrani 15. Isti ID v letih 2026/2027 ostane ločen (15/4).
- Isti offline diagnostični test simulira obstoječi 34-stolpčni list in prekinitev pisanja 67-stolpčnega rezultata. **Potrdi nevarno obstoječe stanje:** `clearContents` izbriše mock, `setValues` vrže napako, povrnitve ni. PASS pomeni uspešno reprodukcijo napake, ne varnega writerja. Produkcijski writer ni bil izveden.
- Ker je lestvica začasno zaprta brez upstream branja, julijski ali nepravilno široki agregati in poljubno število ogledov ne pridejo do javnega rangiranja. Nove uteži ali očiščeni števci niso izračunani.

## Ločen korak za agregiranje in ponovno odprtje

Potreben je ločen pregledan backend korak; ta PR ga ne implementira in ne zagotavlja obnovljene lestvice. Najprej je treba potrditi fizično shemo, zgodovino writerja in vse znane sprožilce. Pred kakršnimkoli pisanjem mora slediti validacija točnih glav, pravokotnosti, števila vrstic, kanoničnih `(event_year,event_id)` identitet in konfliktov ter v2 metrik; 34/67 mora odpovedati brez zapisov, ne samodejno migrirati.

Samo odstranitev `clearContents()` ali `try/catch` rollback ne zagotavlja povrnitve ob prekoračitvi časa procesa. Potrebni so predhodno preverjen trajen backup obstoječih agregatov, izključitev sočasnih writerjev, preverljiva objava in read-back ter ročna obnovitev po prekinitvi. To je več kot varen enovrstični popravek in zahteva ločeno odobreno izvedbo v obstoječi infrastrukturi. Obnova sme zajeti samo agregatni list iz potrjenega backupa; raw dnevnik se ne prepisuje, ne briše in ne deduplicira. Preizkus mora dokazati stanje po napaki, procesu, prekinjenem pred/med/po pisanju, neuspelem read-backu in ponovni obnovi. Brez novega triggerja ali migracije v tej nalogi.

Ponovno odprtje zahteva svež, preverjen obstoječi score v2 ter pravilen nabor kandidatov pred omejitvijo rezultatov. Ohraniti mora Master/status/javno vidnost, leto in stabilno identiteto. Samo osvežitev legacy totalov ali dodajanje score polja že odrezanemu top-20 seznamu ne zadostuje. Trenutno Master preverjanje v SL/EN ostane nespremenjeno.

## Uvedba in povrnitev

PR ostane Draft. Commit uporablja `[CF-Pages-Skip]`, ker Pages sicer samodejno gradi preview veje. Ni mergea, deploymenta, spremembe konfiguracije, triggerjev, Sheets, Script Properties ali backloga.

Po ločeni odobritvi se uvede samo website commit; pri obstoječem brskalniškem predpomnilniku starega GET je možen do 300-sekundni prehod. Novo stanje je 503 brez predpomnjenja v SL/EN. Preveriti prazno lestvico, jasno sporočilo in delovanje ostalih vsebin domače strani. Predstavitveni izbor prihajajočih tekov ohrani obstoječi datumski fallback in se ne predstavlja kot lestvica zanimanja.

Tehnična povrnitev: vrnitev website deploymenta `47f3dced-06d7-4820-a36d-19d2a6bce661` ali revert commita po odobritvi. To ponovno odpre znano zastarelo/legacy lestvico, zato je ob težavi s prikazom varneje ohraniti zaprtje API in popraviti samo besedilo. Ob tem PR ni nastal noben podatkovni zapis, ki bi zahteval podatkovni rollback.
