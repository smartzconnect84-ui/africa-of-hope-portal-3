import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchState, mergeThemeSettings, mergeWebsiteSettings, persistSettingsPatch, settingsRow, today, uid, type Row } from "@/data/liveData";
import type {
  Announcement,
  AppState,
  Assignment,
  AttendanceStatus,
  Certificate,
  Cohort,
  FeeTransaction,
  PortalThemeSettings,
  Program,
  Role,
  SystemSettings,
  User,
  WebsiteSettings,
} from "../types";
import { CATALOG_2026 } from "../data/programCatalog2026";
import { defaultSettings, defaultThemeSettings, defaultWebsiteSettings, initialState } from "../data/mockData";
import { DEFAULT_ROLE_PERMISSIONS, type PermissionKey } from "../lib/permissions";
import { certificatesApi } from "../lib/certificates";
import { academicApi } from "../lib/academics";

// v5: the roles & permissions migration tightens RLS considerably, so a
// previous admin's cached profiles/fees/role grants must never leak into
// the next person's session. Bumping this key discards any v4 cache.
const CACHE_KEY = "aoh-portal-cache-v6";
const SESSION_KEY = "africa-of-hope-session-v5";

const LIVE_TABLES = [
  "profiles",
  "programs",
  "program_modules",
  "cohorts",
  "cohort_students",
  "attendance",
  "assignments",
  "submissions",
  "fee_transactions",
  "certificates",
  "announcements",
  "system_settings",
  "role_permissions",
];

export interface RegistrationPayload {
  name: string;
  email: string;
  phone: string;
  programIds: string[];
  note: string;
  /** Highest completed level of schooling (replaces the old ID/Documents box). */
  educationLevel: string;
  /** Legacy field kept for older records; no longer collected. */
  documents?: string;
}

export interface SignUpPayload extends RegistrationPayload {
  password: string;
}

export interface SignUpResult {
  error: string | null;
  /**
   * signed_in: account created and session started.
   * confirm_email: account created, applicant must confirm their email first.
   */
  status?: "signed_in" | "confirm_email";
}

export interface ProfilePatch {
  name?: string;
  phone?: string;
  title?: string;
  bio?: string;
  address?: string;
  dateOfBirth?: string;
  avatarUrl?: string | null;
}

interface AppContextValue {
  state: AppState;
  currentUser: User | null;
  loading: boolean;
  live: boolean;
  /** Bumped by resetDemoData(); components that fetch their own data outside `state` (e.g. payments, blog) should include this in their refetch effect's dependencies so the "Reload live data" action refreshes them too. */
  reloadKey: number;
  refresh: () => Promise<void>;
  /** Resolves to an error message, or null on success. */
  login: (emailOrUserId: string, password?: string) => Promise<string | null>;
  logout: () => void;
  registerStudent: (payload: RegistrationPayload) => void;
  signUpStudent: (payload: SignUpPayload) => Promise<SignUpResult>;
  requestPasswordReset: (email: string) => Promise<string | null>;
  changePassword: (password: string) => Promise<string | null>;
  updateProfile: (id: string, patch: ProfilePatch) => Promise<string | null>;
  setProgramImage: (id: string, imageUrl: string | null) => Promise<string | null>;
  /** Inserts any 2026/2027 catalogue course missing from the live programmes table. Resolves to an error message, or null on success. */
  seedCatalogue: () => Promise<string | null>;
  approveApplicant: (id: string) => Promise<string | null>;
  rejectApplicant: (id: string) => void;
  toggleStudentStatus: (id: string) => void;
  addProgram: (payload: Omit<Program, "id" | "modules"> & { modulesRaw: string }) => void;
  addCohort: (payload: Omit<Cohort, "id">) => void;
  markAttendance: (cohortId: string, date: string, statuses: Record<string, AttendanceStatus>) => void;
  addAssignment: (payload: Omit<Assignment, "id">) => Promise<void>;
  gradeSubmission: (assignmentId: string, studentId: string, marks: number, feedback: string) => Promise<void>;
  submitSubmission: (assignmentId: string, studentId: string, text: string, attachment: string) => Promise<void>;
  addFeeTransaction: (payload: Omit<FeeTransaction, "id">) => void;
  /** Issues (or returns the existing) certificate through the database function; rejects with an actionable message. */
  issueCertificate: (
    studentId: string,
    programId: string,
    honors: string,
    certificateType?: string,
    completionDate?: string,
  ) => Promise<Certificate>;
  /** Administrator-only revocation of an issued certificate, recorded with actor, time and reason. */
  revokeCertificate: (certificateId: string, reason: string) => Promise<Certificate>;
  addAnnouncement: (payload: Omit<Announcement, "id" | "date">) => void;
  updateSystemSettings: (patch: Partial<SystemSettings>) => Promise<string | null>;
  /** Publishes a whole settings object live (the CMS editor's "Publish changes" button). */
  publishWebsiteSettings: (next: WebsiteSettings) => Promise<string | null>;
  publishThemeSettings: (next: PortalThemeSettings) => Promise<string | null>;
  clearTransactionalData: () => string;
  importSystemData: (data: Partial<AppState>) => void;
  resetDemoData: () => void;
  /** Thin wrapper around the admin-users edge function; toasts and refreshes. Resolves to an error message, or null on success. */
  adminUsers: (action: string, body: Record<string, unknown>) => Promise<string | null>;
  /** Sets a student's programmes and diffs cohort_students to match the given cohorts. */
  assignStudent: (id: string, programIds: string[], cohortIds: string[]) => Promise<string | null>;
  setRolePermission: (role: Role, permission: PermissionKey, on: boolean) => void;
  resetRolePermissions: (role: Role) => void;
}

