import { Clock, Globe, Mail, MapPin, Phone } from "lucide-react";
import type { WebsiteSettings, SectionCopy, SystemSettings } from "@/types";
import { Reveal } from "../Navigation";

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
    <section id="contact" className="scroll-mt-24 bg-[#f6f8f7] py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal>
          <div className="max-w-2xl">
            {copy.eyebrow && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-[11px] font-semibold text-emerald-900">
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
              <div className="h-full rounded-2xl border border-emerald-900/10 bg-white p-5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-800">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-sm text-slate-700">{value}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
