import { useMemo, useState } from "react";
import { AlertTriangle, Banknote, Check, Edit3, Megaphone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { usePermission } from "@/hooks/usePermission";
import { supabase } from "@/integrations/supabase/client";
import type { Announcement, AnnouncementCategory } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Reveal, SectionHeader, panelClass } from "./Navigation";
import { isAnnouncementLiveFor } from "@/lib/announcements";
import { cn } from "@/lib/utils";

const categories: AnnouncementCategory[] = ["Urgent", "Academic", "Financial"];
const empty = { title: "", body: "", category: "Academic" as AnnouncementCategory, audience: "all" as NonNullable<Announcement["audience"]>, status: "published" as NonNullable<Announcement["status"]>, scheduledAt: "", expiresAt: "" };
const tone: Record<AnnouncementCategory, string> = { Urgent: "bg-rose-100 text-rose-700", Academic: "bg-emerald-100 text-emerald-800", Financial: "bg-amber-100 text-amber-800" };

function iso(value: string) { return value ? new Date(value).toISOString() : null; }

export default function AnnouncementManager() {
  const { state, currentUser, refresh } = useApp();
  const canManage = usePermission("announcements.manage");
  const [filter, setFilter] = useState<"All" | AnnouncementCategory>("All");
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(empty);
  const visible = useMemo(() => state.announcements.filter((item) => {
    if (filter !== "All" && item.category !== filter) return false;
    if (canManage) return true;
    return isAnnouncementLiveFor(item, currentUser?.role, Date.now());
  }), [state.announcements, filter, canManage, currentUser?.role]);

  const startCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const startEdit = (item: Announcement) => { setEditing(item); setForm({ title: item.title, body: item.body, category: item.category, audience: item.audience ?? "all", status: item.status ?? "published", scheduledAt: item.scheduledAt?.slice(0,16) ?? "", expiresAt: item.expiresAt?.slice(0,16) ?? "" }); setOpen(true); };
  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) { toast.error("Title and message are required."); return; }
    if (form.status === "scheduled" && !form.scheduledAt) { toast.error("Choose a publication time for a scheduled announcement."); return; }
    setBusy(true);
    const payload = {
      title: form.title.trim(), body: form.body.trim(), category: form.category,
      audience: form.audience, status: form.status,
      scheduled_at: iso(form.scheduledAt), expires_at: iso(form.expiresAt),
      published_at: form.status === "published" ? (editing?.publishedAt ?? new Date().toISOString()) : null,
      published_date: editing?.date ?? new Date().toISOString().slice(0,10),
      author_id: editing ? undefined : (currentUser?.id ?? null),
    };
    const result = editing ? await supabase.from("announcements").update(payload).eq("id", editing.id) : await supabase.from("announcements").insert(payload);
    setBusy(false);
    if (result.error) { toast.error(/schema cache|column/i.test(result.error.message) ? "Announcement scheduling is not active yet. Apply the latest database migration." : result.error.message); return; }
    toast.success(editing ? "Announcement updated." : form.status === "scheduled" ? "Announcement scheduled." : "Announcement published.");
    setOpen(false); await refresh();
  };
  const remove = async (item: Announcement) => {
    if (!window.confirm(`Remove “${item.title}”?`)) return;
    const { error } = await supabase.from("announcements").delete().eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Announcement removed."); await refresh();
  };

  return <div className="space-y-5"><SectionHeader title="Announcements" subtitle={canManage ? "Create, edit, publish, schedule and remove public or role-based announcements." : "Official notices for your portal."} action={canManage && <Button onClick={startCreate} className="bg-emerald-700 hover:bg-emerald-800"><Plus className="mr-1 h-4 w-4"/>New announcement</Button>}/><div className="flex flex-wrap gap-1.5">{(["All",...categories] as const).map((item)=><button key={item} type="button" onClick={()=>setFilter(item)} className={cn("rounded-full px-3 py-1.5 text-xs font-medium", filter===item?"bg-emerald-800 text-white":"bg-slate-100 text-slate-600")}>{item}</button>)}</div><div className="space-y-3">{visible.length===0?<EmptyState icon={Megaphone} title="No announcements" hint="Published notices will appear here."/>:visible.map((item)=><Reveal key={item.id} className={cn(panelClass,"p-5")}><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="mt-0.5 grid h-9 w-9 place-items-center rounded-xl bg-emerald-50">{item.category==="Urgent"?<AlertTriangle className="h-4 w-4 text-rose-600"/>:item.category==="Financial"?<Banknote className="h-4 w-4 text-amber-600"/>:<Check className="h-4 w-4 text-emerald-700"/>}</span><div><h3 className="font-semibold text-slate-900">{item.title}</h3><p className="text-[11px] text-slate-500">{item.author || "Administration"} · {item.date} · {(item.audience??"all").replaceAll("_"," ")} {canManage && `· ${item.status??"published"}`}</p></div></div><div className="flex items-center gap-2"><span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold",tone[item.category])}>{item.category}</span>{canManage&&<><Button size="icon" variant="ghost" aria-label="Edit announcement" onClick={()=>startEdit(item)}><Edit3 className="h-4 w-4"/></Button><Button size="icon" variant="ghost" aria-label="Remove announcement" className="text-rose-600" onClick={()=>void remove(item)}><Trash2 className="h-4 w-4"/></Button></>}</div></div><p className="mt-3 text-sm text-slate-600">{item.body}</p>{item.scheduledAt&&canManage&&<p className="mt-2 text-xs text-slate-400">Scheduled: {new Date(item.scheduledAt).toLocaleString()}</p>}</Reveal>)}</div><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{editing?"Edit announcement":"Create announcement"}</DialogTitle><DialogDescription>Choose the audience and publication window.</DialogDescription></DialogHeader><div className="space-y-3"><div><Label>Title</Label><Input className="mt-1" value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}/></div><div><Label>Message</Label><Textarea className="mt-1" rows={4} value={form.body} onChange={(e)=>setForm({...form,body:e.target.value})}/></div><div className="grid gap-3 sm:grid-cols-3"><div><Label>Category</Label><Select value={form.category} onValueChange={(v)=>setForm({...form,category:v as AnnouncementCategory})}><SelectTrigger className="mt-1"><SelectValue/></SelectTrigger><SelectContent>{categories.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div><div><Label>Audience</Label><Select value={form.audience} onValueChange={(v)=>setForm({...form,audience:v as typeof form.audience})}><SelectTrigger className="mt-1"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="public">Public website</SelectItem><SelectItem value="all">All portal users</SelectItem><SelectItem value="students">Students</SelectItem><SelectItem value="teachers">Teachers</SelectItem></SelectContent></Select></div><div><Label>Status</Label><Select value={form.status} onValueChange={(v)=>setForm({...form,status:v as typeof form.status})}><SelectTrigger className="mt-1"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="scheduled">Scheduled</SelectItem><SelectItem value="published">Published</SelectItem></SelectContent></Select></div></div><div className="grid grid-cols-2 gap-3"><div><Label>Publish at</Label><Input className="mt-1" type="datetime-local" value={form.scheduledAt} onChange={(e)=>setForm({...form,scheduledAt:e.target.value})}/></div><div><Label>Expires at</Label><Input className="mt-1" type="datetime-local" value={form.expiresAt} onChange={(e)=>setForm({...form,expiresAt:e.target.value})}/></div></div></div><DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={busy} onClick={()=>void save()} className="bg-emerald-700">{busy?"Saving…":"Save announcement"}</Button></DialogFooter></DialogContent></Dialog></div>;
}
