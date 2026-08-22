# Yksittäisreseptin kauppalistagenerointi — design

Päivä: 22.8.2026
Tila: Hyväksytty (Antti, 22.8.2026)
Laajuus: Perheen Seinä — Ruoka-osio

## Ongelma

Kauppalistageneraattori osaa tällä hetkellä generoida listan vain tallennetusta
viikkosuunnitelmasta (`POST /api/shopping/generate-from-mealplan`). Yksittäistä
reseptipankin reseptiä ei voi listata suoraan — käyttäjän pitää ensin kääriä resepti
viikkosuunnitelmaan. Tämä on tarpeeton välivaihe.

## Tavoite

Käyttäjä painaa reseptikortissa "Generoi kauppalista" -nappia, näkee esikatselun
(kaappisuodatus + jaotelu ostettava/kaapissa) modaali-ikkunassa ja voi lisätä
puuttuvat ainekset yhdellä napilla pää-Kauppalistalle.

## Ei-tavoitteet (YAGNI)

- Ei ateriasuunnittelijan UI:ta (erillinen backlog-kohde, spec 14.8.2026)
- Ei määrän skaalausta annosmäärän mukaan
- Ei kauppalistan ryhmittelyä kauppaosastoittain
- Ei uusia kokoelmia Firestoreen

## Arkkitehtuuri

### Backend (server.ts)

1. **Refaktorointi:** nykyisen `POST /api/shopping/generate-from-mealplan`
   -endpointin runko siirretään yhteiseksi apufunktioksi:

   ```typescript
   async function buildShoppingPreview(ingredients: any[]): Promise<Array<{
     item: string; amount: string; source: string; already_in_pantry: boolean;
   }>>
   ```

   Funktio lataa kaapin (pantry) Firestoresta tai muistista, normalisoi nimet
   (lowercase + NFD-ääkköspuhdistus), merkitsee `already_in_pantry` ja palauttaa
   saman muodon kuin nykyinen endpoint. Huom: reseptien lataus ja ainesyhdistys
   ("400 g + 200 g" -ketjutus) jäävät kutsujan vastuulle — ne ovat endpoint-
   kohtaisia.

2. **Uusi endpoint:** `POST /api/shopping/generate-from-recipe`, body `{ recipe_id }`.
   - Hakee reseptin `recipes`-kokoelmasta (Firestore/muisti). 404 jos ei löydy,
     400 jos `recipe_id` puuttuu.
   - Kutsuu `buildShoppingPreview(recipe.ingredients || [])`.
   - Vastaa samalla muodolla kuin viikkosuunnitelma-endpoint:
     `[{item, amount, source, already_in_pantry}]`, jossa `source` = reseptin title.
   - Virheet 500 samaan tapaan kuin muut endpointit.

3. **Yhteensopivuus:** vanha endpoint ei muutu ulospäin. Viikkosuunnitelmat
   jatkavat toimimaan kuten ennen.

### Frontend (src/components/FoodPlanner.tsx)

1. Reseptipankin jokaiseen reseptikorttiin nappi **"Generoi kauppalista"**
   (ShoppingCart-ikoni, samaan tapaan kuin muut korttien toiminnot).
2. Napista POST `/api/shopping/generate-from-recipe` → vastaus tallennetaan
   stateen → avautuu **modaali** kortiston päälle:
   - otsikko: reseptin nimi
   - kaksi saraketta: 🔴 Ostettava (n) / 🟢 Kaapissa (n) — sama tyylikieli
     kuin Kauppalistageneraattori-välilehden esikatselussa
   - nappi "Lisää puuttuvat ostoslistalle (n)": POSTaa jokaisen
     `!already_in_pantry` -aineksen `/api/shopping`-endpointille (sama silmukka
     kuin nykyisessä generaattorissa), sulkee modaalin, päivittää listan ja
     näyttää vahvistuksen (alert, kuten nykyään)
3. Sulje-nappi ja taustaan klikkaus sulkevat modaalin.
4. Virhetilanteet (400/404/500): alert samaan tapaan kuin nykyisessä koodissa.
5. Tyhjä aineslista → modaali tekstillä "Ei aineksia".

## Datan kulku

```
[Reseptikortti] --POST generate-from-recipe--> [server]
   server: recipes-haku -> buildShoppingPreview -> [{item, amount, source, already_in_pantry}]
[Modaali] <--esikatselu-- 
[Lisää puuttuvat] --POST /api/shopping (xN)--> pää-Kauppalista
```

## Testaussuunnitelma

1. Backend curlilla ennen frontendia: POST generate-from-recipe voikanakana-id:llä,
   varmennettava sisältö + `already_in_pantry`-liput; 404 tuntemattomalla id:llä;
   vanha mealplan-endpoint edelleen toimii (regressio).
2. `npm run build` virheittä.
3. Deploy → bundle-hash-vermennus → live-testi selaimessa: nappi → modaali →
   lisäys → rastit pää-Kauppalistalla.
4. Muistitilareitti ei ole riski tässä featuressa (ei uusia kokoelmia), mutta
   molemmat endpointit testataan myös sellaisenaan.

## Riskit

- Refactor koskettaa toimivaa viikkosuunnitelma-endpointtia → lievennetään
  curl-regressiotestillä ennen deploya.
- Modaalitila FoodPlanneriin: pidetään yksinkertaisena (state + ehdollinen
  render), ei uutta kirjastoa.
