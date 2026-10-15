import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, RotateCcw } from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { Program } from "@/types";
import { DEFAULT_PROGRAM_IMAGE, programImage } from "@/lib/programImages";
import {
  IMAGE_TYPES, MAX_IMAGE_BYTES, pruneProgramImages, uploadProgramImage, validateFile,
} from "@/lib/storage";
import { cn } from "@/lib/utils";

const COVER_TYPES = IMAGE_TYPES.filter((t) => t !== "image/gif");

/**
 * Programme cover image. Uses the admin-uploaded image when present and the
 * bundled stock photo otherwise. Pass `editable` to show upload/reset controls.
 */
export default function ProgramCover({
  program, editable = false, className,
}: {
  program: Program;
  editable?: boolean;
  className?: string;
}) {
  const { setProgramImage } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const custom = Boolean(program.imageUrl);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const invalid = validateFile(file, COVER_TYPES, MAX_IMAGE_BYTES);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setBusy(true);
    try {
      const url = await uploadProgramImage(program.id, file);
      const err = await setProgramImage(program.id, url);
      if (err) throw new Error(err);
      void pruneProgramImages(program.id, url);
      toast.success(`Image updated for ${program.title}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const reset = async () => {
    setBusy(true);
    const err = await setProgramImage(program.id, null);
    setBusy(false);
    if (err) {
      toast.error(err);
      return;
    }
    void pruneProgramImages(program.id);
    toast.success("Restored the default image");
  };

  return (
    <div className={cn("group relative overflow-hidden bg-emerald-950", className)}>
      <img
        src={programImage(program)}
        alt={program.title}
        loading="lazy"
        onError={(e) => {
          if (!e.currentTarget.src.endsWith(DEFAULT_PROGRAM_IMAGE)) e.currentTarget.src = DEFAULT_PROGRAM_IMAGE;
        }}
        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-emerald-950/70 via-transparent to-transparent" />
      {editable && (
        <>
          <div className="absolute bottom-2.5 right-2.5 flex gap-1.5">
            {custom && (
              <button
                type="button"
                onClick={() => void reset()}
                disabled={busy}
                title="Use the default image"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/90 px-2.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:bg-white disabled:opacity-60"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            )}
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-400 px-2.5 text-xs font-semibold text-emerald-950 shadow-sm transition hover:bg-amber-300 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
              {custom ? "Replace image" : "Upload image"}
            </button>
          </div>
          <span className="absolute left-2.5 top-2.5 rounded-md bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur">
            {custom ? "Custom image" : "Stock image"}
          </span>
          <input
            ref={input}
            type="file"
            accept={COVER_TYPES.join(",")}
            className="hidden"
            onChange={(e) => void upload(e.target.files?.[0])}
          />
        </>
      )}
    </div>
  );
}
