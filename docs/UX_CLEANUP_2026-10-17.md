# STK: zgoščen prikaz domače strani in profilov

Omejena vizualna izboljšava iz `main` **47d686dcb7a89ea2ef601f11b8e14d8a09ded3de**, 17. 10. 2026. Ena veja `codex/stk-compact-home-profiles`, en commit in Draft PR. Brez mergea, deploymenta ali sprememb infrastrukture.

## Preflight in potrjene težave

Pred spreminjanjem kode so bili pregledani aktualna produkcija, svež `origin/main`, repo AGENTS.md, odprti PR-ji (ni odprtih; ponovno preverjeno pred commitom), Astro strani, skupni CSS, formaterji, shranjevanje in obstoječi unit/browser testi. Začetne slike so dejanski produkcijski zajemi iz Chromiuma, ne rekonstrukcija stare kode.

Prebran je bil kanonični [razvojni backlog](https://docs.google.com/spreadsheets/d/1B7fWHfu3ylDTEuU6vKG--riFQMRx7-URriHcuT8F4sc/edit), samo za razvojni kontekst. Master Sheet ni bran. Vsi javni podatki dogodkov so iz obstoječega STK Workerja.

- **DEV-018 DONE**, PR #218/#220: širine iskalnika, gostota mobilnega iskalnika in osnovna mobilna glava profila so že izboljšani.
- **DEV-020 DONE**, PR #225: bele oznake profilnih značk in kontrast naslovov dejstev ostanejo.
- **DEV-031 DONE**, PR #227/#228: nevtralni fallback in preverjena v2 semantika rokov ostaneta; veljavnosti dokazil se ne podaljšuje.
- **DEV-038 DONE**, PR #229: podpora za statistiko obeh let, podatkovni viri, štetje in stanja nedosegljivosti so že rešeni.
- **PR #231** je že v main: mobilna vsebina pred pomožnimi orodji in primaren samostojni Razpis ostaneta. DEV-033 iz #230 ohrani kanonični vrstni red, year/row ujemanje in klasifikacije sprememb.

Produkcija pri 390 px potrjuje: prvi izpostavljeni tek šele pri 714 px (SL); samo 140 px širine za naziv ob treh ikonah; zvezdico v svoji vrstici pri zanimanju; poudarjeno dvovrstično metapodatkovno vrstico sprememb; dva izpisa datuma ter ponovljena kraj/regija v glavi Go4trail. Akcije izpostavljenih kartic imajo na večjih širinah le 34 px višine. To so preostale težave, ne ponovna izvedba zaključenih nalog.

## Izvedene spremembe

1. **Hero:** krajši mobilni odmik od navigacije, manj notranjih razmikov, enako široki sekundarni poti in krajši prelomi Tekobota. Naslov, primarna akcija, branding, barve in grafično ozadje ostanejo. Prosojnost obstoječe dekoracije je zmanjšana, da besedilo nad njo doseže kontrastni prag.
2. **Statistika:** usklajena mreža obeh blokov, bolj vidne številke s tabularnimi števkami, povezavi do letnih koledarjev ob naslovih in jasen napis, da se 2027 dopolnjuje. Povezavi ostaneta visoki 44 px. Brez sprememb endpointov, števil, cachea ali pravil štetja.
3. **Izpostavljeni teki:** na telefonu datum in naziv dobita svojo širino, akcije so združene spodaj; kraj/regija sta vidna. Obstoječa primarna uradna akcija ostane nespremenjena: pri dogodku s prijavo je to Prijava, sicer Razpis. Koledar, shranjevanje in dostopna imena ostanejo. Vse tri akcije in odprte koledarske možnosti imajo najmanj 44 × 44 px. Namizne kartice imajo poravnano spodnjo vrstico akcij tudi ob različnih dolžinah naziva. Obstoječi izbor, omejitev treh in vrstni red so ohranjeni.
4. **Največ zanimanja:** kompaktna vrstica z rangom 01–05, datumom nad nazivom in krajem pod njim; zvezdica ostane v desnem stolpcu ob dogodku. Na večjih širinah ostane obstoječa mreža, vendar z eksplicitnimi vrsticami za datum, naslov, kraj in akcijo. Algoritem, analitični vir, prazna/error stanja in Moji teki so nespremenjeni.
5. **Sveže spremembe:** diskretna vrstica `Posodobljeno · 16. okt. 2026`, nato naziv, ločena vrstica datuma dogodka in kraja/regije ter opis. NEW/CONFIRMED/UPDATED ostanejo Dodano/Potrjeno/Posodobljeno oziroma Added/Confirmed/Updated; neznan tip ne dobi izmišljene oznake. Datum dogodka ohrani leto in semantični `<time>`. Kanonični API vrstni red, identitete in analitični atributi ostanejo.
6. **Profili:** samo ena oznaka datuma, kraj in regija v skupnem informacijskem polju, brez dodatne regijske značke. Ura, razdalje in podlaga ostanejo pogojeni z dejanskimi podatki. Ob manjkajočem kraju ostane znana regija; praznih polj ne dodajamo. Pokal/družinska ponudba ostaneta ločeni znački. Mobilni Moj tek je manjši: shranjevanje ob naslovu, native izbira statusa spodaj, oznaka in pojasnilo sta še vedno vidna. Ni razširljivega razdelka, novega stanja ali nove hrambe. Popravljen je kontrast pojasnila na prosojnem ozadju.
7. **Datumi SL/EN:** oba obstoječa badge helperja uporabljata skupen predstavitveni formater. Primerljivi domači seznami prikazujejo dan in kratek datum; datum iz drugega leta dobi eksplicitno letnico glede na obstoječi Ljubljana today helper. Profil ohrani leto v edini datumovni oznaki; spremembe imajo vedno obe letnici v ločenih vrsticah. Kanonične vrednosti, date-only parsing, časovni pasovi, koledarski izvozi in formaterji drugih strani se ne spreminjajo.

Nameren kompromis: izpostavljena mobilna kartica dobi drugo vrstico za 44 px akcije, zato je posamezna kartica višja. To odpravi stiskanje naslova in pokaže kraj; uvod hkrati postavi **prvi konkretni tek višje**. Celoten blok izpostavljenih tekov je pri produkcijskih treh dogodkih višji za približno 125 px. Naslednji razdelek se zato lahko začne nekoliko nižje. To je izrecno izmerjeno, ne predstavljeno kot splošno zmanjšanje vseh višin. Na namizju se prvi tek premakne za približno 5 px navzdol zaradi dostopnejših kontrol in statistike.

## Primerljivi posnetki in meritve

Isti javni API odgovori so bili zajeti ob produkcijskem pregledu in ponovno uporabljeni lokalno; isti dan, časovni pas, svež kontekst, lokalizacija in viewport. Vsi ne-GET/HEAD zahtevki so blokirani; analitika je izključena. Pri komponentnih izrezih je skrita samo lepljiva navigacija, da ne prekriva vsebine. Celotna začetna zaslona `*-home.png` ohranita navigacijo. Brez interakcij s produkcijskimi prijavami, glasovanjem ali koledarskimi računi.

| SL, 390 px | Prej: produkcija | Potem: lokalni kandidat |
| --- | --- | --- |
| Prvi zaslon | [prej](evidence/ux-cleanup-2026-10-17/before-sl-390-home.png) | [potem](evidence/ux-cleanup-2026-10-17/after-sl-390-home.png) |
| Hero | [prej](evidence/ux-cleanup-2026-10-17/before-sl-390-hero.png) | [potem](evidence/ux-cleanup-2026-10-17/after-sl-390-hero.png) |
| Statistika | [prej](evidence/ux-cleanup-2026-10-17/before-sl-390-stats.png) | [potem](evidence/ux-cleanup-2026-10-17/after-sl-390-stats.png) |
| Izpostavljeni teki | [prej](evidence/ux-cleanup-2026-10-17/before-sl-390-featured.png) | [potem](evidence/ux-cleanup-2026-10-17/after-sl-390-featured.png) |
| Največ zanimanja | [prej](evidence/ux-cleanup-2026-10-17/before-sl-390-interest.png) | [potem](evidence/ux-cleanup-2026-10-17/after-sl-390-interest.png) |
| Sveže spremembe | [prej](evidence/ux-cleanup-2026-10-17/before-sl-390-updates.png) | [potem](evidence/ux-cleanup-2026-10-17/after-sl-390-updates.png) |
| Glava Go4trail | [prej](evidence/ux-cleanup-2026-10-17/before-sl-390-profile.png) | [potem](evidence/ux-cleanup-2026-10-17/after-sl-390-profile.png) |

V [mapi dokazil](evidence/ux-cleanup-2026-10-17/) so enaki pari za EN 390 in SL/EN 1440 px. [Celotna primerjava](evidence/ux-cleanup-2026-10-17/comparison.json) vsebuje vseh 16 stanj SL/EN × 390/430/768/1440 × domača/profil; [produkcijski odčitki](evidence/ux-cleanup-2026-10-17/before.json) in [končni odčitki](evidence/ux-cleanup-2026-10-17/after.json) vsebujejo tudi izvorne meritve.

| Metrika, SL 390 px | Prej | Potem |
| --- | ---: | ---: |
| Hero z odmiki | 328 px | 274 px |
| Y prve izpostavljene kartice | 714 px | 635 px |
| Širina naziva izpostavljenega teka | 140 px | 280 px |
| Višina razdelka Največ zanimanja | 1032 px | 660 px |
| Višina razdelka Sveže spremembe | 667 px | 629 px |
| Višina glave Go4trail | 735 px | 619 px |
| Y uradnih profilnih akcij | 568 px | 518 px |
| Višina Moj tek | 214 px | 148 px |

Za EN pri 390 px je prvi izpostavljeni tek pri 635 px namesto 749 px. Nazivi, izbor in vrstni red izpostavljenih dogodkov ter primerjani cilji uradnih/koledarskih povezav so enaki. Normaliziran je samo generirani ICS DTSTAMP. V vseh 16 parih ni horizontalnega prelivanja ali JS page errors.

## Preverjanje in meje

- `npm test`: **585/585 PASS**, brez preskočenih testov.
- Domača stran: **72/72 Chromium PASS**, vključno z osmimi novimi geometrijskimi scenariji SL/EN pri vseh štirih širinah; dolgi/kratki nazivi in opisi, manjkajoč kraj, ločena datuma, prazna/error stanja, NEW/CONFIRMED/UPDATED, mešani leti, year-safe povezave in prestrežena analitika.
- Statistika: **22/22 PASS**, vključuje tudi 320 in 641 px, manjkajoče/nevtralne podatke, obe leti in eno zahtevo na vir.
- Profili in njihov kontrast: **32/32 PASS** — 8 profilnih scenarijev (pet realnih profilov × SL/EN × štiri širine) ter 24 rasteriziranih kontrastnih scenarijev. Go4trail, dolg Kočevsko 2027, pretekla Ormož in Bistriški tek ter skopi Hrastnik 2027; ura/razdalje/prijava manjkajo, kjer jih vir nima. Vrstni red iz #231, obe uradni akciji, primaren samostojni Razpis, canonical/OG/hreflang/JSON-LD, fokus, ≥44 px save/status, dostopni imeni in trajnost save/status po reloadu so preverjeni.
- Iskalnik, Moji teki in roki: **92/92 PASS**, vključno z v2 napakami in iztekom dokazila, save/unsave in osebnimi statusi. Analitični payloadi so prestreženi lokalno.
- Izrisani kontrast domače strani in profilov je dokumentiran v [home-contrast.json](evidence/ux-cleanup-2026-10-17/home-contrast.json) in [profile-contrast.json](evidence/ux-cleanup-2026-10-17/profile-contrast.json). Minimum izmerjenega običajnega besedila je 4,57 : 1 na domači in 4,83 : 1 na profilih (prag ≥4,5 : 1); metoda vključuje dejansko prosojno/gradientno ozadje. Pri meritvi je skrito besedilo, pri domači tudi njegova dekorativna podčrtava.
- Končni `npm run build`: **PASS, 661 strani**. `git diff --check`: **PASS**.
- `astro check`: dve že obstoječi TS2339 diagnostiki (`placement` v finder testu in `remove` na Node v kontrastnem testu). Ponovno primerjano z ločenim arhivom svežega `origin/main`; brez nove vrste napake ali opozorila. Ti diagnostiki nista popravljeni v tem UX obsegu.
- Obstoječi browser CI ostane; isti workflow dodatno izvede domačo stran, statistiko in profilni kontrast. Kontrastni/statistični testi imajo tudi v CI ekspliciten analytics opt-out.

**Odprte ugotovitve:** novih P1/P2 napak v preverjenem obsegu ni. Dve predobstoječi type-check diagnostiki ostaneta odprti. Uredniška zapisa INBOX pri Ormožu in »Osnutek koledarja« pri Bistriškem teku iz audita #231 ostaneta nespremenjena; to ni naloga za avtomatsko čiščenje podatkov.

Preverjen je **Chromium s simuliranimi širinami**, tudi mobilnima 390/430 px. Fizični iPhone, Safari/WebKit in dejanski screen reader niso preverjeni. Native select, label, aria-pressed, dostopna imena, opis in tipkovniški fokus so preverjeni programsko; ni novega zložljivega razdelka. Zunanje prijave in dejansko dodajanje v Google/Apple/Outlook račun niso izvedeni; preverjeni so URL-ji, odprtje native menija in lokalni save/status. Dejanska produkcijska analitika ni sprožena.

## Predaja

Commit in PR uporabljata `[CF-Pages-Skip]`. Brez mergea, deploymenta, novih Cloudflare nastavitev, API-jev, podatkovnih polj, odvisnosti, slik, animacij, admin funkcij, glasovalne logike ali sprememb Masterja/Content API. Predhodne nepovezane lokalne datoteke v docs ostanejo izključene iz commita.
