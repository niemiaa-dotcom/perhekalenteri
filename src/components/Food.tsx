import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Trash2, CheckCircle2, Circle, Archive, Utensils } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import FoodPlanner from './FoodPlanner';

interface ShoppingItem {
  id: string;
  item: string;
  amount: string;
  completed: number;
}

export const Food: React.FC = () => {
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'shopping' | 'planner2'>('shopping');

  useEffect(() => {
    fetchShoppingList();
  }, []);

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
          onClick={() => setActiveSubTab('planner2')}
          className={`pb-2 px-1 text-sm font-bold transition-all relative ${activeSubTab === 'planner2' ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
        >
          Reseptipankki & Kaappi
          {activeSubTab === 'planner2' && <motion.div layoutId="subtab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
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
      ) : (
        <FoodPlanner />
      )}
    </div>
  );
};