/** Explains errors caused by the profile/programme-image migration not being applied yet. */
function migrationHint(message: string, feature: string): string {
  return /column .* does not exist|schema cache/i.test(message)
    ? `${feature} are not set up yet. Ask an administrator to apply the latest database migration.`
    : message;
}

const AppContext = createContext<AppContextValue | null>(null);

function normalize(raw: Partial<AppState> | null): AppState {
  return {
    ...initialState,
    ...(raw ?? {}),
    settings: { ...defaultSettings, ...(raw?.settings ?? {}) },
    websiteSettings: mergeWebsiteSettings(defaultWebsiteSettings, raw?.websiteSettings),
    themeSettings: mergeThemeSettings(defaultThemeSettings, raw?.themeSettings),
  };
}

function loadCache(): AppState {
  // Never restore profiles, grants, fees or certificates from browser storage.
  try {
    [CACHE_KEY, "aoh-portal-cache-v5", "aoh-portal-cache-v4", SESSION_KEY].forEach((key) => localStorage.removeItem(key));
  } catch { /* storage may be blocked */ }
  return initialState;
}

/** Fire-and-forget write-through helper: local state stays optimistic, DB errors surface as toasts. */
function push(label: string, task: PromiseLike<unknown>) {
  void Promise.resolve(task)
    .then((res) => {
      const error = (res as { error?: { message: string } | null } | null)?.error;
      if (error) toast.error(`${label}: ${error.message}`);
    })
    .catch((err: unknown) =>
      toast.error(`${label}: ${err instanceof Error ? err.message : String(err)}`),
    );
}

