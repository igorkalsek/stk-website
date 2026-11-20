# DEV-048 P0E — dejanski izplen 3. 11. 2026

**P0D 50 + P0E 41 novih različnih bajtnih GPX = 91 veljavnih GPX pri 26
družinah prireditev.** P0E dodaja 12 prej bajtno nepokritih družin. Vseh 12
različnih neposrednih začetnih URL je bilo prenesenih in strukturno veljavnih.
Število 91 pomeni različne SHA-256, ne 91 potrjenih neodvisnih geometrij ali
uradnih tras 2027. Osem začetnih URL ni več povezanih z današnje izvorne
strani in ohranijo REVIEW izvora/različice.

## Kaj je dejansko preverjeno

| Merilo | P0E |
| --- | ---: |
| Začetne priložnosti iz priloženega Excela | 29 |
| Neposredne povezave: pojavitve / različni URL | 13 / 12 |
| Začetni različni URL z dejanskimi veljavnimi GPX | **12/12** |
| Novi različni veljavni GPX po SHA | **41** |
| Novi različni cilji prenosa | **39** |
| Običajni javni neposredni GPX URL | 34 |
| ZIP URL / dejanski GPX člani | 1 / 3 |
| Datoteke pridobljene prek Drive povezave organizatorja | 4 |
| Prepovedana ciljna prenosa zaradi robots | 2 |
| Nove strukturno neveljavne datoteke | 0 |
| Novi možni geometrijski dvojniki / primerjani pari | 2 / 8 |
| Živi uradni različni URL za GPX/ZIP | **27** |
| Datoteke, na katere se teh 27 URL nanaša | 29 |
| Nove potrjene kanonične izvedbe 2027 | **0** |

JAT Funny/NextGen sta ohranjeni kot ločeni kategoriji. Skupni začetni URL je
prenesen **enkrat**, ne dvakrat; tudi aktualna različica se šteje enkrat.
ZIP gozdnega teka ima tri preverjene člane: 11, 6 in 2,5 km. Ne sklepamo
števila prog iz števila arhivov. Ni podvajanja SHA med novimi datotekami ali
s 50 veljavnimi P0D. Prejšnji neveljavni kočevski vertikal ostaja nespremenjen.

## Vseh 12 začetnih neposrednih URL

Vsi imajo ciljni HTTP 200, dejanske bajte, SHA-256 in `FILE_VALID`.

| Vhodni ID | Proga | Izmerjeno km | Letnik datoteke |
| --- | --- | ---: | --- |
| P0E-001 | JAT 120, prvotna povezava | 122,860 | ni izrecne oznake; mapa 2026 ni dokaz |
| P0E-002 | JAT 80, prvotna povezava | 77,800 | ni izrecne oznake |
| P0E-003 | JAT 50, prvotna povezava | 51,686 | ni izrecne oznake |
| P0E-004 | JAT 25, arhivska | 24,251 | 2025 |
| P0E-005 | JAT 15, prvotna povezava | 17,158 | ni izrecne oznake |
| P0E-006/007 | JAT Funny/NextGen 10 | 11,185 | ni izrecne oznake; ista datoteka |
| P0E-008 | EAORC Uphill senior | 8,678 | 2026 |
| P0E-009 | EAORC Uphill U20 | 3,410 | 2026 |
| P0E-010 | EAORC Trail 25 | 25,521 | 2026 |
| P0E-011 | EAORC Trail 52 | 51,972 | 2026 |
| P0E-012 | Go4Trail Ultra, stara | 63,648 | 2025 |
| P0E-013 | Go4Trail Trim, stara | 10,016 | 2023 |

Priloženi dokument omenja CSV, vendar je bil dejansko priložen Excel. Vseh
29 vhodnih vrstic je iz lista `P0E_NOVI_VIRI` ohranjenih v `input29.csv` in
novem Excel listu `P0E_VHOD29`; nič novih bajtnih validacij ni bilo privzetih
iz priloge.

## Nove družine z dejanskimi GPX

