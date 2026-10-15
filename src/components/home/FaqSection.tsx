import { useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { WebsiteSettings, SectionCopy, SystemSettings } from "@/types";
import { Reveal } from "../Navigation";

/** Shared by the homepage FAQ section (rendered side-by-side) per the plan's corrections. */
export function EnquiryForm({ settings }: { settings: SystemSettings }) {
  const [inquiry, setInquiry] = useState({ name: "", email: "", message: "" });

  const submit = () => {
    if (!inquiry.name.trim() || !inquiry.email.trim() || !inquiry.message.trim()) {
      toast.error("Name, email and message are required");
      return;
    }
    toast.success("Enquiry sent. Our admissions team will reply within two working days.");
    setInquiry({ name: "", email: "", message: "" });
  };

  return (
    <div className="rounded-3xl border border-emerald-900/10 bg-[#f6f8f7] p-5 sm:p-6">
      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-emerald-800">
        <Users className="h-3.5 w-3.5" /> Talk to admissions
      </p>
      <h3 className="mt-2 text-lg font-semibold text-slate-900">Send us an enquiry</h3>
      <p className="mt-1 text-sm text-slate-500">
        Prefer to ask first? Send a message and the registrar will respond personally.
      </p>
      <div className="mt-5 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="inq-name">Full name</Label>
          <Input id="inq-name" value={inquiry.name} onChange={(e) => setInquiry({ ...inquiry, name: e.target.value })} placeholder="Your name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inq-email">Email</Label>
          <Input id="inq-email" value={inquiry.email} onChange={(e) => setInquiry({ ...inquiry, email: e.target.value })} placeholder="you@example.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inq-message">Message</Label>
          <Textarea
            id="inq-message"
            rows={4}
            value={inquiry.message}
            onChange={(e) => setInquiry({ ...inquiry, message: e.target.value })}
            placeholder="Tell us which programme interests you"
          />
        </div>
        <Button onClick={submit} className="w-full bg-emerald-700 hover:bg-emerald-800">
          Send enquiry
        </Button>
        <p className="text-center text-[11px] text-slate-500">
          Or call {settings.contactPhone} / email {settings.contactEmail}
        </p>
      </div>
    </div>
  );
}

export default function FaqSection({
  copy,
  w,
  settings,
}: {
  copy: SectionCopy;
  w: WebsiteSettings;
  settings: SystemSettings;
}) {
  if (w.faqs.length === 0) return null;
  return (
    <section id="faq" className="scroll-mt-24 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal>
          <div className="max-w-2xl">
            {copy.eyebrow && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-[11px] font-semibold text-amber-900">
                {copy.eyebrow}
              </p>
            )}
            {copy.title && (
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                {copy.title}
              </h2>
            )}
            {copy.subtitle && <p className="mt-2 text-sm text-slate-600">{copy.subtitle}</p>}
          </div>
        </Reveal>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_1fr]">
          <div className="space-y-3">
            {w.faqs.map((f, i) => (
              <Reveal key={f.id} delay={i * 0.04}>
                <details className="group rounded-2xl border border-emerald-900/10 bg-[#f6f8f7] p-4 open:bg-white">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-slate-800">
                    {f.question}
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                      +
                    </span>
                  </summary>
                  <p className="mt-2.5 text-sm text-slate-600">{f.answer}</p>
                </details>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1}>
            <EnquiryForm settings={settings} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
