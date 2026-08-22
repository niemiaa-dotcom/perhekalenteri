# Yksittäisreseptin kauppalistagenerointi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Käyttäjä voi generoida kauppalistan suoraan yksittäisestä reseptistä (nappi reseptikortissa → modaali-esikatselu → "lisää puuttuvat" pää-Kauppalistalle).

**Architecture:** Nykyisen `POST /api/shopping/generate-from-mealplan` -endpointin yhdistys-/kaappisuodatuslogiikka refaktoroidaan yhteiseksi apufunktioksi `buildShoppingPreview`, jota käyttää uusi endpoint `POST /api/shopping/generate-from-recipe`. Frontend (FoodPlanner.tsx) lisää reseptikortteihin generointinapin ja modaalin, joka käyttää samaa esikatselukomponenttityyliä kuin viikkosuunnitelmageneraattori.

**Tech Stack:** Express + TypeScript (server.ts), React + TypeScript + Vite + Tailwind + motion/react, Firestore (muistitila-fallback).

**Spec:** `docs/superpowers/specs/2026-08-22-yksittaisreseptin-kauppalista-design.md`

## Global Constraints

Specistä (pätevät koko toteutukselle):

- "Vanha endpoint ei muutu ulospäin. Viikkosuunnitelmat jatkavat toimimaan kuten ennen."
- "Vastaa samalla muodolla kuin viikkosuunnitelmageneraattori: `[{item, amount, source, already_in_pantry}]`, jossa `source` = reseptin title."
- Ei-tavoitteet: ei ateriasuunnittelijan UI:ta, ei määrän skaalausta annosmäärän mukaan, ei kauppaosastoryhmittelyä, ei uusia Firestore-kokoelmia.
- Ei AI-endpointteja (sovelluksen `/api/ai/*` on poistettu; Hermes on äly, app on storage).

perhekalenteri-dev-skillin rajoitteet:

- Ei uusia kokoelmia → ei memoryStorage-muutoksia eikä env-var-muutoksia. EI deploy-komentoja (`--set-env-vars`/`--update-env-vars`) tässä featuressa.
- Testausjärjestys: backend curlilla paikallisesti → `npm run lint` + `npm run build` → frontend → deploy → live-varmennus bundle-hashilla.
- Deploy (`git push origin main` → Cloud Run) vain Antin nimenomaisella luvalla.

---

### Task 1: Refaktoroi mealplan-generaattori → yhteinen `buildShoppingPreview`

**Objective:** Kaappilataus, ainesyhdistys ja paluuarvo siirtyvät yhteiseen apufunktioon; mealplan-endpoint kutsuu sitä eikä muutu ulospäin.

**Files:**
- Modify: `/opt/data/Projects/perhekalenteri/server.ts` (endpoint alkaa rivillä 877, paluuarvon map ~970–977)

**Step 1: Lisää apufunktio välittömästi ENNEN riviä `app.post("/api/shopping/generate-from-mealplan", ...`** (samaan scopeen, jotta `firestore`, `isFirestoreAvailable`, `memoryStorage` ovat näkyvissä):

