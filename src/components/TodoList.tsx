import React from 'react';
import { CheckSquare, Plus, Trash2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Todo, FamilyMember } from '../types';

interface TodoListProps {
  todos: Todo[];
  members: FamilyMember[];
  handleToggleTodo: (id: string, completed: number) => Promise<void>;
  handleDeleteTodo: (id: string) => Promise<void>;
  openEditTodoModal: (todo: Todo) => void;
  setEditingTodoId: React.Dispatch<React.SetStateAction<string | null>>;
  setNewTodo: React.Dispatch<React.SetStateAction<any>>;
  setShowTodoModal: React.Dispatch<React.SetStateAction<boolean>>;
}

export const TodoList: React.FC<TodoListProps> = ({
  todos,
  members,
  handleToggleTodo,
  handleDeleteTodo,
  openEditTodoModal,
  setEditingTodoId,
  setNewTodo,
  setShowTodoModal
}) => {
  const getMembers = (memberIds: string | string[]) => {
    try {
      const ids = typeof memberIds === 'string' ? JSON.parse(memberIds || '[]') : (memberIds || []);
      return ids.map((id: string) => members.find(m => m.id === id)).filter(Boolean) as FamilyMember[];
    } catch (e) {
      return [];
    }
  };

  return (
    <div className="bg-slate-900 rounded-[32px] p-6 shadow-sm border border-slate-800 min-h-[calc(100vh-250px)] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-serif italic flex items-center gap-2">
          <CheckSquare size={24} className="text-slate-500" />
          Tehtävälista
        </h2>
        <button 
          onClick={() => {
            setEditingTodoId(null);
            setNewTodo({ 
              task: '', 
              member_ids: members[0] ? [members[0].id] : [],
              hasDueDate: false,
              dueDate: '',
              dueHour: '12',
              dueMinute: '00'
            });
            setShowTodoModal(true);
          }}
          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full transition-colors text-slate-300"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="flex-1 space-y-3 pr-2">
        <AnimatePresence mode="popLayout">
          {todos.map(todo => {
            const todoMembers = getMembers(todo.member_ids);
            return (
              <motion.div
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                key={todo.id}
                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer group ${todo.completed ? 'bg-slate-950 border-slate-900 opacity-60' : 'bg-slate-800 border-slate-700 shadow-sm'}`}
                onClick={() => openEditTodoModal(todo)}
              >
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleTodo(todo.id, todo.completed);
                  }}
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${todo.completed ? 'bg-slate-500 border-slate-500 text-slate-900' : 'border-slate-600 hover:border-slate-500'}`}
                >
                  {todo.completed === 1 && <CheckSquare size={14} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${todo.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                    {todo.task}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {todoMembers.map(m => (
                      <div key={m.id} className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.color }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: m.color }}>
                          {m.name}
                        </span>
                      </div>
                    ))}
                    {todo.due_date && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${new Date(todo.due_date) < new Date() && !todo.completed ? 'text-red-400' : 'text-slate-500'}`}>
                          <Clock size={10} />
                          {new Date(todo.due_date).toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric' })} klo {new Date(todo.due_date).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTodo(todo.id);
                  }}
                  className="text-slate-500 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {todos.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500 italic text-sm">Ei tehtäviä. Nauti vapaa-ajasta!</p>
          </div>
        )}
      </div>
    </div>
  );
};
