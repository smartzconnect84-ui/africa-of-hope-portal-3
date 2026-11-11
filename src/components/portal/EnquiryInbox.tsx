import { useState } from "react";
import useSWR from "swr";
import { CheckCheck, MessageCircle, Mail, Trash2, Download, Inbox } from "lucide-react";
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

function getReplyAction(enquiry: Enquiry) {
  const contact = enquiry.contact.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
    return {
      href: `mailto:${contact}?subject=${encodeURIComponent("Following up on your Africa of Hope enquiry")}`,
      byEmail: true,
    };
  }

  const phone = contact.replace(/\D/g, "");
  if (phone.length < 9) return null;
  return {
    href: buildWhatsAppLink(phone, `Hello ${enquiry.name}, this is AFRICA OF HOPE following up on your enquiry about ${enquiry.program}.`),
    byEmail: false,
  };
}

/** Staff inbox backed by the protected website_enquiries table. */
export default function EnquiryInbox() {
  const { data: items = [], error, isLoading, mutate } = useSWR<Enquiry[]>("staff-website-enquiries", loadEnquiries, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
  });
  const [filter, setFilter] = useState<"all" | "new" | "replied">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const markReplied = async (id: string) => {
    setBusyId(id);
    try {
      await updateEnquiry(id, { replied: true });
      await mutate();
      toast.success("Enquiry marked as replied.");
    } catch {
      toast.error("Could not update this enquiry. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const deleteEnquiry = async (enquiry: Enquiry) => {
    if (!window.confirm(`Delete enquiry from ${enquiry.name}?`)) return;
    setBusyId(enquiry.id);
    try {
      await removeEnquiry(enquiry.id);
      await mutate();
      toast.success("Enquiry deleted.");
    } catch {
      toast.error("Could not delete this enquiry. Please try again.");
    } finally {
      setBusyId(null);
    }
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
      {error ? <p role="alert" className="mt-5 text-sm text-red-700">Could not load enquiries. Check your staff access and try again.</p> : null}
      {isLoading ? <p role="status" className="mt-5 text-sm text-slate-500">Loading enquiries…</p> : null}
      {!error && !isLoading && !shown.length ? (
        <div className="mt-5">
          <EmptyState
            icon={Inbox}
            title={items.length ? "No enquiries match this filter" : "No enquiries yet"}
            hint="New messages from the public WhatsApp button will appear here automatically."
          />
        </div>
      ) : !error && !isLoading ? (
        <div className="mt-5 grid gap-3">
          {shown.map((e) => {
            const reply = getReplyAction(e);
            return (
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
              {reply ? (
                <Button asChild size="sm" className={reply.byEmail ? "bg-slate-700 hover:bg-slate-800" : "bg-[#25D366] hover:bg-[#1fb857]"}>
                  <a href={reply.href} target={reply.byEmail ? undefined : "_blank"} rel="noreferrer">
                    {reply.byEmail ? <Mail data-icon="inline-start" /> : <MessageCircle data-icon="inline-start" />}
                    {reply.byEmail ? "Email reply" : "Reply"}
                  </a>
                </Button>
              ) : (
                <Button size="sm" disabled><MessageCircle data-icon="inline-start" /> No reply address</Button>
              )}
              {!e.replied && (
                <Button size="sm" variant="outline" disabled={busyId === e.id} onClick={() => void markReplied(e.id)}>
                  <CheckCheck data-icon="inline-start" /> Mark replied
                </Button>
              )}
              <Button size="sm" variant="ghost" disabled={busyId === e.id} onClick={() => void deleteEnquiry(e)}>
                <Trash2 data-icon="inline-start" /> Delete
              </Button>

              </div>
            </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