```typescript
  // Yhteinen kauppalistaesikatselu: lataa kaappi, yhdistä ainekset, liputa kaapista löytyvät.
  // Käyttäjät: generate-from-mealplan ja generate-from-recipe.
  const buildShoppingPreview = async (
    recipeList: Array<{ title: string; ingredients: any[] }>
  ): Promise<Array<{ item: string; amount: string; source: string; already_in_pantry: boolean }>> => {
    // Hae pantry
    let pantryItems: string[] = [];
    if (isFirestoreAvailable && firestore) {
      const snap = await firestore.collection("pantry").get();
      pantryItems = snap.docs.map(doc => String((doc.data() as any).item || "").toLowerCase().trim());
    } else {
      pantryItems = (memoryStorage.pantry || []).map((p: any) => String(p.item || "").toLowerCase().trim());
    }

    const allIngredients: Record<string, { item: string; amount: string; source: string; recipeTitle: string; already_in_pantry: boolean }> = {};

    const addIngredient = (ing: any, recipeTitle: string) => {
      if (!ing || !ing.item) return;
      const key = String(ing.item).toLowerCase().trim();
      const normalized = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const isInPantry = pantryItems.includes(key) || pantryItems.includes(normalized);
      if (allIngredients[key]) {
        const prev = allIngredients[key];
        prev.amount = prev.amount ? (prev.amount + " + " + (ing.amount || "")) : (ing.amount || "1 kpl");
        prev.source += ", " + recipeTitle;
      } else {
        allIngredients[key] = {
          item: ing.item,
          amount: ing.amount || "1 kpl",
          source: recipeTitle,
          recipeTitle,
          already_in_pantry: isInPantry
        };
      }
    };

    recipeList.forEach(recipe => {
      (recipe.ingredients || []).forEach((ing: any) => addIngredient(ing, recipe.title || "Resepti"));
    });

    return Object.values(allIngredients).map((v: any) => ({
      item: v.item,
      amount: v.amount,
      source: v.source,
      already_in_pantry: v.already_in_pantry
    }));
  };
```

**Step 2: Korvaa mealplan-endpointin runko.** Korvattava alue alkaa hetki `if (!plan || !plan.plan_data)` -tarkistuksen jälkeen ja päättyy `res.json(result);`-riviin — eli POISTA vanhat pantry-lataus (~907–914), `allIngredients`/`addIngredient` (~916–940), planData-iteraatio (~942–968) ja `result`-map (~970–975), ja liitä seuraava kokonaisuus tilalle (reseptien lataus on siinä mukana ennallaan):

```typescript
      // Hae reseptit hajautettuna id:llä
      let recipes: any[] = [];
      if (isFirestoreAvailable && firestore) {
        const snap = await firestore.collection("recipes").get();
        recipes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else {
        recipes = memoryStorage.recipes || [];
      }
      const recipeById: Record<string, any> = {};
      recipes.forEach((r: any) => { recipeById[r.id] = r; });

      // Kerää suunnitelman reseptit yhteiseen muotoon (title + ingredients)
      const planData = typeof plan.plan_data === "string" ? JSON.parse(plan.plan_data) : plan.plan_data;
      const recipeList: Array<{ title: string; ingredients: any[] }> = [];

      if (Array.isArray(planData.recipes)) {
        planData.recipes.forEach((recipe: any) => {
          recipeList.push({ title: recipe.title || "Resepti", ingredients: recipe.ingredients || [] });
        });
      } else {
        // Päiväkohtainen rakenne: käy läpi jokainen päivä, breakfast/lunch/dinner
        const dayKeys = Object.keys(planData).filter(k => k !== 'days' && k !== 'recipes');
        for (const day of dayKeys) {
          const meals = planData[day];
          if (!meals || typeof meals !== 'object') continue;
          const mealKeys = ['breakfast', 'lunch', 'dinner', 'leftovers'];
          for (const mealKey of mealKeys) {
            const meal = meals[mealKey];
            if (!meal) continue;
            if (meal.recipe_id && recipeById[meal.recipe_id]) {
              const r = recipeById[meal.recipe_id];
              recipeList.push({ title: r.title || "Resepti", ingredients: r.ingredients || [] });
            } else if (typeof meal === 'object' && meal.ingredients) {
              recipeList.push({ title: meal.title || "Ateria", ingredients: meal.ingredients });
            }
            // vapaa teksti (käsin kirjattu ateria) — ei pureta
          }
        }
      }

      const result = await buildShoppingPreview(recipeList);
      res.json(result);
```

**Step 3: Tyypit kuntoon ja regressiotesti.**

Run: `cd /opt/data/Projects/perhekalenteri && npm run lint`
Expected: ei virheitä (tsc --noEmit).

Käynnistä paikallinen palvelin taustalla: `npm run dev` (PORT oletus 3000, muistitila — FIREBASE-muuttujia ei lokaalisti).