| Prireditev | Novi GPX | Ugotovitev |
| --- | ---: | --- |
| Julian Alps Trail Run by UTMB | 12 | šest prvotnih in šest aktualnih različic |
| EAORC Kamnik 2026 | 6 | Uphill, trail in up/down; odprti/elite/U20 niso dodatne družine |
| Go4Trail | 5 | stari 2025/2023, aktualni 2026 in GO3V |
| Sabotin Trail Evening | 1 | dejanski cilj uradnega gumba, 12,936 km |
| Velenje Trail | 3 | datoteke 2024/2025, ne potrjene kot končne 2026 |
| KBK Trail | 1 | Drive datoteka z imenom KBK2026-nova.gpx, 23,471 km |
| Trail tek Zelene doline | 2 | Hribar 22,034 in Dolinar 12,174 km; letnik datotek neznan |
| Hrastnik Trail | 2 | neposredna gumba: 12,597 in 6,040 km; letnik datotek neznan |
| Lahinja Trail | 3 | Duma 10,102, Velikobukovska 18,385, Republikanka 31,955 km |
| Svinjskih E7 Trail | 1 | 3,075 km; ime vsebuje »Nočna«, letnik neznan |
| Vzpon na Široko | 2 | trail 11,744 km in OŠ 0,691 km; kolesarski GPX izločen |
| Gozdni tek okoli Ajdovščine nad Dolom | 3 | ZIP: 10,798 / 6,186 / 2,526 km |

»Nove« pomeni prej brez bajtno validiranih datotek v P0D; ne nujno prej
neznano ime v raziskovalnem katalogu.

## Letnice, različice in REVIEW

