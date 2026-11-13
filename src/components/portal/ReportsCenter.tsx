import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Loader2, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, panelClass, SectionHeader } from "@/components/Navigation";
import { ProfileTrigger } from "@/components/portal/ProfileViewer";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/utils";
import {
  REPORT_AUDIENCES,
  REPORT_CATEGORIES,
  canDecideReport,
  decideReport,
  deleteReport,
  reportsVisibleTo,
  roleGroup,
  submitReport,
  useOpsVersion,
  type ReportAudience,
  type RoleReport,
} from "@/lib/portalOps";

const STATUS_STYLES: Record<RoleReport["status"], string> = {
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  approved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  rejected: "border-destructive/40 bg-destructive/10 text-destructive",
};

/** Reports raised by any role, routed to the staff group that must approve them. */
export default function ReportsCenter() {
  const { currentUser, state } = useApp();
  useOpsVersion();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(REPORT_CATEGORIES[0]);
  const [audience, setAudience] = useState<ReportAudience>(
    currentUser ? ((roleGroup(currentUser.role) === "Student" ? "Administration" : roleGroup(currentUser.role)) as ReportAudience) : "Administration",
  );
  const [body, setBody] = useState("");
  const [filter, setFilter] = useState<"all" | RoleReport["status"]>("all");
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const reports = useMemo(() => {
    const visible = reportsVisibleTo(currentUser);
    return filter === "all" ? visible : visible.filter((r) => r.status === filter);
  }, [currentUser, filter, title, body, category, audience]);

  if (!currentUser) return null;

  function handleSubmit() {
    if (!title.trim() || !body.trim()) {
      toast.error("Add a title and describe the report before submitting.");
      return;
    }
    setBusy(true);
    try {
      submitReport({
        title,
        category,
        body,
        audience,
        author: { id: currentUser!.id, name: currentUser!.name, role: currentUser!.role },
      });
      setTitle("");
      setBody("");
      toast.success("Report submitted for approval.");
    } catch {
      toast.error("Could not submit the report.");
    } finally {
      setBusy(false);
    }
  }

  function handleDecision(report: RoleReport, decision: "approved" | "rejected") {
    decideReport(report.id, decision, noteDraft[report.id] ?? "", {
      id: currentUser!.id,
      name: currentUser!.name,
    });
    setNoteDraft((prev) => ({ ...prev, [report.id]: "" }));
    toast.success(decision === "approved" ? "Report approved." : "Report rejected.");
  }

  const pendingCount = reportsVisibleTo(currentUser).filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Reports & approvals"
        description="Submit a report to a staff group, then approve or reject it with a written decision."
      />

      <div className={cn(panelClass, "p-5")}>
        <h3 className="mb-4 flex items-center gap-2 font-semibold">
          <ClipboardList className="h-4 w-4" /> New report
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="report-title">Title</Label>
            <Input
              id="report-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Attendance drop in Cohort A"
            />
          </div>
          <div>
            <Label htmlFor="report-category">Category</Label>
            <select
              id="report-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {REPORT_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="report-audience">Send to</Label>
            <select
              id="report-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value as ReportAudience)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {REPORT_AUDIENCES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="report-body">Details</Label>
            <Textarea
              id="report-body"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What happened, who is affected and what you recommend."
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSubmit} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit report
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "pending", "approved", "rejected"] as const).map((option) => (
          <Button
            key={option}
            size="sm"
            variant={filter === option ? "default" : "outline"}
            onClick={() => setFilter(option)}
          >
            {option === "all" ? "All reports" : option}
            {option === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Button>
        ))}
      </div>

      {reports.length === 0 ? (
        <EmptyState title="No reports yet" description="Reports you submit or receive will appear here." />
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const author = state.users.find((u) => u.id === report.submittedById);
            const canDecide = canDecideReport(currentUser, report) && report.status === "pending";
            return (
              <article key={report.id} className={cn(panelClass, "p-5")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold">{report.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <ProfileTrigger user={author} className="font-medium">
                        {report.submittedByName}
                      </ProfileTrigger>{" "}
                      · {report.submittedByRole} · {new Date(report.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">To {report.audience}</Badge>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
                        STATUS_STYLES[report.status],
                      )}
                    >
                      {report.status}
                    </span>
                  </div>
                </div>

                <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{report.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">Category: {report.category}</p>

                {report.decidedByName && (
                  <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-sm">
                    <p className="font-medium">
                      {report.status === "approved" ? "Approved" : "Rejected"} by {report.decidedByName}
                      {report.decidedAt ? ` · ${new Date(report.decidedAt).toLocaleString()}` : ""}
                    </p>
                    {report.decisionNote && (
                      <p className="mt-1 text-muted-foreground">{report.decisionNote}</p>
                    )}
                  </div>
                )}

                {canDecide && (
                  <div className="mt-4 space-y-2 border-t pt-3">
                    <Textarea
                      rows={2}
                      placeholder="Decision note (optional)"
                      value={noteDraft[report.id] ?? ""}
                      onChange={(e) =>
                        setNoteDraft((prev) => ({ ...prev, [report.id]: e.target.value }))
                      }
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => handleDecision(report, "approved")}>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDecision(report, "rejected")}
                      >
                        <XCircle className="mr-2 h-4 w-4" /> Reject
                      </Button>
                    </div>
                  </div>
                )}

                {(roleGroup(currentUser.role) === "Administration" ||
                  report.submittedById === currentUser.id) && (
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        deleteReport(report.id);
                        toast.success("Report deleted.");
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