```bash
# Regression: mealplan-generaattori toimii edelleen
curl -s -X POST localhost:3000/api/meal-plans -H "Content-Type: application/json" \
  -d '{"name":"Testiviikko","plan_data":{"recipes":[{"title":"Testiresepti","ingredients":[{"item":"Tumma makaroni","amount":"400 g"},{"item":"Sipuli","amount":"1 kpl"}]}]}}'
# Expected: {"id":"<id>"}

curl -s -X POST localhost:3000/api/shopping/generate-from-mealplan -H "Content-Type: application/json" -d '{"meal_plan_id":"<id>"}'
# Expected: [{"item":"Tumma makaroni","amount":"400 g","source":"Testiresepti","already_in_pantry":false},{"item":"Sipuli","amount":"1 kpl","source":"Testiresepti","already_in_pantry":false}]
```

**Step 4: Commit.**

```bash
git add server.ts
git commit -m "refactor: yhteinen buildShoppingPreview mealplan-generaattorille"
```

---

### Task 2: Uusi endpoint `POST /api/shopping/generate-from-recipe`

**Objective:** Yksittäisen reseptin ainekset kauppalistaesikatseluun samalla logiikalla.

**Files:**
- Modify: `/opt/data/Projects/perhekalenteri/server.ts` (uusi endpoint heti mealplan-endpointin jälkeen, ~rivi 982)

**Step 1: Lisää endpoint** (samaan scopeen, heti `generate-from-mealplan`-endpointin sulkevan `});` jälkeen):

```typescript
  app.post("/api/shopping/generate-from-recipe", async (req, res) => {
    try {
      const { recipe_id } = req.body;
      if (!recipe_id) {
        return res.status(400).json({ error: "recipe_id on pakollinen" });
      }

      let recipe: any = null;
      if (isFirestoreAvailable && firestore) {
        const doc = await firestore.collection("recipes").doc(recipe_id).get();
        if (doc.exists) recipe = { id: doc.id, ...doc.data() };
      } else {
        recipe = (memoryStorage.recipes || []).find((r: any) => r.id === recipe_id);
      }
      if (!recipe) {
        return res.status(404).json({ error: "Reseptiä ei löytynyt" });
      }

      const result = await buildShoppingPreview([{ title: recipe.title || "Resepti", ingredients: recipe.ingredients || [] }]);
      res.json(result);
    } catch (err: any) {
      console.error("Generate from recipe error:", err);
      res.status(500).json({ error: err.message });
    }
  });
```

**Step 2: Curl-testit (palvelin yhä käynnissä Task 1:stä).**

```bash
# 1) Luo testiresepti
curl -s -X POST localhost:3000/api/recipes -H "Content-Type: application/json" \
  -d '{"title":"Voikanakana","ingredients":[{"item":"Kananmuna","amount":"3 kpl"},{"item":"Sipuli","amount":"1 kpl"}]}'
# Expected: {"id":"<rid>"}

# 2) Generoi ilman kaappia
curl -s -X POST localhost:3000/api/shopping/generate-from-recipe -H "Content-Type: application/json" -d '{"recipe_id":"<rid>"}'
# Expected: molemmat already_in_pantry:false

# 3) Lisää sipuli kaappiin ja generoi uudelleen
curl -s -X POST localhost:3000/api/pantry -H "Content-Type: application/json" -d '{"item":"Sipuli","category":"vihannekset"}'
curl -s -X POST localhost:3000/api/shopping/generate-from-recipe -H "Content-Type: application/json" -d '{"recipe_id":"<rid>"}'
# Expected: Sipuli already_in_pantry:true, Kananmuna false

# 4) Virhetilanteet
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:3000/api/shopping/generate-from-recipe -H "Content-Type: application/json" -d '{}'
# Expected: 400
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:3000/api/shopping/generate-from-recipe -H "Content-Type: application/json" -d '{"recipe_id":"ei-olemassa"}'
# Expected: 404
```

**Step 3: Sammuta testipalvelin ja commit.**