export const formatCurrency = (amount: number, currency = "$") =>
  `${currency}${(Number.isFinite(amount) ? amount : 0).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;

export const letterGrade = (marks: number | null) => {
  if (marks === null || Number.isNaN(marks)) return "—";
  if (marks >= 80) return "A";
  if (marks >= 70) return "B";
  if (marks >= 60) return "C";
  if (marks >= 50) return "D";
  return "F";
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadCache);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const identityRef = useRef<string | null>(null);
  const refreshVersion = useRef(0);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Latest state for refresh(), which keeps slices the visitor cannot read.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    const identity = identityRef.current;
    try {
      const { state: next, failed } = await fetchState(stateRef.current);
      if (version !== refreshVersion.current || identity !== identityRef.current) return;
      stateRef.current = next;
      setState(next);
      setLive(true);
      if (failed.length) {
        // Visitors are expected to lack access to private tables; only log it.
        console.warn(`Some portal data could not be read: ${failed.join(", ")}`);
      }
    } catch (err) {
      if (version !== refreshVersion.current || identity !== identityRef.current) return;
      setLive(false);
      toast.error(`Live data unavailable: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    let pending = false;
    const drain = async () => {
      if (cancelled) return;
      if (running) { pending = true; return; }
      running = true;
      do {
        pending = false;
        await refresh();
      } while (pending && !cancelled);
      running = false;
      if (!cancelled) setLoading(false);
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void drain(), 250);
    };
    setLoading(true);
    void drain();
    const channel = supabase.channel(`portal-live-${sessionUserId ?? "public"}`);
    const tables = sessionUserId ? LIVE_TABLES : ["programs", "program_modules", "announcements", "system_settings"];
    tables.forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, schedule);
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") schedule();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") console.warn("Realtime unavailable; refreshing on focus/reconnect.");
    });
    const onFocus = () => { if (document.visibilityState === "visible") schedule(); };
    const poll = window.setInterval(schedule, 60_000);
    window.addEventListener("online", schedule);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.clearInterval(poll);
      window.removeEventListener("online", schedule);
      document.removeEventListener("visibilitychange", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [authReady, sessionUserId, refresh, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    let gotEvent = false;
    const acceptIdentity = (nextId: string | null) => {
      if (cancelled) return;
      if (identityRef.current !== nextId) {
        identityRef.current = nextId;
        refreshVersion.current += 1;
        stateRef.current = initialState;
        setState(initialState);
        setLoading(true);
        setLive(false);
      }
      setSessionUserId(nextId);
      setAuthReady(true);
    };
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      gotEvent = true;
      acceptIdentity(session?.user.id ?? null);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (gotEvent || cancelled) return;
      if (error) console.warn("Session unavailable", error.message);
      acceptIdentity(data.session?.user.id ?? null);
    }).catch(() => { if (!gotEvent) acceptIdentity(null); });
    return () => { cancelled = true; data.subscription.unsubscribe(); };
  }, []);

  const value = useMemo<AppContextValue>(() => {
    const currentUser = state.users.find((u) => u.id === sessionUserId) ?? null;

    const publishWebsiteSettings = async (websiteSettings: WebsiteSettings) => {
      // Save only this column so parallel system/appearance saves are preserved.
      const error = await persistSettingsPatch({ website_settings: websiteSettings });
      if (!error) setState((s) => ({ ...s, websiteSettings }));
      return error;
    };

    const publishThemeSettings = async (themeSettings: PortalThemeSettings) => {
      const error = await persistSettingsPatch({ theme_settings: themeSettings });
      if (!error) setState((s) => ({ ...s, themeSettings }));
      return error;
    };

    const patchUser = (id: string, patch: Row, local: (u: User) => User, label: string) => {
      setState((s) => ({ ...s, users: s.users.map((u) => (u.id === id ? local(u) : u)) }));
      push(label, supabase.from("profiles").update(patch).eq("id", id));
    };

    const value: AppContextValue = {
      state,
      currentUser,
      loading,
      live,
      reloadKey,
      refresh,
      login: async (emailOrUserId, password) => {
        if (!password) return "Enter your portal password to sign in.";
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailOrUserId.trim(),
          password,
        });
        if (error) {
          toast.error(error.message);
          return error.message;
        }
        if (!data.user) return "The server did not create a sign-in session. Please retry.";
        // Auth events establish identity and trigger a fresh, isolated read.
        toast.success("Welcome back to the portal.");
        return null;
      },
      logout: () => {
        identityRef.current = null;
        refreshVersion.current += 1;
        stateRef.current = initialState;
        setSessionUserId(null);
        setState(initialState);
        void supabase.auth.signOut().then(({ error }) => {
          if (error) toast.error(`Sign-out could not finish: ${error.message}. Retry before leaving this device.`);
          else toast.success("Signed out.");
        });
      },
      registerStudent: () => {
        // Legacy API retained for compatibility; all real applicants use Auth signup.
        toast.error("Use Apply now to create a verified account. No local-only profile was created.");
      },
      signUpStudent: async ({ password, ...payload }) => {
        const email = payload.email.trim().toLowerCase();
        const details = {
          phone: payload.phone,
          program_ids: payload.programIds,
          note: payload.note,
          education_level: payload.educationLevel ?? null,
          documents: payload.documents ?? "",
        };
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: payload.name, ...details },
          },
        });
        if (error) {
          if (/sign ?ups? (are )?(not allowed|disabled)/i.test(error.message)) {
            return { error: "Online registration is currently unavailable. Please contact the admissions office." };
          }
          return { error: error.message };
        }
        // Supabase hides existing accounts by returning a user with no identities.
        if (data.user && (data.user.identities ?? []).length === 0) {
          return {
            error: "An account with this email already exists. Sign in instead.",
          };
        }
        if (data.session && data.user) {
          // Older signup triggers only copy the name; store the remaining details now.
          const { data: savedProfile, error: profileError } = await supabase
            .from("profiles")
            .update({ name: payload.name, full_name: payload.name, ...details })
            .eq("id", data.user.id).select("id");
          if (profileError || !savedProfile?.length) {
            return { error: "Your account was created, but some application details could not be saved. Sign in and contact admissions; do not register again." };
          }
          await refresh();
          return { error: null, status: "signed_in" };
        }
        return { error: null, status: "confirm_email" };
      },
      requestPasswordReset: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        return error?.message ?? null;
      },
      changePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        return error?.message ?? null;
      },
      updateProfile: async (id, patch) => {
        const row: Row = {};
        if (patch.name !== undefined) {
          row.name = patch.name;
          row.full_name = patch.name;
        }
        if (patch.phone !== undefined) row.phone = patch.phone;
        if (patch.title !== undefined) row.title = patch.title || null;
        if (patch.bio !== undefined) row.bio = patch.bio || null;
        if (patch.address !== undefined) row.address = patch.address || null;
        if (patch.dateOfBirth !== undefined) row.date_of_birth = patch.dateOfBirth || null;
        if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
        const { data, error } = await supabase.from("profiles").update(row).eq("id", id).select("id");
        if (error) {
          return migrationHint(error.message, "Profile fields");
        }
        if (!data?.length) return "You do not have permission to edit this profile. Sign in again and retry.";
        const local: Partial<User> = {
          ...(patch.name !== undefined && { name: patch.name }),
          ...(patch.phone !== undefined && { phone: patch.phone }),
          ...(patch.title !== undefined && { title: patch.title || undefined }),
          ...(patch.bio !== undefined && { bio: patch.bio || undefined }),
          ...(patch.address !== undefined && { address: patch.address || undefined }),
          ...(patch.dateOfBirth !== undefined && { dateOfBirth: patch.dateOfBirth || undefined }),
          ...(patch.avatarUrl !== undefined && { avatarUrl: patch.avatarUrl || undefined }),
        };
        setState((s) => ({ ...s, users: s.users.map((u) => (u.id === id ? { ...u, ...local } : u)) }));
        return null;
      },
      setProgramImage: async (id, imageUrl) => {
        const { data, error } = await supabase
          .from("programs")
          .update({ image_url: imageUrl })
          .eq("id", id)
          .select("id");
        if (error) {
          return migrationHint(error.message, "Programme images");
        }
        if (!data?.length) return "You do not have permission to edit this programme.";
        setState((s) => ({
          ...s,
          programs: s.programs.map((p) => (p.id === id ? { ...p, imageUrl: imageUrl ?? undefined } : p)),
        }));
        return null;
      },
      seedCatalogue: async () => {
        const { data: liveRows, error: readError } = await supabase.from("programs").select("title");
        if (readError) return migrationHint(readError.message, "Programme catalogue");
        const liveTitles = new Set(
          ((liveRows ?? []) as Row[]).map((row) => String(row.title ?? "").trim().toLowerCase()),
        );
        const missing = CATALOG_2026.filter((p) => !liveTitles.has(p.title.trim().toLowerCase()));
        if (!missing.length) {
          toast.success("The live catalogue already has every 2026/2027 course.");
          return null;
        }
        const rows = missing.map((p) => ({
          id: p.id,
          title: p.title,
          category: p.category,
          duration_weeks: p.durationWeeks,
          tuition: p.tuition,
          certification: p.certification,
          description: p.description,
          entry_requirements: p.entryRequirements,
          delivery_modes: p.deliveryModes,
          study_plan: "Fully online, partially online or on-site",
        }));
        const { error } = await supabase.from("programs").insert(rows);
        if (error) {
          // Older table shapes have no delivery_modes / study_plan column yet.
          const baseRows = rows.map(({ delivery_modes: _modes, study_plan: _plan, ...rest }) => rest);
          const { error: retryError } = await supabase.from("programs").insert(baseRows);
          if (retryError) return migrationHint(retryError.message, "Programme catalogue");
          await refresh();
          toast.success(`Imported ${baseRows.length} courses into the live catalogue.`);
          return null;
        }
        await refresh();
        toast.success(`Imported ${rows.length} courses into the live catalogue.`);
        return null;
      },
      approveApplicant: async (id) => {
        try {
          const { data, error } = await supabase.from('profiles')
            .update({ status: 'Active', note: 'Approved by registrar' })
            .eq('id', id).eq('status', 'Pending Approval').select('id,status').single();
          if (error) return `Approval failed: ${error.message}`;
          if (!data || data.status !== 'Active') return 'Approval was not saved. Refresh the account and retry.';
          setState((s) => ({ ...s, users: s.users.map((u) => u.id === id ? { ...u, status: 'Active', note: 'Approved by registrar' } : u) }));
          return null;
        } catch (err) { return err instanceof Error ? err.message : 'Approval could not be saved. Please retry.'; }
      },
      rejectApplicant: (id) =>
        patchUser(
          id,
          { status: "Suspended", note: "Application declined" },
          (u) => ({ ...u, status: "Suspended", note: "Application declined" }),
          "Application",
        ),
      toggleStudentStatus: (id) => {
        const user = state.users.find((u) => u.id === id);
        const status: User["status"] = user?.status === "Active" ? "Suspended" : "Active";
        patchUser(id, { status }, (u) => ({ ...u, status }), "Student status");
      },
      addProgram: (payload) => {
        const { modulesRaw, ...rest } = payload;
        const id = uid();
        const modules = modulesRaw
          .split(String.fromCharCode(10))
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [title, weeks, ...summary] = line.split("|").map((part) => part.trim());
            return {
              id: uid(),
              title: title || "Module",
              weeks: Number.parseInt(weeks ?? "2", 10) || 2,
              summary: summary.join(" | "),
            };
          });
        const program: Program = { ...rest, id, modules };
        setState((s) => ({ ...s, programs: [...s.programs, program] }));
        push(
          "Programme",
          supabase.from("programs").insert({
            id,
            title: program.title,
            category: program.category,
            duration_weeks: program.durationWeeks,
            tuition: program.tuition,
            certification: program.certification,
            description: program.description,
            entry_requirements: program.entryRequirements,
          }),
        );
        if (modules.length) {
          push(
            "Programme modules",
            supabase.from("program_modules").insert(
              modules.map((m, index) => ({
                id: m.id,
                program_id: id,
                title: m.title,
                weeks: m.weeks,
                summary: m.summary,
                position: index,
              })),
            ),
          );
        }
      },
      addCohort: (payload) => {
        const id = uid();
        const cohort: Cohort = { ...payload, id };
        setState((s) => ({ ...s, cohorts: [...s.cohorts, cohort] }));
        push(
          "Cohort",
          supabase.from("cohorts").insert({
            id,
            name: cohort.name,
            program_id: cohort.programId,
            teacher_id: cohort.teacherId || null,
            start_date: cohort.startDate,
            end_date: cohort.endDate,
            room: cohort.room,
          }),
        );
        if (cohort.studentIds.length) {
          push(
            "Enrolment",
            supabase.from("cohort_students").insert(
              cohort.studentIds.map((studentId) => ({ cohort_id: id, student_id: studentId })),
            ),
          );
        }
      },
      markAttendance: (cohortId, date, statuses) => {
        const rows = Object.entries(statuses).map(([studentId, status]) => ({
          id: uid(),
          cohortId,
          studentId,
          date,
          status,
        }));
        const keptStudentIds = Object.keys(statuses);
        setState((s) => ({
          ...s,
          attendance: [
            ...s.attendance.filter((a) => !(a.cohortId === cohortId && a.date === date)),
            ...rows,
          ],
        }));
        push(
          "Attendance",
          (async () => {
            // Upsert so existing rows keep their id (cohort_id, student_id, attendance_date is unique);
            // only students no longer in `statuses` get their row removed.
            if (rows.length) {
              const upserted = await supabase.from("attendance").upsert(
                rows.map((r) => ({
                  cohort_id: cohortId,
                  student_id: r.studentId,
                  attendance_date: date,
                  status: r.status,
                })),
                { onConflict: "cohort_id,student_id,attendance_date" },
              );
              if (upserted.error) return upserted;
            }
            let clear = supabase.from("attendance").delete().eq("cohort_id", cohortId).eq("attendance_date", date);
            if (keptStudentIds.length) clear = clear.not("student_id", "in", `(${keptStudentIds.join(",")})`);
            return await clear;
          })(),
        );
      },
      addAssignment: async (payload) => {
        const id = uid();
        const { data, error } = await supabase.from("assignments").insert({
          id, cohort_id: payload.cohortId, title: payload.title,
          due_date: payload.dueDate, max_marks: payload.maxMarks,
          description: payload.description, time_limit_minutes: payload.timeLimitMinutes ?? null,
        }).select("id").single();
        if (error || !data) throw new Error(error?.message ?? "Assignment was not saved.");
        await refresh();
      },
      gradeSubmission: async (assignmentId, studentId, marks, feedback) => {
        const assignment = state.assignments.find((a) => a.id === assignmentId);
        if (!assignment || !Number.isFinite(marks) || marks < 0 || marks > assignment.maxMarks) {
          throw new Error("Enter marks within the assignment's allowed range.");
        }
        const { data, error } = await supabase.from("submissions")
          .update({ marks, feedback, status: "Graded" })
          .eq("assignment_id", assignmentId).eq("student_id", studentId).select("id").single();
        if (error || !data) throw new Error(error?.message ?? "No submitted work was found to grade.");
        await refresh();
      },
      submitSubmission: async (assignmentId, studentId, text, attachment) => {
        if (!sessionUserId || studentId !== sessionUserId) throw new Error("Sign in with your own account to submit.");
        const assignment = state.assignments.find((a) => a.id === assignmentId);
        if (assignment?.timeLimitMinutes) throw new Error("Open the timed classwork dialog to start or resume this assignment.");
        const response = [text.trim(), attachment.trim() ? `Work reference: ${attachment.trim()}` : ""].filter(Boolean).join("\n\n");
        if (!response) throw new Error("Add your answer before submitting.");
        await academicApi.startClasswork(assignmentId);
        await academicApi.submitClasswork(assignmentId, response, null);
        await refresh();
      },
      addFeeTransaction: (payload) => {
        const id = uid();
        setState((s) => ({ ...s, fees: [...s.fees, { ...payload, id }] }));
        push(
          "Payment",
          supabase.from("fee_transactions").insert({
            id,
            student_id: payload.studentId,
            category: payload.category,
            amount: payload.amount,
            transaction_date: payload.date,
            method: payload.method,
            reference: payload.reference,
          }),
        );
      },
      issueCertificate: async (studentId, programId, honors, certificateType, completionDate) => {
        // The database assigns the serial and enforces completion/authorization, so the
        // browser never invents an identifier. A failure is surfaced, never faked locally.
        const certificate = await certificatesApi.issue(studentId, programId, honors, certificateType, completionDate);
        setState((s) => ({
          ...s,
          certificates: s.certificates.some((c) => c.id === certificate.id)
            ? s.certificates.map((c) => (c.id === certificate.id ? certificate : c))
            : [...s.certificates, certificate],
        }));
        return certificate;
      },
      revokeCertificate: async (certificateId, reason) => {
        const certificate = await certificatesApi.revoke(certificateId, reason);
        setState((s) => ({
          ...s,
          certificates: s.certificates.map((c) => (c.id === certificate.id ? certificate : c)),
        }));
        return certificate;
      },
      addAnnouncement: (payload) => {
        const id = uid();
        const date = today();
        setState((s) => ({ ...s, announcements: [{ ...payload, id, date }, ...s.announcements] }));
        push(
          "Announcement",
          supabase.from("announcements").insert({
            id,
            title: payload.title,
            body: payload.body,
            category: payload.category,
            published_date: date,
            author_id: currentUser?.id ?? null,
          }),
        );
      },
      updateSystemSettings: async (patch) => {
        const settings = { ...stateRef.current.settings, ...patch };
        const row = settingsRow(settings, state.websiteSettings, state.themeSettings);
        // Website and appearance are published independently; never overwrite them here.
        const { website_settings, theme_settings, ...systemPatch } = row;
        const error = await persistSettingsPatch(systemPatch);
        if (error) toast.error(`Settings: ${error}`);
        else setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
        return error;
      },
      publishWebsiteSettings,
      publishThemeSettings,
      clearTransactionalData: () => "Bulk deletion is disabled to protect real records. No data was deleted.",
      importSystemData: () => {
        throw new Error("Browser backup imports are disabled for live records. Use a reviewed, backed-up server restoration instead.");
      },
      resetDemoData: () => {
        setReloadKey((k) => k + 1);
        toast.info("Refreshing portal data from the live database…");
      },
      adminUsers: async (action, body) => {
        const { data, error } = await supabase.functions.invoke("admin-users", {
          body: { action, ...body },
        });
        const payload = data as { error?: string; user_id?: string } | null;
        if (error || payload?.error) {
          const message = payload?.error ?? error?.message ?? "Request failed";
          toast.error(message);
          return message;
        }
        const labels: Record<string, string> = {
          create: "Staff account created.",
          update: "Account updated.",
          reset_password: "Password reset started.",
          delete: "Account deleted.",
        };
        toast.success(labels[action] ?? "Done.");
        await refresh();
        return null;
      },
      assignStudent: async (id, programIds, cohortIds) => {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ program_ids: programIds })
          .eq("id", id);
        if (profileError) {
          toast.error(`Assign programmes: ${profileError.message}`);
          return profileError.message;
        }
        const current = state.cohorts.filter((c) => c.studentIds.includes(id)).map((c) => c.id);
        const toAdd = cohortIds.filter((c) => !current.includes(c));
        const toRemove = current.filter((c) => !cohortIds.includes(c));
        if (toAdd.length) {
          const { error } = await supabase
            .from("cohort_students")
            .insert(toAdd.map((cohort_id) => ({ cohort_id, student_id: id })));
          if (error) {
            toast.error(`Assign cohorts: ${error.message}`);
            return error.message;
          }
        }
        if (toRemove.length) {
          const { error } = await supabase
            .from("cohort_students")
            .delete()
            .eq("student_id", id)
            .in("cohort_id", toRemove);
          if (error) {
            toast.error(`Remove cohorts: ${error.message}`);
            return error.message;
          }
        }
        setState((s) => ({
          ...s,
          users: s.users.map((u) => (u.id === id ? { ...u, programIds, cohortIds } : u)),
          cohorts: s.cohorts.map((c) => ({
            ...c,
            studentIds: cohortIds.includes(c.id)
              ? Array.from(new Set([...c.studentIds, id]))
              : c.studentIds.filter((sid) => sid !== id),
          })),
        }));
        toast.success("Assignment saved.");
        return null;
      },
      setRolePermission: (role, permission, on) => {
        if (role === "Super Admin") return;
        const key = role as Exclude<Role, "Super Admin">;
        const prevList = state.rolePermissions[role] ?? DEFAULT_ROLE_PERMISSIONS[key] ?? [];
        const nextList = on
          ? Array.from(new Set([...prevList, permission]))
          : prevList.filter((p) => p !== permission);
        setState((s) => ({ ...s, rolePermissions: { ...s.rolePermissions, [role]: nextList } }));
        const task = on
          ? supabase.from("role_permissions").upsert({ role, permission }, { onConflict: "role,permission" })
          : supabase.from("role_permissions").delete().eq("role", role).eq("permission", permission);
        void Promise.resolve(task).then((res) => {
          const resError = (res as { error?: { message: string } | null } | null)?.error;
          if (resError) {
            setState((s) => ({ ...s, rolePermissions: { ...s.rolePermissions, [role]: prevList } }));
            toast.error(`Permission update failed: ${resError.message}`);
          }
        });
      },
      resetRolePermissions: (role) => {
        if (role === "Super Admin") return;
        const key = role as Exclude<Role, "Super Admin">;
        const defaults = DEFAULT_ROLE_PERMISSIONS[key] ?? [];
        const prevList = state.rolePermissions[role] ?? [];
        setState((s) => ({ ...s, rolePermissions: { ...s.rolePermissions, [role]: defaults } }));
        void (async () => {
          const del = await supabase.from("role_permissions").delete().eq("role", role);
          if (del.error) {
            toast.error(`Reset failed: ${del.error.message}`);
            setState((s) => ({ ...s, rolePermissions: { ...s.rolePermissions, [role]: prevList } }));
            return;
          }
          if (defaults.length) {
            const ins = await supabase
              .from("role_permissions")
              .insert(defaults.map((permission) => ({ role, permission })));
            if (ins.error) {
              toast.error(`Reset failed: ${ins.error.message}`);
              return;
            }
          }
          toast.success(`${role} reset to defaults.`);
        })();
      },
    };
    return value;
  }, [state, sessionUserId, loading, live, refresh, reloadKey]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
