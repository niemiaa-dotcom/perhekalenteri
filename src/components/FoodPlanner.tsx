import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Heart, Search, ShoppingCart, Archive, Star, Utensils, CheckCircle2, Circle, X, Sparkles, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Recipe, PantryItem, GeneratedShoppingItem } from '../types';

const CATEGORIES = ['pääruoka', 'keitto', 'kasvis', 'kala', 'pasta', 'leivonnainen', 'salaatti', 'muu'];
const PANTRY_CATEGORIES = ['maitotuotteet', 'vihannekset', 'liha', 'pakaste', 'mauste', 'leipä', 'juomat', 'muut'];

const FoodPlanner: React.FC = () => {
  const [activeView, setActiveView] = useState<'recipes' | 'pantry' | 'shopping'>('recipes');

  // Recipe state
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [recipeForm, setRecipeForm] = useState({
    title: '', description: '', category: 'pääruoka', servings: 4,
    ingredients: [{ item: '', amount: '' }],
    instructions: [''],
    diet_tags: [] as string[],
    notes: ''
  });
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);

  // Pantry state
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [pantryItem, setPantryItem] = useState('');
  const [pantryAmount, setPantryAmount] = useState('');
  const [pantryCategory, setPantryCategory] = useState('muut');

  // Shopping generation state
  const [savedPlans, setSavedPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [generatedItems, setGeneratedItems] = useState<GeneratedShoppingItem[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAddingToShopping, setIsAddingToShopping] = useState(false);
  const [shoppingList, setShoppingList] = useState<any[]>([]);
  const [recipePreview, setRecipePreview] = useState<{ recipe: Recipe; items: GeneratedShoppingItem[] } | null>(null);
  const [isGeneratingRecipe, setIsGeneratingRecipe] = useState<string | null>(null);
  const [isAddingRecipeItems, setIsAddingRecipeItems] = useState(false);

  useEffect(() => {
    fetchRecipes();
    fetchPantry();
    fetchSavedPlans();
    fetchShoppingList();
  }, []);

  const fetchRecipes = async () => {
    try {
      const res = await fetch('/api/recipes');
      const data = await res.json();
      setRecipes(data);
    } catch (err) {
      console.error('Error fetching recipes:', err);
    }
  };

  const fetchPantry = async () => {
    try {
      const res = await fetch('/api/pantry');
      const data = await res.json();
      setPantry(data);
    } catch (err) {
      console.error('Error fetching pantry:', err);
    }
  };

  const fetchSavedPlans = async () => {
    try {
      const res = await fetch('/api/meal-plans');
      const data = await res.json();
      setSavedPlans(data);
    } catch (err) {
      console.error('Error fetching meal plans:', err);
    }
  };

  const fetchShoppingList = async () => {
    try {
      const res = await fetch('/api/shopping');
      const data = await res.json();
      setShoppingList(data);
    } catch (err) {
      console.error('Error fetching shopping list:', err);
    }
  };

  // ==== Recipe CRUD ====
  const saveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeForm.title.trim()) return;
    setIsSavingRecipe(true);
    try {
      const payload = {
        ...recipeForm,
        ingredients: recipeForm.ingredients.filter(i => i.item.trim()),
        instructions: recipeForm.instructions.filter(i => i.trim()),
      };
      if (editingRecipe) {
        await fetch(`/api/recipes/${editingRecipe.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        await fetch('/api/recipes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      setShowRecipeForm(false);
      setEditingRecipe(null);
      resetRecipeForm();
      fetchRecipes();
    } catch (err) {
      console.error('Error saving recipe:', err);
      alert('Reseptin tallennus epäonnistui.');
    } finally {
      setIsSavingRecipe(false);
    }
  };

  const resetRecipeForm = () => {
    setRecipeForm({
      title: '', description: '', category: 'pääruoka', servings: 4,
      ingredients: [{ item: '', amount: '' }],
      instructions: [''],
      diet_tags: [],
      notes: ''
    });
  };

  const editRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setRecipeForm({
      title: recipe.title,
      description: recipe.description || '',
      category: recipe.category,
      servings: recipe.servings || 4,
      ingredients: recipe.ingredients.length ? recipe.ingredients : [{ item: '', amount: '' }],
      instructions: recipe.instructions.length ? recipe.instructions : [''],
      diet_tags: recipe.diet_tags || [],
      notes: recipe.notes || ''
    });
    setShowRecipeForm(true);
    setExpandedRecipeId(recipe.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteRecipe = async (id: string) => {
    if (!confirm('Poistetaanko resepti?')) return;
    try {
      await fetch(`/api/recipes/${id}`, { method: 'DELETE' });
      fetchRecipes();
    } catch (err) {
      console.error('Error deleting recipe:', err);
    }
  };

  const toggleFavorite = async (recipe: Recipe) => {
    try {
      await fetch(`/api/recipes/${recipe.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: !recipe.favorite })
      });
      fetchRecipes();
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  const updateIngredient = (idx: number, field: 'item' | 'amount', value: string) => {
    const newIngredients = [...recipeForm.ingredients];
    newIngredients[idx] = { ...newIngredients[idx], [field]: value };
    setRecipeForm({ ...recipeForm, ingredients: newIngredients });
  };

  const addIngredientRow = () => {
    setRecipeForm({ ...recipeForm, ingredients: [...recipeForm.ingredients, { item: '', amount: '' }] });
  };

  const removeIngredientRow = (idx: number) => {
    if (recipeForm.ingredients.length <= 1) return;
    setRecipeForm({ ...recipeForm, ingredients: recipeForm.ingredients.filter((_, i) => i !== idx) });
  };

  const updateInstruction = (idx: number, value: string) => {
    const newInstructions = [...recipeForm.instructions];
    newInstructions[idx] = value;
    setRecipeForm({ ...recipeForm, instructions: newInstructions });
  };

  const addInstructionRow = () => {
    setRecipeForm({ ...recipeForm, instructions: [...recipeForm.instructions, ''] });
  };

  const toggleDietTag = (tag: string) => {
    const tags = recipeForm.diet_tags.includes(tag)
      ? recipeForm.diet_tags.filter(t => t !== tag)
      : [...recipeForm.diet_tags, tag];
    setRecipeForm({ ...recipeForm, diet_tags: tags });
  };

  // ==== Pantry CRUD ====
  const addPantryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pantryItem.trim()) return;
    try {
      await fetch('/api/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: pantryItem, amount: pantryAmount, category: pantryCategory })
      });
      setPantryItem('');
      setPantryAmount('');
      setPantryCategory('muut');
      fetchPantry();
    } catch (err) {
      console.error('Error adding pantry item:', err);
    }
  };

  const deletePantryItem = async (id: string) => {
    try {
      await fetch(`/api/pantry/${id}`, { method: 'DELETE' });
      fetchPantry();
    } catch (err) {
      console.error('Error deleting pantry item:', err);
    }
  };

  // ==== Shopping generation ====
  const generateShoppingList = async () => {
    if (!selectedPlanId) return;
    setIsGenerating(true);
    setGeneratedItems(null);
    try {
      const res = await fetch('/api/shopping/generate-from-mealplan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal_plan_id: selectedPlanId })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generointi epäonnistui');
      }
      const data = await res.json();
      setGeneratedItems(data);
    } catch (err: any) {
      console.error('Error generating shopping list:', err);
      alert(err.message || 'Kauppalistan generointi epäonnistui.');
    } finally {
      setIsGenerating(false);
    }
  };

  const addMissingToShoppingList = async () => {
    if (!generatedItems) return;
    setIsAddingToShopping(true);
    try {
      const missing = generatedItems.filter(i => !i.already_in_pantry);
      for (const item of missing) {
        await fetch('/api/shopping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item: item.item, amount: item.amount })
        });
      }
      fetchShoppingList();
      setGeneratedItems(null);
      alert(`${missing.length} puuttuvaa ainesta lisätty ostoslistalle!`);
    } catch (err) {
      console.error('Error adding to shopping list:', err);
      alert('Ainesten lisääminen ostoslistalle epäonnistui.');
    } finally {
      setIsAddingToShopping(false);
    }
  };

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

  const filteredRecipes = recipes.filter(r => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return r.title.toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q) ||
      r.ingredients.some(i => i.item.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex gap-4 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveView('recipes')}
          className={`pb-2 px-1 text-sm font-bold transition-all relative ${activeView === 'recipes' ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Reseptipankki
          {activeView === 'recipes' && <motion.div layoutId="planner-subtab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
        </button>
        <button
          onClick={() => setActiveView('pantry')}
          className={`pb-2 px-1 text-sm font-bold transition-all relative ${activeView === 'pantry' ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Kaappi
          {activeView === 'pantry' && <motion.div layoutId="planner-subtab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
        </button>
        <button
          onClick={() => setActiveView('shopping')}
          className={`pb-2 px-1 text-sm font-bold transition-all relative ${activeView === 'shopping' ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Kauppalistageneraattori
          {activeView === 'shopping' && <motion.div layoutId="planner-subtab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
        </button>
      </div>

      {/* ===== RECIPES VIEW ===== */}
      {activeView === 'recipes' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Hae reseptejä (nimi, kuvaus, aines)..."
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-900"
              />
            </div>
            <button
              onClick={() => { setEditingRecipe(null); resetRecipeForm(); setShowRecipeForm(true); }}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all"
            >
              <Plus size={18} /> Lisää resepti
            </button>
          </div>

          {showRecipeForm && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 rounded-3xl p-6 border border-slate-800"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-serif italic text-white">
                  {editingRecipe ? 'Muokkaa reseptiä' : 'Uusi resepti'}
                </h3>
                <button onClick={() => { setShowRecipeForm(false); setEditingRecipe(null); }} className="text-slate-500 hover:text-slate-300">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={saveRecipe} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Nimi *</label>
                    <input
                      type="text"
                      value={recipeForm.title}
                      onChange={e => setRecipeForm({ ...recipeForm, title: e.target.value })}
                      placeholder="Esim. Lohikeitto"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-900 text-slate-100 placeholder-slate-700"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Kuvaus</label>
                    <textarea
                      value={recipeForm.description}
                      onChange={e => setRecipeForm({ ...recipeForm, description: e.target.value })}
                      placeholder="Lyhyt kuvaus (esim. 'Iso kattilallinen, riittää kahdelle päivälle')"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-900 text-slate-100 placeholder-slate-700 resize-none h-20"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Kategoria</label>
                    <select
                      value={recipeForm.category}
                      onChange={e => setRecipeForm({ ...recipeForm, category: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:outline-none"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Annosmäärä</label>
                    <input
                      type="number"
                      min={1}
                      value={recipeForm.servings}
                      onChange={e => setRecipeForm({ ...recipeForm, servings: Number(e.target.value) || 4 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">Ruokavaliomerkinnät</label>
                    <div className="flex flex-wrap gap-2">
                      {['laktoositon', 'maidoton', 'gluteeniton', 'kasvis', 'vegaani'].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleDietTag(tag)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${recipeForm.diet_tags.includes(tag) ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-500 border border-slate-800'}`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Huomiot / korvausvinkit</label>
                    <input
                      type="text"
                      value={recipeForm.notes}
                      onChange={e => setRecipeForm({ ...recipeForm, notes: e.target.value })}
                      placeholder="Esim. 'Kerma → kaurakerma'"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-900 text-slate-100 placeholder-slate-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">Ainekset</label>
                  <div className="space-y-2">
                    {recipeForm.ingredients.map((ing, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="text"
                          value={ing.item}
                          onChange={e => updateIngredient(idx, 'item', e.target.value)}
                          placeholder="Aines (esim. lohi)"
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none placeholder-slate-700"
                        />
                        <input
                          type="text"
                          value={ing.amount}
                          onChange={e => updateIngredient(idx, 'amount', e.target.value)}
                          placeholder="Määrä (esim. 400 g)"
                          className="w-32 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none placeholder-slate-700"
                        />
                        <button type="button" onClick={() => removeIngredientRow(idx)} className="text-slate-600 hover:text-red-400 p-2">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addIngredientRow} className="mt-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                    <Plus size={14} /> Lisää aines
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">Valmistusohjeet</label>
                  <div className="space-y-2">
                    {recipeForm.instructions.map((step, idx) => (
                      <div key={idx} className="flex gap-2">
                        <span className="text-xs font-serif italic text-indigo-400 pt-2 w-6 shrink-0">{idx + 1}.</span>
                        <input
                          type="text"
                          value={step}
                          onChange={e => updateInstruction(idx, e.target.value)}
                          placeholder={`Vaihe ${idx + 1}`}
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none placeholder-slate-700"
                        />
                        {recipeForm.instructions.length > 1 && (
                          <button type="button" onClick={() => setRecipeForm({ ...recipeForm, instructions: recipeForm.instructions.filter((_, i) => i !== idx) })} className="text-slate-600 hover:text-red-400 p-2">
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addInstructionRow} className="mt-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                    <Plus size={14} /> Lisää vaihe
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSavingRecipe || !recipeForm.title.trim()}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-2xl transition-all"
                >
                  {isSavingRecipe ? 'Tallennetaan...' : (editingRecipe ? 'Tallenna muutokset' : 'Tallenna resepti')}
                </button>
              </form>
            </motion.div>
          )}

          {filteredRecipes.length === 0 ? (
            <div className="bg-slate-900 rounded-3xl p-12 text-center border border-slate-800">
              <Utensils size={48} className="mx-auto text-slate-800 mb-4" />
              <p className="text-slate-500 font-serif italic">Ei reseptejä. Lisää ensimmäinen reseptisi!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRecipes.map(recipe => (
                <motion.div
                  key={recipe.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-slate-900 rounded-3xl border border-slate-800 p-5 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleFavorite(recipe)}
                        className={`transition-colors ${recipe.favorite ? 'text-rose-500' : 'text-slate-700 hover:text-rose-400'}`}
                        title={recipe.favorite ? 'Poista suosikeista' : 'Merkitse suosikiksi'}
                      >
                        <Heart size={18} fill={recipe.favorite ? 'currentColor' : 'none'} />
                      </button>
                      <h3 className="font-serif italic text-lg text-white">{recipe.title}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => generateFromRecipe(recipe)}
                        disabled={isGeneratingRecipe === recipe.id}
                        className="text-slate-500 hover:text-emerald-400 p-1.5 disabled:opacity-50"
                        title="Generoi kauppalista"
                      >
                        {isGeneratingRecipe === recipe.id ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
                      </button>
                      <button onClick={() => editRecipe(recipe)} className="text-slate-500 hover:text-indigo-400 p-1.5" title="Muokkaa">
                        <Utensils size={16} />
                      </button>
                      <button onClick={() => deleteRecipe(recipe.id)} className="text-slate-500 hover:text-red-400 p-1.5" title="Poista">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="text-[10px] font-bold bg-slate-950 text-slate-400 px-2 py-1 rounded-lg">{recipe.category}</span>
                    <span className="text-[10px] font-bold bg-slate-950 text-slate-500 px-2 py-1 rounded-lg">{recipe.servings} annosta</span>
                    {recipe.diet_tags.map(tag => (
                      <span key={tag} className="text-[10px] font-bold bg-emerald-950/50 text-emerald-400 px-2 py-1 rounded-lg">{tag}</span>
                    ))}
                  </div>
                  {recipe.description && <p className="text-xs text-slate-500 italic mb-2">{recipe.description}</p>}
                  <div className="text-xs text-slate-400 mb-2">
                    {recipe.ingredients.slice(0, 4).map((ing, i) => (
                      <span key={i}>{ing.amount} {ing.item}{i < Math.min(recipe.ingredients.length, 4) - 1 ? ', ' : ''}</span>
                    ))}
                    {recipe.ingredients.length > 4 && <span> +{recipe.ingredients.length - 4} lisää</span>}
                  </div>
                  <button
                    onClick={() => setExpandedRecipeId(expandedRecipeId === recipe.id ? null : recipe.id)}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
                  >
                    {expandedRecipeId === recipe.id ? 'Piilota' : 'Katso resepti'}
                  </button>
                  <AnimatePresence>
                    {expandedRecipeId === recipe.id && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="mt-4 pt-4 border-t border-slate-800">
                          <h4 className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">Kaikki ainekset</h4>
                          <ul className="space-y-1 mb-4">
                            {recipe.ingredients.map((ing, i) => (
                              <li key={i} className="text-xs text-slate-400 flex justify-between">
                                <span>{ing.item}</span>
                                <span className="text-slate-500">{ing.amount}</span>
                              </li>
                            ))}
                          </ul>
                          <h4 className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">Valmistusohje</h4>
                          <ol className="space-y-2">
                            {recipe.instructions.map((step, i) => (
                              <li key={i} className="text-xs text-slate-300 flex gap-2">
                                <span className="text-indigo-400 font-serif shrink-0">{i + 1}.</span> {step}
                              </li>
                            ))}
                          </ol>
                          {recipe.notes && (
                            <p className="mt-4 text-xs text-amber-400/80 bg-amber-950/20 rounded-xl p-3">
                              <strong>Huom:</strong> {recipe.notes}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== PANTRY VIEW ===== */}
      {activeView === 'pantry' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 sticky top-6">
              <h3 className="text-xl font-serif italic mb-4 flex items-center gap-2">
                <Archive size={20} className="text-indigo-400" /> Lisää kaappiin
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Merkitse mitä perusaineita taloudessa on. Nämä huomioidaan kauppalistageneraattorissa — kaapista löytyviä ei ehdoteta ostettavaksi.
              </p>
              <form onSubmit={addPantryItem} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Tuote</label>
                  <input
                    type="text"
                    value={pantryItem}
                    onChange={e => setPantryItem(e.target.value)}
                    placeholder="Esim. kerma"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-900 text-slate-100 placeholder-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Määrä (valinnainen)</label>
                  <input
                    type="text"
                    value={pantryAmount}
                    onChange={e => setPantryAmount(e.target.value)}
                    placeholder="Esim. 2 dl"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-900 text-slate-100 placeholder-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Kategoria</label>
                  <select
                    value={pantryCategory}
                    onChange={e => setPantryCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:outline-none"
                  >
                    {PANTRY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2">
                  <Plus size={18} /> Lisää kaappiin
                </button>
              </form>
            </div>
          </div>

          <div className="md:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Kaapissa ({pantry.length})</h3>
            {pantry.length === 0 ? (
              <div className="bg-slate-900 rounded-3xl p-12 text-center border border-slate-800">
                <Archive size={48} className="mx-auto text-slate-800 mb-4" />
                <p className="text-slate-500 font-serif italic">Kaappi on tyhjä. Lisää perusaineita joita taloudessa on.</p>
              </div>
            ) : (
              <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden divide-y divide-slate-800">
                {pantry.map(item => (
                  <div key={item.id} className="p-4 flex items-center justify-between group hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-center gap-3 flex-1">
                      <Archive size={16} className="text-slate-600 shrink-0" />
                      <div>
                        <p className="font-medium text-slate-200">{item.item}</p>
                        {item.amount && <p className="text-xs text-slate-500">{item.amount}</p>}
                      </div>
                      <span className="text-[10px] font-bold bg-slate-950 text-slate-500 px-2 py-0.5 rounded-lg ml-2">{item.category}</span>
                    </div>
                    <button onClick={() => deletePantryItem(item.id)} className="text-slate-500 hover:text-red-400 p-2 transition-all" title="Poista">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== SHOPPING GENERATOR VIEW ===== */}
      {activeView === 'shopping' && (
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800">
            <h3 className="text-xl font-serif italic mb-2 flex items-center gap-2">
              <ShoppingCart size={20} className="text-indigo-400" /> Generoi kauppalista
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Valitse tallennettu ateriasuunnitelma. Ainekset yhdistetään automaattisesti, ja kaapista jo löytyvät (Kaappi-välilehti) suodatetaan pois.
            </p>
            <div className="flex flex-col md:flex-row gap-3">
              <select
                value={selectedPlanId}
                onChange={e => setSelectedPlanId(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 focus:outline-none"
              >
                <option value="">Valitse suunnitelma...</option>
                {savedPlans.map(plan => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} ({new Date(plan.created_at).toLocaleDateString('fi-FI')})
                  </option>
                ))}
              </select>
              <button
                onClick={generateShoppingList}
                disabled={isGenerating || !selectedPlanId}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                {isGenerating ? 'Generoidaan...' : 'Generoi kauppalista'}
              </button>
            </div>
            {savedPlans.length === 0 && (
              <p className="mt-3 text-xs text-amber-400/80">
                Ei tallennettuja suunnitelmia. Luo ensin ateriasuunnitelma Ateriasuunnittelija-välilehdellä ja tallenna se.
              </p>
            )}
          </div>

          {generatedItems && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 rounded-3xl p-6 border border-slate-800"
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-5">
                <h4 className="font-bold text-white text-lg">Kauppalistan esikatselu</h4>
                <button
                  onClick={addMissingToShoppingList}
                  disabled={isAddingToShopping}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center gap-2 text-sm"
                >
                  {isAddingToShopping ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
                  {isAddingToShopping ? 'Lisätään...' : `Lisää puuttuvat ostoslistalle (${generatedItems.filter(i => !i.already_in_pantry).length})`}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h5 className="text-[10px] uppercase tracking-widest font-bold text-rose-400 mb-3">Ostettava ({generatedItems.filter(i => !i.already_in_pantry).length})</h5>
                  <div className="space-y-2">
                    {generatedItems.filter(i => !i.already_in_pantry).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-950 rounded-xl p-3 border border-slate-800">
                        <div>
                          <p className="text-sm font-medium text-slate-200">{item.item}</p>
                          <p className="text-xs text-slate-500">{item.amount} · {item.source}</p>
                        </div>
                        <Circle size={16} className="text-rose-500/60 shrink-0" />
                      </div>
                    ))}
                    {generatedItems.filter(i => !i.already_in_pantry).length === 0 && (
                      <p className="text-xs text-slate-500 italic">Kaikki ainekset löytyvät jo kaapista! 🎉</p>
                    )}
                  </div>
                </div>
                <div>
                  <h5 className="text-[10px] uppercase tracking-widest font-bold text-emerald-400 mb-3">Löytyy kaapista ({generatedItems.filter(i => i.already_in_pantry).length})</h5>
                  <div className="space-y-2">
                    {generatedItems.filter(i => i.already_in_pantry).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-950 rounded-xl p-3 border border-slate-800 opacity-70">
                        <div>
                          <p className="text-sm font-medium text-slate-400 line-through decoration-emerald-500/40">{item.item}</p>
                          <p className="text-xs text-slate-600">{item.amount} · {item.source}</p>
                        </div>
                        <CheckCircle2 size={16} className="text-emerald-500/70 shrink-0" />
                      </div>
                    ))}
                    {generatedItems.filter(i => i.already_in_pantry).length === 0 && (
                      <p className="text-xs text-slate-500 italic">Ei kaapista löytyviä.</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Nykyinen ostoslista ({shoppingList.length})</h3>
            </div>
            {shoppingList.length === 0 ? (
              <div className="p-12 text-center">
                <ShoppingCart size={48} className="mx-auto text-slate-800 mb-4" />
                <p className="text-slate-500 font-serif italic">Ostoslista on tyhjä.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {shoppingList.map(item => (
                  <div key={item.id} className="p-4 flex items-center gap-3">
                    <span className={item.completed ? 'text-emerald-500' : 'text-slate-600'}>
                      {item.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </span>
                    <p className={`font-medium ${item.completed ? 'text-slate-600 line-through' : 'text-slate-200'}`}>{item.item}</p>
                    {item.amount && <span className="text-xs text-slate-500 ml-auto">{item.amount}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
    </div>
  );
};

export default FoodPlanner;
