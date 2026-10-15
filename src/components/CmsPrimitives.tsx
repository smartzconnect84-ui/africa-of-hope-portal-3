import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, Plus, Trash2, ArrowUp, ArrowDown, Upload, X, Loader2 } from "lucide-react";
import { uploadSiteAsset } from "@/lib/storage";
import { validateFile, IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/storage";

/* ---------- tiny id helper ---------- */
let seq = 0;
export const genId = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
      />
    </label>
  );
}

export function Area({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
      />
    </label>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-emerald-300"
    >
      <span>
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-emerald-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function ImageBox({
  label,
  value,
  onChange,
  round,
  folder = "misc",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  round?: boolean;
  /** Storage sub-folder inside the public "site-assets" bucket, e.g. "logo", "hero". */
  folder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const handleFile = async (file?: File) => {
    if (!file) return;
    const err = validateFile(file, IMAGE_TYPES, MAX_IMAGE_BYTES);
    if (err) {
      toast.error(err);
      return;
    }
    setBusy(true);
    try {
      const url = await uploadSiteAsset(folder, file);
      onChange(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload that image.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <div className="flex items-center gap-3">
        <div
          className={`grid h-16 w-16 shrink-0 place-items-center overflow-hidden border border-slate-200 bg-slate-50 ${
            round ? "rounded-full" : "rounded-xl"
          }`}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          ) : value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-slate-400" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            <Upload className="h-3.5 w-3.5" /> {busy ? "Uploading…" : "Upload"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" /> Remove
            </button>
          )}
        </div>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      <input
        value={value.startsWith("data:") ? "" : value}
        placeholder="…or paste an image URL"
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-emerald-500"
      />
    </div>
  );
}

export function ListCard({
  index,
  total,
  title,
  onUp,
  onDown,
  onDelete,
  children,
}: {
  index: number;
  total: number;
  title: string;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-800">
          {title} <span className="text-slate-400">#{index + 1}</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUp}
            disabled={index === 0}
            aria-label="Move up"
            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition enabled:hover:bg-slate-50 disabled:opacity-40"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDown}
            disabled={index === total - 1}
            aria-label="Move down"
            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition enabled:hover:bg-slate-50 disabled:opacity-40"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete"
            className="grid h-8 w-8 place-items-center rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

export function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
    >
      <Plus className="h-4 w-4" /> {label}
    </button>
  );
}

/**
 * Generic add/reorder/delete list editor for a CMS array field (any shape
 * with an `id`). Keeps per-tab code in AdminWebsiteSettings down to just a
 * `renderItem` function instead of repeating up/down/delete wiring everywhere.
 */
export function ListEditor<T extends { id: string }>({
  title,
  items,
  onChange,
  renderItem,
  newItem,
  addLabel = "Add item",
  emptyHint = "Nothing here yet.",
}: {
  title: string;
  items: T[];
  onChange: (next: T[]) => void;
  renderItem: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
  newItem: () => T;
  addLabel?: string;
  emptyHint?: string;
}) {
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  const remove = (id: string) => {
    if (!window.confirm("Delete this item? This cannot be undone until you discard changes.")) return;
    onChange(items.filter((i) => i.id !== id));
  };
  const update = (id: string, patch: Partial<T>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  return (
    <div className="grid gap-3">
      {items.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          {emptyHint}
        </p>
      )}
      {items.map((item, index) => (
        <ListCard
          key={item.id}
          index={index}
          total={items.length}
          title={title}
          onUp={() => move(index, -1)}
          onDown={() => move(index, 1)}
          onDelete={() => remove(item.id)}
        >
          {renderItem(item, (patch) => update(item.id, patch))}
        </ListCard>
      ))}
      <AddButton label={addLabel} onClick={() => onChange([...items, newItem()])} />
    </div>
  );
}

