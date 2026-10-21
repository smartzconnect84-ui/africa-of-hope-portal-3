import { useEffect, useState } from "react";
import { ArrowRight, Users } from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { WebsiteSettings } from "@/types";
import { ScrollReveal } from "./motion";

type Member = WebsiteSettings["team"]["members"][number];

function TeamPortrait({ member, featured }: { member: Member; featured: boolean }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [member.image]);
  return <div className={`overflow-hidden ${featured ? "h-80 md:h-full md:min-h-[22rem]" : "h-72"}`}>
    {member.image && !broken ? <img src={member.image} alt={member.name} loading="lazy" decoding="async" onError={() => setBroken(true)} className="aoh-photo h-full w-full object-cover object-center" /> :
      <div role="img" aria-label={`Portrait unavailable for ${member.name}`} className={`flex flex-col items-center justify-center gap-3 bg-emerald-50 p-8 text-emerald-800 ${featured ? "h-80 md:h-full md:min-h-[22rem]" : "h-72"}`}><Users className="h-12 w-12" aria-hidden="true" /><span className="text-sm">Portrait unavailable</span></div>}
  </div>;
}

/** Shared by the homepage and full page, both reading the published CMS model. */
export function TeamProfiles({ team }: { team: WebsiteSettings["team"] }) {
  const members = team.members.filter((member) => member.name.trim());
  if (!members.length) return <p className="mt-8 rounded-2xl border border-dashed border-emerald-900/20 bg-white p-8 text-center text-slate-600">Team profiles will be published here when available.</p>;
  return <div className="mt-8 grid min-w-0 gap-6 sm:grid-cols-2 lg:grid-cols-3">
    {members.map((member, index) => {
      const featured = index === 0;
      return <ScrollReveal key={member.id} className={featured ? "sm:col-span-2 lg:col-span-3" : "h-full"}>
        <article className={`aoh-card min-w-0 overflow-hidden rounded-2xl bg-white ${featured ? "grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" : "flex h-full flex-col"}`}>
          <TeamPortrait member={member} featured={featured} />
          <div className={`min-w-0 ${featured ? "flex flex-col justify-center p-6 sm:p-10" : "p-6"}`}>
            <h2 className={`break-words font-bold text-emerald-950 ${featured ? "text-2xl sm:text-3xl" : "text-xl"}`}>{member.name}</h2>
            {member.role && <p className="mt-3 break-words text-sm font-bold uppercase tracking-wider text-emerald-700">{member.role}</p>}
            {member.bio && <p className="mt-5 whitespace-pre-line break-words text-base leading-8 text-slate-600">{member.bio}</p>}
          </div>
        </article>
      </ScrollReveal>;
    })}
  </div>;
}

export default function TeamPage() {
  const { state } = useApp();
  const team = state.websiteSettings.team;
  return <div className="bg-[#f6f8f7] pb-16 sm:pb-24">
    <section className="bg-emerald-950 px-4 py-14 text-white sm:py-20">
      <ScrollReveal className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">People behind the mission</p>
        <h1 className="mt-4 break-words text-3xl font-bold sm:text-5xl">{team.title || "Meet our team"}</h1>
        {team.description && <p className="mt-5 max-w-2xl whitespace-pre-line text-base leading-8 text-emerald-100">{team.description}</p>}
      </ScrollReveal>
    </section>
    <section aria-label="Public team profiles" className="mx-auto max-w-6xl px-4 pt-4">
      {team.enabled ? <TeamProfiles team={team} /> : <p className="mt-8 rounded-2xl bg-white p-8 text-center text-slate-600">Team profiles are not currently published.</p>}
      <a href="#about" className="mt-10 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white transition hover:bg-emerald-900">About AFRICA OF HOPE <ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
    </section>
  </div>;
}
