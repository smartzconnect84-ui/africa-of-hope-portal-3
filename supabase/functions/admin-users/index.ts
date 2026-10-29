import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const STAFF_ROLES = ["Super Admin", "School Admin", "Teacher", "Registrar", "Admission Officer", "Finance Officer"];
const ADMIN_ROLES = ["Super Admin", "School Admin"];
const STATUSES = ["Active", "Suspended", "Pending Approval", "Rejected"];
const randomPassword = () => crypto.randomUUID().replace(/-/g, "") + "Aa1!";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !service) return json({ error: "Account service is not configured" }, 503);
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Not authenticated" }, 401);
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await caller.auth.getUser();
    const user = authData?.user;
    if (authError || !user) return json({ error: "Not authenticated" }, 401);
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: actor, error: actorError } = await admin.from("profiles").select("role, status").eq("id", user.id).single();
    if (actorError || actor?.status !== "Active") return json({ error: "An active staff account is required" }, 403);
    const superAdmin = actor.role === "Super Admin";
    const hasPermission = async (perm: string): Promise<boolean> => {
      const { data, error } = await caller.rpc("has_permission", { perm });
      return !error && data === true;
    };
    let body: Record<string, unknown>;
    try {
      const raw = await req.text();
      if (raw.length > 16384) return json({ error: "Request too large" }, 413);
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "Invalid request" }, 400);
      body = parsed;
    } catch { return json({ error: "Invalid JSON" }, 400); }
    const action = String(body.action ?? "");

    if (action === "create") {
      if (!(await hasPermission("staff.manage"))) return json({ error: "You do not have permission to add staff" }, 403);
      const email = String(body.email ?? "").trim().toLowerCase();
      const name = String(body.name ?? "").trim();
      const phone = String(body.phone ?? "").trim();
      const title = body.title ? String(body.title).trim() : null;
      const role = String(body.role ?? "Teacher");
      const password = body.password ? String(body.password) : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || name.length > 200) return json({ error: "A valid name and email are required" }, 400);
      if (!STAFF_ROLES.includes(role)) return json({ error: "Unknown staff role" }, 400);
      if (ADMIN_ROLES.includes(role) && !superAdmin) return json({ error: "Only a Super Admin may create administrator accounts" }, 403);
      if (password && password.length < 8) return json({ error: "The password must be at least 8 characters" }, 400);
      const created = password
        ? await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, phone } })
        : await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: name, phone } });
      if (created.error || !created.data?.user) return json({ error: created.error?.message ?? "Could not create the account" }, 400);
      const userId = created.data.user.id;
      const { data: saved, error: profileError } = await admin.from("profiles")
        .update({ name, full_name: name, email, phone, role, status: "Active", title }).eq("id", userId).select("id").single();
      if (profileError || !saved) {
        // Never delete an Auth account to compensate for a failed profile write.
        return json({ user_id: userId, error: "Auth account created, but the school profile was not activated. Review this account before retrying." }, 409);
      }
      const { error: metaError } = await admin.auth.admin.updateUserById(userId, { app_metadata: { role, status: "Active" } });
      if (metaError) return json({ user_id: userId, error: "School profile saved, but Auth metadata could not be synchronized. Review the account before retrying." }, 409);
      return json({ user_id: userId });
    }

    if (!["update", "reset_password", "delete"].includes(action)) return json({ error: "Unknown action" }, 400);
    const canStaff = await hasPermission("staff.manage");
    const canStudents = action === "reset_password" && await hasPermission("students.manage");
    if (!canStaff && !canStudents) return json({ error: "You do not have permission for this account action" }, 403);
    const id = String(body.user_id ?? "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return json({ error: "A valid user_id is required" }, 400);
    const { data: target, error: targetError } = await admin.from("profiles").select("email, role, status").eq("id", id).single();
    if (targetError || !target) return json({ error: "Account not found" }, 404);
    if (ADMIN_ROLES.includes(target.role) && !superAdmin) return json({ error: "Only a Super Admin may manage another administrator's access" }, 403);
    if (!canStaff && target.role !== "Student") return json({ error: "You may only reset student passwords" }, 403);

    if (action === "update") {
      if (id === user.id) return json({ error: "You cannot change your own role or status" }, 400);
      const role = body.role === undefined ? target.role : String(body.role);
      const status = body.status === undefined ? target.status : String(body.status);
      if (![...STAFF_ROLES, "Student"].includes(role) || !STATUSES.includes(status)) return json({ error: "Unknown role or status" }, 400);
      if (ADMIN_ROLES.includes(role) && !superAdmin) return json({ error: "Only a Super Admin may grant administrator access" }, 403);
      const { data: existing, error: existingError } = await admin.auth.admin.getUserById(id);
      if (existingError || !existing.user) return json({ error: "Auth account not found" }, 404);
      const oldMetadata = existing.user.app_metadata ?? {};
      const { error: updateAuthError } = await admin.auth.admin.updateUserById(id, {
        app_metadata: { ...oldMetadata, role, status }, ban_duration: status === "Active" ? "none" : "876000h",
      });
      if (updateAuthError) return json({ error: updateAuthError.message }, 400);
      const { data: saved, error: profileError } = await admin.from("profiles").update({ role, status }).eq("id", id).select("id").single();
      if (profileError || !saved) {
        const { error: rollbackError } = await admin.auth.admin.updateUserById(id, {
          app_metadata: oldMetadata, ban_duration: target.status === "Active" ? "none" : "876000h",
        });
        return json({ error: rollbackError
          ? "Profile save and Auth rollback failed. Review this account in Supabase immediately."
          : "Profile save failed; the Auth change was rolled back. Reload and try again." }, 409);
      }
      return json({ ok: true });
    }
    if (action === "reset_password") {
      const mode = String(body.mode ?? "email");
      if (!["email", "temporary"].includes(mode)) return json({ error: "Unknown password reset mode" }, 400);
      if (mode === "temporary") {
        const password = body.password ? String(body.password) : randomPassword();
        if (password.length < 8) return json({ error: "The password must be at least 8 characters" }, 400);
        const { error } = await admin.auth.admin.updateUserById(id, { password });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, temporary_password: body.password ? undefined : password });
      }
      if (!target.email) return json({ error: "No account email is recorded" }, 400);
      const { error } = await caller.auth.resetPasswordForEmail(target.email);
      return error ? json({ error: error.message }, 400) : json({ ok: true });
    }
    if (id === user.id) return json({ error: "You cannot delete your own account" }, 400);
    const { error: deleteError } = await admin.auth.admin.deleteUser(id);
    if (deleteError) return json({ error: deleteError.message }, 400);
    return json({ ok: true });
  } catch (err) {
    console.error("admin-users failed", err);
    return json({ error: "The account action failed. Reload and review the account before retrying." }, 500);
  }
});
