import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Plus, 
  Trash2,
  Clock,
  MapPin,
  ShoppingCart,
  Home,
  Utensils
} from 'lucide-react';
import { CalendarEvent, FamilyMember } from '../types';

interface CalendarProps {
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  events: CalendarEvent[];
  members: FamilyMember[];
  aiPrompt: string;
  setAiPrompt: React.Dispatch<React.SetStateAction<string>>;
  isAILoading: boolean;
  handleAIEventCreation: (e: React.FormEvent) => Promise<void>;
  openEditEventModal: (event: CalendarEvent) => void;
  handleDeleteEvent: (id: string, e?: React.MouseEvent) => Promise<void>;
  setEditingEventId: React.Dispatch<React.SetStateAction<string | null>>;
  setNewEvent: React.Dispatch<React.SetStateAction<any>>;
  setShowEventModal: React.Dispatch<React.SetStateAction<boolean>>;
  isPushSupported: boolean;
  isSubscribed: boolean;
  subscribeToPush: () => Promise<void>;
  viewMode?: 'day' | 'week' | 'month';
}

const getWeekNumber = (d: Date) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
};

export const Calendar: React.FC<CalendarProps> = ({
  currentDate,
  setCurrentDate,
  events,
  members,
  aiPrompt,
  setAiPrompt,
  isAILoading,
  handleAIEventCreation,
  openEditEventModal,
  handleDeleteEvent,
  setEditingEventId,
  setNewEvent,
  setShowEventModal,
  isPushSupported,
  isSubscribed,
  subscribeToPush,
  viewMode = 'day'
}) => {
  const [selectedDay, setSelectedDay] = useState(new Date());
  const hours = Array.from({ length: 24 }, (_, i) => i);

  useEffect(() => {
    // Sync selected day with currentDate
    if (currentDate.toDateString() !== selectedDay.toDateString()) {
      setSelectedDay(new Date(currentDate));
    }
  }, [currentDate]);

  const getWeekDays = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    
    return Array.from({ length: 7 }).map((_, i) => {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);
      return dayDate;
    });
  };

  const weekDays = getWeekDays(currentDate);

  const getMembers = (memberIds: string | string[]) => {
    try {
      const ids = typeof memberIds === 'string' ? JSON.parse(memberIds || '[]') : (memberIds || []);
      return ids.map((id: string) => members.find(m => m.id === id)).filter(Boolean) as FamilyMember[];
    } catch (e) {
      return [];
    }
  };

  const getEventsForDay = (day: Date) => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    const dayEvents: { event: CalendarEvent, start: Date, end: Date }[] = [];

    events.forEach(e => {
      const originalStart = new Date(e.start_time);
      const originalEnd = new Date(e.end_time);
      const duration = originalEnd.getTime() - originalStart.getTime();

      if (e.recurrence_type === 'none') {
        if (originalStart <= dayEnd && originalEnd >= dayStart) {
          const displayStart = new Date(Math.max(originalStart.getTime(), dayStart.getTime()));
          const displayEnd = new Date(Math.min(originalEnd.getTime(), dayEnd.getTime()));
          dayEvents.push({ event: e, start: displayStart, end: displayEnd });
        }
      } else if (e.recurrence_type === 'daily') {
        if (dayStart >= new Date(new Date(e.start_time).setHours(0,0,0,0))) {
          const instanceStart = new Date(day);
          instanceStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
          const instanceEnd = new Date(instanceStart.getTime() + duration);
          
          if (instanceStart <= dayEnd && instanceEnd >= dayStart) {
            const displayStart = new Date(Math.max(instanceStart.getTime(), dayStart.getTime()));
            const displayEnd = new Date(Math.min(instanceEnd.getTime(), dayEnd.getTime()));
            dayEvents.push({ event: e, start: displayStart, end: displayEnd });
          }
        }
      } else if (e.recurrence_type === 'weekly') {
        if (day.getDay() === originalStart.getDay() && dayStart >= new Date(new Date(e.start_time).setHours(0,0,0,0))) {
          const instanceStart = new Date(day);
          instanceStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
          const instanceEnd = new Date(instanceStart.getTime() + duration);
          
          if (instanceStart <= dayEnd && instanceEnd >= dayStart) {
            const displayStart = new Date(Math.max(instanceStart.getTime(), dayStart.getTime()));
            const displayEnd = new Date(Math.min(instanceEnd.getTime(), dayEnd.getTime()));
            dayEvents.push({ event: e, start: displayStart, end: displayEnd });
          }
        }
      } else if (e.recurrence_type === 'monthly') {
        if (day.getDate() === originalStart.getDate() && dayStart >= new Date(new Date(e.start_time).setHours(0,0,0,0))) {
          const instanceStart = new Date(day);
          instanceStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
          const instanceEnd = new Date(instanceStart.getTime() + duration);
          
          if (instanceStart <= dayEnd && instanceEnd >= dayStart) {
            const displayStart = new Date(Math.max(instanceStart.getTime(), dayStart.getTime()));
            const displayEnd = new Date(Math.min(instanceEnd.getTime(), dayEnd.getTime()));
            dayEvents.push({ event: e, start: displayStart, end: displayEnd });
          }
        }
      }
    });

    return dayEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
  };

  const getProcessedEventsForWeek = () => {
    const processed: { event: CalendarEvent, startCol: number, span: number, row: number, start: Date, end: Date }[] = [];
    const weekStart = new Date(weekDays[0]);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekDays[6]);
    weekEnd.setHours(23, 59, 59, 999);

    const weekEvents: { event: CalendarEvent, start: Date, end: Date }[] = [];

    events.forEach(e => {
      const originalStart = new Date(e.start_time);
      const originalEnd = new Date(e.end_time);
      const duration = originalEnd.getTime() - originalStart.getTime();

      if (e.recurrence_type === 'none') {
        if (originalStart <= weekEnd && originalEnd >= weekStart) {
          weekEvents.push({ event: e, start: originalStart, end: originalEnd });
        }
      } else if (e.recurrence_type === 'daily') {
        weekDays.forEach(day => {
          const instanceStart = new Date(day);
          instanceStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
          const instanceEnd = new Date(instanceStart.getTime() + duration);
          if (instanceStart >= originalStart && instanceStart <= weekEnd && instanceEnd >= weekStart) {
            weekEvents.push({ event: e, start: instanceStart, end: instanceEnd });
          }
        });
      } else if (e.recurrence_type === 'weekly') {
        const dayOfWeek = originalStart.getDay();
        weekDays.forEach(day => {
          if (day.getDay() === dayOfWeek) {
            const instanceStart = new Date(day);
            instanceStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
            const instanceEnd = new Date(instanceStart.getTime() + duration);
            if (instanceStart >= originalStart && instanceStart <= weekEnd && instanceEnd >= weekStart) {
              weekEvents.push({ event: e, start: instanceStart, end: instanceEnd });
            }
          }
        });
      } else if (e.recurrence_type === 'monthly') {
        const dayOfMonth = originalStart.getDate();
        weekDays.forEach(day => {
          if (day.getDate() === dayOfMonth) {
            const instanceStart = new Date(day);
            instanceStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
            const instanceEnd = new Date(instanceStart.getTime() + duration);
            if (instanceStart >= originalStart && instanceStart <= weekEnd && instanceEnd >= weekStart) {
              weekEvents.push({ event: e, start: instanceStart, end: instanceEnd });
            }
          }
        });
      }
    });

    weekEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

    weekEvents.forEach(we => {
      const startDayIndex = weekDays.findIndex(d => d.toDateString() === we.start.toDateString());
      const endDayIndex = weekDays.findIndex(d => d.toDateString() === we.end.toDateString());
      const startCol = Math.max(1, (startDayIndex !== -1 ? startDayIndex : 0) + 1);
      const endCol = Math.min(7, (endDayIndex !== -1 ? endDayIndex : 6) + 1);
      const span = endCol - startCol + 1;

      let row = 0;
      while (true) {
        const conflict = processed.find(p => 
          p.row === row && 
          !(startCol >= p.startCol + p.span || startCol + span <= p.startCol)
        );
        if (!conflict) break;
        row++;
      }
      processed.push({ event: we.event, startCol, span, row, start: we.start, end: we.end });
    });

    return processed;
  };

  const selectedDayEvents = getEventsForDay(selectedDay);
  const processedWeekEvents = getProcessedEventsForWeek();

  const renderDayView = () => {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-serif italic text-white capitalize">
              {selectedDay.toLocaleDateString('fi-FI', { weekday: 'long' })}
            </h2>
            <p className="text-xs md:text-sm text-slate-500 font-medium tracking-wide">
              {selectedDay.toLocaleDateString('fi-FI', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center bg-slate-900 rounded-xl p-1 border border-slate-800">
            <button 
              onClick={() => {
                const d = new Date(selectedDay);
                d.setDate(d.getDate() - 1);
                setSelectedDay(d);
                setCurrentDate(d);
              }}
              className="p-1.5 md:p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button 
              onClick={() => {
                const today = new Date();
                setSelectedDay(today);
                setCurrentDate(today);
              }}
              className="px-2 md:px-4 py-1 text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
            >
              Tänään
            </button>
            <button 
              onClick={() => {
                const d = new Date(selectedDay);
                d.setDate(d.getDate() + 1);
                setSelectedDay(d);
                setCurrentDate(d);
              }}
              className="p-1.5 md:p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="relative flex-1 bg-slate-900/20 rounded-[24px] md:rounded-[32px] border border-white/5 overflow-hidden">
          <div className="absolute inset-0 overflow-y-auto no-scrollbar p-4 md:p-6">
            <div className="relative min-h-[1200px]">
              {/* Hour markers */}
              {hours.map(hour => (
                <div key={hour} className="flex items-center gap-2 md:gap-4 h-[50px] group relative">
                  <span className="w-10 md:w-12 text-[9px] md:text-[10px] font-bold text-slate-600 group-hover:text-slate-400 transition-colors">
                    {hour.toString().padStart(2, '0')}:00
                  </span>
                  <div className="flex-1 h-[1px] bg-slate-800/50 group-hover:bg-slate-800 transition-colors"></div>
                  
                  {/* Quick add button */}
                  <button 
                    onClick={() => {
                      setEditingEventId(null);
                      const pad = (n: number) => n.toString().padStart(2, '0');
                      const dateStr = `${selectedDay.getFullYear()}-${pad(selectedDay.getMonth() + 1)}-${pad(selectedDay.getDate())}`;
                      setNewEvent({
                        title: '', description: '',
                        startDate: dateStr, startHour: pad(hour), startMinute: '00',
                        endDate: dateStr, endHour: pad(hour + 1), endMinute: '00',
                        member_ids: members[0] ? [members[0].id] : [], recurrence_type: 'none', hasEndDate: false,
                        reminder_minutes: 0
                      });
                      setShowEventModal(true);
                    }}
                    className="absolute right-0 opacity-0 group-hover:opacity-100 md:group-hover:opacity-100 p-1 bg-brand-accent/20 text-brand-accent rounded-full transition-all hover:bg-brand-accent hover:text-white z-20"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              ))}

              {/* Current time indicator */}
              {selectedDay.toDateString() === new Date().toDateString() && (
                <div 
                  className="absolute left-12 right-0 border-t-2 border-brand-accent z-20 flex items-center"
                  style={{ top: `${(new Date().getHours() * 50) + (new Date().getMinutes() / 60 * 50)}px` }}
                >
                  <div className="w-2 h-2 bg-brand-accent rounded-full -ml-1 shadow-[0_0_10px_rgba(249,115,22,0.5)]"></div>
                </div>
              )}

              {/* Events */}
              {selectedDayEvents.map(({ event, start, end }, idx) => {
                const eventMembers = getMembers(event.member_ids);
                const primaryColor = eventMembers[0]?.color || '#444';
                
                // Calculate position
                const startMinutes = start.getHours() * 60 + start.getMinutes();
                const endMinutes = end.getHours() * 60 + end.getMinutes();
                const top = (startMinutes / 60) * 50;
                const height = Math.max(40, ((endMinutes - startMinutes) / 60) * 50);

                return (
                  <div 
                    key={`${event.id}-${idx}`}
                    onClick={() => openEditEventModal(event)}
                    className="absolute left-16 right-4 rounded-2xl p-4 border border-slate-800 bg-slate-950/80 backdrop-blur-md shadow-xl hover:shadow-brand-accent/10 hover:border-slate-700 transition-all cursor-pointer z-10 group overflow-hidden"
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                      borderLeftWidth: '4px',
                      borderLeftColor: primaryColor
                    }}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white group-hover:text-brand-accent transition-colors truncate">
                          {event.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock size={10} className="text-slate-500" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            {start.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <div className="flex -space-x-1 shrink-0">
                        {eventMembers.map(m => (
                          <div 
                            key={m.id} 
                            className="w-5 h-5 rounded-full border border-slate-900 flex items-center justify-center text-[7px] font-bold text-white"
                            style={{ backgroundColor: m.color }}
                          >
                            {m.name[0]}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-serif italic text-white">Viikko {getWeekNumber(currentDate)}</h2>
          <div className="flex items-center bg-slate-900 rounded-xl p-1 border border-slate-800">
            <button 
              onClick={() => {
                const d = new Date(currentDate);
                d.setDate(d.getDate() - 7);
                setCurrentDate(d);
              }}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-1 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
            >
              Tänään
            </button>
            <button 
              onClick={() => {
                const d = new Date(currentDate);
                d.setDate(d.getDate() + 7);
                setCurrentDate(d);
              }}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
          <div className="min-w-[700px] md:min-w-0 flex flex-col gap-6">
            <div className="grid grid-cols-7 gap-1 md:gap-4">
              {weekDays.map((day, idx) => {
                const isToday = day.toDateString() === new Date().toDateString();
                const isSelected = day.toDateString() === selectedDay.toDateString();
                return (
                  <div 
                    key={idx} 
                    onClick={() => {
                      setSelectedDay(day);
                      setCurrentDate(day);
                    }}
                    className={`text-center p-1 md:p-4 rounded-xl md:rounded-2xl border transition-all cursor-pointer group relative ${
                      isSelected ? 'bg-brand-accent/10 border-brand-accent ring-2 ring-brand-accent/20' :
                      isToday ? 'bg-brand-accent/5 border-brand-accent/30' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <p className="text-[8px] md:text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-0.5 md:mb-1">
                      {day.toLocaleDateString('fi-FI', { weekday: 'short' })}
                    </p>
                    <p className={`text-xs md:text-xl font-serif ${isToday ? 'text-brand-accent font-bold' : 'text-slate-400'}`}>
                      {day.getDate()}
                    </p>
                    
                    {/* Quick add button for week view */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingEventId(null);
                        const pad = (n: number) => n.toString().padStart(2, '0');
                        const dateStr = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
                        setNewEvent({
                          title: '', description: '',
                          startDate: dateStr, startHour: '12', startMinute: '00',
                          endDate: dateStr, endHour: '13', endMinute: '00',
                          member_ids: members[0] ? [members[0].id] : [], recurrence_type: 'none', hasEndDate: false,
                          reminder_minutes: 0
                        });
                        setShowEventModal(true);
                      }}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-brand-accent text-white rounded-full flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-lg z-20"
                    >
                      <Plus size={12} strokeWidth={3} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="relative grid grid-cols-7 gap-1 md:gap-4 auto-rows-min min-h-[600px]">
              {/* Background columns */}
              <div className="col-span-7 grid grid-cols-7 gap-1 md:gap-4 absolute inset-0 pointer-events-none">
                {weekDays.map((_, idx) => (
                  <div key={idx} className="bg-slate-800/10 rounded-2xl h-full"></div>
                ))}
              </div>

              {/* Events */}
              {processedWeekEvents.map((pe, idx) => {
                const eventMembers = getMembers(pe.event.member_ids);
                const primaryColor = eventMembers[0]?.color || '#444';
                
                return (
                  <div 
                    key={`${pe.event.id}-${idx}`}
                    className="relative p-1.5 md:p-3 rounded-xl border border-slate-800 bg-slate-950/90 backdrop-blur-md shadow-lg hover:shadow-brand-accent/10 hover:border-slate-700 transition-all cursor-pointer z-10 group overflow-hidden"
                    style={{
                      gridColumnStart: pe.startCol,
                      gridColumnEnd: `span ${pe.span}`,
                      gridRowStart: pe.row + 1,
                      borderLeftWidth: '4px',
                      borderLeftColor: primaryColor
                    }}
                    onClick={() => openEditEventModal(pe.event)}
                  >
                    <p className="text-[10px] md:text-sm font-bold text-slate-100 truncate leading-tight mb-1">{pe.event.title}</p>
                    <div className="text-[8px] md:text-[10px] text-slate-500 font-bold uppercase tracking-wider flex flex-col md:flex-row md:items-center md:gap-1">
                      <span>{pe.start.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="hidden md:inline">-</span>
                      <span>{pe.end.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getMonthDays = (date: Date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), 1);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const start = new Date(d.setDate(d.getDate() + diff));
    
    return Array.from({ length: 42 }).map((_, i) => {
      const dayDate = new Date(start);
      dayDate.setDate(start.getDate() + i);
      return dayDate;
    });
  };

  const monthDays = getMonthDays(currentDate);

  const renderMonthView = () => {
    return (
      <div className="flex flex-col gap-6 h-full">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-serif italic text-white capitalize">
            {currentDate.toLocaleDateString('fi-FI', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex items-center bg-slate-900 rounded-xl p-1 border border-slate-800">
            <button 
              onClick={() => {
                const d = new Date(currentDate);
                d.setMonth(d.getMonth() - 1);
                setCurrentDate(d);
              }}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-1 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
            >
              Tänään
            </button>
            <button 
              onClick={() => {
                const d = new Date(currentDate);
                d.setMonth(d.getMonth() + 1);
                setCurrentDate(d);
              }}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="overflow-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 flex-1">
          <div className="min-w-[800px] md:min-w-0 min-h-[600px] md:min-h-[800px] pb-24 flex flex-col">
            <div className="grid grid-cols-7 gap-px bg-slate-800 rounded-3xl border border-slate-800 overflow-hidden flex-1">
              {['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'].map(day => (
                <div key={day} className="bg-slate-900 p-4 text-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{day}</span>
                </div>
              ))}
              {monthDays.map((day, idx) => {
                const isToday = day.toDateString() === new Date().toDateString();
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const dayEvents = getEventsForDay(day);
                
                return (
                  <div 
                    key={idx} 
                    onClick={() => {
                      setSelectedDay(day);
                      setCurrentDate(day);
                    }}
                    className={`bg-slate-950/50 p-1 md:p-2 min-h-[80px] md:min-h-[100px] transition-all cursor-pointer hover:bg-slate-900/50 group relative ${
                      !isCurrentMonth ? 'opacity-30' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1 md:mb-2">
                      <span className={`text-xs md:text-sm font-bold ${isToday ? 'w-6 h-6 md:w-7 md:h-7 bg-brand-accent text-white rounded-full flex items-center justify-center' : 'text-slate-400'}`}>
                        {day.getDate()}
                      </span>
                      
                      {/* Quick add button for month view */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingEventId(null);
                          const pad = (n: number) => n.toString().padStart(2, '0');
                          const dateStr = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
                          setNewEvent({
                            title: '', description: '',
                            startDate: dateStr, startHour: '12', startMinute: '00',
                            endDate: dateStr, endHour: '13', endMinute: '00',
                            member_ids: members[0] ? [members[0].id] : [], recurrence_type: 'none', hasEndDate: false,
                            reminder_minutes: 0
                          });
                          setShowEventModal(true);
                        }}
                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 bg-brand-accent/20 text-brand-accent rounded-full transition-all hover:bg-brand-accent hover:text-white"
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                    <div className="space-y-0.5 md:space-y-1">
                      {dayEvents.slice(0, 3).map(({ event }, eIdx) => {
                        const eventMembers = getMembers(event.member_ids);
                        const primaryColor = eventMembers[0]?.color || '#444';
                        return (
                          <div 
                            key={`${event.id}-${eIdx}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditEventModal(event);
                            }}
                            className="text-[10px] font-bold px-2 py-1 rounded-md truncate text-white/90 border-l-2"
                            style={{ 
                              backgroundColor: `${primaryColor}20`,
                              borderLeftColor: primaryColor
                            }}
                          >
                            {event.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-[9px] font-bold text-slate-500 px-2">
                          + {dayEvents.length - 3} lisää
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full">
      {viewMode === 'day' && renderDayView()}
      {viewMode === 'week' && renderWeekView()}
      {viewMode === 'month' && renderMonthView()}
    </div>
  );
};
