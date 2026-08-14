# Perheen ruoka: Ateriasuunnittelu & älykäs ostoslista

**Päiväys:** 2026-08-14
**Tila:** Hyväksytty suunnitelma (brainstorming-skilli)
**Tallennuspaikka:** Perheen Seinä -repo (`/opt/data/Projects/perhekalenteri`)

## Tausta & tavoite

Perheen Seinä -sovelluksessa on jo alkeelliset kauppalista-, resepti- ja
ateriasuunnittelu-toiminnot, mutta ne ovat jääneet käyttämättä koska ovat liian
alkeellisia. Tavoite on tehdä niistä toimiva kokonaisuus, jota **Hermes (Nipsu)
automatisoi** ja jonka tulokset näkyvät jaettuna perheelle sovelluksessa.

Keskeinen arkkitehtuuripäätös: **Hermes on ateriasuunnittelun "äly".**
Sovelluksen olemassa olevia AI-endpointteja (`generate-meal-plan`,
`generate-recipe`, `swap-meal`) **ei kehitetä** — ne saavat jäädä ennalleen tai
käyttämättä. Sovellus toimii pelkkänä data-storage-rajapintana ja
näyttökerroksena.

## Perhe & ruokavaliot (kriittinen konteksti)

- **Anna** (äiti) — laktoositon
- **Antti** (isä)
- **Enni** (7v) — laktoositon
- **Aino** (1v) — täysin maidoton

Perhe pyrkii syömään **pääasiassa samoja ruokia** (yhteinen ruokapöytä).
Siksi ateriasuunnittelun oletus on **laktoositon JA maidoton** (pienin yhteinen
nimittäjä), ellei toisin pyydetä. Tämä tarkoittaa käytännössä laktoosittomien
maitotuotteiden / kasvipohjaisten korvikkeiden käyttöä, ei erikoisruokia per
henkilö.

## Arkkitehtuuri (yhteenveto)

```
┌─────────────────────┐      ┌──────────────────────────────┐
│  Nipsu (Hermes/AI)  │      │  Perheen Seinä (Cloud Run)   │
│  • suunnitteluehdot  │      │  • reseptipankki (recipes)   │
│  • älykäs ostoslista │ ───► │  • ruokahistoria            │
│  • ruokavaliomuisti  │ SSL  │  • kauppalista (shopping)   │
│  • Discord-komennot  │      │  • UI (Food.tsx)            │
└─────────────────────┘      └──────────────────────────────┘
        (äly, sinä)                (storage + näyttö)
```

- Hermes kutsuu sovelluksen **storage-APIa** (REST, julkinen, sama kuin nyt).
- Sovelluksen UI näyttää tulokset perheelle.
- Ei uutta ulkoista LLM-integrointia sovelluksen puolelle.

## Osa 1: Tietomalli (server.ts + Firestore)

Lisätään **kaksi uutta kokoelmaa** olemassa olevien rinnalle
(`events`, `shopping_list`, `saved_meal_plans`, `todos`, ...):

### `recipes` — pysyvä reseptipankki
```json
{
  "id": "auto",
  "title": "Lohikeitto",
  "category": "keitto | kasvis | liha | kala | pasta | ...",
  "ingredients": [{ "item": "lohi", "amount": "400 g" }],
  "instructions": ["...", "..."],
  "servings": 4,
  "diet_tags": ["laktoositon", "maidoton"],
  "contains": ["kala"],
  "favorite": false,
  "source": "nipsu | käyttäjä",
  "notes": "korvaa kerma → laktoositon/kaura",
  "created_at": "ISO-timestamp"
}
```
- `diet_tags`: mihin ruokavalioon sopii (`laktoositon`, `maidoton`, `gluteeniton`).
- `contains`: mitä allergeeniä/ainetta sisältää (poissulkua varten).
- `notes`: käytännön korvausvinkki (esim. maito → laktoositon/kaura).

### `meal_history` — mitä on syöty
```json
{
  "id": "auto",
  "date": "2026-08-14",
  "recipe_id": "xxx" | null,
  "title": "Lohikeitto",
  "meal": "päivällinen | lounas",
  "leftovers": true,
  "rating": null | "tykkäsin | ei tykätty"
}
```
- Estää liian tiheän toiston (paitsi suosikit).
- Mahdollistaa tähteiden seurannan.
- `rating`: käyttäjän palaute ("ei tykätty" → ei ehdoteta pian uudelleen).

