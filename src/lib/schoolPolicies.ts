import { supabase } from "@/integrations/supabase/client";

export interface SchoolPolicy {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  body: string;
  version: number;
  effectiveDate: string;
  isPublished: boolean;
  requiresAcceptance: boolean;
  sort: number;
}

export interface PolicyAcceptance {
  policyId: string;
  userId: string;
  acceptedVersion: number;
  acceptedAt: string;
}

const row = (p: Record<string, any>): SchoolPolicy => ({
  id: String(p.id ?? p.slug),
  slug: String(p.slug ?? p.id),
  title: String(p.title ?? "Untitled policy"),
  category: String(p.category ?? "General"),
  summary: String(p.summary ?? ""),
  body: String(p.body ?? ""),
  version: Number(p.version ?? 1),
  effectiveDate: String(p.effective_date ?? new Date().toISOString().slice(0, 10)).slice(0, 10),
  isPublished: p.is_published !== false,
  requiresAcceptance: p.requires_acceptance !== false,
  sort: Number(p.sort ?? 0),
});

/** Full fallback text for all 10 policies — used before the migration is applied. */
export const DEFAULT_POLICIES: SchoolPolicy[] = [
  {
    id: "admissions-enrolment", slug: "admissions-enrolment",
    title: "Admissions & Enrolment Policy", category: "Admissions", version: 1,
    effectiveDate: "2025-09-01", isPublished: true, requiresAcceptance: true, sort: 10,
    summary: "Who may apply, how applications are reviewed, and how enrolment is confirmed.",
    body: `1. PURPOSE\nThis policy ensures fair, transparent admission into all Africa of Hope School of Professional Studies certificate programmes.\n\n2. ELIGIBILITY\n2.1 Applicants must be 16 years or older.\n2.2 Applicants must hold a valid ID (national ID, passport or voter's card) and a secondary school certificate or equivalent.\n2.3 Each programme lists additional entry requirements; beginners are welcome on foundation tracks.\n\n3. APPLICATION PROCESS\n3.1 Applications are submitted online through the portal; walk-in paper forms are accepted at the registrar's office.\n3.2 Applicants choose programmes, upload ID, school records and a passport photo.\n3.3 The registrar reviews every file within 5 working days and contacts the applicant by email or SMS.\n\n4. OFFERS & ENROLMENT\n4.1 Approved applicants receive an offer and pay the first instalment to secure a cohort seat.\n4.2 A student ID is issued after payment; enrolment is confirmed at orientation attendance.\n4.3 False documents lead to immediate withdrawal of an offer.\n\n5. APPEALS\nDeclined applicants may appeal in writing to the School Admin within 14 days.`,
  },
  {
    id: "academic-standards-assessment", slug: "academic-standards-assessment",
    title: "Academic Standards & Assessment Policy", category: "Academics", version: 1,
    effectiveDate: "2025-09-01", isPublished: true, requiresAcceptance: true, sort: 20,
    summary: "Pass marks, grading, assignments, quizzes and academic integrity.",
    body: `1. PASS MARK & GRADING\n1.1 The pass mark is 60%. Distinction: 85%+, Merit: 70–84%, Pass: 60–69%.\n1.2 Grades combine assignments, quizzes, attendance-weighted classwork and examinations as stated per programme.\n\n2. ASSESSMENT RULES\n2.1 Assignment deadlines are enforced; late work loses 10% per day up to 3 days, then scores zero unless an extension was granted.\n2.2 Quizzes are individual. Time limits and attempt limits stated in the portal apply.\n2.3 Missed examinations require a documented excuse; one re-sit per module is allowed.\n\n3. ACADEMIC INTEGRITY\n3.1 Plagiarism, impersonation and unauthorised collaboration are misconduct.\n3.2 First offence: zero on the item plus a warning. Repeat offences go to the disciplinary panel and may lead to suspension.\n\n4. PROGRESSION\nStudents must pass all core modules to graduate. Failed modules may be retaken once with the next cohort.`,
  },
  {
    id: "attendance-participation", slug: "attendance-participation",
    title: "Attendance & Participation Policy", category: "Academics", version: 1,
    effectiveDate: "2025-09-01", isPublished: true, requiresAcceptance: true, sort: 30,
    summary: "Minimum 75% attendance, lateness, absence reporting and participation.",
    body: `1. ATTENDANCE REQUIREMENT\n1.1 Students must attend at least 75% of scheduled sessions per programme.\n1.2 Falling below 75% without approved leave blocks examination entry and certification.\n\n2. LATENESS\nArriving more than 15 minutes late counts as "Late". Three late arrivals equal one absence.\n\n3. REPORTING ABSENCE\n3.1 Absences must be reported to the cohort teacher before the session where possible.\n3.2 Illness beyond 2 days needs a clinic note; emergencies are reviewed case by case.\n\n4. ONLINE PARTICIPATION\nFor online sessions, camera-on presence, quiz completion and assignment submission count toward participation.`,
  },
  {
    id: "fees-payments-refunds", slug: "fees-payments-refunds",
    title: "Fees, Payments & Refunds Policy", category: "Finance", version: 1,
    effectiveDate: "2025-09-01", isPublished: true, requiresAcceptance: true, sort: 40,
    summary: "Tuition, instalments, receipts, refunds and financial holds.",
    body: `1. FEE STRUCTURE\n1.1 Tuition per programme is published before each intake. No hidden charges are permitted.\n1.2 Fees may be paid in full or by instalment under a written plan agreed with Finance.\n\n2. PAYMENT & RECEIPTS\n2.1 Pay via mobile money, bank transfer or in person. Every payment is receipted in the student portal.\n2.2 Students must keep reference numbers until the receipt appears in the portal.\n\n3. REFUNDS\n3.1 Full refund (minus registration fee) if withdrawal is requested before classes start.\n3.2 50% tuition refund within the first two weeks; no tuition refund afterwards except on documented medical or hardship grounds approved by the School Admin.\n3.3 Registration fees are non-refundable.\n\n4. FINANCIAL HOLDS\nUnpaid balances after the agreed plan may pause later module access and certificate issuance until settled. No student is suspended for fees without two written reminders.`,
  },
  {
    id: "conduct-discipline", slug: "conduct-discipline",
    title: "Code of Conduct & Discipline Policy", category: "Conduct", version: 1,
    effectiveDate: "2025-09-01", isPublished: true, requiresAcceptance: true, sort: 50,
    summary: "Expected behaviour, prohibited conduct and the disciplinary process.",
    body: `1. EXPECTED CONDUCT\nRespect staff, fellow students and property. Dress decently, keep facilities clean, and represent the school honourably on and off campus.\n\n2. PROHIBITED CONDUCT\nFighting, theft, fraud, harassment, sexual misconduct, drugs, alcohol on premises, weapons, and wilful damage are strictly prohibited.\n\n3. DISCIPLINARY PROCESS\n3.1 Verbal warning → written warning → panel hearing → suspension or expulsion, depending on severity.\n3.2 Serious offences (assault, theft, sexual misconduct) go straight to a panel and may involve law enforcement.\n3.3 Students may bring one support person to a hearing and appeal within 7 days.`,
  },
  {
    id: "safeguarding-welfare", slug: "safeguarding-welfare",
    title: "Safeguarding & Student Welfare Policy", category: "Welfare", version: 1,
    effectiveDate: "2025-09-01", isPublished: true, requiresAcceptance: true, sort: 60,
    summary: "Protection from harm, reporting channels and welfare support.",
    body: `1. COMMITMENT\nAfrica of Hope is committed to a safe learning environment free from abuse, harassment and exploitation, especially for minors and vulnerable learners.\n\n2. REPORTING\n2.1 Report concerns to any teacher, the registrar, or afrohope033@gmail.com / +231776679963. Anonymous reports are accepted.\n2.2 All reports are logged and reviewed within 48 hours. Urgent-risk cases are escalated same-day.\n2.3 Retaliation against anyone who reports in good faith is itself misconduct.\n\n3. STAFF DUTIES\nStaff never meet a minor alone behind closed doors, never request personal favours, and refer disclosures to the safeguarding lead immediately.\n\n4. SUPPORT\nCounselling referrals, timetable adjustments and confidential follow-up are available to affected students.`,
  },
  {
    id: "examinations-certification", slug: "examinations-certification",
    title: "Examinations & Certification Policy", category: "Academics", version: 1,
    effectiveDate: "2025-09-01", isPublished: true, requiresAcceptance: true, sort: 70,
    summary: "Exam conduct, pass requirements, honours, verification and re-sits.",
    body: `1. EXAM CONDUCT\nBring a student ID. Phones and notes are banned unless the paper is open-book. Cheating means instant disqualification from the paper.\n\n2. PASS & HONOURS\nPass mark 60%. Honours wording on certificates: Distinction (85%+), Merit (70–84%).\n\n3. CERTIFICATES\n3.1 Issued after all modules, fees and attendance requirements are met.\n3.2 Every certificate carries a serial number verifiable free online — no account needed.\n3.3 Lost certificates are replaced once for a reprint fee; revoked certificates (fraud) are published as revoked.\n\n4. RE-SITS\nOne re-sit per failed module within 6 months. A second failure requires retaking the module.`,
  },
  {
    id: "data-privacy", slug: "data-privacy",
    title: "Data Privacy & Records Policy", category: "Governance", version: 1,
    effectiveDate: "2025-09-01", isPublished: true, requiresAcceptance: true, sort: 80,
    summary: "What data we keep, why, who sees it, and student rights.",
    body: `1. DATA WE KEEP\nIdentity, contact, academic records, attendance, payments, certificates and support notes — only what running the school requires.\n\n2. USE & ACCESS\nRecords are used for teaching, certification, verification and legal compliance. Only authorised staff see personal data; employers see only certificate verification results.\n\n3. STUDENT RIGHTS\nStudents may request a copy of their records, corrections, and deletion of non-statutory data after graduation. Requests are answered within 14 days.\n\n4. SECURITY & RETENTION\nEncrypted storage and role-based access. Academic and certificate records are kept permanently for verification; application files of non-enrolled persons are removed after 2 years.`,
  },
  {
    id: "health-safety", slug: "health-safety",
    title: "Health, Safety & Campus Policy", category: "Welfare", version: 1,
    effectiveDate: "2025-09-01", isPublished: true, requiresAcceptance: false, sort: 90,
    summary: "Campus safety, emergencies, health and facility use.",
    body: `1. CAMPUS SAFETY\nFollow staff instructions during drills and emergencies. Report hazards, broken equipment and suspicious persons immediately.\n\n2. HEALTH\nIll students should stay home and inform the cohort teacher. First aid is available at the registrar's office; serious cases are referred to the nearest clinic.\n\n3. FACILITIES\nUse labs, equipment and the library as instructed. Food and drink stay out of computer labs. Damaged items must be reported; wilful damage is charged.\n\n4. VISITORS\nVisitors sign in at reception. Students are responsible for their guests' conduct.`,
  },
  {
    id: "online-learning-ict", slug: "online-learning-ict",
    title: "Online Learning & ICT Acceptable Use Policy", category: "Academics", version: 1,
    effectiveDate: "2025-09-01", isPublished: true, requiresAcceptance: true, sort: 100,
    summary: "Portal accounts, online classes, training materials and device rules.",
    body: `1. ACCOUNTS\nOne account per person. Never share passwords; report suspected compromise to the registrar immediately.\n\n2. ONLINE CLASSES & MATERIALS\nJoin on time, stay for the full session, and submit your own work. Training materials are for enrolled students — do not redistribute or upload them elsewhere.\n\n3. ACCEPTABLE USE\nSchool devices and networks are for learning. No illegal downloads, harassment, explicit content or attempts to bypass security.\n\n4. OFFLINE ACCESS\nDownload lessons where offered for low-connectivity study, but quizzes and final submissions must sync through the portal to count.`,
  },
];

