const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080/api";

export type User = { id: string; name: string; email: string };
export type Habit = {
  id: string;
  name: string;
  description?: string;
  category: string;
  color: string;
  target?: string;
  weekdays: number[];
  completedDates: string[];
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
};
export type CalendarEvent = {
  id: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location?: string;
  category: string;
  color: string;
  reminderMinutes?: number;
};
export type Reminder = {
  id: string;
  eventId: string;
  eventTitle: string;
  dueAt: string;
  status: "UPCOMING" | "OVERDUE" | "DISMISSED" | "COMPLETED";
};
export type Analytics = {
  scheduledToday: number;
  completedToday: number;
  todayRate: number;
  weekly: { label: string; completed: number; scheduled: number }[];
  monthly: { label: string; rate: number }[];
  activity: { date: string; count: number }[];
};

let token = sessionStorage.getItem("habitforge.token");
export const getToken = () => token;
export const setToken = (value: string | null) => {
  token = value;
  if (value) sessionStorage.setItem("habitforge.token", value);
  else sessionStorage.removeItem("habitforge.token");
};

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Time-Zone": Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? ((await response.json()) as { message?: string; detail?: string })
      : await response.text();
    if (response.status === 401) setToken(null);
    const message =
      typeof payload === "string"
        ? payload
        : (payload.message ?? payload.detail);
    throw new Error(message || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
