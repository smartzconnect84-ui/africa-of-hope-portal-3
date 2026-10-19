import { useState } from "react";
import { Bookmark, PlayCircle } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { requestLearningResume, useLearningMemory, type LearningMemory } from "@/lib/learningMemory";
import { Button } from "@/components/ui/button";
import { panelClass } from "../Navigation";

export function SavedLearningList({ rows, onResume }: { rows: LearningMemory[]; onResume: (row: LearningMemory) => void }) {
  const { state } = useApp();
  const [bookmarksOnly, setBookmarksOnly] = useState(false);
  const sorted = rows.filter((r) => bookmarksOnly ? r.bookmarked : r.last_opened_at).sort((a, b) => (b.last_opened_at || b.updated_at).localeCompare(a.last_opened_at || a.updated_at));
  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-slate-900">{bookmarksOnly ? "Bookmarked lessons" : "Continue Learning"}</h2>
      <Button size="sm" variant="outline" aria-pressed={bookmarksOnly} onClick={() => setBookmarksOnly((v) => !v)}><Bookmark className="mr-1.5 h-4 w-4" />{bookmarksOnly ? "Show recent" : "Show bookmarks"}</Button>
    </div>
    {sorted.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{sorted.map((row) => <button type="button" key={row.unit_id} onClick={() => onResume(row)} className="min-w-0 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-left transition hover:bg-emerald-100 focus-visible:outline-emerald-700">
      <p className="truncate text-xs font-semibold text-emerald-800">{state.programs.find((p) => p.id === row.program_id)?.title || "Your programme"}</p>
      <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900">{row.lesson_title}</p>
      <span className="mt-2 flex items-center gap-1.5 text-xs text-slate-600"><PlayCircle className="h-4 w-4" />Resume lesson{row.position_seconds > 0 ? ` · ${Math.floor(row.position_seconds / 60)}:${String(Math.floor(row.position_seconds % 60)).padStart(2, "0")}` : ""}{row.bookmarked && <Bookmark className="ml-auto h-3.5 w-3.5 fill-amber-400 text-amber-700" />}</span>
    </button>)}</div> : <p className="mt-3 text-sm text-slate-500">{bookmarksOnly ? "Use Bookmark lesson in My Courses to save a lesson here." : "Open a lesson in My Courses to start building your Continue Learning list."}</p>}
  </div>;
}

export default function ContinueLearning() {
  const { currentUser } = useApp();
  const memory = useLearningMemory(currentUser?.id);
  return <section className={`${panelClass} p-5`}>
    <SavedLearningList rows={memory.rows} onResume={requestLearningResume} />
    <p className="mt-3 text-xs text-slate-500" role="status">{memory.ready ? memory.notice : "Loading saved learning…"}</p>
    {memory.notice.includes("only") && <Button variant="link" size="sm" onClick={() => void memory.retry()}>Retry sync</Button>}
  </section>;
}
