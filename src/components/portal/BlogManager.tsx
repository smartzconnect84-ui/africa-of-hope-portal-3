import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock, Edit3, Eye, ImageOff, Loader2, Newspaper, Plus, Search, Star, Trash2, Upload,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { usePermission } from "@/hooks/usePermission";
import {
  blogApi, slugify,
  type BlogDraftInput, type BlogPost, type BlogSaveAction, type BlogStatus,
} from "@/lib/blog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Reveal, SectionHeader, StatCard, panelClass } from "../Navigation";
import { cn } from "@/lib/utils";

const CATEGORY_OPTIONS = ["News", "Event", "Programme", "Press", "Community"];
const STATUS_FILTERS: Array<{ value: BlogStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const STATUS_TONE: Record<BlogStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  scheduled: "bg-amber-100 text-amber-800",
  published: "bg-emerald-100 text-emerald-800",
  archived: "bg-rose-100 text-rose-700",
};

interface FormState {
  title: string;
  slug: string;
  slugTouched: boolean;
  excerpt: string;
  category: string;
  tags: string;
  body: string;
  featured: boolean;
  coverImageUrl: string | null;
  coverImagePath: string | null;
}

const emptyForm: FormState = {
  title: "", slug: "", slugTouched: false, excerpt: "", category: "News", tags: "",
  body: "", featured: false, coverImageUrl: null, coverImagePath: null,
};

/**
 * Formats a UTC ISO timestamp for an `<input type="datetime-local">`, which
 * always displays/parses in the browser's LOCAL time. A naive `.slice(0,16)`
 * of the UTC string would show the UTC wall-clock time mislabelled as local,
 * so this converts to local time first.
 */
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Renders plain-text body as paragraphs (blank-line separated); JSX text nodes escape automatically. */
function BodyPreview({ body }: { body: string }) {
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return <p className="text-sm italic text-slate-400">Nothing to preview yet.</p>;
  return (
    <div className="space-y-3">
      {paragraphs.map((p, i) => (
        <p key={i} className="text-sm leading-relaxed text-slate-700">{p}</p>
      ))}
    </div>
  );
}

