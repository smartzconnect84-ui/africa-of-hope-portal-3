import { useEffect, useMemo, useState } from "react";
import { Bell, BellOff, CalendarClock, Loader2, Smartphone, Wallet, Megaphone, Send } from "lucide-react";
import { useApp, formatCurrency } from "@/context/AppContext";
import { academicApi } from "@/lib/academics";
import { useReminderNotifications, type ReminderItem } from "@/lib/pushReminders";
import { Button } from "@/components/ui/button";
import { panelClass } from "../Navigation";
import { cn } from "@/lib/utils";

const FRESH_ANNOUNCEMENT_MS = 48 * 60 * 60 * 1000;

function whenLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date to be confirmed";
  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  const formatted = date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  if (days < 0) return `${formatted} (overdue)`;
  if (days === 0) return `${formatted} (today)`;
  if (days === 1) return `${formatted} (tomorrow)`;
  return `${formatted} (in ${days} days)`;
}

/**
 * f65 — Reminder settings card for students.
 * Lesson due dates, an open fee balance and new announcements can each be
 * switched on or off. The card is explicit about what actually happens:
 * device notifications now, phone alerts while the app is closed only once the
 * push sender is configured.
 */
export default function ReminderSettings() {
  const { state, currentUser } = useApp();
  const [deadlines, setDeadlines] = useState<{ id: string; title: string; due_at: string }[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    if (!currentUser || currentUser.role !== "Student") return;
    academicApi
      .myCourseStatus()
      .then((rows) => {
        if (!active) return;
        const merged = rows.flatMap((row) =>
          row.upcoming_deadlines.map((d) => ({ id: `${row.cohort_id}-${d.kind}-${d.id}`, title: d.title, due_at: d.due_at })),
        );
        setDeadlines(merged);
        setLoadError("");
      })
      .catch(() => {
        if (active) setLoadError("Course deadlines could not be loaded. Reminders for fees and announcements still work.");
      });
    return () => {
      active = false;
    };
  }, [currentUser?.id]);

  const items = useMemo<ReminderItem[]>(() => {
    if (!currentUser) return [];
    const list: ReminderItem[] = deadlines.map((d) => ({
      id: `lesson-${d.id}`,
      kind: "lesson" as const,
      title: "Deadline coming up",
      body: `${d.title} is due ${new Date(d.due_at).toLocaleString()}.`,
      dueAt: d.due_at,
      url: "/",
    }));

    // Fee balance: remind before the cohort start date while a balance is open.
    const cohort = state.cohorts.find((c) => c.id === currentUser.cohortIds[0]);
    const tuition = currentUser.programIds.reduce(
      (total, pid) => total + (state.programs.find((p) => p.id === pid)?.tuition ?? 0),
      0,
    );
    const paid = state.fees.filter((f) => f.studentId === currentUser.id).reduce((sum, f) => sum + f.amount, 0);
    const balance = Math.max(tuition - paid, 0);
    if (cohort?.startDate && balance > 0) {
      list.push({
        id: `fee-${currentUser.id}-${cohort.startDate}`,
        kind: "fee",
        title: "Fees still open",
        body: `Your balance of ${formatCurrency(balance)} is still open and classes start ${new Date(cohort.startDate).toLocaleDateString()}.`,
        dueAt: new Date(cohort.startDate).toISOString(),
        url: "/",
      });
    }

    state.announcements
      .filter((a) => (a.status ? a.status === "published" : true))
      .filter((a) => !a.audience || a.audience === "all" || a.audience === (currentUser.role === "Student" ? "students" : "staff"))
      .forEach((a) => {
        const published = a.publishedAt || a.date;
        const publishedAt = new Date(published);
        if (Number.isNaN(publishedAt.getTime())) return;
        if (Date.now() - publishedAt.getTime() > FRESH_ANNOUNCEMENT_MS) return;
        list.push({
          id: `announcement-${a.id}`,
          kind: "announcement",
          title: a.title || "New announcement",
          body: a.body ? a.body.slice(0, 160) : "A new announcement was published in the portal.",
          dueAt: publishedAt.toISOString(),
          url: "/",
        });
      });

    return list;
  }, [currentUser, deadlines, state.announcements, state.cohorts, state.fees, state.programs]);

  const reminders = useReminderNotifications(currentUser?.id, items);

  if (!currentUser) return null;

  const on = reminders.prefs.enabled && reminders.permission === "granted";
  const chips: { key: "lessons" | "fees" | "announcements"; label: string; icon: typeof Bell }[] = [
    { key: "lessons", label: "Lesson & quiz due dates", icon: CalendarClock },
    { key: "fees", label: "Fee balance deadlines", icon: Wallet },
    { key: "announcements", label: "New announcements", icon: Megaphone },
  ];

  return (
    <section className={`${panelClass} p-5`} aria-label="Deadline reminders">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            {on ? <Bell className="h-4 w-4 text-emerald-700" /> : <BellOff className="h-4 w-4 text-slate-400" />}
            Notifications & reminders
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Get a notification for lesson and quiz due dates, an open fee balance and new announcements.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1",
            on ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-slate-50 text-slate-600 ring-slate-200",
          )}
        >
          <Smartphone className="h-3.5 w-3.5" />
          {on ? (reminders.pushState === "subscribed" ? "Registered for phone alerts" : "On for this device") : "Off"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {chips.map(({ key, label, icon: Icon }) => {
          const active = on && reminders.prefs[key];
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => reminders.toggleKind(key)}
              disabled={!on}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1 transition disabled:opacity-50",
                active
                  ? "bg-emerald-800 text-white ring-emerald-800"
                  : "bg-white text-emerald-900 ring-emerald-900/15 hover:bg-emerald-50",
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {on ? (
          <>
            <Button size="sm" variant="outline" onClick={() => void reminders.sendTest()}>
              <Send className="mr-1.5 h-4 w-4" /> Local device test
            </Button>
            <Button size="sm" variant="ghost" disabled={reminders.busy} onClick={() => void reminders.disable()}>
              Pause reminders
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={() => void reminders.enable()} disabled={reminders.busy}>
            {reminders.busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Bell className="mr-1.5 h-4 w-4" />}
            {reminders.permission === "denied" ? "Check browser permission" : "Enable / retry notifications"}
          </Button>
        )}
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-600">{reminders.help}</p>
      {on && reminders.pushState !== "subscribed" && <Button variant="outline" className="mt-3" disabled={reminders.busy} onClick={() => void reminders.enable()}>Retry push registration</Button>}
      {!reminders.supported && (
        <p className="mt-3 text-xs leading-5 text-amber-800">
          This browser does not support notifications. Deadlines still appear in your portal lists.
        </p>
      )}
      {reminders.supported && reminders.permission === "denied" && (
        <p className="mt-3 text-xs leading-5 text-amber-800">
          Notifications are blocked for this site. Allow them in your browser settings, then reload this page.
        </p>
      )}

      {reminders.next.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-500">Next reminders</p>
          <ul className="mt-1 space-y-1">
            {reminders.next.map((item) => (
              <li key={item.id} className="text-xs text-slate-600">
                {item.kind === "fee" ? "Fee balance" : item.title} · {whenLabel(item.dueAt)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {loadError && <p className="mt-3 text-xs text-amber-800">{loadError}</p>}
      {reminders.notice && (
        <p className="mt-3 text-xs leading-5 text-slate-600" role="status">
          {reminders.notice}
        </p>
      )}
    </section>
  );
}
