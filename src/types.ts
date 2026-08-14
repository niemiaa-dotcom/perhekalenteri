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
  reminder_minutes?: number; // Minutes before event to send email reminder (days*1440)
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

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  category: string;
  servings: number;
  ingredients: { item: string; amount: string }[];
  instructions: string[];
  diet_tags: string[];
  source: string;
  notes?: string;
  favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface PantryItem {
  id: string;
  item: string;
  amount: string;
  category: string;
  added_at: string;
}

export interface GeneratedShoppingItem {
  item: string;
  amount: string;
  source: string;
  already_in_pantry: boolean;
}