### API-endpointit (server.ts, pelkkää CRUD-storagea, ei AI-logiikkaa)
```
GET    /api/recipes              → kaikki reseptit
POST   /api/recipes              → lisää resepti
PUT    /api/recipes/:id          → päivitä resepti
DELETE /api/recipes/:id          → poista resepti
GET    /api/meal-history         → historia
POST   /api/meal-history         → kirjaa ateria
DELETE /api/meal-history/:id     → poista kirjaus
```
- Noudattavat olemassa olevaa `getCollection`- / Firestore-mallia kuten
  `shopping_list` (ks. `server.ts` r. 619+).
- **Ei AI-kutsua** — pelkkä tallennus/luku.


### `pantry` — mitä taloudessa on
```json
{
  "id": "auto",
  "item": "kerma",
  "amount": "3+2 rkl",
  "category": "maitotuotteet | vihannekset | liha | pakaste | mauste | ...",
  "expires_at": "ISO-timestamp" | null, // valinnainen, voitaneen hylätä alkutallessa
  "added_at": "ISO-timestamp"
}
```
- Jatkuvasti päivitettävä lista ("kaappi") josta Nipsu lukee saatavilla olevat aineet ostoslistaa laatiessa.
- Sisältää vain perusaineet (esim. suola, öljy, maito, kerma), ei ruokajäämiä.
- `amount` on vapaakirjoitettava (käyttäjä tietää itse miten paljon on "tarpeeksi").

## Osa 3: Älykäs ostoslista & pantri-integraatio (Hermes + sovelluksen storage)

Käyttää olemassa olevaa `shopping_list`-kokoelmaa ja `/api/shopping`-endpointteja.

**Automaattinen kokoaminen + pantri-seulonta:** hyväksyttyä ateriasuunnitelmaa varten Nipsu laskee kaikki tarvittavat ainekset, vertaa ne `pantry`-kokoelmaan ja lähettää **vain puuttuvat ainekset** sovelluksen `/api/shopping`-endpointtiin.

**Työnkulku:**
1. Sanot "suunnittele viikon". Nipsu ehdottaa ruokalajit (esim. lohikeitto, kasviswokka...).
2. Kun hyväksyt suunnitelman, Nipsu laskee tarvittavat ainekset yhteensä.
3. "Mitä näistä löytyy jo kaapista?" — Nipsu tarkistaa `pantry`-kokoelman automaattisesti, mutta kysyy sinulta lopullisesta vahvistuksesta (tai tekee sen itse kun olet kertonut mikä on kotona).
4. Puuttuvat ainekset lähetetään ostoslistalle automaattisesti.

**Älykäs käsittely (minä):**
1. **Duplikaattien yhdistäminen** — sama tuote useasta reseptistä yhdistetään yhdeksi riviksi; määrät lasketaan yhteen.
2. **Määrälaskenta annosmäärän mukaan.**
3. **Ruokavalio-korvaukset** — kun aines sisältää maitoa/laktoosia, listalle menee oikea korvike. Perustuu reseptin `notes` / `diet_tags`.
4. **Kauppakäytävä-lajittelu** — tuotteet ryhmiteltynä kaupan osastojen mukaan. Lajitteluryhmät näkyvät sovelluksen UI:ssa.

**Pantry-hallinta (UI):**
Sovelluksen Food-välilehdelle lisätään uusi välilehti/kortti "Kaappi/Pantry". Siinä voi lisätä/muuttaa/tiivittää perusaineita, jotka ovat tällä hetkellä taloudessa ja jotka Nipsu ottaa huomioon kauppalistan muodostuksessa.


## Osa 2: (Hermes-puoli)

Toimii Hermes-skillinä (ei sovelluksen backendissa). Sinä ohjaat sitä
Discordista/chatista.

**Rytmi:** 3–5 päivän jaksot kerrallaan (joustava). Ei pakotettua 7 pv rytmiä.

**Logiikka (minä teen):**
1. **Reseptipankki-pohjainen ehdotus** — ehdotan perheen **omista resepteistä**
   (tutut suosikit ensin), täydennän uusilla vain jos pankki on tyhjä tietylle
   ateriatyypille.
