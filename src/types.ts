export interface FamilyMember {
  id: string;
  name: string;
  color: string;
  email?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  member_ids: string[];
  recurrence_type: 'none' | 'daily' | 'weekly' | 'monthly';
  reminder_minutes?: number; // Minutes before event to show notification
}

export interface Todo {
  id: string;
  task: string;
  completed: number;
  member_ids: string[];
  due_date?: string;
  created_at: string;
  reminder_minutes?: number;
}
