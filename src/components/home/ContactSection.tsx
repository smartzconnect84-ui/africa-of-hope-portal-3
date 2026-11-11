import { useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Clock, Globe, Mail, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WebsiteSettings, SectionCopy, SystemSettings } from "@/types";
import { Reveal } from "../Navigation";
import { EnquiryForm } from "./FaqSection";
import { saveEnquiry } from "@/lib/enquiries";

function VisitForm() {
  const [form, setForm] = useState({ name: "", contact: "", date: "", group: "" });
  const [sending, setSending] = useState(false);
  const submit = async () => {
    if (!form.name.trim() || !form.contact.trim() || !form.date.trim()) {
      toast.error("Name, contact and preferred date are required");
      return;
    }
    setSending(true);
    try {
      await saveEnquiry({
        name: form.name,
        contact: form.contact,
        program: "Campus visit request",
        message: `Preferred visit date: ${form.date.trim()}${form.group.trim() ? ` · Group size: ${form.group.trim()}` : ""}. Please confirm my campus visit.`,
        source: "contact",
      });
      toast.success("Visit request sent. We will confirm your campus visit shortly.");
      setForm({ name: "", contact: "", date: "", group: "" });
    } catch {
      toast.error("We couldn’t save your visit request. Please try again.");
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="rounded-3xl border border-emerald-900/10 bg-white p-5 sm:p-6">
      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-emerald-700">
        <CalendarCheck className="h-4 w-4" /> Book a campus visit
      </p>
      <h3 className="mt-2 text-lg font-bold text-emerald-950">Visit, call or email</h3>
      <p className="mt-1 text-sm text-slate-600">Prefer to talk in person? Pick a date and our registrar will confirm your visit.</p>
      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="visit-name">Full name</Label>
          <Input id="visit-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="visit-contact">Phone or email</Label>
            <Input id="visit-contact" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="+231 …" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="visit-date">Preferred date</Label>
            <Input id="visit-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="visit-group">Group size (optional)</Label>
          <Input id="visit-group" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} placeholder="e.g. 3 people" />
        </div>
        <Button onClick={submit} disabled={sending} className="w-full bg-amber-400 text-emerald-950 hover:bg-amber-300">
          {sending ? "Sending…" : "Request visit"}
        </Button>
      </div>
    </div>
  );
}

export default function ContactSection({
  copy,
  w,
  settings,
}: {
  copy: SectionCopy;
  w: WebsiteSettings;
  settings: SystemSettings;
}) {
  const cards = [
    { icon: MapPin, label: "Campus", value: w.address || settings.address },
    { icon: Phone, label: "Call or WhatsApp", value: w.contactPhone || settings.contactPhone },
    { icon: Mail, label: "Email", value: w.contactEmail || settings.contactEmail },
    { icon: Clock, label: "Office hours", value: w.officeHours },
  ].filter((c) => c.value);

  if (cards.length === 0) return null;

  return (
    <section
      id="contact"
      className="scroll-mt-24 bg-gradient-to-b from-[#eef4f0] via-[#f6f8f7] to-white py-14 sm:py-16"
    >
      <div className="mx-auto max-w-6xl px-4">
        <Reveal>
          <div className="max-w-2xl">
            {copy.eyebrow && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-[11px] font-semibold text-amber-900">
                <Globe className="h-3.5 w-3.5" /> {copy.eyebrow}
              </p>
            )}
            {copy.title && (
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                {copy.title}
              </h2>
            )}
            {copy.subtitle && <p className="mt-2 text-sm text-slate-600">{copy.subtitle}</p>}
          </div>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ icon: Icon, label, value }) => (
            <Reveal key={label}>
              <div className="aoh-card aoh-glass h-full rounded-2xl p-5 transition-shadow hover:shadow-lg">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-800">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-sm text-slate-700">{value}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <Reveal>
            <EnquiryForm settings={settings} />
          </Reveal>
          <Reveal delay={0.1}>
            <VisitForm />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
