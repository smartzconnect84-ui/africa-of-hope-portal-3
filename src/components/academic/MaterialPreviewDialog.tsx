import { useEffect, useState } from "react";
import { AlertTriangle, Download, Loader2 } from "lucide-react";
import { academicApi, type TrainingMaterial } from "@/lib/academics";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * G7: in-app preview for training materials. Images, audio and video render
 * inline; PDFs render in an iframe; everything else falls back to a signed
 * download link opened in a new tab. Signed URLs expire after 10 minutes
 * (see academicApiFactory.materialUrl), so a fresh one is fetched every time
 * the dialog opens rather than cached.
 */
export default function MaterialPreviewDialog({
  material,
  open,
  onOpenChange,
}: {
  material: TrainingMaterial | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !material) { setUrl(null); setError(""); return; }
    let active = true;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const resolved = material.file_path ? await academicApi.materialUrl(material.file_path) : material.external_url ?? null;
        if (active) setUrl(resolved);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [open, material]);

  const mime = material?.mime_type ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{material?.title ?? "Material"}</DialogTitle>
          {material?.description && <DialogDescription>{material.description}</DialogDescription>}
        </DialogHeader>
        {loading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-700" aria-label="Loading preview" />}
        {!loading && error && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        {!loading && !error && url && (
          <div className="min-w-0">
            {mime.startsWith("image/") ? (
              <img src={url} alt={material?.title ?? "Material preview"} className="max-h-[70vh] w-full rounded-lg object-contain" />
            ) : mime.startsWith("audio/") ? (
              <audio controls src={url} className="w-full">
                <track kind="captions" />
              </audio>
            ) : mime.startsWith("video/") ? (
              // Captions are not authored for teacher-uploaded training clips.
              <video controls src={url} className="max-h-[70vh] w-full rounded-lg bg-black" />
            ) : mime === "application/pdf" ? (
              <iframe title={material?.title ?? "Material preview"} src={url} className="h-[70vh] w-full rounded-lg border border-slate-200" />
            ) : (
              <Button asChild className="bg-emerald-700 hover:bg-emerald-800">
                <a href={url} target="_blank" rel="noopener noreferrer" download>
                  <Download className="mr-1.5 h-4 w-4" /> Download {material?.title}
                </a>
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