```bash
git add server.ts
git commit -m "feat: POST /api/shopping/generate-from-recipe endpoint"
```

---

### Task 3: Frontend — nappi reseptikorttiin + esikatselumodaali

**Objective:** Reseptikortin ShoppingCart-nappi hakee esikatselun ja modaali lisää puuttuvat pää-Kauppalistalle.

**Files:**
- Modify: `/opt/data/Projects/perhekalenteri/src/components/FoodPlanner.tsx`

**Step 1: Uusi state (shopping generation -state-lohkon perään, rivin ~39 jälkeen):**

```typescript
  const [recipePreview, setRecipePreview] = useState<{ recipe: Recipe; items: GeneratedShoppingItem[] } | null>(null);
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState<string | null>(null);
  const [isAddingRecipeItems, setIsAddingRecipeItems] = useState(false);
```

**Step 2: Uudet funktiot heti `addMissingToShoppingList`-funktion jälkeen (~rivi 280):**

```typescript
  const generateFromRecipe = async (recipe: Recipe) => {
    setIsGeneratingRecipe(recipe.id);
    try {
      const res = await fetch('/api/shopping/generate-from-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe_id: recipe.id })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generointi epäonnistui');
      }
      const data = await res.json();
      setRecipePreview({ recipe, items: data });
    } catch (err: any) {
      console.error('Error generating shopping list from recipe:', err);
      alert(err.message || 'Kauppalistan generointi epäonnistui.');
    } finally {
      setIsGeneratingRecipe(null);
    }
  };

  const addRecipeMissingToShopping = async () => {
    if (!recipePreview) return;
    setIsAddingRecipeItems(true);
    try {
      const missing = recipePreview.items.filter(i => !i.already_in_pantry);
      for (const item of missing) {
        await fetch('/api/shopping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item: item.item, amount: item.amount })
        });
      }
      fetchShoppingList();
      setRecipePreview(null);
      alert(`${missing.length} puuttuvaa ainesta lisätty ostoslistalle!`);
    } catch (err) {
      console.error('Error adding recipe items to shopping list:', err);
      alert('Ainesten lisääminen ostoslistalle epäonnistui.');
    } finally {
      setIsAddingRecipeItems(false);
    }
  };
```

**Step 3: Nappi reseptikortin toimintoriviin (rivit ~514–521, `<div className="flex items-center gap-1">` -lohkon ensimmäiseksi napiksi, ennen Muokkaa-nappia):**

```tsx
                      <button
                        onClick={() => generateFromRecipe(recipe)}
                        disabled={isGeneratingRecipe === recipe.id}
                        className="text-slate-500 hover:text-emerald-400 p-1.5 disabled:opacity-50"
                        title="Generoi kauppalista"
                      >
                        {isGeneratingRecipe === recipe.id ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
                      </button>
```

**Step 4: Modaali komponentin return-loppuun (viimeisen `)}`-lohkon jälkeen, ennen komponentin sulkevaa `</div>`:ää ~rivi 783). Ikonit (X, Circle, CheckCircle2, Loader2, ShoppingCart) ovat jo importoituina:**

