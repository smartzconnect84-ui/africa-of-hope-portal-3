import { useEffect, useState } from "react";
import { CheckCheck, MessageCircle, Trash2, Download, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionHeader, panelClass } from "../Navigation";
import { cn } from "@/lib/utils";
import {
  buildWhatsAppLink,
  loadEnquiries,
  removeEnquiry,
  updateEnquiry,
  type Enquiry,
} from "@/lib/enquiries";

/** f33 staff inbox: reads the same local store the public WhatsApp form writes to. */
export default function EnquiryInbox() {
  const [items, setItems] = useState<Enquiry[]>(() => loadEnquiries());
  const [filter, setFilter] = useState<"all" | "new" | "replied">("all");

  const refresh = () => setItems(loadEnquiries());
  useEffect(() => {
    refresh();
    window.addEventListener("storage", refresh);
    const t = window.setInterval(refresh, 2000);
    return () => {
      window.removeEventListener("storage", refresh);
      window.clearInterval(t);
    };
  }, []);

  const shown = items.filter((e) =>
    filter === "all" ? true : filter === "new" ? !e.replied : e.replied,
  );

  const exportCsv = () => {
    if (!shown.length) return toast.info("There is nothing to export yet.");
    const rows = [["Name", "Contact", "Programme", "Message", "Received", "Replied"],
      ...shown.map((e) => [e.name, e.contact, e.program, e.message, e.createdAt, e.replied ? "Yes" : "No"])];
    const csv = rows.map((r) => r.map((c) => JSON.stringify(c ?? "")).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "whatsapp-enquiries.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <section className={cn(panelClass, "p-4 sm:p-6")}>
      <SectionHeader
        title="WhatsApp enquiries"
        subtitle="Messages sent from the public floating button — reply in one tap."
        action={
          <div className="flex gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
              aria-label="Filter enquiries"
            >
              <option value="all">All</option>
              <option value="new">New</option>
              <option value="replied">Replied</option>
            </select>
            <Button variant="outline" onClick={exportCsv}><Download data-icon="inline-start" /> CSV</Button>
          </div>
        }
      />
      {!shown.length ? (
        <div className="mt-5">
          <EmptyState
            icon={Inbox}
            title={items.length ? "No enquiries match this filter" : "No enquiries yet"}
            hint="New messages from the public WhatsApp button will appear here automatically."
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {shown.map((e) => (
            <article key={e.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {e.name} <span className="font-normal text-slate-500">· {e.contact}</span>
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-emerald-800">{e.program}</p>
                </div>
                <span className={cn(
                  "rounded-full px-2 py-1 text-[11px] font-semibold",
                  e.replied ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800",
                )}>
                  {e.replied ? "Replied" : "New"}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{e.message}</p>
              <p className="mt-2 text-[11px] text-slate-400">
                {new Date(e.createdAt).toLocaleString()}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="bg-[#25D366] hover:bg-[#1fb857]"
                  onClick={() => window.open(buildWhatsAppLink(
                    e.contact.replace(/\D/g, "") || "",
                    `Hello ${e.name}, this is AFRICA OF HOPE following up on your enquiry about ${e.program}.`,
                  ), "_blank", "noopener")}
                >
                  <MessageCircle data-icon="inline-start" /> Reply
                </Button>
                {!e.replied && (
                  <Button size="sm" variant="outline" onClick={() => { updateEnquiry(e.id, { replied: true }); refresh(); }}>
                    <CheckCheck data-icon="inline-start" /> Mark replied
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => {
                  if (!window.confirm(`Delete enquiry from ${e.name}?`)) return;
                  removeEnquiry(e.id); refresh(); toast.success("Enquiry deleted.");
                }}>
                  <Trash2 data-icon="inline-start" /> Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
