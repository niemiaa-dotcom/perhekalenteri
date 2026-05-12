import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  CheckSquare, 
  Plus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  User,
  LayoutDashboard,
  Sparkles,
  Utensils,
  X,
  Check,
  Bell,
  Repeat,
  FileText,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FamilyMember, CalendarEvent, Todo } from './types';
import { Calendar } from './components/Calendar';
import { TodoList } from './components/TodoList';
import { Food } from './components/Food';

const ClockPicker = ({ initialHour, initialMinute, onSave, onClose }: { initialHour: string, initialMinute: string, onSave: (h: string, m: string) => void, onClose: () => void }) => {
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(initialMinute);

  const handleHourSelect = (h: number) => {
    setHour(h.toString().padStart(2, '0'));
    setMode('minute');
  };

  const handleMinuteSelect = (m: number) => {
    const newMin = m.toString().padStart(2, '0');
    setMinute(newMin);
    onSave(hour, newMin);
  };

  const renderHours = () => {
    const hours = Array.from({length: 24}, (_, i) => i);
    return hours.map(h => {
      const isOuter = h > 0 && h <= 12;
      const radius = isOuter ? 90 : 55;
      const angle = (h % 12) * 30 * (Math.PI / 180);
      const x = 120 + radius * Math.sin(angle);
      const y = 120 - radius * Math.cos(angle);
      
      return (
        <button
          key={h}
          type="button"
          onClick={() => handleHourSelect(h)}
          className={`absolute w-8 h-8 -ml-4 -mt-4 rounded-full flex items-center justify-center text-sm transition-colors ${hour === h.toString().padStart(2, '0') ? 'bg-slate-100 text-slate-900' : 'hover:bg-slate-800 text-slate-300'}`}
          style={{ left: x, top: y }}
        >
          {h}
        </button>
      );
    });
  };

  const renderMinutes = () => {
    const minutes = Array.from({length: 12}, (_, i) => i * 5);
    return minutes.map(m => {
      const radius = 90;
      const angle = (m / 5) * 30 * (Math.PI / 180);
      const x = 120 + radius * Math.sin(angle);
      const y = 120 - radius * Math.cos(angle);
      
      return (
        <button
          key={m}
          type="button"
          onClick={() => handleMinuteSelect(m)}
          className={`absolute w-8 h-8 -ml-4 -mt-4 rounded-full flex items-center justify-center text-sm transition-colors ${minute === m.toString().padStart(2, '0') ? 'bg-slate-100 text-slate-900' : 'hover:bg-slate-800 text-slate-300'}`}
          style={{ left: x, top: y }}
        >
          {m.toString().padStart(2, '0')}
        </button>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} 
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="relative bg-stone-900 rounded-[32px] p-6 shadow-2xl flex flex-col items-center border border-stone-800"
      >
        <div className="flex gap-2 text-4xl font-serif mb-6">
          <button type="button" onClick={() => setMode('hour')} className={`${mode === 'hour' ? 'text-stone-100 font-bold' : 'text-stone-600 hover:text-stone-400'} transition-colors`}>{hour}</button>
          <span className="text-stone-600">:</span>
          <button type="button" onClick={() => setMode('minute')} className={`${mode === 'minute' ? 'text-stone-100 font-bold' : 'text-stone-600 hover:text-stone-400'} transition-colors`}>{minute}</button>
        </div>
        <div className="relative w-[240px] h-[240px] bg-stone-950 rounded-full border border-stone-800 shadow-inner">
          <div className="absolute left-1/2 top-1/2 w-2 h-2 -ml-1 -mt-1 bg-stone-100 rounded-full" />
          {mode === 'hour' ? renderHours() : renderMinutes()}
        </div>
        <button type="button" onClick={() => onSave(hour, minute)} className="mt-6 px-6 py-2 bg-slate-100 text-slate-900 rounded-full text-sm font-bold hover:bg-slate-300 transition-colors">Valmis</button>
      </motion.div>
    </div>
  );
};

const getWeekNumber = (d: Date) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
};

const DatePicker = ({ initialDate, onSave, onClose }: { initialDate: string, onSave: (date: string) => void, onClose: () => void }) => {
  const [viewDate, setViewDate] = useState(initialDate ? new Date(initialDate) : new Date());
  const [selectedDate, setSelectedDate] = useState(initialDate ? new Date(initialDate) : new Date());

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  // Adjust for Monday start (0=Sun, 1=Mon... -> 0=Mon, 6=Sun)
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

  const handleDateSelect = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    setSelectedDate(newDate);
    const pad = (n: number) => n.toString().padStart(2, '0');
    onSave(`${newDate.getFullYear()}-${pad(newDate.getMonth() + 1)}-${pad(newDate.getDate())}`);
  };

  const weekdays = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} 
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="relative bg-stone-900 rounded-[32px] p-6 shadow-2xl flex flex-col border border-stone-800 w-full max-w-xs"
      >
        <div className="flex items-center justify-between mb-6">
          <button onClick={prevMonth} className="p-2 hover:bg-stone-800 rounded-full text-stone-400 transition-colors"><ChevronLeft size={20} /></button>
          <h4 className="text-lg font-serif italic text-white">
            {viewDate.toLocaleDateString('fi-FI', { month: 'long', year: 'numeric' })}
          </h4>
          <button onClick={nextMonth} className="p-2 hover:bg-stone-800 rounded-full text-stone-400 transition-colors"><ChevronRight size={20} /></button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekdays.map(w => (
            <div key={w} className="text-[10px] font-bold text-stone-500 text-center uppercase tracking-widest">{w}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === viewDate.getMonth() && selectedDate.getFullYear() === viewDate.getFullYear();
            const isToday = new Date().toDateString() === new Date(viewDate.getFullYear(), viewDate.getMonth(), day).toDateString();
            
            return (
              <button
                key={day}
                onClick={() => handleDateSelect(day)}
                className={`aspect-square rounded-xl text-sm flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-900/40' : isToday ? 'text-indigo-400 font-bold border border-indigo-500/30' : 'text-stone-300 hover:bg-stone-800'}`}
              >
                {day}
              </button>
            );
          })}
        </div>
        
        <button onClick={onClose} className="mt-6 w-full py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-sm font-bold transition-colors">Sulje</button>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'calendar' | 'todos' | 'food' | 'settings'>('calendar');
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('week');
  const [showEventModal, setShowEventModal] = useState(false);
  const [showTodoModal, setShowTodoModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [activeTimePicker, setActiveTimePicker] = useState<'start' | 'end' | 'todo' | null>(null);
  const [activeDatePicker, setActiveDatePicker] = useState<'start' | 'end' | 'todo' | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);

  const [newEvent, setNewEvent] = useState({ 
    title: '', description: '', 
    startDate: '', startHour: '12', startMinute: '00',
    endDate: '', endHour: '13', endMinute: '00',
    member_ids: [] as string[], recurrence_type: 'none' as 'none' | 'daily' | 'weekly' | 'monthly',
    hasEndDate: false,
    reminder_minutes: 0
  });

  const [newTodo, setNewTodo] = useState({ 
    task: '', 
    member_ids: [] as string[],
    hasDueDate: false,
    dueDate: '',
    dueHour: '12',
    dueMinute: '00',
    reminder_minutes: 0
  });

  useEffect(() => {
    fetchData();
    checkPushSupport();
    checkEmailConfig();
  }, []);

  const checkEmailConfig = async () => {
    try {
      const res = await fetch('/api/settings/email-status');
      if (res.ok) {
        const data = await res.json();
        setEmailConfigured(data.configured);
      }
    } catch (err) {
      console.error("Failed to check email config status:", err);
    }
  };

  const checkPushSupport = async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsPushSupported(true);
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribeToPush = async () => {
    try {
      const response = await fetch('/api/push/public-key');
      const { publicKey } = await response.json();
      
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription })
      });

      setIsSubscribed(true);
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
    }
  };

  const selectAllMembers = () => {
    setNewEvent(prev => ({
      ...prev,
      member_ids: members.map(m => m.id)
    }));
  };

  const fetchData = async () => {
    try {
      const [membersRes, eventsRes, todosRes] = await Promise.all([
        fetch('/api/members'),
        fetch('/api/events'),
        fetch('/api/todos')
      ]);
      
      if (!membersRes.ok || !eventsRes.ok || !todosRes.ok) {
        throw new Error('Palvelinvirhe tietoja haettaessa');
      }
      
      const membersData = await membersRes.json();
      const eventsData = await eventsRes.json();
      const todosData = await todosRes.json();

      setMembers(membersData);
      setEvents(eventsData);
      setTodos(todosData);
      
      if (membersData && membersData.length > 0) {
        setNewEvent(prev => ({ 
          ...prev, 
          member_ids: prev.member_ids.length > 0 ? prev.member_ids : [String(membersData[0].id)] 
        }));
        setNewTodo(prev => ({ 
          ...prev, 
          member_ids: prev.member_ids.length > 0 ? prev.member_ids : [String(membersData[0].id)] 
        }));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      // You could add a state for errors here to show in UI
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const startDateTime = new Date(`${newEvent.startDate}T${newEvent.startHour}:${newEvent.startMinute}:00`);
      const endDateTime = new Date(`${newEvent.hasEndDate && newEvent.endDate ? newEvent.endDate : newEvent.startDate}T${newEvent.endHour}:${newEvent.endMinute}:00`);

      const eventToSave = {
        ...newEvent,
        member_ids: newEvent.member_ids.map(id => String(id)),
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        reminder_minutes: newEvent.reminder_minutes || null
      };
      
      const url = editingEventId ? `/api/events/${editingEventId}` : '/api/events';
      const method = editingEventId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventToSave)
      });

      if (!response.ok) {
        let errorMessage = 'Tallennus epäonnistui';
        const responseText = await response.text();
        try {
          const errData = JSON.parse(responseText);
          errorMessage = errData.error || errorMessage;
        } catch (e) {
          errorMessage = responseText.slice(0, 100) || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      setShowEventModal(false);
      setEditingEventId(null);
      setNewEvent({ 
        title: '', description: '', 
        startDate: '', startHour: '12', startMinute: '00',
        endDate: '', endHour: '13', endMinute: '00',
        member_ids: members[0] ? [String(members[0].id)] : [], recurrence_type: 'none', hasEndDate: false,
        reminder_minutes: 0
      });
      fetchData();
    } catch (error: any) {
      console.error('Error saving event:', error);
      alert('Tapahtuman tallennus epäonnistui: ' + error.message);
    }
  };

  const openEditEventModal = (event: CalendarEvent) => {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    
    // Format dates to YYYY-MM-DD for input[type="date"]
    const formatLocal = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };

    const startDateStr = formatLocal(start);
    const endDateStr = formatLocal(end);
    
    let parsedMemberIds: string[] = [];
    try {
      parsedMemberIds = typeof event.member_ids === 'string' ? JSON.parse(event.member_ids || '[]') : (event.member_ids || []);
    } catch (e) {
      parsedMemberIds = [];
    }

    setEditingEventId(event.id);
    setNewEvent({
      title: event.title,
      description: event.description || '',
      startDate: startDateStr,
      startHour: start.getHours().toString().padStart(2, '0'),
      startMinute: start.getMinutes().toString().padStart(2, '0'),
      endDate: endDateStr,
      endHour: end.getHours().toString().padStart(2, '0'),
      endMinute: end.getMinutes().toString().padStart(2, '0'),
      member_ids: parsedMemberIds,
      recurrence_type: event.recurrence_type,
      hasEndDate: startDateStr !== endDateStr,
      reminder_minutes: event.reminder_minutes || 0
    });
    setShowEventModal(true);
  };

  const openEditTodoModal = (todo: Todo) => {
    let parsedMemberIds: string[] = [];
    try {
      parsedMemberIds = typeof todo.member_ids === 'string' ? JSON.parse(todo.member_ids || '[]') : (todo.member_ids || []);
    } catch (e) {
      parsedMemberIds = [];
    }

    let hasDueDate = false;
    let dueDate = '';
    let dueHour = '12';
    let dueMinute = '00';

    if (todo.due_date) {
      hasDueDate = true;
      const d = new Date(todo.due_date);
      const pad = (n: number) => n.toString().padStart(2, '0');
      dueDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      dueHour = pad(d.getHours());
      dueMinute = pad(d.getMinutes());
    }

    setEditingTodoId(todo.id);
    setNewTodo({
      task: todo.task,
      member_ids: parsedMemberIds,
      hasDueDate,
      dueDate,
      dueHour,
      dueMinute,
      reminder_minutes: todo.reminder_minutes || 0
    });
    setShowTodoModal(true);
  };

  const handleDeleteEvent = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await fetch(`/api/events/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const handleAIEventCreation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setIsAILoading(true);
    try {
      const today = new Date();
      const membersContext = members.map(m => `${m.name} (ID: ${m.id})`).join(', ');
      
      const systemInstruction = `
        Olet perhekalenterin apulainen. Käyttäjä antaa sinulle aikataulun vapaalla tekstillä.
        Tehtäväsi on poimia aikataulusta tapahtumat ja palauttaa ne JSON-muodossa.
        
        Tänään on: ${today.toISOString()} (${today.toLocaleDateString('fi-FI', { weekday: 'long' })})
        Perheenjäsenet ja heidän ID:nsä: ${membersContext}
        
        Säännöt:
        - Päättele oikeat member_ids tekstin perusteella. Jos henkilöä ei mainita, käytä ID:tä ["${members[0]?.id || ''}"].
        - start_time ja end_time on oltava muodossa "YYYY-MM-DDTHH:mm".
        - Jos tapahtuma toistuu viikoittain (esim. "joka maanantai", "viikottaiset kouluajat"), aseta recurrence_type: "weekly".
        - Laske start_time ja end_time päivämäärät oikein. Jos sanotaan "Ma klo 8-12", etsi kuluvan tai seuraavan viikon maanantain päivämäärä ja aseta se start_time:ksi.
        - Kuvaus (description) voi olla tyhjä, jos sitä ei erikseen mainita.
      `;

      const res = await fetch('/api/ai/create-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, systemInstruction })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create events via AI');
      }

      const eventsToCreate = await res.json();
      
      for (const ev of eventsToCreate) {
        const startDateTime = new Date(ev.start_time);
        const endDateTime = new Date(ev.end_time);
        
        await fetch('/api/events', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...ev,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString()
          }) 
        });
      }
      
      setAiPrompt('');
      fetchData();
    } catch (error) {
      console.error('Error with AI creation:', error);
      alert('Tekoäly kohtasi ongelman. Yritä uudelleen.');
    } finally {
      setIsAILoading(false);
    }
  };

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dueDateTime = newTodo.hasDueDate && newTodo.dueDate ? new Date(`${newTodo.dueDate}T${newTodo.dueHour}:${newTodo.dueMinute}:00`) : null;

      const todoToSave = {
        task: newTodo.task,
        member_ids: newTodo.member_ids,
        due_date: dueDateTime ? dueDateTime.toISOString() : null
      };

      if (editingTodoId) {
        await fetch(`/api/todos/${editingTodoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...todoToSave,
            reminder_minutes: newTodo.hasDueDate ? newTodo.reminder_minutes : null
          })
        });
      } else {
        await fetch('/api/todos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...todoToSave,
            reminder_minutes: newTodo.hasDueDate ? newTodo.reminder_minutes : null
          })
        });
      }
      setShowTodoModal(false);
      setEditingTodoId(null);
      setNewTodo({ 
        task: '', 
        member_ids: [],
        hasDueDate: false,
        dueDate: '',
        dueHour: '12',
        dueMinute: '00',
        reminder_minutes: 0
      });
      fetchData();
    } catch (error) {
      console.error('Error adding todo:', error);
    }
  };

  const handleToggleTodo = async (id: string, completed: number) => {
    try {
      await fetch(`/api/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !completed })
      });
      fetchData();
    } catch (error) {
      console.error('Error toggling todo:', error);
    }
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      await fetch(`/api/todos/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Error deleting todo:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-pulse text-2xl font-serif italic text-slate-500">Ladataan perheen seinää...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-brand-dark text-slate-200 font-sans">
      {/* Left Sidebar - Desktop Only */}
      <aside className="hidden lg:flex w-64 border-r border-slate-800 flex-col bg-brand-dark z-20">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-accent rounded-lg flex items-center justify-center shadow-lg shadow-brand-accent/20">
            <CalendarIcon className="text-white" size={24} />
          </div>
          <span className="text-xl font-bold text-white tracking-tight font-serif italic">FamilyHub</span>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('calendar')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'calendar' ? 'bg-slate-800/50 text-brand-accent font-semibold' : 'text-slate-400 hover:bg-slate-800/30'}`}
          >
            <CalendarIcon size={20} />
            Kalenteri
          </button>
          <button 
            onClick={() => setActiveTab('todos')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'todos' ? 'bg-slate-800/50 text-brand-accent font-semibold' : 'text-slate-400 hover:bg-slate-800/30'}`}
          >
            <CheckSquare size={20} />
            Tehtävät
          </button>
          <button 
            onClick={() => setActiveTab('food')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'food' ? 'bg-slate-800/50 text-brand-accent font-semibold' : 'text-slate-400 hover:bg-slate-800/30'}`}
          >
            <Utensils size={20} />
            Ruoka
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-slate-800/50 text-brand-accent font-semibold' : 'text-slate-400 hover:bg-slate-800/30'}`}
          >
            <Settings size={20} />
            Asetukset
          </button>

          <div className="pt-8">
            <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">Perheenjäsenet</p>
            <div className="space-y-1">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-800/20 rounded-lg cursor-pointer group">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }}></span>
                  <span className="text-sm text-slate-400 group-hover:text-slate-200">{m.name}</span>
                </div>
              ))}
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-brand-dark relative overflow-hidden">
        {/* Top Bar */}
        <header className="h-20 border-b border-slate-800 flex items-center justify-between px-4 md:px-8 bg-brand-dark/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-4 bg-slate-900/50 rounded-full px-5 py-2 border border-slate-800 w-full max-w-md">
            <Sparkles className="text-brand-accent" size={18} />
            <form onSubmit={handleAIEventCreation} className="flex-1">
              <input 
                type="text" 
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="Kysy tekoälyltä..."
                className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder-slate-500 text-slate-200"
                disabled={isAILoading}
              />
            </form>
            {isAILoading && <div className="w-4 h-4 border-2 border-brand-accent/30 border-t-brand-accent rounded-full animate-spin" />}
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex bg-slate-900 rounded-lg p-1">
              <button 
                onClick={() => setCalendarView('day')}
                className={`px-2 md:px-4 py-1 md:py-1.5 rounded-md text-[10px] md:text-sm font-medium transition-all ${calendarView === 'day' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Päivä
              </button>
              <button 
                onClick={() => setCalendarView('week')}
                className={`px-2 md:px-4 py-1 md:py-1.5 rounded-md text-[10px] md:text-sm font-medium transition-all ${calendarView === 'week' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Viikko
              </button>
              <button 
                onClick={() => setCalendarView('month')}
                className={`px-2 md:px-4 py-1 md:py-1.5 rounded-md text-[10px] md:text-sm font-medium transition-all ${calendarView === 'month' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Kuukausi
              </button>
            </div>
            <div className="hidden md:block h-6 w-[1px] bg-slate-800 mx-2"></div>
            <button className="hidden md:flex p-2.5 text-slate-400 hover:text-white bg-slate-900 rounded-full relative border border-slate-800">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-brand-accent rounded-full border-2 border-slate-900"></span>
            </button>
            <button 
              onClick={() => {
                setEditingEventId(null);
                setNewEvent({ 
                  title: '', description: '', 
                  startDate: currentDate.toISOString().split('T')[0], startHour: '12', startMinute: '00',
                  endDate: currentDate.toISOString().split('T')[0], endHour: '13', endMinute: '00',
                  member_ids: members[0] ? [members[0].id] : [], recurrence_type: 'none', hasEndDate: false,
                  reminder_minutes: 0
                });
                setShowEventModal(true);
              }}
              className="hidden md:flex items-center gap-2 bg-brand-accent hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-xl shadow-lg shadow-orange-950/20 transition-all"
            >
              <Plus size={20} strokeWidth={3} />
              Lisää meno
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar relative">
          <div className={`p-4 pb-28 md:p-8 ${activeTab === 'calendar' ? 'h-full flex flex-col' : ''}`}>
            {activeTab === 'calendar' && (
              <Calendar 
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                events={events}
                members={members}
                aiPrompt={aiPrompt}
                setAiPrompt={setAiPrompt}
                isAILoading={isAILoading}
                handleAIEventCreation={handleAIEventCreation}
                openEditEventModal={openEditEventModal}
                handleDeleteEvent={handleDeleteEvent}
                setEditingEventId={setEditingEventId}
                setNewEvent={setNewEvent}
                setShowEventModal={setShowEventModal}
                isPushSupported={isPushSupported}
                isSubscribed={isSubscribed}
                subscribeToPush={subscribeToPush}
                viewMode={calendarView}
              />
            )}
            {activeTab === 'todos' && (
              <TodoList 
                todos={todos}
                members={members}
                handleToggleTodo={handleToggleTodo}
                handleDeleteTodo={handleDeleteTodo}
                openEditTodoModal={openEditTodoModal}
                setEditingTodoId={setEditingTodoId}
                setNewTodo={setNewTodo}
                setShowTodoModal={setShowTodoModal}
              />
            )}
            {activeTab === 'food' && <Food />}
            {activeTab === 'settings' && (
              <div className="max-w-4xl mx-auto space-y-8">
                <h2 className="text-4xl font-serif italic text-white mb-8">Asetukset</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-4 p-6 bg-slate-900/50 rounded-3xl border border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-brand-accent/20 rounded-xl flex items-center justify-center text-brand-accent">
                        <Bell size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-200">Selainilmoitukset</h3>
                        <p className="text-xs text-slate-500">Saa muistutuksia selaimeen</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {!isPushSupported && (
                        <div className="text-xs text-slate-400 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                          <p className="font-bold text-slate-300 mb-1">Selainilmoitukset eivät ole aktivoitavissa tässä näkymässä.</p>
                          <ul className="list-disc pl-4 space-y-1 mt-2">
                            <li>Jos olet AI Studiossa, <b>avaa sovellus uuteen välilehteen</b> (App URL).</li>
                            <li><b>iPhonella:</b> Avaa sivu Safarissa, paina Jaa-nappia ja valitse "Lisää Koti-valikkoon". Avaa sovellus Koti-valikosta.</li>
                            <li><b>Androidilla:</b> Asenna sovellus tai lisää aloitusnäyttöön selaimen valikosta.</li>
                          </ul>
                        </div>
                      )}
                      {isPushSupported && !isSubscribed && (
                        <div className="flex flex-col gap-2">
                          <button 
                            onClick={subscribeToPush}
                            className="w-full py-3 bg-brand-accent hover:bg-orange-600 text-white rounded-xl font-bold transition-all"
                          >
                            Ota selainilmoitukset käyttöön
                          </button>
                          <p className="text-xs text-slate-500 text-center">
                            Salli ilmoitukset selaimen ja laitteen asetuksista.
                          </p>
                        </div>
                      )}
                      {isSubscribed && (
                        <div className="text-emerald-500 text-sm font-bold bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-center">
                          Selainilmoitukset käytössä
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 p-6 bg-slate-900/50 rounded-3xl border border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
                        <User size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-200">Perheenjäsenet & Sähköpostit</h3>
                        <p className="text-xs text-slate-500">Hallitse jäseniä ja heidän ilmoitusosoitteitaan</p>
                      </div>
                    </div>
                    
                    {!emailConfigured && (
                      <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-xl text-sm text-orange-200">
                        <p className="font-bold mb-1">Sähköpostimuistutukset eivät ole käytössä!</p>
                        <p>Jotta sähköpostimuistutukset toimivat, sinun täytyy asettaa <code className="bg-orange-900/50 px-1 rounded">EMAIL_USER</code> ja <code className="bg-orange-900/50 px-1 rounded">EMAIL_PASS</code> ympäristömuuttujat AI Studion asetuksissa (Settings-valikko).</p>
                        <ul className="list-disc pl-4 mt-2 space-y-1 text-xs opacity-80">
                          <li><code className="bg-orange-900/50 px-1 rounded">EMAIL_USER</code> on Gmail-osoitteesi</li>
                          <li><code className="bg-orange-900/50 px-1 rounded">EMAIL_PASS</code> on Gmailin <b>Sovellussalasana</b> (App Password)</li>
                        </ul>
                      </div>
                    )}

                    <div className="space-y-3">
                      {members.map(m => (
                        <div key={m.id} className="flex flex-col gap-2 bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                          <div className="flex items-center gap-3">
                            <input 
                              type="color" 
                              value={m.color} 
                              onChange={async (e) => {
                                const newColor = e.target.value;
                                setMembers(prev => prev.map(member => member.id === m.id ? { ...member, color: newColor } : member));
                                await fetch(`/api/members/${m.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ name: m.name, color: newColor, email: m.email })
                                });
                              }}
                              className="w-8 h-8 rounded-lg bg-transparent border-none cursor-pointer shrink-0"
                            />
                            <input 
                              type="text" 
                              value={m.name}
                              onChange={(e) => {
                                const newName = e.target.value;
                                setMembers(prev => prev.map(member => member.id === m.id ? { ...member, name: newName } : member));
                              }}
                              onBlur={async (e) => {
                                await fetch(`/api/members/${m.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ name: e.target.value, color: m.color, email: m.email })
                                });
                                fetchData();
                              }}
                              className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-white font-bold"
                            />
                            <button 
                              onClick={async () => {
                                // Fallback to custom modal or just delete if confirm is not allowed in iframe, but existing code uses confirm
                                if (confirm(`Haluatko varmasti poistaa jäsenen ${m.name}?`)) {
                                  await fetch(`/api/members/${m.id}`, { method: 'DELETE' });
                                  fetchData();
                                }
                              }}
                              className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 pl-11">
                            <input 
                              type="email" 
                              placeholder="Sähköpostiosoite muistutuksille"
                              value={m.email || ''}
                              onChange={(e) => {
                                const newEmail = e.target.value;
                                setMembers(prev => prev.map(member => member.id === m.id ? { ...member, email: newEmail } : member));
                              }}
                              onBlur={async (e) => {
                                await fetch(`/api/members/${m.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ name: m.name, color: m.color, email: e.target.value })
                                });
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-brand-accent transition-colors placeholder-slate-600"
                            />
                          </div>
                        </div>
                      ))}
                      <button 
                        onClick={async () => {
                          const name = prompt('Uuden jäsenen nimi:');
                          if (name) {
                            const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
                            const randomColor = colors[Math.floor(Math.random() * colors.length)];
                            await fetch('/api/members', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ name, color: randomColor })
                            });
                            fetchData();
                          }
                        }}
                        className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition-all border border-slate-700 flex items-center justify-center gap-2"
                      >
                        <Plus size={18} />
                        Lisää jäsen
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-900/50 rounded-3xl border border-slate-800">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-400">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-200">Varmuuskopiointi</h3>
                      <p className="text-xs text-slate-500">Hallitse perheen tietoja. Tiedot tallennetaan palvelimelle tiedostoon family_wall.db.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button 
                      onClick={async () => {
                        try {
                          const response = await fetch('/api/export');
                          const data = await response.json();
                          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `familyhub_backup_${new Date().toISOString().split('T')[0]}.json`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        } catch (e) {}
                      }}
                      className="py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition-all"
                    >
                      Lataa tiedot
                    </button>
                    <div className="relative">
                      <input 
                        type="file" 
                        accept=".json"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = async (event) => {
                            try {
                              const data = JSON.parse(event.target?.result as string);
                              if (confirm('Tämä korvaa kaikki nykyiset tiedot. Haluatko varmasti jatkaa?')) {
                                const response = await fetch('/api/import', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify(data)
                                });
                                
                                if (response.ok) {
                                  alert('Tiedot palautettu onnistuneesti!');
                                  window.location.reload();
                                } else {
                                  const err = await response.json();
                                  alert('Palautus epäonnistui: ' + (err.error || 'Tuntematon virhe'));
                                }
                              }
                            } catch (e) {
                              alert('Tiedoston luku epäonnistui. Varmista, että tiedosto on oikeassa muodossa.');
                            }
                          };
                          reader.readAsText(file);
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <button className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition-all border border-slate-700">
                        Palauta tiedot
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Spacer for mobile bottom navigation */}
          <div className="h-24 lg:hidden pointer-events-none" />
        </div>
      </main>

      {/* Right Sidebar - Desktop Only */}
      <aside className="hidden xl:flex w-80 border-l border-slate-800 bg-brand-dark p-6 flex-col overflow-y-auto no-scrollbar">
        <div className="mb-10">
          <h2 className="text-2xl font-serif italic text-white mb-6">Seuraavaksi</h2>
          <div className="space-y-6">
            {events
              .filter(e => new Date(e.start_time) >= new Date())
              .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
              .slice(0, 3)
              .map((e, i, arr) => (
                <div key={e.id} className={`relative pl-6 ${i !== arr.length - 1 ? 'pb-6 border-l border-slate-800' : ''}`}>
                  <div 
                    className="absolute left-[-4.5px] top-0 w-2 h-2 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                    style={{ 
                      backgroundColor: members.find(m => {
                        const ids = typeof e.member_ids === 'string' ? JSON.parse(e.member_ids || '[]') : (e.member_ids || []);
                        return ids.includes(m.id);
                      })?.color || '#444' 
                    }}
                  />
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    {new Date(e.start_time).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}
                    {new Date(e.start_time).toDateString() !== new Date().toDateString() && ` • ${new Date(e.start_time).toLocaleDateString('fi-FI', { day: 'numeric', month: 'short' })}`}
                  </p>
                  <h4 className="text-sm font-bold text-slate-200">{e.title}</h4>
                  <p className="text-xs text-slate-500 mt-1 truncate">{e.description || 'Ei kuvausta'}</p>
                </div>
              ))}
            {events.filter(e => new Date(e.start_time) >= new Date()).length === 0 && (
              <p className="text-sm text-slate-600 italic">Ei tulevia menoja.</p>
            )}
          </div>
        </div>

        <div className="bg-brand-accent/10 border border-brand-accent/20 rounded-3xl p-6 mb-10 relative overflow-hidden group">
          <div className="absolute -top-12 -right-12 w-24 h-24 bg-brand-accent/10 rounded-full blur-3xl group-hover:bg-brand-accent/20 transition-colors"></div>
          <div className="flex items-center gap-2 text-brand-accent mb-4">
            <Sparkles size={16} strokeWidth={3} />
            <span className="text-[10px] font-black uppercase tracking-widest">AI Suositus</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed font-medium">
            {events.length > 5 
              ? "Huominen näyttää kiireiseltä. Suosittelen valmistelemaan aamun jo tänään illalla."
              : "Kalenteri näyttää väljältä. Hyvä aika yhteiselle ulkoilulle!"}
          </p>
        </div>

        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mb-6">Ruokalista</h2>
          <div 
            onClick={() => setActiveTab('food')}
            className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex items-center justify-between group hover:border-slate-700 transition-colors cursor-pointer"
          >
            <span className="text-sm font-semibold text-slate-300">Katso viikon ruokalista</span>
            <Utensils className="text-slate-600 group-hover:text-slate-400" size={16} />
          </div>
        </div>
      </aside>

      {/* Event Modal */}
      <AnimatePresence>
        {showEventModal && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEventModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative bg-slate-900 rounded-t-[32px] md:rounded-[32px] w-full max-w-xl shadow-2xl border border-slate-800 flex flex-col max-h-[95vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-4 md:p-6 flex items-center justify-between border-b border-slate-800 bg-slate-900/50 sticky top-0 z-10">
                <button 
                  onClick={() => setShowEventModal(false)}
                  className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
                <h3 className="text-lg font-bold text-white font-serif italic">
                  {editingEventId ? 'Muokkaa tapahtumaa' : 'Lisää tapahtuma'}
                </h3>
                <button 
                  onClick={() => {
                    const form = document.getElementById('event-form') as HTMLFormElement;
                    if (form) form.requestSubmit();
                  }}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-full font-bold text-sm hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                >
                  Tallenna
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 no-scrollbar pb-12">
                <form id="event-form" onSubmit={handleAddEvent} className="space-y-8">
                  {/* Event Title */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500 ml-1">Tapahtuman nimi</label>
                    <input 
                      required
                      type="text"
                      value={newEvent.title}
                      onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                      placeholder="Syntymäpäiväjuhlat..."
                      className="w-full bg-transparent border-0 border-b-2 border-slate-800 focus:ring-0 focus:border-indigo-500 text-2xl font-bold p-0 pb-2 placeholder:text-slate-700 text-white transition-all"
                    />
                  </div>

                  {/* Date & Time Picker */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-indigo-400">
                      <CalendarIcon size={18} />
                      <span className="text-xs font-bold uppercase tracking-widest">Aika</span>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Start Time */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1">Alkaa</span>
                        <div className="flex gap-3">
                          <button 
                            type="button"
                            onClick={() => setActiveDatePicker('start')}
                            className="flex-1 bg-slate-800/50 p-3 rounded-2xl flex flex-col items-center justify-center border border-slate-700/50 hover:bg-slate-800 transition-colors relative overflow-hidden"
                          >
                            <span className="text-[10px] font-semibold text-slate-500">Päivä</span>
                            <span className="text-sm font-bold text-white">
                              {newEvent.startDate ? new Date(newEvent.startDate).toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'long' }) : 'Valitse päivä'}
                            </span>
                          </button>
                          <button 
                            type="button"
                            onClick={() => setActiveTimePicker('start')}
                            className="flex-1 bg-slate-800/50 p-3 rounded-2xl flex flex-col items-center justify-center border border-slate-700/50 hover:bg-slate-800 transition-colors"
                          >
                            <span className="text-[10px] font-semibold text-slate-500">Klo</span>
                            <span className="text-sm font-bold text-white">{newEvent.startHour}:{newEvent.startMinute}</span>
                          </button>
                        </div>
                      </div>

                      {/* End Time */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1">Päättyy</span>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={newEvent.hasEndDate}
                              onChange={e => setNewEvent({...newEvent, hasEndDate: e.target.checked})}
                              className="w-3 h-3 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Eri päivänä</span>
                          </label>
                        </div>
                        <div className="flex gap-3">
                          <button 
                            type="button"
                            disabled={!newEvent.hasEndDate}
                            onClick={() => setActiveDatePicker('end')}
                            className={`flex-1 bg-slate-800/50 p-3 rounded-2xl flex flex-col items-center justify-center border border-slate-700/50 transition-colors relative overflow-hidden ${!newEvent.hasEndDate ? 'opacity-50' : 'hover:bg-slate-800'}`}
                          >
                            <span className="text-[10px] font-semibold text-slate-500">Päivä</span>
                            <span className="text-sm font-bold text-white">
                              {newEvent.hasEndDate ? (newEvent.endDate ? new Date(newEvent.endDate).toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'long' }) : 'Valitse päivä') : '-'}
                            </span>
                          </button>
                          <button 
                            type="button"
                            onClick={() => setActiveTimePicker('end')}
                            className="flex-1 bg-slate-800/50 p-3 rounded-2xl flex flex-col items-center justify-center border border-slate-700/50 hover:bg-slate-800 transition-colors"
                          >
                            <span className="text-[10px] font-semibold text-slate-500">Klo</span>
                            <span className="text-sm font-bold text-white">{newEvent.endHour}:{newEvent.endMinute}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Participants */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-indigo-400">
                        <User size={18} />
                        <span className="text-xs font-bold uppercase tracking-widest">Osallistujat</span>
                      </div>
                      <button 
                        type="button"
                        onClick={selectAllMembers}
                        className="text-[10px] font-bold text-slate-500 hover:text-indigo-400 uppercase tracking-widest transition-colors"
                      >
                        Valitse kaikki
                      </button>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                      {members.map(m => {
                        const isSelected = newEvent.member_ids.includes(m.id);
                        return (
                          <div 
                            key={m.id} 
                            onClick={() => {
                              setNewEvent(prev => ({
                                ...prev,
                                member_ids: isSelected 
                                  ? prev.member_ids.filter(id => id !== m.id)
                                  : [...prev.member_ids, m.id]
                              }));
                            }}
                            className="flex flex-col items-center gap-2 min-w-[70px] cursor-pointer group"
                          >
                            <div className="relative">
                              <div 
                                className={`size-16 rounded-full p-1 border-2 transition-all duration-300 ${isSelected ? 'scale-110' : 'border-transparent opacity-40'}`}
                                style={{ borderColor: isSelected ? m.color : 'transparent' }}
                              >
                                <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-xl font-bold text-white overflow-hidden relative">
                                  {m.avatar ? (
                                    <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                                  ) : (
                                    m.name[0]
                                  )}
                                  {isSelected && (
                                    <div className="absolute inset-0 bg-indigo-600/20 flex items-center justify-center">
                                      <Check size={24} className="text-white drop-shadow-md" />
                                    </div>
                                  )}
                                </div>
                              </div>
                              {isSelected && (
                                <div 
                                  className="absolute -bottom-1 -right-1 bg-indigo-600 text-white rounded-full size-6 flex items-center justify-center border-2 border-slate-900 shadow-lg"
                                  style={{ backgroundColor: m.color }}
                                >
                                  <Check size={12} strokeWidth={3} />
                                </div>
                              )}
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-tighter transition-colors ${isSelected ? 'text-white' : 'text-slate-500'}`}>
                              {m.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recurrence */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-indigo-400">
                      <Repeat size={18} />
                      <span className="text-xs font-bold uppercase tracking-widest">Toistuvuus</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {[
                        { id: 'none', label: 'Ei toistuvuutta' },
                        { id: 'daily', label: 'Päivittäin' },
                        { id: 'weekly', label: 'Viikoittain' },
                        { id: 'monthly', label: 'Kuukausittain' }
                      ].map(t => (
                        <button 
                          key={t.id}
                          type="button"
                          onClick={() => setNewEvent({...newEvent, recurrence_type: t.id as any})}
                          className={`px-4 py-3 rounded-2xl text-xs font-bold whitespace-nowrap border transition-all ${
                            newEvent.recurrence_type === t.id 
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' 
                              : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reminder */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-indigo-400">
                      <Bell size={18} />
                      <span className="text-xs font-bold uppercase tracking-widest">Muistutus</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {[
                        { val: 0, label: 'Ei muistutusta' },
                        { val: 5, label: '5 min ennen' },
                        { val: 15, label: '15 min ennen' },
                        { val: 30, label: '30 min ennen' },
                        { val: 60, label: '1 tunti ennen' },
                        { val: 1440, label: '1 päivä ennen' }
                      ].map(r => (
                        <button 
                          key={r.val}
                          type="button"
                          onClick={() => setNewEvent({...newEvent, reminder_minutes: r.val})}
                          className={`px-4 py-3 rounded-2xl text-xs font-bold whitespace-nowrap border transition-all ${
                            newEvent.reminder_minutes === r.val 
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' 
                              : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-indigo-400">
                      <FileText size={18} />
                      <span className="text-xs font-bold uppercase tracking-widest">Kuvaus</span>
                    </div>
                    <textarea 
                      value={newEvent.description}
                      onChange={e => setNewEvent({...newEvent, description: e.target.value})}
                      placeholder="Lisää muistiinpanoja tästä..."
                      rows={3}
                      className="w-full bg-slate-800/50 rounded-2xl border border-slate-700/50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-4 placeholder:text-slate-700 text-sm text-slate-200 transition-all resize-none"
                    />
                  </div>

                  {/* Delete Button (only when editing) */}
                  {editingEventId && (
                    <div className="pt-4">
                      <button 
                        type="button"
                        onClick={() => {
                          if (window.confirm('Haluatko varmasti poistaa tämän merkinnän?')) {
                            handleDeleteEvent(editingEventId);
                            setShowEventModal(false);
                          }
                        }}
                        className="w-full px-4 py-4 rounded-2xl border border-red-900/30 text-red-400 font-bold hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2"
                      >
                        <Trash2 size={18} />
                        Poista merkintä
                      </button>
                    </div>
                  )}
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Todo Modal */}
      <AnimatePresence>
        {showTodoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTodoModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-slate-900 rounded-[32px] p-6 md:p-8 w-full max-w-md shadow-2xl border border-slate-800"
            >
              <h2 className="text-2xl md:text-3xl font-serif italic mb-6 text-slate-100">{editingTodoId ? 'Muokkaa Tehtävää' : 'Uusi Tehtävä'}</h2>
              <form onSubmit={handleAddTodo} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Tehtävä</label>
                  <input 
                    required
                    type="text"
                    value={newTodo.task}
                    onChange={e => setNewTodo({...newTodo, task: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-700 transition-all text-slate-100 placeholder-slate-600"
                    placeholder="Esim. Käy kaupassa"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Ajankohta (valinnainen)</label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={newTodo.hasDueDate}
                        onChange={e => setNewTodo({...newTodo, hasDueDate: e.target.checked})}
                        className="w-3 h-3 rounded border-slate-700 bg-slate-950 text-slate-100 focus:ring-slate-700"
                      />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Aseta aika</span>
                    </label>
                  </div>
                  {newTodo.hasDueDate && (
                    <div className="space-y-4 mt-2">
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={() => setActiveDatePicker('todo')}
                          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-700 transition-all text-sm text-left font-bold hover:bg-slate-800 text-slate-100"
                        >
                          {newTodo.dueDate ? new Date(newTodo.dueDate).toLocaleDateString('fi-FI', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Valitse päivä'}
                        </button>
                        <button 
                          type="button"
                          onClick={() => setActiveTimePicker('todo')}
                          className="w-24 bg-slate-950 border border-slate-800 rounded-xl px-2 py-3 focus:outline-none focus:ring-2 focus:ring-slate-700 transition-all text-sm text-center font-bold hover:bg-slate-800 text-slate-100"
                        >
                          {newTodo.dueHour}:{newTodo.dueMinute}
                        </button>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Muistutus</label>
                        <select 
                          value={newTodo.reminder_minutes}
                          onChange={e => setNewTodo({...newTodo, reminder_minutes: parseInt(e.target.value)})}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-slate-700 transition-all text-slate-100"
                        >
                          <option value={0}>Ei muistutusta</option>
                          <option value={5}>5 minuuttia ennen</option>
                          <option value={15}>15 minuuttia ennen</option>
                          <option value={30}>30 minuuttia ennen</option>
                          <option value={60}>1 tunti ennen</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-2">Vastuuhenkilöt</label>
                  <div className="flex flex-wrap gap-2">
                    {members.map(m => {
                      const isSelected = newTodo.member_ids.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setNewTodo(prev => ({
                              ...prev,
                              member_ids: isSelected 
                                ? prev.member_ids.filter(id => id !== m.id)
                                : [...prev.member_ids, m.id]
                            }));
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${isSelected ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-600'}`}
                          style={isSelected ? { borderColor: m.color, color: m.color, backgroundColor: `${m.color}20` } : {}}
                        >
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="pt-4 flex flex-col gap-3">
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setShowTodoModal(false)}
                      className="flex-1 px-4 py-3 rounded-xl border border-slate-800 font-bold text-slate-400 hover:bg-slate-800 transition-colors"
                    >
                      Peruuta
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-900 font-bold hover:bg-slate-300 transition-colors"
                    >
                      {editingTodoId ? 'Tallenna' : 'Lisää'}
                    </button>
                  </div>
                  {editingTodoId && (
                    <button 
                      type="button"
                      onClick={() => {
                        if (window.confirm('Haluatko varmasti poistaa tämän tehtävän?')) {
                          handleDeleteTodo(editingTodoId);
                          setShowTodoModal(false);
                        }
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-red-900/50 text-red-400 font-bold hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 size={18} />
                      Poista tehtävä
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* AI Modal */}
      <AnimatePresence>
        {showAIModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !isAILoading && setShowAIModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-slate-900 rounded-[32px] p-6 md:p-8 w-full max-w-md shadow-2xl border border-slate-800"
            >
              <h2 className="text-2xl md:text-3xl font-serif italic mb-2 flex items-center gap-3 text-slate-100">
                <Sparkles className="text-indigo-400" /> Tekoäly-apulainen
              </h2>
              <p className="text-sm text-slate-400 mb-6">Kerro vapaasti, mitä haluat lisätä kalenteriin. Esimerkiksi: "Lapsen viikottaiset kouluajat: Ma klo 8-12, Ti klo 9-13"</p>
              <form onSubmit={handleAIEventCreation} className="space-y-4">
                <div>
                  <textarea 
                    required
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    disabled={isAILoading}
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-900 transition-all resize-none text-sm text-slate-100 placeholder-slate-600"
                    placeholder="Kirjoita aikataulu tähän..."
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowAIModal(false)}
                    disabled={isAILoading}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-800 font-bold text-slate-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    Peruuta
                  </button>
                  <button 
                    type="submit"
                    disabled={isAILoading}
                    className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isAILoading ? <span className="animate-pulse">Luodaan...</span> : 'Luo tapahtumat'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Time Picker Modal */}
      <AnimatePresence>
        {activeTimePicker && (
          <ClockPicker
            initialHour={activeTimePicker === 'start' ? newEvent.startHour : activeTimePicker === 'end' ? newEvent.endHour : newTodo.dueHour}
            initialMinute={activeTimePicker === 'start' ? newEvent.startMinute : activeTimePicker === 'end' ? newEvent.endMinute : newTodo.dueMinute}
            onSave={(h, m) => {
              if (activeTimePicker === 'start') {
                setNewEvent({ ...newEvent, startHour: h, startMinute: m });
              } else if (activeTimePicker === 'end') {
                setNewEvent({ ...newEvent, endHour: h, endMinute: m });
              } else if (activeTimePicker === 'todo') {
                setNewTodo({ ...newTodo, dueHour: h, dueMinute: m });
              }
              setActiveTimePicker(null);
            }}
            onClose={() => setActiveTimePicker(null)}
          />
        )}
      </AnimatePresence>

      {/* Date Picker Modal */}
      <AnimatePresence>
        {activeDatePicker && (
          <DatePicker 
            initialDate={activeDatePicker === 'start' ? newEvent.startDate : activeDatePicker === 'end' ? newEvent.endDate : newTodo.dueDate}
            onSave={(date) => {
              if (activeDatePicker === 'start') setNewEvent({...newEvent, startDate: date});
              else if (activeDatePicker === 'end') setNewEvent({...newEvent, endDate: date});
              else if (activeDatePicker === 'todo') setNewTodo({...newTodo, dueDate: date});
              setActiveDatePicker(null);
            }}
            onClose={() => setActiveDatePicker(null)}
          />
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800 px-6 py-4 flex justify-between items-center z-50">
        <button onClick={() => setActiveTab('calendar')} className={`flex flex-col items-center gap-1 ${activeTab === 'calendar' ? 'text-brand-accent' : 'text-slate-500'}`}>
          <CalendarIcon size={24} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Koti</span>
        </button>
        <button onClick={() => setActiveTab('todos')} className={`flex flex-col items-center gap-1 ${activeTab === 'todos' ? 'text-brand-accent' : 'text-slate-500'}`}>
          <CheckSquare size={24} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Tehtävät</span>
        </button>
        <button onClick={() => setActiveTab('food')} className={`flex flex-col items-center gap-1 ${activeTab === 'food' ? 'text-brand-accent' : 'text-slate-500'}`}>
          <Utensils size={24} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Ruoka</span>
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 ${activeTab === 'settings' ? 'text-brand-accent' : 'text-slate-500'}`}>
          <Settings size={24} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Asetukset</span>
        </button>
      </nav>

      {/* Mobile Floating Action Button */}
      {activeTab === 'calendar' && (
        <div className="lg:hidden fixed bottom-24 right-6 z-50">
          <button 
            onClick={() => {
              setEditingEventId(null);
              setNewEvent({ 
                title: '', description: '', 
                startDate: currentDate.toISOString().split('T')[0], startHour: '12', startMinute: '00',
                endDate: currentDate.toISOString().split('T')[0], endHour: '13', endMinute: '00',
                member_ids: members[0] ? [members[0].id] : [], recurrence_type: 'none', hasEndDate: false,
                reminder_minutes: 0
              });
              setShowEventModal(true);
            }}
            className="w-14 h-14 bg-brand-accent text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform"
          >
            <Plus size={32} strokeWidth={3} />
          </button>
        </div>
      )}
    </div>
  );
}
