export type EventCategory =
  | "meeting"
  | "milestone"
  | "review"
  | "deadline"
  | "reminder"
  | "general";

export type EventColor =
  | "blue"
  | "emerald"
  | "amber"
  | "purple"
  | "rose"
  | "cyan";

export interface CalendarEventItem {
  id: string;
  title: string;
  description: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  startTime?: string | null; // HH:mm (e.g. "10:00")
  endTime?: string | null; // HH:mm (e.g. "11:30")
  isAllDay: boolean;
  category: EventCategory;
  color: EventColor;
  clientId?: string | null;
  clientName?: string | null;
  taskId?: string | null;
  taskTitle?: string | null;
  location?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NewCalendarEventInput = {
  id?: string;
  title: string;
  description?: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  isAllDay?: boolean;
  category?: EventCategory;
  color?: EventColor;
  clientId?: string | null;
  clientName?: string | null;
  taskId?: string | null;
  taskTitle?: string | null;
  location?: string | null;
};

export type CalendarEventPatchInput = Partial<
  Omit<CalendarEventItem, "id" | "createdAt">
>;
