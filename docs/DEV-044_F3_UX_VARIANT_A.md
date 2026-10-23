# DEV-044 / F3-UX – varianta A

23. 10. 2026, Europe/Ljubljana. Omejena implementacija izboljšave razdelka »Aktualno«, iz aktualnega oddaljenega `main` `4bc2e00f81ecc314c0bbe2557ca48e374dc9fedf`.

## Obseg in preflight

Pred posegom preverjena živa SL/EN produkcija v Chromiumu, oddaljeni main in odprti PR-ji. Edini odprti PR je dokumentacijski Draft [#237](https://github.com/igorkalsek/stk-website/pull/237); ne vsebuje prekrivajoče implementacije. DEV-018, DEV-040 in DEV-044 F2 niso ponovno izvedeni. Začetne nepovezane lokalne datoteke so ohranjene.

- V SL in EN je obstoječa sekcija naslednjih tekov v DOM pred roki prijav. Mobilni vrstni red in vrstni red tipkovnice sta usklajena. Pri namizni širini ostanejo roki levo in glavni seznam desno; kadar ni rokov, seznam zapolni razpoložljivo širino.
- Manjši naslov »Aktualno / Current races«, manj uvodnih razmikov in mobilnega notranjega odmika.
- Akcije naslednjih tekov uporabljajo celotno širino kartice. Na telefonu ostane glavna uradna akcija z besedilom; sekundarni Razpis ob ločeni Prijavi, koledar in shranjevanje uporabljajo obstoječe ikone. Njihova polna dostopna imena ostanejo. Samostojni Razpis ostane z besedilom, združeni razpis/prijava se lahko prelomi. Kontrole in odprte koledarske možnosti imajo najmanj 44 × 44 px.
- Koledarski meni se na telefonu odpre v toku kartice, da njegove možnosti ne segajo izven zaslona.

Spremenjena sta samo vrstni red obstoječih blokov SL/EN ter CSS, omejen na razdelek. Brez spremembe izbora, vrstnega reda dogodkov, identitet, podatkovnega nalaganja, API-jev, analitike, SEO, iskalnika, Mojih tekov ali drugih sekcij. Brez novih komponent, odvisnosti ali storitev.

## Primerljiva meritev

**PREJ je dejanski produkcijski izris, POTEM je lokalni build kandidata.** Za obe strani uporabljeni isti javni odgovori obstoječega Workerja in obstoječega interest-preview, zajeti pred posegom. Odgovori so v brskalniku prestreženi in ponovljeni; to je kontrolirana primerjava postavitve, ne meritev žive latence. Čas je fiksiran na 23. 10. 2026 ob 14:00 CEST. Svež izoliran kontekst za vsako kombinacijo SL/EN × 390/1440 × brez shranjenih / 2026 / 2027 / obe leti. Shranjene reference so lokalne: Čaven 2026 `r000251` in Knap Trail 2027 `r000002`, status Planiram/Planning. Analitika je izključena in vsi ne-GET/HEAD zahtevki blokirani.

| Jezik / širina | Višina Aktualno prej | Potem | Zmanjšanje | Nižje sekcije prej |
|---|---:|---:|---:|---:|
| SL / 390 | 1742,23 px | 1308,09 px | **24,9 %** | 434,14 px |
| EN / 390 | 1714,23 px | 1266,50 px | **26,1 %** | 447,73 px |
| SL / 1440 | 743,81 px | 689,81 px | 7,3 % | 54 px |
| EN / 1440 | 823,81 px | 689,81 px | 16,3 % | 134 px |

Rezultat je enak za vsa štiri lokalna stanja pri istem jeziku/širini. [Vseh 16 primerjav](evidence/dev044-f3-ux/comparison.json) potrjuje:

- isti izpis besedila dogodkov in vrstni red kartic;
- isti nabor povezav, akcij, datumov, dostopnih imen in identitet v razdelku (primerjava neodvisna od namerno spremenjenega vrstnega reda dveh sekcij);
- povsem enak `innerHTML` vseh drugih vrhnjih sekcij domače strani;
- nič horizontalnega prelivanja in nič JS page errors;
- zanimanje in osebni blok prideta prej za višinski prihranek; uvod, statistika in prvi izpostavljeni tek se ne premaknejo.

## Primerjalni posnetki

Izrezi pokažejo celoten spremenjeni razdelek. Lepljiva glava je samo med izrezom skrita, da ne prekrije kartic. Širina izreza je dejanska širina razdelka znotraj navedenega viewporta.

| Viewport | Produkcija pred spremembo | Lokalni kandidat |
|---|---|---|
| SL / 390 | [prej](evidence/dev044-f3-ux/before-sl-390-current.png) | [potem](evidence/dev044-f3-ux/after-sl-390-current.png) |
| EN / 390 | [prej](evidence/dev044-f3-ux/before-en-390-current.png) | [potem](evidence/dev044-f3-ux/after-en-390-current.png) |
| SL / 1440 | [prej](evidence/dev044-f3-ux/before-sl-1440-current.png) | [potem](evidence/dev044-f3-ux/after-sl-1440-current.png) |
| EN / 1440 | [prej](evidence/dev044-f3-ux/before-en-1440-current.png) | [potem](evidence/dev044-f3-ux/after-en-1440-current.png) |

## Preverjanje

- `npm test`: **770/770 PASS**.
- Končni `npm run build`: **PASS, 677 strani**.
- Brskalniške regresije: **226 različnih scenarijev PASS**: 84 home (vključno z 12 novimi), 22 home-stats, 28 public-get-dedup, 41 finder, 35 my-races-statuses in 16 registration-deadlines. Končni home/stats/GET/roki na dokončanem buildu: **150/150 PASS**; iskalnik in shranjeni statusi: **76/76 PASS** v širšem zagonu. Brez preskočenih testov.
- `git diff --check`: PASS.

Dvanajst novih scenarijev v obstoječem `home.spec.ts` preverja SL/EN pri 390/1440 px: dolge nazive, prazno stanje, manjkajoč kraj/regijo in prijavo, samostojni Razpis, vse uradne akcije, year-safe profile, dostopna imena, tipkovniški fokus, velikost kontrol, koledarske možnosti, save/unsave, mobilni/namizni in DOM vrstni red ter polno širino seznama brez rokov. Testi se izvajajo v obstoječem home ukazu in CI; nove avtomatizacije ni.

Med razvojem sta bili popravljeni podedovana mobilna širina koledarskega menija in širina datumske oznake. Začetne napake novih testov zaradi normaliziranega vezaja, napačnega pričakovanega EN besedila in preverjanja fokusa brez tipkovniškega načina so popravljene v testnih pričakovanjih. Prvi širši zagon je imel tri prehodne napake profilnih rokov ob prekrivanju z buildom; končni zagon je izveden na dokončanem buildu.

## Meje in povrnitev

Preverjen je Chromium s simuliranima širinama, ne fizični telefon ali Safari/WebKit in ne dejanski screen reader. Polna dostopna imena in tipkovniški fokus ikon so preverjeni programsko. Zunanji postopki prijave in dodajanje v koledarske račune niso izvedeni. Pri širšem datumu/ponudbi se absolutna višina spremeni; odstotki veljajo za isti zajeti nabor podatkov.

Povrnitev: revert enega commita. Podatkovne migracije, novi viri ali spremembe lokalne hrambe niso potrebni. Commit uporablja `[CF-Pages-Skip]`; dostava je Draft PR brez mergea ali deploymenta.
