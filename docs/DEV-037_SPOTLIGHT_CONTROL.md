# DEV-037: ročni časovno omejen izbor »V ospredju«

Draft; brez mergea, deploya ali aktivacije. Obstoječi DEV-037 in PR-ja #253/#257.

Povezani API PR in celotna pogodba/navodila:
https://github.com/igorkalsek/stk-apps-scripts/blob/codex/dev037-spotlight-control/docs/DEV-037_SPOTLIGHT_CONTROL.md

## Sprememba

`utils-home-spotlight.ts` je izoliran sloj nad **nespremenjenim** `selectHomepageSpotlightRace`. Izbor se preveri s svežimi javnimi Master podatki in ločeno, strogo razločno pogodbo `GET /?spotlight=1` obstoječega Workerja (`ok=true`, `type=homepage_spotlight`, `version=1`, en objekt `selection`). Star API s pogodbo Master ni konfiguracija.

Ročni izbor preveri leto, dejansko vrstico, pričakovani datum in izvorni naziv, natanko eno ujemanje med vsemi surovimi vrsticami, potrjenost, javno vidnost in interval. Ob neveljavnosti, izteku, `selection=null` ali napaki konfiguracije se pokliče izvirni tedenski izbirnik. Ročni izbor obide okno 14–56 dni in izključitev najbližjih štirih. Brez preverljivega izbranega Master leta ni ročne promocije; za avtomatiko se lahko uporabijo druga trenutno dosegljiva leta, kot prej.

`editorial` in `automatic`: UREDNIŠKI IZBOR STK / STK EDITORIAL PICK.
`partner`: PARTNERSKA PROMOCIJA / PARTNER PROMOTION. Brez plačljivega modela.

## Začetni prikaz in življenjski cikel

Ker je Astro stran statična, je začetni izbor iz builda v HTML skrit, analitična zastavica pa izključena. Odpre se šele po zaključku svežih Master in konfiguracijskih zahtevkov. Tako se zastarel build ne pokaže pred ročnim izborom. To pomeni, da kartica brez JavaScripta ostane skrita; ostala naslovnica je nespremenjena.

- Meja dneva in veljavnost sta vedno Europe/Ljubljana, ne časovni pas obiskovalca. Zadnji dan velja vključno, nikoli prek datuma dogodka.
- Ponovni pregled: nova stran, osvežitev, vrnitev fokusa/vidnosti, BFCache in lokalna polnoč, tudi ob DST. Ni novega zunanjega načrtovalnika ali stalnega pollinga.
- Pred ponovnim pregledom se prej prikazana kartica skrije. Zahtevki imajo 10-sekundno mejo, konfiguracija `no-store` in preklic zahtevka. Pozni/stari rezultati po izteku ali menjavi vidnosti se ne uporabijo.
- Ni shranjevanja konfiguracije ali dogodkov. Master uporablja obstoječe deljenje samo sočasnih zahtevkov; ustaljeni odgovori se ne hranijo.
- Obstoječa analitika sledi šele potrjenemu prikazu in ohrani deduplikacijo istega dogodka/leta/mesta. Klik uporablja obstoječo pogodbo in kanonično povezavo. `data-selection-mode` je zgolj diagnostika.

## Poznejša uvedba in prva aktivacija

1. Najprej API PR: odobren merge in Apps Script deployment na obstoječi deployment, privzeto brez aktivne nastavitve. Operater mora preveriti morebitno razliko med Git virom in produkcijskim Apps Scriptom. Workerja ni treba spreminjati; produkcijska forwarding koda je bila preverjena read-only.
2. Preveriti nov javni odgovor z `selection=null`, običajni Master za 2026/2027 in nato odobreno objaviti ta spletni PR.
3. Preveriti avtomatiko na SL/EN pri mobilnem in namiznem prikazu.
4. Šele z ločeno odobritvijo v obstoječem workbooku ustvariti `STK_SPOTLIGHT_CONTROL` in najprej neaktiven zapis `NE`. Glave in primer so v API navodilih. Noben produkcijski list ni ustvarjen v tem PR-ju.
5. Ponovno preveriti 2026 / vrstico 263 / `2026-11-28` / `Zimski jamatlon`. Za pozneje odobren preizkus: obdobje `2026-11-13`–`2026-11-28`, `selection_type=editorial`. Šele nato odobreno `enabled=DA`.
6. Preveriti API, SL/EN, oba formata, oznako, datum, povezavo ter vrnitev z `NE`. Izklop se preveri na naslednjo osvežitev/vrnitev na zavihek; ni potisnega osveževanja že odprte strani.

Naslednji izbor v podprtih letih 2026/2027 zahteva samo urejanje kontrolnega lista. En sam zapis `DA`; ostali `NE`. Napačna ali večpomenska nastavitev izklopi ročni način. Za prihodnja leta velja obstoječa omejitev Master API-ja.

## Preflight in pregled obsega

Preverjeni aktualni main (`1d7791f` splet, `275bab9` API), odprti PR-ji, spletni AGENTS.md, implementacija PR #253 in sprememba besedila #257 ter obstoječi testi. Pred spremembami 875 spletnih unit testov PASS. Javni produkcijski Master potrjuje Jamatlonov posnetek; testi ne aktivirajo produkcije.

Najbližji teki, Največ zanimanja, iskalnik, razpisi, prijave, glasovanje, registracija, organizatorske potrditve, identitete in importi niso spremenjeni. CSS in samodejni izbirnik ostaneta nedotaknjena. Nova pogodba ne razkrije kontaktov ali organizatorskih/varnostnih podatkov.

Povrnitev: `enabled=NE`; ob težavi s kodo je mogoče vsak PR revertati posebej. Če API PR povrnemo prvi, se novi splet sam vrne na avtomatiko, ker star odgovor zavrne kot konfiguracijo. Brez sprememb kanoničnih podatkov.

Stroški in vzdrževanje so praktično enaki: en dodaten majhen GET za konfiguracijo ob preverjanju, brez novih plačljivih storitev, KV/D1, baze ali računov. Kartica med preverjanjem ostane skrita do največ 10 sekund ob počasni/nedosegljivi konfiguraciji. Rezultati testov in preostali koraki so v opisu PR. Pred DONE ostanejo odobritve, dejanska uvedba, ločeno odobrena prva konfiguracija in produkcijski smoke test.