const toDb = (p: Partial<SchoolPolicy>) => ({
  slug: p.slug,
  title: p.title,
  category: p.category,
  summary: p.summary,
  body: p.body,
  version: p.version,
  effective_date: p.effectiveDate,
  is_published: p.isPublished,
  requires_acceptance: p.requiresAcceptance,
  sort: p.sort,
});

export async function listPolicies(): Promise<{ data: SchoolPolicy[]; live: boolean }> {
  try {
    const { data, error } = await supabase
      .from("school_policies")
      .select("*")
      .order("sort", { ascending: true });
    if (error) throw error;
    const mapped = (data ?? []).map(row).filter((p) => p.isPublished);
    if (mapped.length === 0) return { data: DEFAULT_POLICIES, live: false };
    return { data: mapped, live: true };
  } catch {
    return { data: DEFAULT_POLICIES, live: false };
  }
}

export async function listAllPoliciesAdmin(): Promise<{ data: SchoolPolicy[]; live: boolean }> {
  try {
    const { data, error } = await supabase
      .from("school_policies")
      .select("*")
      .order("sort", { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) return { data: DEFAULT_POLICIES, live: false };
    return { data: data.map(row), live: true };
  } catch {
    return { data: DEFAULT_POLICIES, live: false };
  }
}

export async function savePolicyRemote(p: SchoolPolicy): Promise<string | null> {
  try {
    if (String(p.id).includes("-") && p.id.length > 20 && !DEFAULT_POLICIES.some((d) => d.id === p.id)) {
      const { error } = await supabase.from("school_policies").update({ ...toDb(p), updated_at: new Date().toISOString() }).eq("id", p.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("school_policies").upsert({ ...toDb(p), updated_at: new Date().toISOString() }, { onConflict: "slug" });
      if (error) throw error;
    }
    return null;
  } catch (e: any) {
    return e?.message ?? "Could not save policy.";
  }
}

export async function getMyAcceptances(userId: string): Promise<Record<string, PolicyAcceptance>> {
  try {
    const { data, error } = await supabase.from("policy_acceptances").select("*").eq("user_id", userId);
    if (error) throw error;
    const out: Record<string, PolicyAcceptance> = {};
    for (const r of data ?? []) out[String((r as any).policy_id)] = {
      policyId: String((r as any).policy_id),
      userId: String((r as any).user_id),
      acceptedVersion: Number((r as any).accepted_version ?? 1),
      acceptedAt: String((r as any).accepted_at ?? ""),
    };
    return out;
  } catch {
    try {
      const raw = localStorage.getItem(`aoh-policy-accept-${userId}`);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
}

export async function acceptPolicyRemote(policyId: string, userId: string, version: number, policySlug?: string): Promise<string | null> {
  try {
    const { error } = await supabase.from("policy_acceptances").upsert(
      { policy_id: policyId, user_id: userId, accepted_version: version, accepted_at: new Date().toISOString() },
      { onConflict: "policy_id,user_id" },
    );
    if (error) throw error;
    return null;
  } catch (e: any) {
    try {
      const key = `aoh-policy-accept-${userId}`;
      const raw = localStorage.getItem(key);
      const all = raw ? JSON.parse(raw) : {};
      all[policyId] = { policyId, userId, acceptedVersion: version, acceptedAt: new Date().toISOString(), slug: policySlug };
      localStorage.setItem(key, JSON.stringify(all));
      return null;
    } catch {
      return e?.message ?? "Could not record acceptance.";
    }
  }
}
