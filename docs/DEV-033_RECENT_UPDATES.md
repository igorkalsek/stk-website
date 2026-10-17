# DEV-033 — sveže spremembe 2026/2027 (REVIEW)

Pripravljeno 17. 10. 2026 na `main dc7e45f28cd8729d992e1f4153b98b93b4fe6387`
(združeni #229/DEV-038). **Brez merge ali deploya. DEV-033 ostaja odprt do
produkcijske verifikacije in uporabnikove odobritve.** Spremljevalna API veja:
`igorkalsek/stk-apps-scripts:codex/dev-033-recent-updates`.

## Sprememba

Oba homepage jezika zahtevata
`/recent_updates?days=7&limit=4&years=2026,2027` prek obstoječega Workerja.
Pred prikazom preverita `ok: true` in
`recent_updates_last_days.years: ["2026", "2027"]` in veljaven seznam `events`. Stari produkcijski API
neznani parameter prezre; odsotnost te potrditve zato pomeni nevtralni prikaz
nedosegljivosti, ne tihega prikaza samo 2026.

Javni Master se naloži prek `/` in `/?year=2027`. Obstoječi `loadJson` cache
ponovno uporabi zahtevo za letno statistiko DEV-038; browser regresije potrjujejo
še vedno eno zahtevo za 2027. Nobenega neposrednega dostopa do Sheets ni.

Ujemanje in deduplikacija uporabita leto skupaj z Master vrstico. `R000037`
je na teh profilih izpeljan iz vrstice in **sam ni identiteta skozi leta**.
Manjkajoče leto, neujemajoč datum, nasprotujoči se row/ID kandidati ali dvoumna
Master identiteta pomenijo kartico brez povezave in brez analitičnih atributov.
Ujemanje po točnem datumu/nazivu/kraju ostane možno, kadar ni row/ID kandidata.
Ob izpadu Masterja 2027 kartice 2027 ostanejo vidne brez povezav; potrjene
povezave 2026 ostanejo uporabne. Izpad recent API, neveljaven datum spremembe
ali nepodprt contract prikaže jasno obvestilo o nedosegljivosti.

Skupni izbor največ štirih kartic uporabi kanonični globalni seznam
`recent_updates_last_days.events` in ohrani njegov vrstni red. Starih treh
skupin ne združuje ali razvršča na novo. Oznake
Dodano/Potrjeno/Posodobljeno in Added/Confirmed/Updated ostanejo vezane na
izrecni `update_type`; neznan tip ne dobi izmišljene oznake.

Klik/impression uporablja leto in ID preverjenega Master dogodka. Kontrolni
klik na 2027!37 ima `event_key: "2027:r000037"`, ne `2026:r000037`.

## Preflight in konkretni dokazi

Aktualni javni recent API je neposredno in prek Workerja vrnil HTTP 200, tri
UPDATED dogodke 2026 ter obdobje 11.–17. 10. Produkcija še nima novega contracta.
Read-only odčitek kanoničnega Apps Script deploymenta potrdi v47 in nespremenjeni
produkcijski klasifikator; API veja temelji na main #105/DEV-032 in ohranja #104.
PR #100 ostaja ločen Draft; drugi Content Pack PR-ji niso vključeni.

Sveži Worker Master 2027 potrjuje:

| Master | Dogodek | Datum | Status/vidnost |
| --- | --- | --- | --- |
| 2027!37 | Backyard Ultra Ljubljana 2027 | 2027-10-08 | potrjeno / DA |
| 2027!38 | Trail Maribor 2027 | 2027-06-12 | potrjeno / DA |

CHANGE_LOG 1016/1017 iz zasebnega odčitka predhodnega v47 preverjanja
17. 10. okoli 00:35 CEST vsebuje oznaki `NEW:` in datum spremembe 16. 10.
Nov neposredni Sheets GET je vrnil HTTP 403; CHANGE_LOG **ni ponovno preverjen
v živo**. Lokalno predvajanje teh zapisov s svežim javnim Masterjem v API
kandidatu vrne oba kot NEW v 7-dnevnem oknu. To ni trditev o uvedbi v produkcijo.
Podroben dokaz in hash izvora sta v spremljevalnem API poročilu
`projects/stk-content-api/DEV-033_RECENT_UPDATES.md`.

Build vsebuje točne štiri profile:

- `/tek/2027/r000037-backyard-ultra-ljubljana-2027/`
- `/tek/2027/r000038-trail-maribor-2027/`
- `/en/races/2027/r000037-backyard-ultra-ljubljana-2027/`
- `/en/races/2027/r000038-trail-maribor-2027/`

## Preverjanja in P1/P2 pregled

- `npm test`: **582/582 PASS**.
- `npm run build`: **PASS**, 661 strani, vključno s kontrolnimi profili 2027.
- `npx playwright test tests/browser/home.spec.ts tests/browser/home-stats.spec.ts --project=chromium`:
  **86/86 PASS**. Vključene vse obstoječe home/statistika regresije in 20 večletnih
  primerov za SL/EN, 390/1440 px, uspeh, izpad Masterja 2027, izpad recent API
  stari API in manjkajoči `events`. Zunanji podatkovni/analitični klici so v testih prestreženi.
- Unit primeri preverijo `2026!37` proti `2027!37`, manjkajočo/nasprotujočo
  identiteto, dvojnike, omejitev, oba jezika profilov in potrditev contracta.
- Vizualni pregled izrezov razdelka SL/EN na mobilni in namizni širini;
  browser preveri tudi odsotnost horizontalnega overflowa.
- `git diff --check`: PASS. P1/P2 regresijski pregled ni odkril dodatnih težav:
  ni povezovanja/analitike v napačno leto, ni sprememb DEV-038 statističnih
  kartic, iskalnika, Moj STK ali drugih blokov. CSS in infrastruktura nista
  spremenjena. API sklop spremljevalne veje: 84/84 testov in 65/65 recent testov pri TZ=UTC.

Chromium je macOS MachPort znotraj peskovnika zavrnil. Uspešna browser
preverjanja so bila izvedena lokalno zunaj peskovnika. Za build je bila uporabljena
ločena namestitev obstoječega lockfila, brez spremembe odvisnosti.

## Uvedba po odobritvi

Najprej pregledati in po odobritvi uvesti API opt-in na ohranjeni v47 osnovi.
Pred tem ponovno prebrati živi CHANGE_LOG, preveriti vmesne produkcijske popravke
in #100. Preveriti oba NEW primera neposredno in skozi Worker ter legacy
odgovore. Šele nato uvesti website. V produkciji preveriti obe letni statistiki,
SL/EN povezave, mobilni/namizni prikaz in analitiko po letu. Varna povrnitev gre
v obratnem vrstnem redu. Ob delnem izpadu virov ali starem API stran ostane
brez napačnih povezav in oznak. Nobeno od teh operativnih dejanj ni bilo izvedeno.


## Dopolnitev po neodvisnem REVIEW — P2

Pri istem `recent_update_date: 2026-10-16` je kanonični vrstni red
**Trail Maribor 2027 (2027-06-12) pred Backyard Ultra Ljubljana 2027
(2027-10-08)**. Stran tega zaporedja ne spremeni po nazivu. Unit in SL/EN
browser regresije na 390/1440 px pošljejo `new_events` v nasprotnem vrstnem
redu; prikaz mora slediti `events`. V kanoničnem seznamu je tudi dvojnik in
peta dodatna kartica: rezultat mora vsebovati štiri kartice brez dvojnika.
Ohranjeni so oba profila 2027, profil 2026!37 in klik
`event_key: 2027:r000037` za Backyard, ki je zdaj na drugem mestu.

`hasMultiYearRecentUpdatesContract` poleg `ok` in `years` zahteva seznam
objektov `events`; selection zahteva veljavne datume sprememb. Manjkajoči ali
neveljavni seznam povzroči nevtralni prikaz nedosegljivosti in nikoli fallbacka
na drugačno razvrščanje skupin. Prazni kanonični seznam je veljaven prazen
odgovor. Letna deduplikacija, omejitev štirih kartic in preverjanje Master
identitete ostanejo ohranjeni. Stari exported helper za skupine ostane zaradi
združljivosti, vendar ga domači strani ne uporabljata.

API spremljevalni popravek omeji ohranitev `CHANGE_LOG.timestamp` Date na
opt-in reader in zavrne navidezni uspeh ob manjkajočem/nedosegljivem obveznem
Masterju. Njegovi integracijski testi gredo skozi dejanski reader. V objavljenem
b8d1100 specifična HH:mm pretvorba za `timestamp` ni bila reproducirana;
globalni normalizator je ostal nespremenjen in opt-in pot zdaj Date izrecno
ohrani. Ponovni neposredni Sheets GET je tudi v nadaljevanju vrnil HTTP 403;
nova lokalna kontrola uporablja dokumentirani dokaz ter uporabnikovo
potrditev neodvisnega živega REVIEW. Ni trditve o novem živem odčitku te seje.

Pregled P1/P2 po popravku: nobenega napačnega vrstnega reda kontrolnih dogodkov,
povezovanja ali analitike med letoma; regresije statistike DEV-038 ostanejo
uspešne. PR-ja ostajata #106 in #230, DEV-033 ostaja **REVIEW**. Brez merge,
deploya, sprememb Cloudflare/Apps Script ali zapisov v Sheets.
