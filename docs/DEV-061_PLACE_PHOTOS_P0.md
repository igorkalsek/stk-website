# DEV-061 — P0 katalog fotografij krajev (18. 11. 2026)

## Stanje

Pripravljena je začetna zbirka **13 kandidatov** v `src/data/place-photo-candidates.json`.
Kandidat pomeni: izvirna stran Wikimedia Commons in navedena avtorska/licenčna
metapodatka sta preverjena; **fotografija še ni uredniško potrjena**.
Noben kandidat ni prenesen, optimiziran, dodan v javni HTML, OG predogled ali
produkcijski CMS. Vsi vnosi imajo `visualReview=PENDING` in `assetPath=null`.

Katalog uporablja stabilne `NEARBY_PLACES.id` iz DEV-056 (Q-identifikatorji),
ne imen krajev ali domnevnih GPS štartov. To ni sprememba Master/API pogodbe.

## Uredniška pravila

1. Preveri dejansko vsebino in vizualno kakovost vsake izvirne fotografije,
   ne samo njenega imena, opisa ali licence.
2. Potrdi ujemanje kraja, vključno z občino in morebitnim istoimenskim krajem.
   **Primer zavrnitve:** `File:Zagorje.jpg` na Commons prikazuje *Hrvatsko
   Zagorje*, ne Zagorja ob Savi. V katalogu je namesto tega namenski
   `File:Zagorje - cerkev.jpg` z izrecnim opisom kraja.
3. Fotografija kraja ni dokaz štartne lokacije, trase, prireditve ali
   aktualne organizatorske potrditve. Prikaz označi kot ilustrativno
   fotografijo kraja, kadar lahko pride do zmede.
4. Pred javnim prikazom preveri per-file licenco in morebitne osebnostne,
   blagovne ali druge pravice; shrani avtorja, izvirnik, licenco in informacijo
   o obrezu/prilagoditvi. Pri CC BY-SA preveri share-alike zahteve za predelavo.
5. Preveri obrez ob razmerjih 16:9 (desktop) in ožji mobile crop; odpravi
   slabo kompozicijo, vidne vodne žige ali zavajajoče prizore.
6. Šele nato prenesi in optimiziraj odobreno datoteko v preverjen javni
   asset-hosting. Izogibaj se neposrednemu hotlinkanju izvirnikov velikosti
   več MB na profilih in ne uvajaj novih plačljivih storitev samo za P0.
7. Izpad ali manjkajoča slika ne sme spremeniti statusa teka, identitete,
   povezav na razpis/prijavo ali stabilnosti statičnega builda.

## Predlog nadaljevanja

- **P0 vizualni pregled:** za 13 kandidatov preveri fotografijo, kakovost,
  pravice, izbor/alternativo in označi le izrecno odobrene vnose.
- **P1 omejen website PR:** ločeno uvedi opcijsko sliko na profilih, z
  ustrezno navedbo vira, brez povečanja mobilnega uvoda; najprej 390/768/1440,
  SL/EN, tipkovnica, performance/LCP in dolg naslov.
- **P2:** samo po dokazu koristi preveri individualni OG predogled in
  morebitne majhne sličice v iskalniku. Ne spreminjaj analitike brez potrebe.

## Preverjanje

`node --test tests/dev061-place-photo-candidates.test.mjs`

Git pravila: en osnutek PR, en logični commit; brez auto-merge, produkcijskega
deploya ali sprememb podatkovnih API-jev. DONE šele po izrecni odobritvi
uporabnika in dokazljivem javnem preverjanju, P0 sam ni produkcijska uvedba.
