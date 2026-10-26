import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  MessageSquareText,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { EmptyState, SectionHeader, StatCard, Status, panelClass } from "../Navigation";

const focusAreas = [
  { label: "Review missed work", detail: "Turn overdue assignments into your first study wins.", icon: ClipboardList, tone: "rose" },
  { label: "Strengthen weak topics", detail: "Use your feedback and quiz results to choose one topic at a time.", icon: BrainCircuit, tone: "amber" },
  { label: "Prepare for assessment", detail: "Build a short revision block before attempting your next quiz.", icon: Target, tone: "emerald" },
] as const;

export default function SelfAssessmentHub() {
  const { state, currentUser } = useApp();
  const [activeTab, setActiveTab] = useState("overview");

  const mine = useMemo(() => {
    if (!currentUser) return { assignments: [], submissions: [], cohorts: [] };
    const cohorts = state.cohorts.filter((cohort) => cohort.studentIds.includes(currentUser.id));
    const cohortIds = new Set(cohorts.map((cohort) => cohort.id));
    const assignments = state.assignments.filter((assignment) => cohortIds.has(assignment.cohortId));
    const assignmentIds = new Set(assignments.map((assignment) => assignment.id));
    const submissions = state.submissions.filter((submission) => submission.studentId === currentUser.id && assignmentIds.has(submission.assignmentId));
    return { assignments, submissions, cohorts };
  }, [currentUser, state.assignments, state.cohorts, state.submissions]);

  const metrics = useMemo(() => {
    const graded = mine.submissions.filter((submission) => submission.marks !== null);
    const average = graded.length ? Math.round(graded.reduce((total, submission) => total + (submission.marks ?? 0), 0) / graded.length) : 0;
    const submittedIds = new Set(mine.submissions.filter((submission) => submission.submittedAt || submission.status === "Graded" || submission.status === "Submitted").map((submission) => submission.assignmentId));
    const overdue = mine.assignments.filter((assignment) => assignment.dueDate < new Date().toISOString().slice(0, 10) && !submittedIds.has(assignment.id)).length;
    return { average, assessed: graded.length, completion: mine.assignments.length ? Math.round((submittedIds.size / mine.assignments.length) * 100) : 0, overdue };
  }, [mine]);

  const recommendation = metrics.overdue > 0 ? "Start with one overdue assignment" : metrics.average < 50 && metrics.assessed > 0 ? "Review your latest feedback" : "Attempt a practice assessment";

  return (
    <div className="space-y-5">
      <SectionHeader title="Self-assessment hub" subtitle="A simple weekly loop: understand your progress, choose a focus, and take the next action." action={<Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" onClick={() => setActiveTab("action-plan")}><Sparkles className="mr-1.5 h-4 w-4" /> Build my action plan</Button>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="Average score" value={metrics.assessed ? `${metrics.average}%` : "—"} hint={metrics.assessed ? `${metrics.assessed} assessed item${metrics.assessed === 1 ? "" : "s"}` : "Complete an assessment to begin"} />
        <StatCard icon={BookOpenCheck} label="Work completed" value={`${metrics.completion}%`} tone="slate" hint={`${mine.submissions.length} submission${mine.submissions.length === 1 ? "" : "s"} recorded`} />
        <StatCard icon={ShieldAlert} label="Needs attention" value={metrics.overdue} tone={metrics.overdue ? "rose" : "emerald"} hint={metrics.overdue ? "Overdue items" : "No overdue items"} />
        <StatCard icon={Users} label="Learning groups" value={mine.cohorts.length} tone="amber" hint="Active course communities" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">My snapshot</TabsTrigger>
          <TabsTrigger value="action-plan">Action plan</TabsTrigger>
          <TabsTrigger value="support">Support loop</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
          <div className={cn(panelClass, "p-5")}>
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Recommended next step</p><h3 className="mt-1 text-lg font-semibold text-slate-900">{recommendation}</h3><p className="mt-1 text-sm text-slate-500">Small, specific actions make independent learning easier to sustain.</p></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Target className="h-5 w-5" /></span></div>
            <Button variant="outline" className="mt-5" onClick={() => setActiveTab("action-plan")}>View action plan <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
          </div>
          <div className={cn(panelClass, "p-5")}><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><h3 className="font-semibold text-slate-900">Your learning rhythm</h3></div><div className="mt-4 space-y-3 text-sm"><div className="flex items-center justify-between border-b border-slate-100 pb-3"><span className="text-slate-500">Courses joined</span><span className="font-semibold text-slate-800">{mine.cohorts.length}</span></div><div className="flex items-center justify-between border-b border-slate-100 pb-3"><span className="text-slate-500">Assessments graded</span><span className="font-semibold text-slate-800">{metrics.assessed}</span></div><div className="flex items-center justify-between"><span className="text-slate-500">Current status</span><Status value={metrics.overdue ? "needs_attention" : "on_track"} /></div></div></div>
        </TabsContent>
        <TabsContent value="action-plan" className="grid gap-3 md:grid-cols-3">{focusAreas.map(({ label, detail, icon: Icon, tone }, index) => <div key={label} className={cn(panelClass, "p-5", index === 0 && metrics.overdue ? "ring-2 ring-rose-200" : "")}><span className={cn("grid h-10 w-10 place-items-center rounded-xl", tone === "rose" ? "bg-rose-100 text-rose-700" : tone === "amber" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}><Icon className="h-5 w-5" /></span><h3 className="mt-4 font-semibold text-slate-900">{label}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{detail}</p><div className="mt-5 flex items-center gap-2 text-xs font-semibold text-emerald-700">Step {index + 1} <ArrowRight className="h-3.5 w-3.5" /></div></div>)}</TabsContent>
        <TabsContent value="support" className="grid gap-4 lg:grid-cols-2"><div className={cn(panelClass, "p-5")}><div className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-emerald-700" /><h3 className="font-semibold text-slate-900">Ask for feedback</h3></div><p className="mt-2 text-sm leading-6 text-slate-500">Use the helpdesk or class discussion to ask a focused question about a result, topic, or assignment.</p><Button className="mt-4 bg-emerald-700 hover:bg-emerald-800" onClick={() => setActiveTab("overview")}>Return to snapshot</Button></div><div className={cn(panelClass, "p-5")}><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-600" /><h3 className="font-semibold text-slate-900">Teacher check-in</h3></div><p className="mt-2 text-sm leading-6 text-slate-500">Teachers can use Progress Insights to identify where a check-in will have the greatest impact.</p><div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Your next check-in topic: <span className="font-semibold text-slate-800">{recommendation.toLowerCase()}</span>.</div></div></TabsContent>
      </Tabs>
      {mine.assignments.length === 0 && <EmptyState icon={ClipboardList} title="Your assessment workspace is ready" hint="Join a course and your assignments, feedback, and progress signals will appear here." />}
    </div>
  );
}