export default function BlogManager() {
  const { currentUser, reloadKey } = useApp();
  const canManage = usePermission("blog.manage");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<BlogStatus | "all">("all");
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [action, setAction] = useState<BlogSaveAction>("draft");
  const [scheduledAt, setScheduledAt] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setPosts(await blogApi.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [reloadKey]);

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        if (!p.title.toLowerCase().includes(term) && !p.excerpt.toLowerCase().includes(term) && !p.category.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [posts, statusFilter, search]);

  const counts = useMemo(() => ({
    published: posts.filter((p) => p.status === "published").length,
    scheduled: posts.filter((p) => p.status === "scheduled").length,
    draft: posts.filter((p) => p.status === "draft").length,
  }), [posts]);

  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setAction("draft");
    setScheduledAt("");
    setCoverFile(null);
    setCoverPreview(null);
    setOpen(true);
  };

  const startEdit = (post: BlogPost) => {
    setEditing(post);
    setForm({
      title: post.title, slug: post.slug, slugTouched: true, excerpt: post.excerpt, category: post.category,
      tags: post.tags.join(", "), body: post.body, featured: post.featured,
      coverImageUrl: post.coverImageUrl, coverImagePath: post.coverImagePath,
    });
    setAction(post.status === "archived" ? "draft" : post.status === "scheduled" ? "schedule" : post.status === "published" ? "publish" : "draft");
    setScheduledAt(post.publishedAt ? toDatetimeLocalValue(post.publishedAt) : "");
    setCoverFile(null);
    revokeCoverPreview();
    setCoverPreview(post.coverImageUrl);
    setOpen(true);
  };

  const onTitleChange = (title: string) => {
    setForm((f) => ({ ...f, title, slug: f.slugTouched ? f.slug : slugify(title) }));
  };

  // The slug box keeps the raw text the user is typing (so a trailing
  // hyphen, or typing out of character order, isn't fought on every
  // keystroke) and only normalises it to a URL-safe slug on blur; `save()`
  // slugifies again regardless as the final safety net.
  const onSlugChange = (raw: string) => {
    setForm((f) => ({ ...f, slug: raw, slugTouched: true }));
  };
  const onSlugBlur = () => {
    setForm((f) => ({ ...f, slug: slugify(f.slug) }));
  };

  // Blob preview URLs from `URL.createObjectURL` must be revoked once
  // replaced or no longer needed, or every cover selection leaks memory.
  const revokeCoverPreview = () => {
    setCoverPreview((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return prev;
    });
  };

  const onCoverSelected = (file: File | null) => {
    setCoverFile(file);
    setCoverPreview((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : form.coverImageUrl;
    });
  };

  // Revoke any outstanding blob preview URL when the dialog closes or the component unmounts.
  useEffect(() => {
    if (open) return;
    revokeCoverPreview();
  }, [open]);
  useEffect(() => () => revokeCoverPreview(), []);

  const save = async () => {
    if (!form.title.trim()) { toast.error("Title is required."); return; }
    if (action === "schedule" && !scheduledAt) { toast.error("Choose a date and time to publish this post."); return; }
    setBusy(true);
    try {
      const slug = slugify(form.slug.trim() || form.title);
      const draft: BlogDraftInput = {
        title: form.title.trim(),
        slug,
        excerpt: form.excerpt.trim(),
        body: form.body,
        category: form.category || "News",
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        featured: form.featured,
        coverImageUrl: form.coverImageUrl,
        coverImagePath: form.coverImagePath,
      };
      // Author fields are set once at creation only — editing a post must
      // never reassign it to whoever happens to be editing it.
      if (!editing) {
        draft.authorId = currentUser?.id ?? null;
        draft.authorName = currentUser?.name ?? "";
      }
      let oldCoverPathToDelete: string | null = null;
      if (coverFile) {
        const uploaded = await blogApi.uploadCover(coverFile, slug);
        draft.coverImageUrl = uploaded.url;
        draft.coverImagePath = uploaded.path;
        // The old cover is only deleted once the post row save below
        // actually succeeds — never before — so a failed save never leaves
        // the post without any cover on file.
        if (editing?.coverImagePath && editing.coverImagePath !== uploaded.path) {
          oldCoverPathToDelete = editing.coverImagePath;
        }
      }
      if (editing) {
        await blogApi.update(
          editing.id,
          draft,
          action,
          scheduledAt || undefined,
          { status: editing.status, publishedAt: editing.publishedAt },
          oldCoverPathToDelete,
        );
      } else {
        await blogApi.create(draft, action, scheduledAt || undefined);
      }
      toast.success(editing ? "Post updated." : "Post saved.");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (post: BlogPost) => {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    try {
      await blogApi.remove(post.id, post.coverImagePath);
      toast.success("Post deleted.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  if (!canManage) {
    return <EmptyState icon={Newspaper} title="No access" hint="You don't have permission to manage the blog." />;
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Blog"
        subtitle="Write, schedule, publish and archive public blog posts."
        action={<Button onClick={startCreate} className="bg-emerald-700 hover:bg-emerald-800"><Plus className="mr-1 h-4 w-4" />New post</Button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon={Newspaper} label="Published" value={counts.published} />
        <StatCard icon={CalendarClock} label="Scheduled" value={counts.scheduled} tone="amber" />
        <StatCard icon={Edit3} label="Drafts" value={counts.draft} tone="slate" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button key={f.value} type="button" onClick={() => setStatusFilter(f.value)}
              className={cn("rounded-full px-3 py-1.5 text-xs font-medium", statusFilter === f.value ? "bg-emerald-800 text-white" : "bg-slate-100 text-slate-600")}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full max-w-xs sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input className="pl-8" placeholder="Search posts" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Newspaper} title="No posts yet" hint="Create your first post to see it here." />
      ) : (
        <div className="space-y-3">
          {filtered.map((post) => (
            <Reveal key={post.id} className={cn(panelClass, "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between")}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100">
                  {post.coverImageUrl ? (
                    <img src={post.coverImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageOff className="h-5 w-5 text-slate-400" />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-slate-900">{post.title}</h3>
                    {post.featured && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-500" />}
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    /{post.slug} · {post.category} · {post.publishedAt ? new Date(post.publishedAt).toLocaleString() : "not scheduled"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={cn("capitalize", STATUS_TONE[post.status])}>{post.status}</Badge>
                <Button size="icon" variant="ghost" aria-label="Edit post" onClick={() => startEdit(post)}><Edit3 className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Delete post" className="text-rose-600" onClick={() => void remove(post)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </Reveal>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit post" : "New post"}</DialogTitle>
            <DialogDescription>Write the post, pick a cover image and choose when it goes live.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="blog-title">Title</Label>
              <Input id="blog-title" value={form.title} onChange={(e) => onTitleChange(e.target.value)} placeholder="New computer lab opens for students" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="blog-slug">URL slug</Label>
              <Input id="blog-slug" value={form.slug} onChange={(e) => onSlugChange(e.target.value)} onBlur={onSlugBlur} placeholder="new-computer-lab-opens-for-students" />
              <p className="text-xs text-slate-400">A unique suffix is added automatically if this slug is already used.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="blog-excerpt">Excerpt</Label>
              <Textarea id="blog-excerpt" rows={2} value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} placeholder="Short summary shown on the blog list and link previews." />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="blog-category">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger id="blog-category"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="blog-tags">Tags (comma separated)</Label>
                <Input id="blog-tags" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="community, event" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="blog-cover">Cover image</Label>
              <div className="flex items-center gap-3">
                <span className="grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100">
                  {coverPreview ? <img src={coverPreview} alt="" className="h-full w-full object-cover" /> : <ImageOff className="h-5 w-5 text-slate-400" />}
                </span>
                <input id="blog-cover" ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                  onChange={(e) => onCoverSelected(e.target.files?.[0] ?? null)} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-1 h-3.5 w-3.5" /> {coverPreview ? "Replace" : "Upload"}
                </Button>
                <p className="text-xs text-slate-400">JPEG, PNG, WEBP or GIF, up to 5 MB.</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <div>
                <p className="text-sm font-medium text-slate-800">Featured</p>
                <p className="text-xs text-slate-500">Highlight this post on the public blog list.</p>
              </div>
              <Switch checked={form.featured} onCheckedChange={(v) => setForm((f) => ({ ...f, featured: v }))} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="blog-status">Status</Label>
                <Select value={action} onValueChange={(v) => setAction(v as BlogSaveAction)}>
                  <SelectTrigger id="blog-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Save as draft</SelectItem>
                    <SelectItem value="schedule">Schedule</SelectItem>
                    <SelectItem value="publish">Publish now</SelectItem>
                    <SelectItem value="archive">Archive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {action === "schedule" && (
                <div className="space-y-1.5">
                  <Label htmlFor="blog-scheduled-at">Publish at</Label>
                  <Input id="blog-scheduled-at" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="blog-body" className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> Body</Label>
              <Textarea id="blog-body" rows={8} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder={"Write in plain text. Leave a blank line between paragraphs."} />
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Preview</p>
                <BodyPreview body={form.body} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy} onClick={() => void save()} className="bg-emerald-700 hover:bg-emerald-800">
              {busy ? "Saving…" : "Save post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
