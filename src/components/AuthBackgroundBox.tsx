import { useId, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Upload, X, Layers } from "lucide-react";
import { uploadAuthBackground, pruneAuthBackground } from "@/lib/storage";
import { cn } from "@/lib/utils";

/** Auth-page background picker backed by `auth-background/<folder>` in the public
 * `site-assets` bucket. Mirrors `ImageBox` so the existing CMS form pattern stays
 * consistent, but keeps its own storage folder and tone label.
 */
export default function AuthBackgroundBox({
  label = "Auth page background",
  value,
  onChange,
  folder = "page",
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  folder?: string;
}) {
  const errorId = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const folderKey = folder.toLowerCase();

  const handleFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadAuthBackground(folderKey, file);
      onChange(url);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
        <span id={errorId} className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid h-20 w-32 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-900",
          )}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          ) : value ? (
            <img src={value} alt={label} loading="lazy" className="h-full w-full object-cover" />
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
            <Upload className="h-3.5 w-3.5" /> {busy ? "Uploading…" : "Upload background"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => {
                pruneAuthBackground(folderKey, value);
                onChange("");
              }}
              disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" /> Remove
            </button>
          )}
        </div>
        <input
          ref={ref}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </div>
      <input
        value={value.startsWith("data:") ? "" : value}
        aria-label={`${label} URL`}
        disabled={busy}
        placeholder="…or paste a background image URL (PNG / JPEG / WebP)"
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-emerald-500"
      />
      <p className="mt-1 text-[11px] leading-4 text-slate-500">
        Uploaded to the public site-assets bucket under auth-background/{folderKey}. A matching public read policy is required for visitors to see it.
      </p>
    </div>
  );
}
