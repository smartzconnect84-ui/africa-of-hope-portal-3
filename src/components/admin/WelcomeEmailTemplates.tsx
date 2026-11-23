import { useEffect, useState } from "react";
import { Mail, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { panelClass, SectionHeader } from "../Navigation";

type Audience = "student" | "staff";

interface Template {
  audience: Audience;
  subject: string;
  body: string;
}

const LABELS: Record<Audience, { title: string; hint: string }> = {
  student: {
    title: "Students and applicants",
    hint: "Sent to every account with the Student role — on registration and again when the account is approved.",
  },
  staff: {
    title: "Staff and volunteers",
    hint: "Sent to every non-student account: teachers, registrars, officers, coordinators and volunteers.",
  },
};

const PLACEHOLDERS =
  "{{name}} is replaced with the recipient's name. {{event_line}} becomes either “Your account has been created and is waiting for review.” or “Your AFRICA OF HOPE account has been approved and is ready to use.”";

export default function WelcomeEmailTemplates() {
  const [templates, setTemplates] = useState<Partial<Record<Audience, Template>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Audience | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error: loadError } = await supabase
        .from("welcome_email_templates")
        .select("audience, subject, body")
        .order("audience");
      if (!active) return;
      setLoading(false);
      if (loadError) {
        setError("The welcome email templates could not be loaded. Reload the page and try again.");
        return;
      }
      const next: Partial<Record<Audience, Template>> = {};
      for (const row of (data ?? []) as Template[]) {
        if (row.audience === "student" || row.audience === "staff") next[row.audience] = row;
      }
      setTemplates(next);
    })();
    return () => {
      active = false;
    };
  }, []);

  const patch = (audience: Audience, field: "subject" | "body", value: string) => {
    setTemplates((prev) => {
      const current = prev[audience] ?? { audience, subject: "", body: "" };
      return { ...prev, [audience]: { ...current, [field]: value } };
    });
  };

  const save = async (audience: Audience) => {
    const tpl = templates[audience];
    if (!tpl) return;
    if (!tpl.subject.trim() || !tpl.body.trim()) {
      toast.error("Add both a subject and a message before saving.");
      return;
    }
    if (tpl.body.length > 8000) {
      toast.error("Keep the message under 8000 characters.");
      return;
    }
    setSaving(audience);
    const { error: saveError } = await supabase
      .from("welcome_email_templates")
      .upsert(
        { audience, subject: tpl.subject.trim(), body: tpl.body, updated_at: new Date().toISOString() },
        { onConflict: "audience" },
      );
    setSaving(null);
    if (saveError) {
      toast.error("Could not save this welcome email. Check your permissions and retry.");
      return;
    }
    toast.success(`Welcome email saved for ${LABELS[audience].title.toLowerCase()}. The next account email uses it.`);
  };

  if (loading) {
    return (
      <div className={`${panelClass} p-5 text-sm text-slate-500`}>Loading welcome emails…</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`${panelClass} p-5`}>
        <SectionHeader
          title="Welcome emails"
          subtitle="Two separate messages: one for staff and volunteers, one for students and applicants. Changes apply to every account email queued after saving."
        />
        <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900">{PLACEHOLDERS}</p>
        {error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
      </div>

      {(["student", "staff"] as Audience[]).map((audience) => {
        const tpl = templates[audience];
        return (
          <div key={audience} className={`${panelClass} p-5`}>
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 text-emerald-700" />
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{LABELS[audience].title}</h3>
                <p className="mt-0.5 text-xs text-slate-500">{LABELS[audience].hint}</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor={`welcome-subject-${audience}`}>Subject</Label>
                <Input
                  id={`welcome-subject-${audience}`}
                  value={tpl?.subject ?? ""}
                  onChange={(e) => patch(audience, "subject", e.target.value)}
                  placeholder="Welcome to AFRICA OF HOPE"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`welcome-body-${audience}`}>Message</Label>
                <Textarea
                  id={`welcome-body-${audience}`}
                  value={tpl?.body ?? ""}
                  onChange={(e) => patch(audience, "body", e.target.value)}
                  rows={14}
                  className="font-mono text-xs leading-relaxed"
                  placeholder="Hello {{name}}, …"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => save(audience)}
                  disabled={saving === audience}
                  className="bg-emerald-700 hover:bg-emerald-800"
                >
                  <Save className="mr-1.5 h-4 w-4" />
                  {saving === audience ? "Saving…" : `Save ${audience === "student" ? "student" : "staff"} email`}
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
