import { useEffect, useState } from "react";
import { CheckCircle2, FileText, Pencil, Save, ShieldCheck, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import { usePermission } from "@/hooks/usePermission";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { panelClass, SectionHeader, EmptyState } from "./Navigation";

const DEFAULT_POLICY_TEXT = `AFRICA OF HOPE SCHOOL OF PROFESSIONAL STUDIES — Student Policy

1. Attendance: Learners must attend within their selected training days and complete the course within its duration to be certificated.
2. Conduct: Respectful behaviour towards instructors, staff and fellow learners is required at all times.
3. Integrity: All submitted work must be your own. Plagiarism or cheating may result in disqualification.
4. Fees: Registration packages are non-refundable once a cohort has started.
5. Certificates: Issued only upon verified completion of all required lessons and assessments.
6. Data: Personal data is handled under our Privacy and Data Protection practices.`;

const STORAGE_KEY = "aoh-student-policy-text";

export default function StudentPolicy() {
  const { currentUser } = useApp();
  const canManage = usePermission("settings.manage");
  const key = currentUser ? `aoh-policy-accepted:${currentUser.id}` : null;
  const [policyText, setPolicyText] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_POLICY_TEXT; } catch { return DEFAULT_POLICY_TEXT; }
  });
  const [draftText, setDraftText] = useState(policyText);
  const [editing, setEditing] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.schoolPolicyAcceptedAt) {
      setAccepted(true);
      if (key) localStorage.setItem(key, "1");
      return;
    }
    if (key) setAccepted(localStorage.getItem(key) === "1");
  }, [currentUser?.id, currentUser?.schoolPolicyAcceptedAt, key]);

  const accept = async () => {
    if (!currentUser) return;
    if (key) localStorage.setItem(key, "1");
    setAccepted(true);
    try {
      await supabase
        .from("profiles")
        .update({ school_policy_accepted_at: new Date().toISOString() })
        .eq("id", currentUser.id);
    } catch {
      /* best effort */
    }
  };

  const saveEdit = () => {
    const next = draftText.trim() || DEFAULT_POLICY_TEXT;
    setPolicyText(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
    setEditing(false);
  };

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <SectionHeader title="Student policy" subtitle="Read and accept the student policy before continuing your studies." />
      <section className={panelClass + " p-4 sm:p-6"}>
        <div className="flex items-center justify-between gap-2 text-emerald-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <h3 className="font-semibold">Policy document</h3>
          </div>
          {canManage && !editing && (
            <Button size="sm" variant="outline" onClick={() => { setDraftText(policyText); setEditing(true); }}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
            </Button>
          )}
        </div>
        {editing ? (
          <div className="mt-4 space-y-3">
            <Textarea rows={12} value={draftText} onChange={(e) => setDraftText(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
              </Button>
              <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={saveEdit}>
                <Save className="mr-1.5 h-3.5 w-3.5" /> Save
              </Button>
            </div>
          </div>
        ) : (
          <div
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setScrolled(true);
            }}
            className="mt-4 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
          >
            {policyText}
          </div>
        )}
        {accepted ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> You have accepted the student policy.
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button disabled={!scrolled || editing} onClick={accept} className="bg-emerald-700 hover:bg-emerald-800">
              <FileText className="mr-1.5 h-4 w-4" /> I have read and accept
            </Button>
            {!scrolled && <span className="text-xs text-slate-500">Scroll to the bottom to enable acceptance.</span>}
          </div>
        )}
      </section>
      {!currentUser && <EmptyState icon={FileText} title="Sign in required" hint="Sign in to accept the student policy." />}
    </div>
  );
}