2. **Ruokahistoria-muisti** — vältän ruokia jotka syöty viime 1–2 viikkoa
   (paitsi selkeä suosikki).
3. **Ruokavalio-suodatin** — valitsen vain `diet_tags`-ltaan laktoosittomat AND
   maidottomat (Aino 1v on pienin yhteinen nimittäjä). `contains`-poissulku.
4. **Tähde-logiikka** — "iso kattilallinen" -ideologia: yksi iso ruokalaji josta
   riittää 2–3 ateriaa (tähteet seuraavina päivinä). Tämä on jo nykyisen
   promptin idea, mutta nyt **tallennettu ja näkyvä**.

**Työnkulku:**
1. Sanot "suunnittele viikko" (tai jokin jakso).
2. Ehdotan suunnitelman (reseptit, annokset, tähteiden jako).
3. Sinä tarkistat/hyväksyt/muutat/vaihdat (käytän `swap`-ideaa, mutta
   toteutus on minun, ei sovelluksen `swap-meal`-endpointin).
4. Tallennetaan suunnitelma → näkymä sovelluksessa + ruokahistoria täydentyy.



**Tilannevalvonta:** kaupassa voit pyytää listaa ja apua kerättyjen
merkitsemiseen; minä voin näyttää mitä vielä puuttuu.

## Osa 4: Automaatio & ohjaus (Discord)

**Komennot:**
- **"suunnittele viikko"** → ehdotan ateriasuunnitelman (vaiheittain: ensin
  jakson pituus, sitten ehdotus, sitten hyväksyntä).
- **"tee kauppalista"** → kerään hyväksytyn suunnitelman ainekset listaksi,
  yhdistän, lasken, korvaan ruokavaliot, lajittelen kauppakäytävittäin,
  tallennan `/api/shopping`.
- **"lisää resepti"** → tallennan uuden reseptin pankkiin.
- **"lisää oma resepti: ..."** → käyttäjän antama resepti tallennetaan.
- **"merkitse suosikiksi / ei tykätty"** → päivittää `favorite` / `rating`.
- **"mitä syötiin viimeksi?"** → ruokahistoria-katsaus.

**Cron-automaatio (valinnainen, sovitaan erikseen):**
- Muistutus ajoittain ruokasuunnittelua varten (esim. perjantai-ilta /
  viikonloppu), että voin ehdottaa seuraavan jakson suunnitelman.
- Tehdään Hermes-cronilla (kuten `perhekalenteri-reminder-ping`), ei
  sovelluksen sisällä.

## Aloitusdatat: reseptipankin alkukokoelma

Koska reseptidataa ei ole missään, Hermes kokoaa **20–30 kotimaista arkiruokaa**
(keittoja, kasvis-, liha-, kala-, pastaruokia) jotka ovat oletuksena
laktoosittomia + maidottomia tai helposti sellaisiksi korvattavia (korvausvinkki
`notes`-kentässä). Antti/Nipsu voi sitten muokata, merkitä suosikkeja ja
lisätä omia.

## Testaus & hyväksyntä

- **Storage-API:** `curl`-testit kullekin uudelle endpointille
  (`GET/POST/PUT/DELETE /api/recipes`, `/api/meal-history`). Varmista
  Firestore-persistenssi (ei ephemeral-muistitila — tarkista `FIREBASE_*`-envit).
- **UI:** reseptipankki-listaus, viikkosuunnitelma-näkymä, lajiteltu ostoslista
  näkyvät Food.tsx:ssä. Varmista deploy hash (ks. `perhekalenteri-ops`-skill).
- **Ruokavalio-suodatin:** varmista että ehdotettu suunnitelma ei sisällä maitoa
  (Aino) / laktoosia (Anna, Enni), ellei korvattuna.

## Riippuvuudet & rajoitteet

- Perheen Seinä -repo: Cloud Run + Firestore (`perhekalenteri-90a11`),
  deploy `git push origin main` → git-trigger. Ei maksullista Cloud Scheduleria.
- `.app`-TLD herättää Hermesin turvaskannauksen — hyväksy kutsut.
- Sovelluksen AUTH: **julkinen API, ei autentikaatiota** (kuten nyt). Resepti- ja
  ruokahistoria-data on vastaavasti julkinen samassa sovelluksessa — tietoinen
  päätös, jatkaa olemassa olevaa mallia.
