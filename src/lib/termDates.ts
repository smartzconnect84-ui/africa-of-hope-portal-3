import type { AppState } from "@/types";

export interface TermEntry {
  id: string;
  label: string;
  start: string; // yyyy-mm-dd
  end: string; // yyyy-mm-dd
  note: string;
  kind: "intake" | "term" | "cohort" | "deadline";
}

/**
 * f35: public term dates fed from the same live dates as the student calendar —
 * cohort start/end dates and assignment due dates — with sensible 2026/2027
 * fallback terms when the portal has no live cohorts yet.
 */
export function buildTermDates(state: AppState): TermEntry[] {
  const entries: TermEntry[] = [];
  const cohorts = [...state.cohorts].sort((a, b) => a.startDate.localeCompare(b.startDate));
  for (const c of cohorts.slice(0, 8)) {
    if (!c.startDate) continue;
    entries.push({
      id: `cohort-${c.id}`,
      label: `${c.name} begins`,
      start: c.startDate.slice(0, 10),
      end: (c.endDate || c.startDate).slice(0, 10),
      note: `${state.programs.find((p) => p.id === c.programId)?.title ?? "Programme"}${c.room ? ` · ${c.room}` : ""}`,
      kind: "cohort",
    });
  }
  const dueDates = [...state.assignments]
    .filter((a) => a.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 4);
  for (const a of dueDates) {
    entries.push({
      id: `due-${a.id}`,
      label: a.title,
      start: a.dueDate.slice(0, 10),
      end: a.dueDate.slice(0, 10),
      note: `Assignment deadline · ${a.maxMarks} marks`,
      kind: "deadline",
    });
  }
  if (entries.length > 0) return entries;

  // Fallback 2026/2027 academic calendar (Liberia-style semesters).
  const year = (state.settings.academicYear || "2026/2027").trim() || "2026/2027";
  const first = year.startsWith("2026") ? "2026" : year.slice(0, 4);
  const second = year.includes("/") ? year.split("/")[1] : String(Number(first) + 1);
  return [
    { id: "intake-1", label: `${year} First intake opens`, start: `${first}-09-07`, end: `${first}-09-07`, note: "Applications open online in minutes", kind: "intake" },
    { id: "term-1", label: "First semester classes begin", start: `${first}-09-21`, end: `${first}-12-18`, note: state.settings.semester || "First Semester", kind: "term" },
    { id: "term-2", label: "Second semester classes begin", start: `${second}-01-18`, end: `${second}-05-14`, note: "Cohort-based certificate programmes", kind: "term" },
    { id: "intake-2", label: `${second} mid-year intake`, start: `${second}-06-07`, end: `${second}-06-07`, note: "Late applications close when cohorts fill", kind: "intake" },
  ];
}

export function nextUpcoming(entries: TermEntry[]): TermEntry | null {
  const today = new Date().toISOString().slice(0, 10);
  return entries.filter((e) => e.start >= today).sort((a, b) => a.start.localeCompare(b.start))[0] ?? null;
}

/** Minimal .ics download so visitors can add a date to any calendar app. */
export function downloadIcs(entry: TermEntry): void {
  const stamp = (d: string) => d.replace(/-/g, "");
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT",
    `UID:${entry.id}@africaofhope`, `DTSTART:${stamp(entry.start)}`,
    `DTEND:${stamp(entry.end)}`, `SUMMARY:${entry.label} — AFRICA OF HOPE`,
    `DESCRIPTION:${entry.note}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${entry.id}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function googleCalendarUrl(entry: TermEntry): string {
  const stamp = (d: string) => d.replace(/-/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${entry.label} — AFRICA OF HOPE`,
    dates: `${stamp(entry.start)}/${stamp(entry.end)}`,
    details: entry.note,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
