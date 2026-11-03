# DEV-044 F4 – ločen brief za odzivnost lestvice

**Predlog, brez backend implementacije ali produkcijskih sprememb.** Osnova: meritve in meje v [F4 poročilu](DEV-044_F4_HOME.md), 3. 11. 2026.

## Problem in dokazi

Obstoječi Website relay 2026 vrne HTTP 200 v 35,945 s pri prvem ter 4,342 s pri ponovljenem zajemu. Frontend prej doda še zaporedni Master (~3–3,5 s). F4 odstrani to zaporednost in povsem razveže običajne teke; **ne odpravlja 35,9 s strežniškega čakanja**. Timeout 55/60 s ostane zgornja meja, ne pospešitev.

Aktualni GitHub `projects/stk-content-api/RecentInterest.gs`, blob `ee3ddb5b02de738097326baf406be104364b5725`, ima cache preverjanje šele po obeh Masterjih in celotnem CHANGE_LOG. To je devet `getValues` range branj na veljavnem cache zadetku, poleg drugih Sheet operacij. Ob missu je za neprazen zajem približno 25 takih branj: celotna timestamp projekcija RAW dvakrat, A:H in Q okna dvakrat, ponovno oba Masterja/CHANGE_LOG za drift. `RecentInterestCore.gs` dodatno normalizira čase in preverja časovno identiteto ter izračuna obe leti. Zgodovinski native timestamp prefix je že optimiziran v DEV-047; tega popravka ne predlagamo ponovno.

**Dokazano ozko grlo za uporabnika:** čakanje na strežniški odgovor, dodatno zaporedni frontend Master. **Nepotrjeno:** posamezen najdražji Apps klic, CacheService hit/miss in obnašanje sočasnih cold obiskov. GitHub koda ni nov neodvisen pregled bajtov serving v52; aktualno produkcijsko povezavo potrjujeta backlogov release zapis in uspešen javni odgovor. Ne pripisuj vseh 35,9 s brez meritve zgolj Sheets I/O, pretvorbi časov ali score builderju.

## Najmanjši nadaljnji paket

1. Pripni takrat aktualni main in serving read-only baseline. Uporabi že pridobljen, zaseben zamrznjen testni vzorec, ne ponovnega produkcijskega RAW audita. V lokalnem/staging harnessu izmeri čas in število klicev za Master, CHANGE_LOG, timestamp scan, okno, drift, core, cache get/put ter velikost cache vnosa. Nobene nove javne telemetrije ali endpointa.
2. Najprej preveri optimizacije **z isto pogodbo in enakimi varovali**: ponovno uporabo že formatiranih enakih časov znotraj ene zahteve, izračun nespremenljivih lokalnih mej enkrat, indeks časovnih sprememb po `(year, master_row)` namesto ponavljajočega skeniranja ter manj redundantnih bralnih klicev ob enakem drift dokazu. Izberi samo tiste, ki v harnessu dajo merljiv prihranek. Ne odstrani drugega branja na podlagi hitrostne predpostavke.
3. Če prevlada cache-hit I/O, oblikuj ločen pregledan načrt invalidacije na **obstoječem** CacheService/Workerju. Ohraniti mora trenutno preverjanje Master/status/javne vidnosti, točno identiteto, sedem zaključenih dni Ljubljana, največ 300 s starosti ter 503 ob nedosegljivem ali spremenjenem viru. Slepo serviranje istega JSON-a s CDN TTL ali preskok živih kontrol ni enakovredna optimizacija. Če pravilnosti ni mogoče ohraniti z majhnim posegom, NO-GO za ta del.
4. Samo ob dokazani potrebi obravnavaj hkratne cache misse. Ne drži globalnega Apps locka čez dolgo obdelavo in ne dodajaj triggerja/predizračuna v tej nalogi. Brez nove baze, agregatnega writerja, trajne kopije RAW ali sprememb uteži.

## Merilo uspeha in letniki

Z istim zamrznjenim vzorcem primerjaj prej/potem po fazah; rezultati, vrstni red in javna identiteta se morajo povsem ujemati. Kot cilj za oceno, ne obljubo, uporabi vsaj 50 % manj časa pri cold poti in vsaj 30 % manj pri warm poti. Objavi dejanske čase; če jih ni, ne razglasi izboljšanja. Nato največ en odobren cold in en repeat smoke prek obstoječega Workerja, oba letnika preverjena z minimalnim dodatnim branjem, brez load testa. Ločena review in odobritev za uvedbo/flags, dokumentiran code-only rollback.

Ohrani 2026/2027 in ključe `(event_year,event_id)`. Apps cache že hrani poročilo z obema lestvicama; enoten večletni frontend rezultat zato sam po sebi ne odstrani dragega začetnega izračuna. Sedanja javna pogodba je vezana na izbrano leto. **Večletne lestvice ne predlagamo v tem paketu:** dodatna pogodba/identitetna tveganja nimajo dokazanega zmogljivostnega prihranka.
