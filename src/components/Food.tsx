import React, { useState, useEffect } from 'react';
import { ShoppingCart, Utensils, Plus, Trash2, CheckCircle2, Circle, Sparkles, Loader2, Repeat, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ShoppingItem {
  id: string;
  item: string;
  amount: string;
  completed: number;
}

interface Recipe {
  title: string;
  ingredients: { item: string; amount: string }[];
  instructions: string[];
  description?: string;
  servings?: number;
}

interface MealPlan {
  days: number;
  recipes: Recipe[];
}

interface SavedMealPlan {
  id: string;
  name: string;
  plan_data: string; // JSON string of MealPlan
  created_at: string;
}

export const Food: React.FC = () => {
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [recipe, setRecipe] = useState<any | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'shopping' | 'recipes' | 'planner'>('shopping');
  
  // Meal Planner state
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [planDays, setPlanDays] = useState(3);
  const [plannerRequests, setPlannerRequests] = useState('');
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);
  const [swapRequest, setSwapRequest] = useState('');
  const [savedMealPlans, setSavedMealPlans] = useState<SavedMealPlan[]>([]);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [planName, setPlanName] = useState('');

  useEffect(() => {
    fetchShoppingList();
    fetchSavedMealPlans();
  }, []);

  const fetchSavedMealPlans = async () => {
    try {
      const res = await fetch('/api/meal-plans');
      const data = await res.json();
      setSavedMealPlans(data);
    } catch (error) {
      console.error('Error fetching saved meal plans:', error);
    }
  };

  const saveMealPlan = async () => {
    if (!mealPlan || !planName.trim()) return;
    setIsSavingPlan(true);
    try {
      await fetch('/api/meal-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: planName, plan_data: mealPlan })
      });
      setPlanName('');
      fetchSavedMealPlans();
    } catch (error) {
      console.error('Error saving meal plan:', error);
    } finally {
      setIsSavingPlan(false);
    }
  };

  const loadMealPlan = (savedPlan: SavedMealPlan) => {
    try {
      const parsedPlan = JSON.parse(savedPlan.plan_data);
      setMealPlan(parsedPlan);
      setPlanDays(parsedPlan.days || parsedPlan.recipes.length);
    } catch (error) {
      console.error('Error parsing saved meal plan:', error);
    }
  };

  const deleteSavedMealPlan = async (id: string) => {
    try {
      await fetch(`/api/meal-plans/${id}`, { method: 'DELETE' });
      fetchSavedMealPlans();
    } catch (error) {
      console.error('Error deleting saved meal plan:', error);
    }
  };

  const fetchShoppingList = async () => {
    try {
      const res = await fetch('/api/shopping');
      const data = await res.json();
      setShoppingList(data);
    } catch (error) {
      console.error('Error fetching shopping list:', error);
    }
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    try {
      await fetch('/api/shopping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: newItem, amount: newAmount })
      });
      setNewItem('');
      setNewAmount('');
      fetchShoppingList();
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const toggleItem = async (id: string, completed: number) => {
    try {
      await fetch(`/api/shopping/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !completed })
      });
      fetchShoppingList();
    } catch (error) {
      console.error('Error toggling item:', error);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await fetch(`/api/shopping/${id}`, { method: 'DELETE' });
      fetchShoppingList();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const clearCompleted = async () => {
    try {
      await fetch('/api/shopping', { method: 'DELETE' });
      fetchShoppingList();
    } catch (error) {
      console.error('Error clearing completed items:', error);
    }
  };

  const addItemToShoppingListDirectly = async (item: string, amount: string) => {
    try {
      await fetch('/api/shopping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item, amount })
      });
      fetchShoppingList();
    } catch (error) {
      console.error('Error adding item directly:', error);
    }
  };

  const generateRecipe = async () => {
    if (!ingredients.trim()) return;
    setIsGenerating(true);
    setRecipe(null);
    try {
      const res = await fetch('/api/ai/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to generate recipe');
      }

      const data = await res.json();
      setRecipe(data);
    } catch (error) {
      console.error('Error generating recipe:', error);
      alert('Reseptin generointi epäonnistui. Yritä uudelleen.');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateMealPlan = async () => {
    setIsPlanning(true);
    try {
      let prompt = `Suunnittele ateriasuunnitelma ${planDays} päivän ajalle nelihenkiselle perheelle (isä, äiti, 7v ja 1v lapset).
      Tavoitteena on minimoida päivittäinen ruoanlaitto hyödyntämällä tähteitä.
      Rajoitukset:
      - Ehdota reseptejä joita on helppo tehdä mutta laita välillä sekaan erikoisempia ruokia joita voimme kokeilla.
      - Vähennä punaisen lihan (nauta, sika, lammas) käyttöä. Suosi enemmän kasvisruokia, kalaa ja kanaa.
      - ÄLÄ ehdota uutta reseptiä joka päivälle. Jos suunnitelma on esim. 5 päivää, ehdota vain 2-3 isompaa ruokalajia, joista riittää useammalle aterialle.
      - Annoskoon ei tarvitse olla tasan 8, vaan sellainen määrä joka on järkevä valmistaa kerralla (esim. iso kattilallinen keittoa tai uunivuoka).
      - Ilmoita selkeästi kuvauksessa (description), monelleko päivälle/aterialle kyseinen ruoka on tarkoitettu.
      - Vastaa suomeksi JSON-muodossa.
      JSON-rakenteen pitää olla lista reseptejä, joissa on nimi (title), ainekset (ingredients: {item, amount}[]), valmistusohjeet (instructions: string[]), annosmäärä (servings: number) ja lyhyt kuvaus (description) siitä miksi se sopii perheelle ja miten se jaetaan eri päiville.`;

      if (plannerRequests.trim()) {
        prompt += `\n\nHuomioi lisäksi seuraavat käyttäjän toiveet ja olemassa olevat ainekset: "${plannerRequests}"`;
      }

      const res = await fetch('/api/ai/generate-meal-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, planDays })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to generate meal plan');
      }

      const data = await res.json();
      setMealPlan({ days: planDays, recipes: data.recipes });
    } catch (error) {
      console.error('Error generating meal plan:', error);
      alert('Ateriasuunnitelman luonti epäonnistui.');
    } finally {
      setIsPlanning(false);
    }
  };

  const swapMeal = async (index: number, specificRequest?: string) => {
    if (!mealPlan) return;
    setIsPlanning(true);
    try {
      const currentTitles = mealPlan.recipes.map(r => r.title).join(', ');
      let prompt = `Ehdota uutta, erilaista reseptiä korvaamaan "${mealPlan.recipes[index].title}" ateriasuunnitelmassa. 
      Perheessä on isä, äiti, 7v ja 1v lapset. 
      Tavoitteena on, että ruuasta riittää useammalle aterialle (tähteet), jotta joka päivä ei tarvitse kokata.
      Suosi kasvisruokaa tai vaaleaa lihaa/kalaa punaisen lihan sijaan.
      Vältä näitä jo suunnitelmassa olevia ruokia: ${currentTitles}.
      Vastaa suomeksi JSON-muodossa yhdellä reseptillä.`;

      if (specificRequest && specificRequest.trim()) {
        prompt += `\n\nKÄYTTÄJÄN ERITYISTOIVE TÄLLE ATERIALLE: "${specificRequest}". Tee resepti ehdottomasti tämän toiveen pohjalta!`;
      } else if (plannerRequests.trim()) {
        prompt += `\n\nHuomioi lisäksi seuraavat käyttäjän toiveet ja olemassa olevat ainekset: "${plannerRequests}"`;
      }

      const res = await fetch('/api/ai/swap-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to swap meal');
      }

      const newRecipe = await res.json();
      const newRecipes = [...mealPlan.recipes];
      newRecipes[index] = newRecipe;
      setMealPlan({ ...mealPlan, recipes: newRecipes });
    } catch (error) {
      console.error('Error swapping meal:', error);
      alert('Aterian vaihto epäonnistui.');
    } finally {
      setIsPlanning(false);
    }
  };

  const addIngredientsToShoppingList = async (ingredients: { item: string; amount: string }[]) => {
    try {
      for (const ing of ingredients) {
        await fetch('/api/shopping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item: ing.item, amount: ing.amount })
        });
      }
      fetchShoppingList();
      alert('Ainekset lisätty kauppalistaan!');
    } catch (error) {
      console.error('Error adding ingredients:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex gap-4 border-b border-slate-800 pb-2">
        <button 
          onClick={() => setActiveSubTab('shopping')}
          className={`pb-2 px-1 text-sm font-bold transition-all relative ${activeSubTab === 'shopping' ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Kauppalista
          {activeSubTab === 'shopping' && <motion.div layoutId="subtab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
        </button>
        <button 
          onClick={() => setActiveSubTab('recipes')}
          className={`pb-2 px-1 text-sm font-bold transition-all relative ${activeSubTab === 'recipes' ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Reseptigeneraattori
          {activeSubTab === 'recipes' && <motion.div layoutId="subtab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
        </button>
        <button 
          onClick={() => setActiveSubTab('planner')}
          className={`pb-2 px-1 text-sm font-bold transition-all relative ${activeSubTab === 'planner' ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Ateriasuunnittelija
          {activeSubTab === 'planner' && <motion.div layoutId="subtab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
        </button>
      </div>

      {activeSubTab === 'shopping' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Add Item Form */}
          <div className="md:col-span-1">
            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 sticky top-6">
              <h3 className="text-xl font-serif italic mb-4 flex items-center gap-2">
                <Plus size={20} className="text-indigo-400" /> Lisää tuote
              </h3>
              <form onSubmit={addItem} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Tuote</label>
                  <input 
                    type="text"
                    value={newItem}
                    onChange={e => setNewItem(e.target.value)}
                    placeholder="Esim. Maito"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-900 transition-all text-slate-100 placeholder-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Määrä (valinnainen)</label>
                  <input 
                    type="text"
                    value={newAmount}
                    onChange={e => setNewAmount(e.target.value)}
                    placeholder="Esim. 2 pkt"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-900 transition-all text-slate-100 placeholder-slate-700"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-3 bg-slate-100 text-slate-900 font-bold rounded-xl hover:bg-slate-300 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Lisää listalle
                </button>
              </form>
            </div>
          </div>

          {/* List Display */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Ostoslista ({shoppingList.length})</h3>
              {shoppingList.some(i => i.completed) && (
                <button 
                  onClick={clearCompleted}
                  className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-widest transition-colors"
                >
                  Tyhjennä kerätyt
                </button>
              )}
            </div>

            <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
              <AnimatePresence mode="popLayout">
                {shoppingList.length === 0 ? (
                  <div className="p-12 text-center">
                    <ShoppingCart size={48} className="mx-auto text-slate-800 mb-4" />
                    <p className="text-slate-500 font-serif italic">Lista on tyhjä. Mitä tarvittaisiin kaupasta?</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {shoppingList.map(item => (
                      <motion.div 
                        key={item.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="p-4 flex items-center justify-between group hover:bg-slate-800/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => toggleItem(item.id, item.completed)}>
                          <button className={`transition-colors ${item.completed ? 'text-emerald-500' : 'text-slate-600'}`}>
                            {item.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                          </button>
                          <div>
                            <p className={`font-medium transition-all ${item.completed ? 'text-slate-600 line-through' : 'text-slate-200'}`}>
                              {item.item}
                            </p>
                            {item.amount && (
                              <p className={`text-xs ${item.completed ? 'text-slate-700' : 'text-slate-500'}`}>
                                {item.amount}
                              </p>
                            )}
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteItem(item.id)}
                          className="p-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      ) : activeSubTab === 'recipes' ? (
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800">
            <h3 className="text-2xl font-serif italic mb-4 flex items-center gap-3">
              <Sparkles className="text-indigo-400" /> Mitä kaapista löytyy?
            </h3>
            <p className="text-sm text-slate-400 mb-6">Syötä raaka-aineita, niin tekoäly loihtii niistä reseptin.</p>
            
            <div className="space-y-4">
              <textarea 
                value={ingredients}
                onChange={e => setIngredients(e.target.value)}
                placeholder="Esim. kanaa, kermaa, sipulia, pastaa..."
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-900 transition-all text-slate-100 placeholder-slate-700 min-h-[120px] resize-none"
              />
              <button 
                onClick={generateRecipe}
                disabled={isGenerating || !ingredients.trim()}
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Generoidaan reseptiä...
                  </>
                ) : (
                  <>
                    <Utensils size={20} />
                    Generoi resepti
                  </>
                )}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {recipe && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 rounded-[32px] md:rounded-[40px] p-6 md:p-12 border border-slate-800 shadow-2xl"
              >
                <h2 className="text-3xl md:text-5xl font-serif italic mb-2 text-slate-100 leading-tight">
                  {recipe.title}
                </h2>
                {recipe.servings && (
                  <p className="text-sm font-bold text-slate-500 mb-8">
                    Riittää {recipe.servings} annokseen
                  </p>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
                  <div className="md:col-span-1">
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                      <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-indigo-400">Ainekset</h4>
                      <button 
                        onClick={() => addIngredientsToShoppingList(recipe.ingredients)}
                        className="text-[10px] font-bold text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                      >
                        <Plus size={12} /> Lisää kaikki listalle
                      </button>
                    </div>
                    <ul className="space-y-3">
                      {recipe.ingredients.map((ing: any, i: number) => (
                        <li key={i} className="text-slate-300 text-sm flex items-start justify-between gap-2 group">
                          <div className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/50 mt-1.5 shrink-0" />
                            <span>{ing.amount} {ing.item}</span>
                          </div>
                          <button 
                            onClick={() => addItemToShoppingListDirectly(ing.item, ing.amount)}
                            className="text-indigo-400 hover:text-indigo-300 p-1 bg-indigo-500/10 rounded-md transition-colors"
                            title="Lisää kauppalistaan"
                          >
                            <Plus size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="md:col-span-2">
                    <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-indigo-400 mb-4 md:mb-6">Valmistusohje</h4>
                    <div className="space-y-6">
                      {recipe.instructions.map((step: string, i: number) => (
                        <div key={i} className="flex gap-4">
                          <span className="text-xl md:text-2xl font-serif italic text-slate-700 shrink-0">{(i + 1).toString().padStart(2, '0')}</span>
                          <p className="text-slate-300 text-sm leading-relaxed pt-1">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto space-y-8">
          {savedMealPlans.length > 0 && (
            <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800">
              <h3 className="text-xl font-serif italic mb-4 text-white">Tallennetut suunnitelmat</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {savedMealPlans.map(plan => (
                  <div key={plan.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 group relative">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold text-indigo-400">{plan.name}</h4>
                      <button 
                        onClick={() => deleteSavedMealPlan(plan.id)}
                        className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Poista suunnitelma"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mb-4">
                      {new Date(plan.created_at).toLocaleDateString('fi-FI')}
                    </p>
                    <button 
                      onClick={() => loadMealPlan(plan)}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors"
                    >
                      Lataa suunnitelma
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-900 rounded-3xl p-8 border border-slate-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div>
                <h3 className="text-2xl font-serif italic mb-2 flex items-center gap-3">
                  <Sparkles className="text-indigo-400" /> AI Ateriasuunnittelija
                </h3>
                <p className="text-sm text-slate-400">Suunniteltu perheellesi: 2 aikuista, 7v ja 1v lapset.</p>
              </div>
              <div className="flex items-center gap-4 bg-slate-950 p-2 rounded-2xl border border-slate-800">
                {[3, 5, 7].map(d => (
                  <button 
                    key={d}
                    onClick={() => setPlanDays(d)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${planDays === d ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    {d} päivää
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">Erityistoiveet ja olemassa olevat ainekset (esim. "Meillä on kanaa ja makaronia")</label>
              <textarea 
                value={plannerRequests}
                onChange={(e) => setPlannerRequests(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors resize-none h-24"
                placeholder="Kirjoita toiveesi tähän..."
              />
            </div>

            <button 
              onClick={generateMealPlan}
              disabled={isPlanning}
              className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20"
            >
              {isPlanning ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Suunnitellaan aterioita...
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  Luo ateriasuunnitelma
                </>
              )}
            </button>
          </div>

          <AnimatePresence>
            {mealPlan && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-8"
              >
                <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-white">Tallenna suunnitelma</h4>
                    <p className="text-xs text-slate-400">Tallenna tämä viikko myöhempää käyttöä varten.</p>
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <input 
                      type="text" 
                      value={planName}
                      onChange={e => setPlanName(e.target.value)}
                      placeholder="Esim. Viikko 42"
                      className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 flex-1 md:w-48"
                    />
                    <button 
                      onClick={saveMealPlan}
                      disabled={isSavingPlan || !planName.trim()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition-colors text-sm whitespace-nowrap"
                    >
                      {isSavingPlan ? 'Tallennetaan...' : 'Tallenna'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-8">
                  {mealPlan.recipes.map((r, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-slate-900 rounded-[32px] p-8 border border-slate-800 shadow-xl relative group"
                    >
                      <div className="flex flex-col md:flex-row gap-8">
                        <div className="flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                            <div>
                              <span className="text-[10px] uppercase tracking-widest font-bold text-indigo-400 mb-1 block">Ateria {idx + 1}</span>
                              <h3 className="text-2xl font-serif italic text-white">{r.title}</h3>
                              {r.servings && (
                                <span className="text-xs font-bold text-slate-500 mt-1 block">
                                  Riittää {r.servings} annokseen
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                              {swappingIndex === idx ? (
                                <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-700 w-full sm:w-auto">
                                  <input 
                                    type="text" 
                                    value={swapRequest}
                                    onChange={e => setSwapRequest(e.target.value)}
                                    placeholder="Mitä tilalle?"
                                    className="bg-transparent border-none text-sm text-white px-3 py-1 focus:outline-none flex-1 min-w-0"
                                    autoFocus
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        swapMeal(idx, swapRequest);
                                        setSwappingIndex(null);
                                      } else if (e.key === 'Escape') {
                                        setSwappingIndex(null);
                                      }
                                    }}
                                  />
                                  <div className="flex gap-1">
                                    <button 
                                      onClick={() => {
                                        swapMeal(idx, swapRequest);
                                        setSwappingIndex(null);
                                      }}
                                      className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shrink-0"
                                      title="Hyväksy"
                                    >
                                      <CheckCircle2 size={16} />
                                    </button>
                                    <button 
                                      onClick={() => setSwappingIndex(null)}
                                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg transition-colors shrink-0"
                                      title="Peruuta"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => {
                                    setSwappingIndex(idx);
                                    setSwapRequest('');
                                  }}
                                  disabled={isPlanning}
                                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-indigo-400 rounded-xl transition-all flex items-center gap-2 ml-auto"
                                  title="Vaihda ateria"
                                >
                                  <Repeat size={18} />
                                  <span className="text-xs font-bold hidden sm:inline">Vaihda</span>
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-slate-400 mb-6 italic">{r.description}</p>
                          
                          <div className="space-y-6">
                            <div>
                              <h4 className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-3">Valmistusohje</h4>
                              <div className="space-y-2">
                                {r.instructions.map((step, i) => (
                                  <p key={i} className="text-sm text-slate-300 leading-relaxed">
                                    <span className="text-indigo-500 font-serif mr-2">{i + 1}.</span> {step}
                                  </p>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="w-full md:w-72 bg-slate-950 rounded-2xl p-6 border border-slate-800">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Ainekset</h4>
                            <button 
                              onClick={() => addIngredientsToShoppingList(r.ingredients)}
                              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                              Lisää kaikki
                            </button>
                          </div>
                          <ul className="space-y-3">
                            {r.ingredients.map((ing, i) => (
                              <li key={i} className="text-xs text-slate-400 flex items-start justify-between gap-2 group/ing">
                                <span className="flex-1">{ing.amount} {ing.item}</span>
                                <button 
                                  onClick={() => addItemToShoppingListDirectly(ing.item, ing.amount)}
                                  className="text-indigo-400 hover:text-indigo-300 p-1 bg-indigo-500/10 rounded-md transition-colors"
                                  title="Lisää kauppalistaan"
                                >
                                  <Plus size={14} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