- **JAT:** priloga za 25 km navaja GPX 2025. Ta še deluje, vendar
  [živa stran](https://julianalps.utmb.world/sl/races/25k) zdaj povezuje novo
  datoteko z izrecno oznako 2026. Enako sem pridobil šest aktualnih datotek
  z `pdf.utmb.world`, z neposrednim dokazom iz organizatorjevih povezav.
  Prvotnih šest Cloudinary URL ni bilo na današnjih straneh; njihov prvotni
  uradni pripis ostaja REVIEW. Aktualni »15 km« meri **17,130 km**, »10 km«
  **11,108 km**, »50 km« **54,141 km**. Razdalje niso popravljene v Masterju.
- **Go4Trail:** stara Ultra 2025 in Trim 2023 ostajata ločeni. Današnja gumba
  kažeta datoteki 2026: Ultra **63,179 km**, Trim **12,925 km**; GO3V meri
  **27,637 km**. Sedanja stran ne spremeni zgodovinskega letnika stare datoteke.
- **Velenje:** neposredni gumbi res vrnejo GPX, toda izrecne oznake so
  Družinski **2024**, Pozoj in Mastodont **2025**. To ne potrdi končne trase
  izvedbe 5. 12. 2026 ali nove datoteke 2027.
- **KBK:** stran že govori o 2027, prenesena datoteka pa ima ime **2026**.
  Datotečno ime je močnejši dokaz oznake letnika kot čas nalaganja; povezava
  ni potrditev nespremenjene trase za 2027.
- **Zelene doline:** naslov organizatorjeve strani govori o 2025, Master
  referenca pa o 2026. V GPX ni izrecnega letnika; GPS časov ne uporabljam za
  letnico. **Svinjskih E7** ima ime »Nočna«, trenutni Master pa dnevni dogodek;
  datoteka je veljavna za tehnično presojo, vezava izvedbe ostaja REVIEW.
- **Široko OŠ:** povezava je označena 750 m in meri 691 m, v GPX pa je
  ostalo ime 12 km. Neskladje metapodatkov je zabeleženo, ne skrito.

Osem parov starih/aktualnih različic je primerjanih s P0D metodo 256 vzorcev
po normalizirani dolžini, brez povezovanja segmentov, v obeh smereh. JAT
25 km ima 95. percentil razmika **8,7 m**, JAT 15 km **27,7 m**: oba sta
`POSSIBLE_GEOMETRY_DUPLICATE`, ne dokaz enakosti. Največji vzorčni razmiki so
okoli **489/481 m**, zato delne spremembe niso izključene. Preostalih šest
parov ima večje razlike. Za 82 od skupaj 91 datotek obstajajo 6-decimalni
geometrijski prstni odtisi; enakih ni. Devet starih P0D datotek nima takega
odtisa. To ni izčrpna prostorska deduplikacija vseh tras.

## Izločeni in nedokončani viri

**Haloze:** uradna občinska stran ponuja dve datoteki, toda robots prepove
`/DownloadFile`; obe sta `SOURCE_RESTRICTED`. Bajti niso preneseni. Brez
ugibanja alternativnih naslovov ali obhoda omejitve.

**Plotaroute:** [navodila](https://www.plotaroute.com/tip/1/how-to-download-a-route-to-a-garmin-edge)
opisujejo ročni izvoz, [pogoji](https://www.plotaroute.com/TermsOfUse.html)
pa omejujejo kopiranje z izjemo osebne nekomercialne uporabe. Dovoljenost
projektnega avtomatskega izvoza ni potrjena; Velikonočni tek in Trail Maribor
ostaneta PAGE_ONLY. To ni trditev, da platforma sploh nima javnega izvoza.

**ViewGPX:** [uradni opis](https://www.viewgpx.com/) omogoča prenos javno
deljenih datotek brez računa. Obe kraški povezavi vrneta HTML; v začasnem
Chrome pregledu prve strani se pokaže le noga brez uporabnega gumba ali
neposrednega naslova. Omejeno nalaganje virov v brskalniku je lahko vplivalo
na izris, zato to ni dokaz napake platforme. Izvoz ni dokončan; vgrajeni XML
ni prištet med prenesene GPX. Račun ni ustvarjen.

**Drugi pregledani organizatorji:** Fara PDF in Zaplana vodita na Garmin
zemljevide; Triglav napoveduje GPX/navodila pred izvedbo; pri zimskem Bohinju,
Šršenjem trailu, Gačah in Trail Velika Planina ni bil identificiran dovoljen
neposredni GPX v pregledanih virih. Gaške kolesarske sledi so izločene kot
napačna disciplina. Vir teka na Lisco vrne HTTP 500. Pregled je ustavljen
zaradi padajočega izplena novih družin, ne zaradi doseganja določene številke.

## Ohranitev, uporabnost in preverjanje

Vseh **26 datotek P0D** je bajtno nespremenjenih glede na `47547c3`.
Posodobljen CSV ohrani vseh **139 vrstic in vseh 68 stolpcev P0D**, nato
doda polja P0E in **33 novih raziskovalnih/kategorijskih/progovnih vrstic**,
ID `GPX-0140`–`GPX-0172`. Skupnih 172 vrstic ni število različnih GPX.
Različice in skupni GPX kategorij so vezani prek rezultatnih ID/SHA.

Excel ohrani vseh **15 listov P0D**, njihove vrednosti in formule, ter doda
štiri liste P0E: povzetek, katalog, datoteke in izhodiščnih 29 priložnosti.
Prejšnja dokazila se ne prepisujejo. Master 2026/2027 je ponovno prebran
samo prek Worker API; izbrani dejanski snapshoti so ločeni od namigov priloge.
Ni novih race_id/edition_id ali samodejnega potrjevanja izvedbe iz letnice strani.

Za poznejšo presojo je uporabnih **27 trenutno živih uradnih URL za GPX/ZIP**
(29 datotečnih povezav). Osem umaknjenih prvotnih povezav ni vključeno.
Štirje Drive prenosi so bajtno preverjeni, vendar servis ne izpostavi izvornega
HTTP/DNS/redirect pregleda in anonimni dostop ni neodvisno potrjen; niso med
27 javnimi neposrednimi povezavami. To ni dovoljenje za ponovno gostovanje:
`rehost_permission=NOT_ESTABLISHED` ostaja za vse. Najbolj pregleden izplen
za arhivsko presojo so aktualni JAT, EAORC in Go4Trail; pri Velenju je treba
ohraniti zgodovinske oznake, pri KBK/Zelenih dolinah pa omejitve Drive.

Obstoječi validator je uporabljen nespremenjeno za XML/ZIP presojo. Dodani so
samo eksplicitni dovoljeni gostitelji in popravljeno UTF-8 kodiranje
ne-ASCII URL (Velenje Družinski), z regresijskim testom. Izvirna neuspešna
lokalna zahteva in razlog ponovitve sta v `retry-evidence.json`. Limiti,
DNS/preusmeritve, DTD in ZIP varnost ostajajo aktivni. Brez polne XSD validacije.

**33/33 testov PASS.** Neodvisni pregled ohranitve P0D, CSV/Excel formul,
vseh 41 lokalnih payloadov/SHA/razdalj in ZIP varnosti je izveden z:

```sh
python3 -m unittest discover -s docs/dev048-gpx -p 'test_*.py' -v
python3 docs/dev048-gpx/p0e/verify.py --payloads
git diff --check
```

P0E GPX metapodatki ne objavljajo osebnih imen/računov; ostanejo samo naslov
proge in tehnična dejstva. GPX/ZIP bajti so zunaj Git, ne na STK/R2.
**PR ostaja raziskovalni Draft. Brez sprememb Masterja, PUBLIC_LS, registry,
API, produkcijskega UI, kontaktiranja organizatorjev, novih storitev,
računov ali scheduled nalog; brez mergea in deploymenta.**
