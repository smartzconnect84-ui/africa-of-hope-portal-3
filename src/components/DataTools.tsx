import { useRef, useState } from "react";
import { Download, Upload, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadCsv, parseCsv, useOnline } from "@/lib/dataTools";
import { cn } from "@/lib/utils";

/**
 * Generic Export / Import bar: drop it above any admin list (people,
 * programmes, fees, certificates…) to get CSV export, CSV import and an
 * offline notice. Offline edits stay in localStorage via AppContext and
 * sync to Supabase when the connection returns.
 */
export default function DataTools<T extends object>({
  name,
  rows,
  columns,
  onImport,
  className,
}: {
  name: string;
  rows: T[];
  columns: { key: keyof T; label: string }[];
  onImport?: (rows: Record<string, string>[]) => void;
  className?: string;
}) {
  const online = useOnline();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const doExport = () => {
    if (!rows.length) { toast.info(`No ${name} to export yet.`); return; }
    downloadCsv(`${name}-${new Date().toISOString().slice(0, 10)}.csv`, rows, columns);
    toast.success(`${rows.length} ${name} exported to CSV.`);
  };

  const doImport = async (file: File) => {
    if (!onImport) return;
    setBusy(true);
    try {
      const text = await file.text();
      const grid = parseCsv(text);
      if (grid.length < 2) { toast.error("That CSV has no data rows."); return; }
      const head = grid[0].map((h) => h.trim().toLowerCase());
      const out = grid.slice(1).map((line) =>
        Object.fromEntries(head.map((h, i) => [h, (line[i] ?? "").trim()])),
      );
      onImport(out);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that CSV file.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {!online && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
          <WifiOff className="h-3 w-3" /> Offline — changes are saved on this device and sync later
        </span>
      )}
      <Button type="button" size="sm" variant="outline" onClick={doExport}>
        <Download className="mr-1.5 h-3.5 w-3.5" /> Export {name}
      </Button>
      {onImport && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); }}
          />
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1.5 h-3.5 w-3.5" /> {busy ? "Reading…" : `Import ${name}`}
          </Button>
        </>
      )}
    </div>
  );
}
