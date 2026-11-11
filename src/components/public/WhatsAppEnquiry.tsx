import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { toast } from "sonner";
import type { Program } from "@/types";
import {
  buildWhatsAppLink,
  enquiryMessage,
  saveEnquiry,
  schoolWhatsAppNumber,
} from "@/lib/enquiries";

export default function WhatsAppEnquiry({
  programs,
  contactPhone,
}: {
  programs: Program[];
  contactPhone: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [program, setProgram] = useState("General enquiry");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [whatsAppUrl, setWhatsAppUrl] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => nameRef.current?.focus(), 60);
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      window.addEventListener("keydown", onKey);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener("keydown", onKey);
      };
    }
  }, [open ]);

  const submit = async () => {
    if (!name.trim() || !contact.trim() || !message.trim()) {
      toast.error("Please add your name, contact and message.");
      return;
    }
    setSending(true);
    setWhatsAppUrl(null);
    const payload = { name: name.trim(), contact: contact.trim(), program, message: message.trim() };
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;

    try {
      await saveEnquiry({ ...payload, source: "whatsapp" });
      const url = buildWhatsAppLink(schoolWhatsAppNumber(contactPhone), enquiryMessage(payload));
      setWhatsAppUrl(url);
      toast.success("Enquiry saved. Continue to WhatsApp to send your message.");
      setName("");
      setContact("");
      setProgram("General enquiry");
      setMessage("");
      if (popup) {
        popup.location.assign(url);
        setOpen(false);
      }
    } catch {
      popup?.close();
      toast.error("We couldn’t save your enquiry. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Chat with us on WhatsApp"
        className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_12px_32px_-8px_rgba(37,211,102,0.7)] transition hover:scale-105 hover:bg-[#1fb857] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800 focus-visible:ring-offset-2"
      >
        <MessageCircle className="h-6 w-6" aria-hidden="true" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Send a WhatsApp enquiry">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-4 bottom-4 mx-auto max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl sm:inset-x-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2">
            <div className="flex items-center justify-between bg-emerald-950 px-5 py-4 text-white">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#25D366]">
                  <MessageCircle className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Chat with admissions</p>
                  <p className="text-xs text-emerald-200">We reply within two working days</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close enquiry form"
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-5">
              <div>
                <label htmlFor="wa-name" className="text-xs font-semibold text-slate-700">Full name</label>
                <input
                  ref={nameRef}
                  id="wa-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                />
              </div>
              <div>
                <label htmlFor="wa-contact" className="text-xs font-semibold text-slate-700">Phone or email</label>
                <input
                  id="wa-contact"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="+231 … or you@example.com"
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                />
              </div>
              <div>
                <label htmlFor="wa-program" className="text-xs font-semibold text-slate-700">Programme of interest</label>
                <select
                  id="wa-program"
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-700"
                >
                  <option>General enquiry</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.title}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="wa-message" className="text-xs font-semibold text-slate-700">Message</label>
                <textarea
                  id="wa-message"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us which programme interests you…"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700"
                />
              </div>
              <button
                type="button"
                onClick={submit}
                disabled={sending}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-semibold text-white transition hover:bg-[#1fb857] disabled:opacity-60"
              >
                <Send className="h-4 w-4" aria-hidden="true" /> {sending ? "Sending…" : "Send via WhatsApp"}
  </button>
  {whatsAppUrl ? (
    <a href={whatsAppUrl} target="_blank" rel="noreferrer" className="block text-center text-sm font-semibold text-emerald-800 underline underline-offset-4">
      Continue to WhatsApp
    </a>
  ) : null}
  <p className="text-center text-[11px] text-slate-500">

                Your message is saved for our staff and opens in WhatsApp pre-filled.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
