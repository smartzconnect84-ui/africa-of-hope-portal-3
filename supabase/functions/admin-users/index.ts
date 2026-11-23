import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const STAFF_ROLES = ["Super Admin", "School Admin", "Teacher", "Registrar", "Admission Officer", "Finance Officer", "Public Relations Officer", "Data Entry Officer", "Executive Assistant", "Research Officer", "Customer Care Officer", "Director of Education"];
const ADMIN_ROLES = ["Super Admin", "School Admin"];
const STATUSES = ["Active", "Suspended", "Pending Approval", "Rejected"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DUP = /already|exists|registered|taken|duplicate|unique/i;
const DUP_MSG = "An account with this email already exists. One email can only be used for one account (Student, Admin or Staff).";
const randomPassword = () => crypto.randomUUID().replace(/-/g, "") + "Aa1!";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST", code: "method_not_allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !service) {
      console.error("admin-users: missing env");
      return json({ error: "Account service is not configured on the server.", code: "not_configured" }, 503);
    }
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Not authenticated. Sign in again, then retry.", code: "no_token" }, 401);
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await caller.auth.getUser();
    const user = authData?.user;
    if (authError || !user) return json({ error: "Not authenticated. Sign in again, then retry.", code: "bad_token" }, 401);
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: actor } = await admin.from("profiles").select("role, status").eq("id", user.id).single();
    if (!actor) return json({ error: "Your staff profile was not found. Ask a Super Admin to check the profiles table.", code: "no_actor_profile" }, 403);
    if (actor.status !== "Active") return json({ error: "Your account is not active, so it cannot manage accounts.", code: "actor_inactive" }, 403);
    const superAdmin = actor.role === "Super Admin";

    const hasPermission = async (perm: string): Promise<boolean> => {
      if (superAdmin) return true;
      try {
        const { data, error } = await caller.rpc("has_permission", { perm });
        if (!error && data === true) return true;
      } catch (_e) { /* fall through to direct lookup */ }
      try {
        const { data } = await admin.from("role_permissions").select("permission").eq("role", actor.role).eq("permission", perm).limit(1);
        if (data && data.length > 0) return true;
      } catch (_e) { /* ignore */ }
      return false;
    };

    let body: Record<string, unknown>;
    try {
      const raw = await req.text();
      if (raw.length > 16384) return json({ error: "Request too large", code: "too_large" }, 413);
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "Invalid request", code: "bad_request" }, 400);
      body = parsed;
    } catch { return json({ error: "Invalid JSON", code: "bad_json" }, 400); }
    const action = String(body.action ?? "");

    if (action === "create") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const name = String(body.name ?? body.full_name ?? "").trim();
      const phone = String(body.phone ?? "").trim();
      const title = body.title ? String(body.title).trim() : null;
      const role = String(body.role ?? "Teacher");
      const password = body.password ? String(body.password) : "";
      const isStudent = role === "Student";

      if (!isStudent && !(await hasPermission("staff.manage"))) {
        return json({ error: "You do not have permission to add staff. Your role needs the Manage staff (staff.manage) permission.", code: "forbidden" }, 403);
      }
      if (isStudent && !(await hasPermission("students.manage")) && !(await hasPermission("staff.manage"))) {
        return json({ error: "You do not have permission to add students. Your role needs the Manage students (students.manage) permission.", code: "forbidden" }, 403);
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || name.length > 200) return json({ error: "A valid name and email are required", code: "bad_input" }, 400);
      if (!isStudent && !STAFF_ROLES.includes(role)) return json({ error: "Unknown role", code: "bad_role" }, 400);
      if (ADMIN_ROLES.includes(role) && !superAdmin) return json({ error: "Only a Super Admin may create administrator accounts", code: "forbidden" }, 403);
      if (password && password.length < 8) return json({ error: "The password must be at least 8 characters", code: "bad_password" }, 400);
      const programIds = Array.isArray(body.program_ids) ? (body.program_ids as unknown[]).map(String).filter((v) => UUID.test(v)) : [];

      let userId = "";
      let generatedPassword: string | undefined;
      const meta = { full_name: name, phone };
      const createWith = (pw: string) => admin.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: meta });
      if (password) {
        const created = await createWith(password);
        if (created.error || !created.data?.user) {
          const raw = created.error?.message ?? "Could not create the account";
          console.error("admin-users: createUser failed", { email, msg: raw });
          return json({ error: DUP.test(raw) ? DUP_MSG : raw, code: DUP.test(raw) ? "duplicate" : "auth_create_failed" }, 400);
        }
        userId = created.data.user.id;
      } else {
        const invited = await admin.auth.admin.inviteUserByEmail(email, { data: meta });
        if (!invited.error && invited.data?.user) {
          userId = invited.data.user.id;
        } else {
          const raw = invited.error?.message ?? "Invite failed";
          if (DUP.test(raw)) return json({ error: DUP_MSG, code: "duplicate" }, 400);
          console.error("admin-users: invite failed, using temporary password", { email, msg: raw });
          generatedPassword = randomPassword();
          const created = await createWith(generatedPassword);
          if (created.error || !created.data?.user) {
            const raw2 = created.error?.message ?? "Could not create the account";
            return json({ error: DUP.test(raw2) ? DUP_MSG : `Could not create the account (${raw2}).`, code: DUP.test(raw2) ? "duplicate" : "auth_create_failed" }, 400);
          }
          userId = created.data.user.id;
        }
      }

      // The signup trigger creates a Pending profile; activate it with the real role.
      const basePatch: Record<string, unknown> = { full_name: name, name, email, role, status: "Active" };
      if (phone) basePatch.phone = phone;
      if (title) basePatch.title = title;
      if (programIds.length) basePatch.program_ids = programIds;
      const attempts: Record<string, unknown>[] = [
        basePatch,
        (() => { const p = { ...basePatch }; delete p.title; return p; })(),
        { full_name: name, email, role, status: "Active" },
      ];
      let saved: { id: string } | null = null;
      let profileError: { message: string } | null = null;
      for (const patch of attempts) {
        const res = await admin.from("profiles").update(patch).eq("id", userId).select("id").maybeSingle();
        if (!res.error && res.data) { saved = res.data as { id: string }; profileError = null; break; }
        if (!res.error && !res.data) {
          // Trigger did not create a profile row; insert one.
          const ins = await admin.from("profiles").insert({ id: userId, ...patch }).select("id").maybeSingle();
          if (!ins.error && ins.data) { saved = ins.data as { id: string }; profileError = null; break; }
          profileError = ins.error as { message: string } | null;
        } else {
          profileError = res.error as { message: string } | null;
        }
        if (!/column .* does not exist|schema cache/i.test(profileError?.message ?? "")) break;
      }
      if (!saved) {
        const msg = profileError?.message ?? "unknown";
        console.error("admin-users: profile activation failed", { userId, msg });
        return json({ user_id: userId, ...(generatedPassword ? { temporary_password: generatedPassword } : {}), error: `Sign-in account created, but the profile was not activated (${msg}). Open the account and set its role.`, code: "profile_failed" }, 409);
      }
      const { error: metaError } = await admin.auth.admin.updateUserById(userId, { app_metadata: { role, status: "Active" } });
      if (metaError) {
        console.error("admin-users: metadata sync failed", { userId, msg: metaError.message });
        return json({ user_id: userId, ...(generatedPassword ? { temporary_password: generatedPassword } : {}), error: "Profile saved, but sign-in metadata could not be synchronized. Review the account.", code: "metadata_failed" }, 409);
      }
      return json({ ok: true, user_id: userId, role, ...(generatedPassword ? { temporary_password: generatedPassword } : {}) });
    }

    if (!["update", "reset_password", "delete"].includes(action)) return json({ error: "Unknown action", code: "bad_action" }, 400);
    const canStaff = await hasPermission("staff.manage");
    const canStudents = await hasPermission("students.manage");
    if (!canStaff && !canStudents) return json({ error: "You do not have permission for this account action", code: "forbidden" }, 403);
    const id = String(body.user_id ?? "");
    if (!UUID.test(id)) return json({ error: "A valid user_id is required", code: "bad_input" }, 400);
    const { data: target } = await admin.from("profiles").select("email, role, status").eq("id", id).single();
    if (!target) return json({ error: "Account not found", code: "not_found" }, 404);
    if (ADMIN_ROLES.includes(target.role) && !superAdmin) return json({ error: "Only a Super Admin may manage another administrator's access", code: "forbidden" }, 403);
    if (!canStaff && target.role !== "Student") return json({ error: "You may only manage student accounts", code: "forbidden" }, 403);

    if (action === "update") {
      if (id === user.id) return json({ error: "You cannot change your own role or status", code: "bad_input" }, 400);
      const role = body.role === undefined ? target.role : String(body.role);
      const status = body.status === undefined ? target.status : String(body.status);
      if (!([...STAFF_ROLES, "Student"].includes(role)) || !STATUSES.includes(status)) return json({ error: "Unknown role or status", code: "bad_input" }, 400);
      if (!canStaff && role !== "Student") return json({ error: "You may only manage student accounts", code: "forbidden" }, 403);
      if (ADMIN_ROLES.includes(role) && !superAdmin) return json({ error: "Only a Super Admin may grant administrator access", code: "forbidden" }, 403);
      const { data: existing, error: existingError } = await admin.auth.admin.getUserById(id);
      if (existingError || !existing.user) return json({ error: "Auth account not found", code: "not_found" }, 404);
      const oldMetadata = existing.user.app_metadata ?? {};
      const { error: updateAuthError } = await admin.auth.admin.updateUserById(id, {
        app_metadata: { ...oldMetadata, role, status }, ban_duration: status === "Active" ? "none" : "876000h",
      });
      if (updateAuthError) return json({ error: updateAuthError.message, code: "auth_update_failed" }, 400);
      const { data: saved, error: profileError } = await admin.from("profiles").update({ role, status }).eq("id", id).select("id").single();
      if (profileError || !saved) {
        const { error: rollbackError } = await admin.auth.admin.updateUserById(id, {
          app_metadata: oldMetadata, ban_duration: target.status === "Active" ? "none" : "876000h",
        });
        return json({ error: rollbackError ? "Profile save and Auth rollback failed. Review this account immediately." : "Profile save failed; the Auth change was rolled back. Reload and try again.", code: "profile_failed" }, 409);
      }
      return json({ ok: true });
    }
    if (action === "reset_password") {
      const mode = String(body.mode ?? "email");
      if (!["email", "temporary"].includes(mode)) return json({ error: "Unknown password reset mode", code: "bad_input" }, 400);
      if (mode === "temporary") {
        const password = body.password ? String(body.password) : randomPassword();
        if (password.length < 8) return json({ error: "The password must be at least 8 characters", code: "bad_password" }, 400);
        const { error } = await admin.auth.admin.updateUserById(id, { password });
        if (error) return json({ error: error.message, code: "auth_update_failed" }, 400);
        return json({ ok: true, temporary_password: body.password ? undefined : password });
      }
      if (!target.email) return json({ error: "No account email is recorded", code: "bad_input" }, 400);
      const { error } = await caller.auth.resetPasswordForEmail(target.email);
      return error ? json({ error: error.message, code: "reset_failed" }, 400) : json({ ok: true });
    }
    return json({ error: "Permanent deletion is disabled to preserve school records. Suspend this account instead.", code: "delete_disabled" }, 409);
  } catch (err) {
    console.error("admin-users failed", err);
    return json({ error: "The account action failed. Reload and review the account before retrying.", code: "internal" }, 500);
  }
});
