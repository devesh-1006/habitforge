import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { z } from "zod";
import {
  Activity,
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Flame,
  LayoutDashboard,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Settings,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { getToken, request, setToken } from "./api";
import type { Analytics, CalendarEvent, Habit, Reminder, User } from "./api";
import "./App.css";
import "./Feature.css";

type Toast = { message: string; error?: boolean };
type ModalState = {
  kind: "habit" | "event";
  item?: Habit | CalendarEvent;
} | null;
type EventTimes = {
  start?: string;
  end?: string;
  endDate?: string;
  allDayEndDate?: string;
  allDay?: boolean;
};
const today = (date = new Date()) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const dateOffset = (date: Date, offset: number) => {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + offset);
  return today(shifted);
};
const navItems = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/habits", label: "My habits", icon: Target },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/reminders", label: "Reminders", icon: Bell },
  { to: "/analytics", label: "Insights", icon: TrendingUp },
  { to: "/coach", label: "AI Coach", icon: Sparkles, soon: true },
];

function App() {
  const [currentDate] = useState(() => new Date());
  const currentDateString = today(currentDate);
  const [token, setCurrentToken] = useState(
    sessionStorage.getItem("habitforge.token"),
  );
  const [user, setUser] = useState<User | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(true);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [eventDate, setEventDate] = useState(() => currentDateString);
  const [eventTimes, setEventTimes] = useState<EventTimes>({});
  const [refresh, setRefresh] = useState(0);
  const navigate = useNavigate();

  const notify = useCallback((message: string, error = false) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 3600);
  }, []);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      const [profile, habitData, eventData, reminderData, analyticsData] =
        await Promise.all([
          request<User>("/profile"),
          request<Habit[]>("/habits"),
          request<CalendarEvent[]>("/events"),
          request<Reminder[]>("/reminders"),
          request<Analytics>("/analytics"),
        ]);
      setUser(profile);
      setHabits(habitData);
      setEvents(eventData);
      setReminders(reminderData);
      setAnalytics(analyticsData);
    } catch (error) {
      if (!getToken()) {
        setCurrentToken(null);
        setUser(null);
        setHabits([]);
        setEvents([]);
        setReminders([]);
        setAnalytics(null);
      }
      notify(
        error instanceof Error ? error.message : "Could not load your account.",
        true,
      );
    } finally {
      setLoading(false);
    }
  }, [token, notify]);

  useEffect(() => {
    void reload();
  }, [reload, refresh]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    )
      return;
    const notifyDueReminders = () => {
      const now = Date.now();
      reminders
        .filter(
          (reminder) =>
            reminder.status === "UPCOMING" || reminder.status === "OVERDUE",
        )
        .forEach((reminder) => {
          const due = new Date(reminder.dueAt).getTime();
          const key = `habitforge.notified.${reminder.id}`;
          if (
            due <= now &&
            due > now - 120_000 &&
            !sessionStorage.getItem(key)
          ) {
            new Notification("HabitForge reminder", {
              body: reminder.eventTitle,
            });
            sessionStorage.setItem(key, "1");
          }
        });
    };
    notifyDueReminders();
    const interval = window.setInterval(notifyDueReminders, 30_000);
    return () => window.clearInterval(interval);
  }, [reminders]);

  const signIn = async (path: string, body: unknown) => {
    const result = await request<{ token: string; user: User }>(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setToken(result.token);
    setCurrentToken(result.token);
    setUser(result.user);
    setLoading(true);
    setRefresh((value) => value + 1);
    navigate("/");
    notify(
      path.endsWith("register")
        ? "Your HabitForge account is ready."
        : "Welcome back.",
    );
  };
  const logout = () => {
    setToken(null);
    setCurrentToken(null);
    setUser(null);
    setHabits([]);
    setEvents([]);
    setReminders([]);
    setAnalytics(null);
    navigate("/login");
  };
  const saveHabit = async (data: Record<string, unknown>, id?: string) => {
    await request(`/habits${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(data),
    });
    setModal(null);
    setRefresh((value) => value + 1);
    notify(id ? "Habit updated." : "Habit created.");
  };
  const saveEvent = async (data: Record<string, unknown>, id?: string) => {
    await request(`/events${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(data),
    });
    setModal(null);
    setRefresh((value) => value + 1);
    notify(id ? "Event updated." : "Event created.");
  };
  const toggleCompletion = async (habit: Habit) => {
    await toggleDate(habit, today());
  };
  const toggleDate = async (habit: Habit, date: string) => {
    const done = habit.completedDates.includes(date);
    try {
      await request(`/habits/${habit.id}/completions/${date}`, {
        method: done ? "DELETE" : "PUT",
      });
      setRefresh((value) => value + 1);
      notify(
        done
          ? "Completion undone."
          : date === today()
            ? "Habit completed. Nice work."
            : "Past completion recorded.",
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not update completion.",
        true,
      );
    }
  };
  const archiveHabit = async (habit: Habit) => {
    if (
      !window.confirm(`Archive "${habit.name}"? Its history will be preserved.`)
    )
      return;
    try {
      await request(`/habits/${habit.id}/archive`, { method: "POST" });
      setRefresh((value) => value + 1);
      notify("Habit archived. Its completion history is preserved.");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not archive habit.",
        true,
      );
    }
  };
  const deleteHabit = async (habit: Habit) => {
    if (
      !window.confirm(
        `Delete "${habit.name}"? Its completion history will also be removed.`,
      )
    )
      return;
    try {
      await request(`/habits/${habit.id}`, { method: "DELETE" });
      setRefresh((value) => value + 1);
      notify("Habit deleted.");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not delete habit.",
        true,
      );
    }
  };
  const deleteEvent = async (event: CalendarEvent) => {
    if (!window.confirm(`Delete "${event.title}" and its reminder?`)) return;
    try {
      await request(`/events/${event.id}`, { method: "DELETE" });
      setRefresh((value) => value + 1);
      notify("Event deleted.");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not delete event.",
        true,
      );
    }
  };
  const updateReminder = async (
    id: string,
    status: "DISMISSED" | "COMPLETED",
  ) => {
    try {
      await request(`/reminders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setRefresh((value) => value + 1);
      notify(
        status === "COMPLETED" ? "Reminder completed." : "Reminder dismissed.",
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not update reminder.",
        true,
      );
    }
  };

  if (!token) return <AuthPage onSubmit={signIn} />;
  return (
    <div className="app-shell min-h-screen">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigate("/");
          }}
        >
          <span className="brand-mark">
            <Activity size={19} />
          </span>
          <span>
            habit<span className="brand-light">forge</span>
          </span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navItems.map(({ to, label, icon: Icon, soon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
              {soon && <span className="nav-soon">SOON</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="streak-card">
            <div className="streak-icon">
              <Flame size={19} />
            </div>
            <div>
              <strong>
                {habits.reduce(
                  (max, habit) => Math.max(max, habit.currentStreak),
                  0,
                )}{" "}
                day streak
              </strong>
              <span>Keep showing up</span>
            </div>
          </div>
          <button
            className="nav-link profile-link"
            onClick={() => navigate("/profile")}
          >
            <div className="avatar">
              {user?.name?.slice(0, 1).toUpperCase()}
            </div>
            <span className="profile-name">{user?.name}</span>
            <Settings size={17} />
          </button>
          <button className="nav-link logout-link" onClick={logout}>
            <LogOut size={17} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={15} />
            <strong>
              <CurrentPage />
            </strong>
          </div>
          <div className="top-actions">
            <span className="date-chip">
              <CalendarDays size={15} />
              {new Intl.DateTimeFormat(undefined, {
                month: "short",
                day: "numeric",
              }).format(currentDate)}
            </span>
            <button
              className="icon-button notification-button"
              aria-label="View reminders"
              onClick={() => navigate("/reminders")}
            >
              <Bell size={18} />
              {reminders.filter(
                (reminder) =>
                  reminder.status === "UPCOMING" ||
                  reminder.status === "OVERDUE",
              ).length > 0 && <i />}
            </button>
          </div>
        </header>
        <div className="page-content">
          {loading ? (
            <div className="loading-state">
              <span className="spinner" />
              Loading your workspace…
            </div>
          ) : (
            <Routes>
              <Route
                path="/"
                element={
                  <Dashboard
                    user={user}
                    habits={habits}
                    events={events}
                    reminders={reminders}
                    analytics={analytics}
                    currentDate={currentDate}
                    onHabit={toggleCompletion}
                    onAddHabit={() => setModal({ kind: "habit" })}
                    onAddEvent={() => {
                      setEventDate(currentDateString);
                      setEventTimes({});
                      setModal({ kind: "event" });
                    }}
                  />
                }
              />
              <Route
                path="/habits"
                element={
                  <HabitsPage
                    habits={habits}
                    currentDate={currentDate}
                    onToggle={toggleCompletion}
                    onAdd={() => setModal({ kind: "habit" })}
                    onEdit={(habit) => setModal({ kind: "habit", item: habit })}
                    onDelete={deleteHabit}
                    onArchive={archiveHabit}
                  />
                }
              />
              <Route
                path="/habits/:id"
                element={
                  <HabitDetailPage
                    habits={habits}
                    currentDate={currentDate}
                    onToggleDate={toggleDate}
                    onEdit={(habit) => setModal({ kind: "habit", item: habit })}
                  />
                }
              />
              <Route
                path="/calendar"
                element={
                  <CalendarPage
                    events={events}
                    habits={habits}
                    onAdd={(
                      date,
                      start,
                      end,
                      endDate,
                      allDayEndDate,
                      allDay,
                    ) => {
                      setEventDate(date);
                      setEventTimes({
                        start,
                        end,
                        endDate,
                        allDayEndDate,
                        allDay,
                      });
                      setModal({ kind: "event" });
                    }}
                    onDelete={deleteEvent}
                    onEdit={(event) => setModal({ kind: "event", item: event })}
                  />
                }
              />
              <Route
                path="/reminders"
                element={
                  <RemindersPage
                    reminders={reminders}
                    onUpdate={updateReminder}
                  />
                }
              />
              <Route
                path="/analytics"
                element={
                  <AnalyticsPage analytics={analytics} habits={habits} />
                }
              />
              <Route path="/coach" element={<CoachPage />} />
              <Route path="/profile" element={<ProfilePage user={user} />} />
              <Route
                path="*"
                element={
                  <Dashboard
                    user={user}
                    habits={habits}
                    events={events}
                    reminders={reminders}
                    analytics={analytics}
                    currentDate={currentDate}
                    onHabit={toggleCompletion}
                    onAddHabit={() => setModal({ kind: "habit" })}
                    onAddEvent={() => {
                      setEventDate(currentDateString);
                      setEventTimes({});
                      setModal({ kind: "event" });
                    }}
                  />
                }
              />
            </Routes>
          )}
        </div>
      </main>
      {menuOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      {modal && (
        <FormModal
          kind={modal.kind}
          initialDate={eventDate}
          initialTimes={eventTimes}
          initial={modal.item}
          onClose={() => setModal(null)}
          onSave={modal.kind === "habit" ? saveHabit : saveEvent}
          onError={(error) => notify(error, true)}
        />
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "toast-error" : ""}`}
          role="status"
        >
          {toast.error ? <CircleHelp size={18} /> : <CheckCircle2 size={18} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

function CurrentPage() {
  const location = useLocation();
  return (
    <>
      {navItems.find((item) => item.to === location.pathname)?.label ??
        (location.pathname === "/profile" ? "Profile" : "Overview")}
    </>
  );
}

export function AuthPage({
  onSubmit,
}: {
  onSubmit: (path: string, body: unknown) => Promise<void>;
}) {
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const schema = registering
      ? z.object({
          name: z.string().trim().min(2, "Enter your name."),
          email: z.email(),
          password: z.string().min(8, "Use at least 8 characters."),
        })
      : z.object({
          email: z.email(),
          password: z.string().min(1, "Enter your password."),
        });
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(
        registering ? "/auth/register" : "/auth/login",
        parsed.data,
      );
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Authentication failed.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page min-h-screen">
      <div className="auth-art">
        <a className="brand auth-brand" href="#">
          <span className="brand-mark">
            <Activity size={19} />
          </span>
          <span>
            habit<span className="brand-light">forge</span>
          </span>
        </a>
        <div className="art-copy">
          <span className="eyebrow">SMALL STEPS. LASTING CHANGE.</span>
          <h1>
            Make your days
            <br />
            count for <em>more.</em>
          </h1>
          <p>Build the routines that bring your best ideas to life.</p>
          <div className="art-orbit">
            <div className="orbit-ring ring-one" />
            <div className="orbit-ring ring-two" />
            <div className="orbit-center">
              <Target size={31} />
            </div>
            <span className="orbit-dot dot-a" />
            <span className="orbit-dot dot-b" />
            <span className="orbit-dot dot-c" />
          </div>
        </div>
        <div className="art-footer">
          A little progress each day adds up to big results.
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-card">
          <div className="mobile-auth-brand">
            <span className="brand-mark">
              <Activity size={19} />
            </span>
            habit<span className="brand-light">forge</span>
          </div>
          <span className="eyebrow">
            {registering ? "YOUR NEXT CHAPTER STARTS HERE" : "WELCOME BACK"}
          </span>
          <h2>
            {registering ? "Create your account" : "Sign in to HabitForge"}
          </h2>
          <p className="muted">
            {registering
              ? "Start building a rhythm that lasts."
              : "Your habits are waiting for you."}
          </p>
          <form noValidate onSubmit={submit} className="form-stack">
            {registering && (
              <label>
                Your name
                <input
                  name="name"
                  placeholder="Alex Morgan"
                  autoComplete="name"
                  required
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                placeholder={
                  registering ? "At least 8 characters" : "Enter your password"
                }
                autoComplete={registering ? "new-password" : "current-password"}
                required
                minLength={registering ? 8 : 1}
              />
            </label>
            {error && (
              <div className="inline-error" role="alert">
                {error}
              </div>
            )}
            <button
              className="button button-primary button-full"
              disabled={busy}
            >
              {busy
                ? "Please wait…"
                : registering
                  ? "Create account"
                  : "Sign in"}
              <ArrowUpRight size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {registering ? "Already have an account?" : "New to HabitForge?"}{" "}
            <button
              onClick={() => {
                setRegistering(!registering);
                setError("");
              }}
            >
              {registering ? "Sign in" : "Create account"}
            </button>
          </p>
          <p className="auth-note">Your account and data are private to you.</p>
        </div>
      </div>
    </div>
  );
}

function Dashboard({
  user,
  habits,
  events,
  reminders,
  analytics,
  currentDate,
  onHabit,
  onAddHabit,
  onAddEvent,
}: {
  user: User | null;
  habits: Habit[];
  events: CalendarEvent[];
  reminders: Reminder[];
  analytics: Analytics | null;
  currentDate: Date;
  onHabit: (habit: Habit) => void;
  onAddHabit: () => void;
  onAddEvent: () => void;
}) {
  const todaysHabits = habits.filter((habit) =>
    habit.weekdays.includes(currentDate.getDay()),
  );
  const upcoming = [...events]
    .filter((event) => event.startAt.slice(0, 10) >= today(currentDate))
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 3);
  const shownReminders = reminders
    .filter((item) => item.status === "UPCOMING" || item.status === "OVERDUE")
    .slice(0, 3);
  return (
    <div className="page-stack">
      <div className="welcome-row">
        <div>
          <span className="eyebrow">
            {new Intl.DateTimeFormat(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })
              .format(currentDate)
              .toUpperCase()}
          </span>
          <h1>
            Good {greeting(currentDate)}, {user?.name?.split(" ")[0] ?? "there"}{" "}
            <span className="wave">✦</span>
          </h1>
          <p className="muted">
            A little intention goes a long way. Let's make today count.
          </p>
        </div>
        <button className="button button-primary" onClick={onAddHabit}>
          <Plus size={17} />
          New habit
        </button>
      </div>
      <div className="metric-grid">
        <Metric
          icon={<Target size={19} />}
          color="violet"
          label="Scheduled today"
          value={analytics?.scheduledToday ?? 0}
          note="habits on your schedule"
        />
        <Metric
          icon={<CheckCircle2 size={19} />}
          color="green"
          label="Completed today"
          value={`${analytics?.completedToday ?? 0} / ${analytics?.scheduledToday ?? 0}`}
          note={
            analytics?.scheduledToday
              ? `${analytics.todayRate}% of today's habits`
              : "nothing scheduled today"
          }
        />
        <Metric
          icon={<Flame size={19} />}
          color="orange"
          label="Best current streak"
          value={`${habits.length ? Math.max(...habits.map((habit) => habit.currentStreak)) : 0} days`}
          note={`best ever ${habits.length ? Math.max(...habits.map((habit) => habit.longestStreak)) : 0} days`}
        />
        <Metric
          icon={<TrendingUp size={19} />}
          color="blue"
          label="Completion rate"
          value={`${analytics?.todayRate ?? 0}%`}
          note="for today's schedule"
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel habits-panel">
          <div className="panel-heading">
            <div>
              <h2>Today's habits</h2>
              <p>Show up for the things that matter.</p>
            </div>
            <NavLink to="/habits" className="text-link">
              All habits <ChevronRight size={15} />
            </NavLink>
          </div>
          {todaysHabits.length ? (
            <div className="today-list">
              {todaysHabits.slice(0, 5).map((habit) => (
                <div className="today-item" key={habit.id}>
                  <button
                    className={`check-circle ${habit.completedDates.includes(today(currentDate)) ? "checked" : ""}`}
                    onClick={() => void onHabit(habit)}
                    aria-label={`${habit.completedDates.includes(today(currentDate)) ? "Undo" : "Complete"} ${habit.name}`}
                  >
                    {habit.completedDates.includes(today(currentDate)) && (
                      <Check size={15} />
                    )}
                  </button>
                  <span
                    className="habit-dot"
                    style={{ background: habit.color }}
                  />
                  <div className="today-habit-copy">
                    <strong
                      className={
                        habit.completedDates.includes(today(currentDate))
                          ? "completed-text"
                          : ""
                      }
                    >
                      {habit.name}
                    </strong>
                    <span>
                      {habit.category}
                      {habit.target ? ` · ${habit.target}` : ""}
                    </span>
                  </div>
                  <span className="streak-mini">
                    <Flame size={13} />
                    {habit.currentStreak}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Your routine starts here"
              body="Add a habit to give your day a little structure."
              action="Create your first habit"
              onClick={onAddHabit}
            />
          )}
        </section>
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Your week, at a glance</h2>
              <p>Completed habits vs. your schedule</p>
            </div>
            <span className="chart-legend">
              <i />
              Completed
            </span>
          </div>
          {analytics?.weekly.some((day) => day.scheduled > 0) ? (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.weekly} barGap={5}>
                  <CartesianGrid stroke="#27303a" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#788391"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="#788391"
                    tickLine={false}
                    axisLine={false}
                    width={24}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#171e25",
                      border: "1px solid #303a43",
                      borderRadius: 10,
                      color: "#eef1f4",
                    }}
                  />
                  <Bar
                    dataKey="completed"
                    name="Completed"
                    fill="#a4e276"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty
              title="Your weekly rhythm will show up here"
              body="Complete a habit to start seeing your progress."
            />
          )}
        </section>
      </div>
      <div className="dashboard-grid lower-grid">
        <section className="panel events-panel">
          <div className="panel-heading">
            <div>
              <h2>Coming up</h2>
              <p>A little heads-up for what's next.</p>
            </div>
            <button
              className="icon-button add-small"
              aria-label="Add event"
              onClick={onAddEvent}
            >
              <Plus size={18} />
            </button>
          </div>
          {upcoming.length ? (
            <div className="event-list">
              {upcoming.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <Empty
              title="Your calendar is clear"
              body="Add an event so you don't miss a thing."
              action="Add an event"
              onClick={onAddEvent}
            />
          )}
        </section>
        <section className="panel reminders-panel">
          <div className="panel-heading">
            <div>
              <h2>Reminders</h2>
              <p>Important things, right on time.</p>
            </div>
            <NavLink to="/reminders" className="text-link">
              See all <ChevronRight size={15} />
            </NavLink>
          </div>
          {shownReminders.length ? (
            <div className="reminder-preview">
              {shownReminders.map((reminder) => (
                <div className="reminder-line" key={reminder.id}>
                  <span
                    className={`reminder-bullet ${reminder.status === "OVERDUE" ? "overdue" : ""}`}
                  />
                  <span>{reminder.eventTitle}</span>
                  <time>
                    {new Date(reminder.dueAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="No reminders just yet"
              body="Set a reminder when you create an event."
            />
          )}
        </section>
      </div>
    </div>
  );
}
function greeting(date: Date) {
  const hour = date.getHours();
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}
function Metric({
  icon,
  color,
  label,
  value,
  note,
}: {
  icon: ReactNode;
  color: string;
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${color}`}>{icon}</div>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <span className="metric-note">{note}</span>
    </div>
  );
}
function Empty({
  title,
  body,
  action,
  onClick,
}: {
  title: string;
  body: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Sparkles size={18} />
      </div>
      <strong>{title}</strong>
      <p>{body}</p>
      {action && onClick && (
        <button className="text-link empty-action" onClick={onClick}>
          {action} <ArrowUpRight size={14} />
        </button>
      )}
    </div>
  );
}
function EventRow({ event }: { event: CalendarEvent }) {
  return (
    <div className="event-row">
      <span className="event-color" style={{ background: event.color }} />
      <div className="event-row-title">
        <strong>{event.title}</strong>
        <span>{event.category}</span>
      </div>
      <time>
        {event.allDay
          ? new Date(
              `${event.startAt.slice(0, 10)}T12:00:00`,
            ).toLocaleDateString(undefined, { month: "short", day: "numeric" })
          : new Date(event.startAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
      </time>
    </div>
  );
}

function HabitsPage({
  habits,
  currentDate,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
  onArchive,
}: {
  habits: Habit[];
  currentDate: Date;
  onToggle: (habit: Habit) => void;
  onAdd: () => void;
  onEdit: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
  onArchive: (habit: Habit) => void;
}) {
  const [filter, setFilter] = useState("All habits");
  const shown = habits.filter(
    (habit) =>
      filter === "All habits" ||
      (filter === "Today"
        ? habit.weekdays.includes(currentDate.getDay())
        : habit.category === filter),
  );
  return (
    <div className="page-stack">
      <div className="welcome-row">
        <div>
          <span className="eyebrow">CONSISTENCY OVER INTENSITY</span>
          <h1>Your habits</h1>
          <p className="muted">Small promises kept, one day at a time.</p>
        </div>
        <button className="button button-primary" onClick={onAdd}>
          <Plus size={17} />
          Create habit
        </button>
      </div>
      <div className="filter-row">
        <div className="segmented">
          {[
            "All habits",
            "Today",
            ...Array.from(new Set(habits.map((habit) => habit.category))),
          ].map((item) => (
            <button
              key={item}
              className={filter === item ? "selected" : ""}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <span className="muted small-text">
          {shown.length} {shown.length === 1 ? "habit" : "habits"}
        </span>
      </div>
      {shown.length ? (
        <div className="habit-grid">
          {shown.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              currentDate={currentDate}
              onToggle={() => void onToggle(habit)}
              onEdit={() => onEdit(habit)}
              onArchive={() => onArchive(habit)}
              onDelete={() => void onDelete(habit)}
            />
          ))}
        </div>
      ) : (
        <section className="panel">
          <Empty
            title="No habits here yet"
            body="Pick a small, repeatable action and start building momentum."
            action="Create a habit"
            onClick={onAdd}
          />
        </section>
      )}
    </div>
  );
}
function HabitDetailPage({
  habits,
  currentDate,
  onToggleDate,
  onEdit,
}: {
  habits: Habit[];
  currentDate: Date;
  onToggleDate: (habit: Habit, date: string) => void;
  onEdit: (habit: Habit) => void;
}) {
  const { id } = useParams();
  const habit = habits.find((item) => item.id === id);
  if (!habit)
    return (
      <section className="panel">
        <Empty
          title="Habit not found"
          body="It may have been removed or archived."
          action="Back to habits"
          onClick={() => window.history.back()}
        />
      </section>
    );
  const days = Array.from({ length: 30 }, (_, index) => {
    return dateOffset(currentDate, index - 29);
  });
  return (
    <div className="page-stack">
      <div className="welcome-row">
        <div>
          <Link to="/habits" className="text-link">
            ‹ All habits
          </Link>
          <span className="eyebrow detail-eyebrow">
            {habit.category.toUpperCase()}
          </span>
          <h1>{habit.name}</h1>
          <p className="muted">
            {habit.description || "A little progress, every day."}
          </p>
        </div>
        <button
          className="button button-secondary"
          onClick={() => onEdit(habit)}
        >
          <Pencil size={15} />
          Edit habit
        </button>
      </div>
      <div className="metric-grid">
        <Metric
          icon={<Flame size={18} />}
          color="orange"
          label="Current streak"
          value={`${habit.currentStreak} days`}
          note="scheduled days in a row"
        />
        <Metric
          icon={<TrendingUp size={18} />}
          color="green"
          label="Longest streak"
          value={`${habit.longestStreak} days`}
          note="your personal best"
        />
        <Metric
          icon={<CheckCircle2 size={18} />}
          color="blue"
          label="30-day completion"
          value={`${habit.completionRate}%`}
          note="scheduled days completed"
        />
        <Metric
          icon={<Target size={18} />}
          color="violet"
          label="Schedule"
          value={`${habit.weekdays.length} days/week`}
          note={habit.target || "A routine that fits you"}
        />
      </div>
      <section className="panel history-panel">
        <div className="panel-heading">
          <div>
            <h2>Recent history</h2>
            <p>
              Select a date to record or undo a completion. Your history is
              preserved when you edit this habit.
            </p>
          </div>
        </div>
        <div className="history-grid">
          {days.map((date) => {
            const done = habit.completedDates.includes(date);
            const scheduled = habit.weekdays.includes(
              new Date(`${date}T12:00:00`).getDay(),
            );
            return (
              <button
                key={date}
                className={`history-day ${done ? "history-done" : ""} ${!scheduled ? "history-unscheduled" : ""}`}
                onClick={() => {
                  if (scheduled && date <= today(currentDate))
                    void onToggleDate(habit, date);
                }}
                disabled={!scheduled || date > today(currentDate)}
                title={`${date}${scheduled ? (done ? " — completed, click to undo" : " — click to mark complete") : " — not scheduled"}`}
              >
                <span>
                  {new Date(`${date}T12:00:00`)
                    .toLocaleDateString(undefined, { weekday: "short" })
                    .slice(0, 1)}
                </span>
                <strong>{date.slice(-2)}</strong>
              </button>
            );
          })}
        </div>
        <div className="history-legend">
          <span>
            <i className="history-done-key" />
            Completed
          </span>
          <span>
            <i className="history-unscheduled-key" />
            Not scheduled
          </span>
          <span>Only scheduled days count toward streaks.</span>
        </div>
      </section>
    </div>
  );
}
function HabitCard({
  habit,
  currentDate,
  onToggle,
  onEdit,
  onArchive,
  onDelete,
}: {
  habit: Habit;
  currentDate: Date;
  onToggle: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const done = habit.completedDates.includes(today(currentDate));
  return (
    <article className="panel habit-card">
      <div className="habit-card-top">
        <span
          className="habit-color-block"
          style={{ background: `${habit.color}22`, color: habit.color }}
        >
          <Target size={19} />
        </span>
        <div className="habit-card-actions">
          <button
            className="icon-button"
            aria-label={`Edit ${habit.name}`}
            onClick={onEdit}
          >
            <Pencil size={15} />
          </button>
          <button
            className="icon-button"
            aria-label={`Archive ${habit.name}`}
            onClick={onArchive}
          >
            <Archive size={15} />
          </button>
          <button
            className="icon-button delete-button"
            aria-label={`Delete ${habit.name}`}
            onClick={onDelete}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <span className="eyebrow category-label">{habit.category}</span>
      <h2>
        <Link to={`/habits/${habit.id}`}>{habit.name}</Link>
      </h2>
      <p className="habit-description">
        {habit.description || "A little progress, every day."}
      </p>
      <div className="weekday-row">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <span
            key={index}
            className={habit.weekdays.includes(index) ? "day-on" : ""}
          >
            {day}
          </span>
        ))}
      </div>
      <div className="habit-stats">
        <span>
          <Flame size={14} />
          {habit.currentStreak} day streak
        </span>
        <span>{habit.completionRate}% this month</span>
      </div>
      <button
        className={`button habit-check ${done ? "button-done" : "button-subtle"}`}
        onClick={onToggle}
      >
        {done ? (
          <>
            <Check size={16} />
            Done today
          </>
        ) : (
          <>
            <Plus size={16} />
            Mark complete
          </>
        )}
      </button>
    </article>
  );
}

function CalendarPage({
  events,
  habits,
  onAdd,
  onDelete,
  onEdit,
}: {
  events: CalendarEvent[];
  habits: Habit[];
  onAdd: (
    date: string,
    start?: string,
    end?: string,
    endDate?: string,
    allDayEndDate?: string,
    allDay?: boolean,
  ) => void;
  onDelete: (event: CalendarEvent) => void;
  onEdit: (event: CalendarEvent) => void;
}) {
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const calendarEvents = useMemo(
    () => [
      ...events.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.startAt,
        end: event.endAt,
        allDay: event.allDay,
        backgroundColor: event.color,
        borderColor: event.color,
        extendedProps: { data: event },
      })),
      ...habits.map((habit) => ({
        id: `habit-${habit.id}`,
        title: `Habit · ${habit.name}`,
        daysOfWeek: habit.weekdays,
        allDay: true,
        display: "background" as const,
        backgroundColor: "#8272c955",
        borderColor: "#8272c9",
        extendedProps: { data: undefined },
      })),
    ],
    [events, habits],
  );
  return (
    <div className="page-stack">
      <div className="welcome-row">
        <div>
          <span className="eyebrow">MAKE SPACE FOR WHAT MATTERS</span>
          <h1>Your calendar</h1>
          <p className="muted">A calm view of the things on your plate.</p>
        </div>
        <button
          className="button button-primary"
          onClick={() => onAdd(today())}
        >
          <Plus size={17} />
          Add event
        </button>
      </div>
      <section className="panel calendar-panel">
        <div className="calendar-note">
          <span>
            <i className="legend-event" />
            Events
          </span>
          <span>
            <i className="legend-habit" />
            Habit schedule
          </span>
          <span className="timezone-note">
            Times shown in your local timezone
          </span>
        </div>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          events={calendarEvents}
          selectable
          selectMirror
          dayMaxEvents
          weekends
          height="auto"
          timeZone="local"
          select={(info) => {
            const date = info.startStr.slice(0, 10);
            onAdd(
              date,
              info.allDay ? undefined : info.startStr.slice(11, 16),
              info.allDay ? undefined : info.endStr.slice(11, 16),
              info.allDay ? undefined : info.endStr.slice(0, 10),
              info.allDay ? shiftDate(info.endStr.slice(0, 10), -1) : undefined,
              info.allDay,
            );
          }}
          dateClick={(info) => {
            const date = info.dateStr.slice(0, 10);
            if (!info.dateStr.includes("T")) onAdd(date);
            else {
              const start = info.dateStr.slice(11, 16);
              const end = addHour(start);
              onAdd(
                date,
                start,
                end.time,
                end.dayOffset ? shiftDate(date, end.dayOffset) : date,
              );
            }
          }}
          eventClick={(info) => {
            const event = info.event.extendedProps.data as
              CalendarEvent | undefined;
            if (event) setSelected(event);
          }}
          eventTimeFormat={{
            hour: "numeric",
            minute: "2-digit",
            meridiem: "short",
          }}
        />
      </section>
      {selected && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <section className="dialog event-detail">
            <button
              className="icon-button dialog-close"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              <X size={19} />
            </button>
            <span
              className="event-color"
              style={{ background: selected.color }}
            />
            <span className="eyebrow">{selected.category}</span>
            <h2>{selected.title}</h2>
            <p>{selected.description || "No additional details."}</p>
            <div className="detail-line">
              <CalendarDays size={16} />
              {selected.allDay
                ? `All day · ${selected.startAt.slice(0, 10)}`
                : new Date(selected.startAt).toLocaleString()}
            </div>
            {selected.location && (
              <div className="detail-line">{selected.location}</div>
            )}
            <button
              className="button button-secondary"
              onClick={() => {
                onEdit(selected);
                setSelected(null);
              }}
            >
              <Pencil size={15} />
              Edit event
            </button>
            <button
              className="button button-danger"
              onClick={() => {
                onDelete(selected);
                setSelected(null);
              }}
            >
              <Trash2 size={16} />
              Delete event
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function RemindersPage({
  reminders,
  onUpdate,
}: {
  reminders: Reminder[];
  onUpdate: (id: string, status: "DISMISSED" | "COMPLETED") => void;
}) {
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >(
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission,
  );
  const enable = async () => {
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
  };
  const visible = reminders.filter(
    (reminder) =>
      reminder.status === "UPCOMING" || reminder.status === "OVERDUE",
  );
  return (
    <div className="page-stack">
      <div className="welcome-row">
        <div>
          <span className="eyebrow">THE IMPORTANT THINGS</span>
          <h1>Reminders</h1>
          <p className="muted">
            A gentle nudge to help you be where you meant to be.
          </p>
        </div>
        <button className="button button-secondary" onClick={enable}>
          <Bell size={16} />
          {permission === "granted"
            ? "Notifications on"
            : "Enable browser notifications"}
        </button>
      </div>
      {permission === "denied" && (
        <div className="notice-banner">
          Browser notifications are blocked. You can still see and manage
          reminders here; adjust your browser's site settings to enable alerts.
        </div>
      )}
      {permission === "unsupported" && (
        <div className="notice-banner">
          This browser does not support notifications. Your in-app reminders are
          still available while HabitForge is open.
        </div>
      )}
      <div className="reminder-summary">
        <Metric
          icon={<Bell size={18} />}
          color="violet"
          label="Needs attention"
          value={visible.length}
          note="upcoming or overdue"
        />
        <Metric
          icon={<CheckCircle2 size={18} />}
          color="green"
          label="Taken care of"
          value={reminders.filter((item) => item.status === "COMPLETED").length}
          note="completed reminders"
        />
        <Metric
          icon={<ArrowDownRight size={18} />}
          color="blue"
          label="Dismissed"
          value={reminders.filter((item) => item.status === "DISMISSED").length}
          note="dismissed reminders"
        />
      </div>
      <section className="panel reminders-full">
        <div className="panel-heading">
          <div>
            <h2>Your reminders</h2>
            <p>Set reminders from an event's reminder options.</p>
          </div>
        </div>
        {visible.length ? (
          visible.map((reminder) => (
            <div className="reminder-item" key={reminder.id}>
              <span
                className={`reminder-bullet ${reminder.status === "OVERDUE" ? "overdue" : ""}`}
              />
              <div className="reminder-info">
                <strong>{reminder.eventTitle}</strong>
                <span>
                  {reminder.status === "OVERDUE" ? "Overdue" : "Upcoming"} ·{" "}
                  {new Date(reminder.dueAt).toLocaleString()}
                </span>
              </div>
              <button
                className="button button-subtle mini-button"
                onClick={() => void onUpdate(reminder.id, "DISMISSED")}
              >
                Dismiss
              </button>
              <button
                className="button button-primary mini-button"
                onClick={() => void onUpdate(reminder.id, "COMPLETED")}
              >
                <Check size={14} />
                Done
              </button>
            </div>
          ))
        ) : (
          <Empty
            title="All caught up"
            body="Create an event with a reminder and we'll keep it here."
          />
        )}
      </section>
    </div>
  );
}

function AnalyticsPage({
  analytics,
  habits,
}: {
  analytics: Analytics | null;
  habits: Habit[];
}) {
  const chartTooltip = {
    background: "#171e25",
    border: "1px solid #303a43",
    borderRadius: 10,
    color: "#eef1f4",
  };
  return (
    <div className="page-stack">
      <div className="welcome-row">
        <div>
          <span className="eyebrow">NOTICE THE SMALL WINS</span>
          <h1>Insights</h1>
          <p className="muted">
            A clearer picture of the consistency you're building.
          </p>
        </div>
      </div>
      <div className="metric-grid">
        <Metric
          icon={<Target size={18} />}
          color="violet"
          label="Habits you're building"
          value={habits.length}
          note="active habits"
        />
        <Metric
          icon={<Flame size={18} />}
          color="orange"
          label="Longest active streak"
          value={`${habits.length ? Math.max(...habits.map((habit) => habit.longestStreak)) : 0} days`}
          note="your personal best"
        />
        <Metric
          icon={<Activity size={18} />}
          color="green"
          label="Today's follow-through"
          value={`${analytics?.todayRate ?? 0}%`}
          note={`${analytics?.completedToday ?? 0} completed today`}
        />
        <Metric
          icon={<TrendingUp size={18} />}
          color="blue"
          label="This month's consistency"
          value={`${analytics?.monthly.at(-1)?.rate ?? 0}%`}
          note="scheduled days completed"
        />
      </div>
      <section className="panel insight-panel">
        <div className="panel-heading">
          <div>
            <h2>Weekly consistency</h2>
            <p>Completions against habits scheduled each day.</p>
          </div>
        </div>
        {analytics?.weekly.some((day) => day.scheduled > 0) ? (
          <div className="insight-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.weekly}>
                <CartesianGrid stroke="#27303a" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#788391"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="#788391"
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip contentStyle={chartTooltip} />
                <Bar
                  dataKey="completed"
                  name="Completed"
                  fill="#a4e276"
                  radius={[5, 5, 0, 0]}
                />
                <Bar
                  dataKey="scheduled"
                  name="Scheduled"
                  fill="#34404a"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty
            title="Your progress starts with a habit"
            body="Once you have a schedule, your weekly and monthly patterns will appear here."
          />
        )}
      </section>
      <section className="panel insight-panel monthly-panel">
        <div className="panel-heading">
          <div>
            <h2>Monthly consistency</h2>
            <p>Share of scheduled habit-days you completed each month.</p>
          </div>
        </div>
        {analytics?.monthly.some((month) => month.rate > 0) ? (
          <div className="monthly-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.monthly}>
                <CartesianGrid stroke="#27303a" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#788391"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  unit="%"
                  stroke="#788391"
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value) => [`${value}%`, "Consistency"]}
                  contentStyle={chartTooltip}
                />
                <Bar
                  dataKey="rate"
                  name="Consistency"
                  fill="#a4e276"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty
            title="Monthly patterns will appear here"
            body="Create a habit schedule and log completions to build a meaningful trend."
          />
        )}
      </section>
      <section className="panel heatmap-panel">
        <div className="panel-heading">
          <div>
            <h2>Your activity</h2>
            <p>Completed habits over the last 12 weeks.</p>
          </div>
          <span className="heat-legend">
            Less <i className="heat-0" />
            <i className="heat-1" />
            <i className="heat-2" />
            <i className="heat-3" /> More
          </span>
        </div>
        {analytics?.activity?.length ? (
          <div className="heatmap-grid">
            {analytics.activity.map((day) => (
              <span
                key={day.date}
                title={`${day.date}: ${day.count} completions`}
                className={`heat-cell heat-${Math.min(day.count, 3)}`}
              />
            ))}
          </div>
        ) : (
          <Empty
            title="No activity recorded yet"
            body="Complete a scheduled habit and your activity calendar will begin to grow."
          />
        )}
      </section>
    </div>
  );
}

function CoachPage() {
  return (
    <div className="coach-page">
      <div className="coach-orb">
        <Sparkles size={27} />
      </div>
      <span className="eyebrow">A MORE THOUGHTFUL KIND OF COACH</span>
      <h1>
        Good habits.
        <br />
        <em>Human pace.</em>
      </h1>
      <p>
        We're making room for a coach that helps you find a rhythm that feels
        like yours—not another voice telling you to do more.
      </p>
      <div className="wip-pill">
        <span />
        WORK IN PROGRESS
      </div>
      <div className="coach-features">
        <div>
          <CheckCircle2 size={17} />
          <span>Personalized habit suggestions</span>
        </div>
        <div>
          <CheckCircle2 size={17} />
          <span>Gentle weekly summaries</span>
        </div>
        <div>
          <CheckCircle2 size={17} />
          <span>Patterns that help you learn about yourself</span>
        </div>
        <div>
          <CheckCircle2 size={17} />
          <span>Realistic routine recommendations</span>
        </div>
      </div>
      <div className="coach-footnote">
        No AI analysis is running. This feature is planned for a future release.
      </div>
    </div>
  );
}

function ProfilePage({ user }: { user: User | null }) {
  return (
    <div className="page-stack profile-page">
      <div className="welcome-row">
        <div>
          <span className="eyebrow">YOUR SPACE, YOUR PACE</span>
          <h1>Profile & settings</h1>
          <p className="muted">The basics behind your HabitForge account.</p>
        </div>
      </div>
      <section className="panel profile-card">
        <div className="profile-avatar-large">
          {user?.name?.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <span className="eyebrow">ACCOUNT DETAILS</span>
          <h2>{user?.name}</h2>
          <p className="muted">{user?.email}</p>
        </div>
      </section>
      <section className="panel settings-info">
        <div className="panel-heading">
          <div>
            <h2>Privacy & sign-in</h2>
            <p>How HabitForge keeps your account safe.</p>
          </div>
        </div>
        <p>
          Your password is protected with BCrypt hashing on the server. Your
          short-lived sign-in token is kept in this browser tab's session
          storage and is never saved in your account profile. Sign out to remove
          it.
        </p>
        <div className="settings-detail">
          <span>Time zone</span>
          <strong>
            {Intl.DateTimeFormat().resolvedOptions().timeZone} · local device
            time
          </strong>
        </div>
        <div className="settings-detail">
          <span>AI Coach</span>
          <strong>Not active · planned feature only</strong>
        </div>
      </section>
    </div>
  );
}

function FormModal({
  kind,
  initialDate,
  initialTimes,
  initial,
  onClose,
  onSave,
  onError,
}: {
  kind: "habit" | "event";
  initialDate: string;
  initialTimes: EventTimes;
  initial?: Habit | CalendarEvent;
  onClose: () => void;
  onSave: (data: Record<string, unknown>, id?: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const existingHabit =
    kind === "habit" && initial && "weekdays" in initial ? initial : undefined;
  const existingEvent =
    kind === "event" && initial && "allDay" in initial ? initial : undefined;
  const [allDay, setAllDay] = useState(
    existingEvent?.allDay ?? initialTimes.allDay ?? false,
  );
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const raw = Object.fromEntries(values);
    const allDay = values.get("allDay") === "on";
    if (kind === "habit") {
      const parsed = z
        .object({
          name: z
            .string()
            .trim()
            .min(2, "Habit name must have at least 2 characters."),
          description: z.string().optional(),
          category: z.string().min(1),
          color: z.string(),
          target: z.string().optional(),
        })
        .safeParse(raw);
      if (!parsed.success) {
        onError(parsed.error.issues[0]?.message ?? "Check the form.");
        return;
      }
      const weekdays = values.getAll("weekdays").map(Number);
      if (!weekdays.length) {
        onError("Choose at least one day for your habit.");
        return;
      }
      try {
        await onSave({ ...parsed.data, weekdays }, existingHabit?.id);
      } catch (failure) {
        onError(
          failure instanceof Error ? failure.message : "Could not save habit.",
        );
      }
    } else {
      const parsed = z
        .object({
          title: z
            .string()
            .trim()
            .min(2, "Event title must have at least 2 characters."),
          description: z.string().optional(),
          startDate: z.string().min(1),
          startTime: z.string().optional(),
          endDate: z.string().optional(),
          endTime: z.string().optional(),
          location: z.string().optional(),
          category: z.string().min(1),
          color: z.string(),
          reminderMinutes: z.string(),
        })
        .safeParse(raw);
      if (!parsed.success) {
        onError(parsed.error.issues[0]?.message ?? "Check the form.");
        return;
      }
      const startAt = allDay
        ? parsed.data.startDate
        : `${parsed.data.startDate}T${parsed.data.startTime || "09:00"}:00`;
      const endAt = allDay
        ? parsed.data.endDate || parsed.data.startDate
        : `${parsed.data.endDate || parsed.data.startDate}T${parsed.data.endTime || "10:00"}:00`;
      if (new Date(endAt) < new Date(startAt)) {
        onError("The event cannot end before it starts.");
        return;
      }
      try {
        await onSave(
          {
            title: parsed.data.title,
            description: parsed.data.description,
            startAt,
            endAt,
            allDay,
            location: parsed.data.location,
            category: parsed.data.category,
            color: parsed.data.color,
            reminderMinutes: parsed.data.reminderMinutes
              ? Number(parsed.data.reminderMinutes)
              : null,
            timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          existingEvent?.id,
        );
      } catch (failure) {
        onError(
          failure instanceof Error ? failure.message : "Could not save event.",
        );
      }
    }
  };
  const existingStartDate = existingEvent?.startAt.slice(0, 10) ?? initialDate;
  const existingEndAt = existingEvent?.endAt;
  const existingEndDate = existingEndAt
    ? existingEvent?.allDay
      ? shiftDate(existingEndAt.slice(0, 10), -1)
      : existingEndAt.slice(0, 10)
    : initialDate;
  const formEndDate = existingEvent
    ? existingEndDate
    : allDay
      ? (initialTimes.allDayEndDate ?? initialDate)
      : (initialTimes.endDate ?? initialDate);
  const defaultEndTime =
    existingEvent?.endAt.slice(11, 16) ??
    initialTimes.end ??
    (initialTimes.start ? addHour(initialTimes.start).time : "10:00");
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="dialog form-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="dialog-head">
          <div>
            <span className="eyebrow">
              {kind === "habit"
                ? "A SMALL PROMISE TO YOURSELF"
                : "MAKE ROOM FOR WHAT MATTERS"}
            </span>
            <h2 id="modal-title">
              {kind === "habit"
                ? existingHabit
                  ? "Edit habit"
                  : "Create a habit"
                : existingEvent
                  ? "Edit event"
                  : "Add an event"}
            </h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={19} />
          </button>
        </div>
        <form className="form-stack modal-form" onSubmit={submit}>
          {kind === "habit" ? (
            <>
              <label>
                Habit name
                <input
                  name="name"
                  placeholder="e.g. Read for 15 minutes"
                  defaultValue={existingHabit?.name}
                  required
                  minLength={2}
                  autoFocus
                />
              </label>
              <label>
                Description <span className="optional">(optional)</span>
                <textarea
                  name="description"
                  placeholder="What does this habit mean to you?"
                  rows={2}
                  defaultValue={existingHabit?.description ?? ""}
                />
              </label>
              <div className="form-two">
                <label>
                  Category
                  <select
                    name="category"
                    defaultValue={existingHabit?.category ?? "Wellness"}
                  >
                    {existingHabit?.category &&
                      ![
                        "Wellness",
                        "Learning",
                        "Mindfulness",
                        "Fitness",
                        "Productivity",
                        "Personal",
                      ].includes(existingHabit.category) && (
                        <option>{existingHabit.category}</option>
                      )}
                    <option>Wellness</option>
                    <option>Learning</option>
                    <option>Mindfulness</option>
                    <option>Fitness</option>
                    <option>Productivity</option>
                    <option>Personal</option>
                  </select>
                </label>
                <label>
                  Daily target <span className="optional">(optional)</span>
                  <input
                    name="target"
                    placeholder="e.g. 8 glasses"
                    defaultValue={existingHabit?.target ?? ""}
                  />
                </label>
              </div>
              <label>
                Color
                <input
                  name="color"
                  type="color"
                  defaultValue={existingHabit?.color ?? "#a4e276"}
                  className="color-input"
                />
              </label>
              <fieldset>
                <legend>Repeat on</legend>
                <div className="weekday-pickers">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day, index) => (
                      <label key={day}>
                        <input
                          type="checkbox"
                          name="weekdays"
                          value={index}
                          defaultChecked={
                            existingHabit
                              ? existingHabit.weekdays.includes(index)
                              : true
                          }
                        />
                        <span>{day}</span>
                      </label>
                    ),
                  )}
                </div>
              </fieldset>
            </>
          ) : (
            <>
              <label>
                Event title
                <input
                  name="title"
                  placeholder="e.g. Project presentation"
                  defaultValue={existingEvent?.title}
                  required
                  minLength={2}
                  autoFocus
                />
              </label>
              <label>
                Description <span className="optional">(optional)</span>
                <textarea
                  name="description"
                  placeholder="Add a few useful details"
                  rows={2}
                  defaultValue={existingEvent?.description ?? ""}
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  name="allDay"
                  checked={allDay}
                  onChange={(event) => setAllDay(event.target.checked)}
                />
                All-day event
              </label>
              <div className="form-two">
                <label>
                  Start date
                  <input
                    name="startDate"
                    type="date"
                    defaultValue={existingStartDate}
                    required
                  />
                </label>
                {allDay ? (
                  <label>
                    End date <span className="optional">(inclusive)</span>
                    <input
                      name="endDate"
                      type="date"
                      defaultValue={formEndDate}
                    />
                  </label>
                ) : (
                  <label>
                    Start time
                    <input
                      name="startTime"
                      type="time"
                      defaultValue={
                        existingEvent?.startAt.slice(11, 16) ??
                        initialTimes.start ??
                        "09:00"
                      }
                      required
                    />
                  </label>
                )}
              </div>
              {!allDay && (
                <div className="form-two">
                  <label>
                    End date
                    <input
                      name="endDate"
                      type="date"
                      defaultValue={formEndDate}
                    />
                  </label>
                  <label>
                    End time
                    <input
                      name="endTime"
                      type="time"
                      defaultValue={defaultEndTime}
                      required
                    />
                  </label>
                </div>
              )}
              <div className="form-two">
                <label>
                  Category
                  <select
                    name="category"
                    defaultValue={existingEvent?.category ?? "Personal"}
                  >
                    {existingEvent?.category &&
                      ![
                        "Personal",
                        "Work",
                        "Study",
                        "Health",
                        "Birthday",
                        "Deadline",
                      ].includes(existingEvent.category) && (
                        <option>{existingEvent.category}</option>
                      )}
                    <option>Personal</option>
                    <option>Work</option>
                    <option>Study</option>
                    <option>Health</option>
                    <option>Birthday</option>
                    <option>Deadline</option>
                  </select>
                </label>
                <label>
                  Location <span className="optional">(optional)</span>
                  <input
                    name="location"
                    placeholder="Add a location"
                    defaultValue={existingEvent?.location ?? ""}
                  />
                </label>
              </div>
              <label>
                Reminder
                <select
                  name="reminderMinutes"
                  defaultValue={
                    existingEvent?.reminderMinutes?.toString() ?? ""
                  }
                >
                  <option value="">No reminder</option>
                  <option value="0">At event time</option>
                  <option value="5">5 minutes before</option>
                  <option value="15">15 minutes before</option>
                  <option value="60">1 hour before</option>
                </select>
              </label>
              <label>
                Display color
                <input
                  name="color"
                  type="color"
                  defaultValue={existingEvent?.color ?? "#a4e276"}
                  className="color-input"
                />
              </label>
              <p className="form-help">
                Timed events use your local time zone. All-day event end dates
                are inclusive.
              </p>
            </>
          )}
          <div className="dialog-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="button button-primary" type="submit">
              <Plus size={16} />
              {kind === "habit"
                ? existingHabit
                  ? "Save changes"
                  : "Create habit"
                : existingEvent
                  ? "Save changes"
                  : "Save event"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function addHour(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + 60;
  const dayOffset = Math.floor(total / (24 * 60));
  const normalized = total % (24 * 60);
  return {
    time: `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`,
    dayOffset,
  };
}

export default function Root() {
  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}