```tsx
      {/* ===== RECIPE SHOPPING PREVIEW MODAL ===== */}
      {recipePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setRecipePreview(null)}>
          <div className="absolute inset-0 bg-black/70" />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-slate-900 rounded-3xl p-6 border border-slate-800 w-full max-w-2xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-1">
              <h3 className="text-xl font-serif italic text-white flex items-center gap-2">
                <ShoppingCart size={20} className="text-indigo-400" /> {recipePreview.recipe.title}
              </h3>
              <button onClick={() => setRecipePreview(null)} className="text-slate-500 hover:text-white p-1" title="Sulje">
                <X size={20} />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Kaapista jo löytyvät ainekset on suodatettu. Lisää puuttuvat suoraan ostoslistalle.
            </p>

            {recipePreview.items.length === 0 ? (
              <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800">
                <p className="text-slate-500 font-serif italic">Ei aineksia tässä reseptissä.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h5 className="text-[10px] uppercase tracking-widest font-bold text-rose-400 mb-3">Ostettava ({recipePreview.items.filter(i => !i.already_in_pantry).length})</h5>
                    <div className="space-y-2">
                      {recipePreview.items.filter(i => !i.already_in_pantry).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-950 rounded-xl p-3 border border-slate-800">
                          <div>
                            <p className="text-sm font-medium text-slate-200">{item.item}</p>
                            <p className="text-xs text-slate-500">{item.amount}</p>
                          </div>
                          <Circle size={16} className="text-rose-500/60 shrink-0" />
                        </div>
                      ))}
                      {recipePreview.items.filter(i => !i.already_in_pantry).length === 0 && (
                        <p className="text-xs text-slate-600 font-serif italic">Kaikki ainekset löytyvät kaapista!</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <h5 className="text-[10px] uppercase tracking-widest font-bold text-emerald-400 mb-3">Kaapissa ({recipePreview.items.filter(i => i.already_in_pantry).length})</h5>
                    <div className="space-y-2">
                      {recipePreview.items.filter(i => i.already_in_pantry).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-950 rounded-xl p-3 border border-slate-800 opacity-60">
                          <div>
                            <p className="text-sm font-medium text-slate-400">{item.item}</p>
                            <p className="text-xs text-slate-600">{item.amount}</p>
                          </div>
                          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                        </div>
                      ))}
                      {recipePreview.items.filter(i => i.already_in_pantry).length === 0 && (
                        <p className="text-xs text-slate-600 font-serif italic">Kaappi ei auta tässä — kaikki ostettava.</p>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={addRecipeMissingToShopping}
                  disabled={isAddingRecipeItems || recipePreview.items.every(i => i.already_in_pantry)}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {isAddingRecipeItems ? <Loader2 size={18} className="animate-spin" /> : <ShoppingCart size={18} />}
                  {isAddingRecipeItems ? 'Lisätään...' : `Lisää puuttuvat ostoslistalle (${recipePreview.items.filter(i => !i.already_in_pantry).length})`}
                </button>
              </>
            )}
          </motion.div>
        </div>
      )}
```

**Step 5: Tarkistukset.**

Run: `npm run lint && npm run build`
Expected: molemmat läpi virheittä. Kirjaa `npm run build`-tulosteen bundle-hash (dist/assets -tiedostojen nimet) live-varmennusta varten.

**Step 6: Commit.**

```bash
git add src/components/FoodPlanner.tsx
git commit -m "feat: reseptikohtainen kauppalistageneraattori (modaali + lisäys ostoslistalle)"
```

---

### Task 4: Deploy ja live-varmennus (vain Antin luvalla)

**Objective:** Feature tuotantoon ja todennettu selaimessa.

**Step 1: KYSY ANTLTA LUPA** pushata mainiin (Cloud Run git-trigger deployaa automaattisesti).

**Step 2: Deploy.**

```bash
git push origin main
```

**Step 3: Odota Cloud Run-buildi (2–4 min), sitten bundle-hash-vermennus selaimessa:**

```js
Array.from(document.querySelectorAll('script[src]')).map(s=>s.src)
```
Vrt. Task 3:n build-hash — uusi hash = uusi versio livessä.

**Step 4: Live-testi tuotantosovelluksessa (Ruoka → Reseptipankki & Kaappi):**

1. Etsi "Hidaskeittimen voikanakana" → paina ShoppingCart-nappia → modaali avautuu, ainekset listattuna (oliiviöljy kaapissa → vihreälle, jos Kaappiin on lisätty oliiviöljy — se on siellä).
2. "Lisää puuttuvat ostoslistalle" → vahvistus → Kauppalista-välilehdellä uudet rivit.
3. Regressio: Kauppalistageneraattori-välilehdellä "Viikko 10" -suunnitelmalla generointi toimii yhä.

**Rullaustakaisin:** jos livessä hajoaa, `git revert` viimeiset feat/commitit + uusi push (deployaa edellisen tilan).