- Hermes-skilli kutsuttaessa sovelluksen APIa käyttää samoja olemassa olevia
  endpointteja; ei uusia ulkoisia palveluita.

## Tietoturvahuomio

Sovelluksen API on julkinen (kuten nykyiset `events`, `shopping_list`,
`members`). Reseptit ja ruokahistoria eivät ole erityisen sensitiivistä dataa,
mutta koska ne asuvat samassa julkisessa rajapinnassa, tämä on tietoinen
kompromissi olemassa olevan arkitehtuurin mukaisesti. Mahdollista
tulevaisuudessa suojata, mutta ei tässä vaiheessa (YAGNI).## Osa 4: Automaatio & ohjaus (Discord)

**Komennot:**
- **"suunnittele viikko"** → ehdotan ateriasuunnitelman (vaiheittain: ensin
  jakson pituus, sitten ehdotus, sitten hyväksyntä).
- **"tee kauppalista"** → kerään hyväksytyn suunnitelman ainekset listaksi,
  yhdistän, lasken, korvaan ruokavaliot, lajittelen kauppakäytävittäin,
  tallennan `/api/shopping`.
- **"lisää resepti"** → tallennan uuden reseptin pankkiin.
- **"lisää oma resepti: ..."** → käyttäjän antama resepti tallennetaan.
- **"merkitse suosikiksi / ei tykätty"** → päivittää `favorite` / `rating`.
- **"mitä syötiin viimeksi?"** → ruokahistoria-katsaus.

**Cron-automaatio (valinnainen, sovitaan erikseen):**
- Muistutus ajoittain ruokasuunnittelua varten (esim. perjantai-ilta /
  viikonloppu), että voin ehdottaa seuraavan jakson suunnitelman.
- Tehdään Hermes-cronilla (kuten `perhekalenteri-reminder-ping`), ei
  sovelluksen sisällä.

## Aloitusdatat: reseptipankin alkukokoelma

Koska reseptidataa ei ole missään, Hermes kokoaa **20–30 kotimaista arkiruokaa**
(keittoja, kasvis-, liha-, kala-, pastaruokia) jotka ovat oletuksena
laktoosittomia + maidottomia tai helposti sellaisiksi korvattavia (korvausvinkki
`notes`-kentässä). Antti/Nipsu voi sitten muokata, merkitä suosikkeja ja
lisätä omia.

## Testaus & hyväksyntä

- **Storage-API:** `curl`-testit kullekin uudelle endpointille
  (`GET/POST/PUT/DELETE /api/recipes`, `/api/meal-history`). Varmista
  Firestore-persistenssi (ei ephemeral-muistitila — tarkista `FIREBASE_*`-envit).
- **UI:** reseptipankki-listaus, viikkosuunnitelma-näkymä, lajiteltu ostoslista
  näkyvät Food.tsx:ssä. Varmista deploy hash (ks. `perhekalenteri-ops`-skill).
- **Ruokavalio-suodatin:** varmista että ehdotettu suunnitelma ei sisällä maitoa
  (Aino) / laktoosia (Anna, Enni), ellei korvattuna.

## Riippuvuudet & rajoitteet

- Perheen Seinä -repo: Cloud Run + Firestore (`perhekalenteri-90a11`),
  deploy `git push origin main` → git-trigger. Ei maksullista Cloud Scheduleria.
- `.app`-TLD herättää Hermesin turvaskannauksen — hyväksy kutsut.
- Sovelluksen AUTH: **julkinen API, ei autentikaatiota** (kuten nyt). Resepti- ja
  ruokahistoria-data on vastaavasti julkinen samassa sovelluksessa — tietoinen
  päätös, jatkaa olemassa olevaa mallia.
- Hermes-skilli kutsuttaessa sovelluksen APIa käyttää samoja olemassa olevia
  endpointteja; ei uusia ulkoisia palveluita.

## Tietoturvahuomio

Sovelluksen API on julkinen (kuten nykyiset `events`, `shopping_list`,
`members`). Reseptit ja ruokahistoria eivät ole erityisen sensitiivistä dataa,
mutta koska ne asuvat samassa julkisessa rajapinnassa, tämä on tietoinen
kompromissi olemassa olevan arkitehtuurin mukaisesti. Mahdollista
tulevaisuudessa suojata, mutta ei tässä vaiheessa (YAGNI).
