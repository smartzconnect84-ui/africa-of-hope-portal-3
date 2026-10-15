import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const STAFF_ROLES = ["Super Admin", "School Admin", "Teacher", "Registrar", "Finance Officer"];

/** True for Postgres error 23503 (foreign_key_violation), however it is wrapped by the client. */
function isForeignKeyViolation(message: string): boolean {
  return /23503|foreign key constraint|violates foreign key/i.test(message);
}

function randomPassword(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16) + "Aa1!";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");

    // Caller client: carries the caller's own JWT, so has_permission() reads
    // their real auth.uid() and role -- the same check the RLS policies use.
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: authData } = await caller.auth.getUser();
    const user = authData?.user;
    if (!user) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(url, service);

    async function hasPermission(perm: string): Promise<boolean> {
      const { data, error } = await caller.rpc("has_permission", { perm });
      return !error && data === true;
    }
    async function isSuperAdmin(): Promise<boolean> {
      const { data, error } = await caller.rpc("is_super_admin");
      return !error && data === true;
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    // ── create ────────────────────────────────────────────────────────
    if (action === "create") {
      if (!(await hasPermission("staff.manage"))) {
        return json({ error: "You do not have permission to add staff." }, 403);
      }

      const email = String(body.email ?? "").trim().toLowerCase();
      const name = String(body.name ?? email.split("@")[0] ?? "").trim();
      const phone = String(body.phone ?? "").trim();
      const title = body.title ? String(body.title).trim() : null;
      const role = String(body.role ?? "Teacher");
      const password = body.password ? String(body.password) : "";

      if (!email || !name) return json({ error: "Name and email are required." }, 400);
      if (!STAFF_ROLES.includes(role)) return json({ error: `Unknown role "${role}".` }, 400);
      if (role === "Super Admin" && !(await isSuperAdmin())) {
        return json({ error: "Only a Super Admin can create a Super Admin account." }, 400);
      }
      if (password && password.length < 8) {
        return json({ error: "The password must be at least 8 characters." }, 400);
      }

      let userId: string;
      if (password) {
        const { data: created, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          app_metadata: { role, status: "Active" },
          user_metadata: { full_name: name, phone },
        });
        if (error || !created?.user) return json({ error: error?.message ?? "Could not create the account." }, 400);
        userId = created.user.id;
      } else {
        // No password given: invite the person by email. The invite email
        // (sent by Supabase Auth) lets them sign in and set their own
        // password -- a working "email a set-password link" without a
        // custom email sender configured in this project.
        const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, {
          data: { full_name: name, phone },
        });
        if (error || !invited?.user) return json({ error: error?.message ?? "Could not invite the account." }, 400);
        userId = invited.user.id;
        const { error: metaError } = await admin.auth.admin.updateUserById(userId, {
          app_metadata: { role, status: "Active" },
        });
        if (metaError) {
          await admin.auth.admin.deleteUser(userId);
          return json({ error: metaError.message }, 400);
        }
      }

      const { error: profileError } = await admin
        .from("profiles")
        .update({ name, full_name: name, email, phone, role, status: "Active", title })
        .eq("id", userId);
      if (profileError) {
        await admin.auth.admin.deleteUser(userId);
        return json({ error: profileError.message }, 400);
      }

      return json({ user_id: userId });
    }

    // ── update (role / status) ───────────────────────────────────────
    if (action === "update") {
      if (!(await hasPermission("staff.manage"))) {
        return json({ error: "You do not have permission to change staff accounts." }, 403);
      }
      const id = String(body.user_id ?? "");
      if (!id) return json({ error: "user_id is required." }, 400);
      if (id === user.id) return json({ error: "You cannot change your own role or status." }, 400);

      const role = body.role !== undefined ? String(body.role) : undefined;
      const status = body.status !== undefined ? String(body.status) : undefined;
      if (role !== undefined && !STAFF_ROLES.includes(role)) {
        return json({ error: `Unknown role "${role}".` }, 400);
      }
      if (role === "Super Admin" && !(await isSuperAdmin())) {
        return json({ error: "Only a Super Admin can promote someone to Super Admin." }, 400);
      }

      const patch: Record<string, string> = {};
      if (role !== undefined) patch.role = role;
      if (status !== undefined) patch.status = status;
      if (Object.keys(patch).length === 0) return json({ error: "Nothing to update." }, 400);

      const { error: profileError } = await admin.from("profiles").update(patch).eq("id", id);
      if (profileError) return json({ error: profileError.message }, 400);

      const { data: existing } = await admin.auth.admin.getUserById(id);
      const nextAppMeta = { ...(existing?.user?.app_metadata ?? {}), ...patch };
      const authPatch: Record<string, unknown> = { app_metadata: nextAppMeta };
      if (status !== undefined) authPatch.ban_duration = status === "Suspended" ? "876000h" : "none";

      const { error: authError } = await admin.auth.admin.updateUserById(id, authPatch);
      if (authError) return json({ error: authError.message }, 400);

      return json({ ok: true });
    }

    // ── reset_password ───────────────────────────────────────────────
    if (action === "reset_password") {
      const canStaff = await hasPermission("staff.manage");
      const canStudents = !canStaff && (await hasPermission("students.manage"));
      if (!canStaff && !canStudents) {
        return json({ error: "You do not have permission to reset passwords." }, 403);
      }

      const id = String(body.user_id ?? "");
      if (!id) return json({ error: "user_id is required." }, 400);

      const { data: target, error: targetError } = await admin
        .from("profiles")
        .select("email, role")
        .eq("id", id)
        .single();
      if (targetError || !target?.email) return json({ error: "Account not found." }, 400);
      if (canStudents && target.role !== "Student") {
        return json({ error: "You can only reset passwords for students." }, 403);
      }

      const mode = String(body.mode ?? "email");
      if (mode === "temporary") {
        const temporaryPassword = body.password ? String(body.password) : randomPassword();
        if (temporaryPassword.length < 8) {
          return json({ error: "The password must be at least 8 characters." }, 400);
        }
        const { error } = await admin.auth.admin.updateUserById(id, { password: temporaryPassword });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, temporary_password: body.password ? undefined : temporaryPassword });
      }

      // mode === "email": send a real recovery email through Supabase
      // Auth's own password-reset flow (the same one the sign-in page uses).
      const anon = createClient(url, anonKey);
      const { error } = await anon.auth.resetPasswordForEmail(target.email);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ── delete ────────────────────────────────────────────────────────
    if (action === "delete") {
      if (!(await hasPermission("staff.manage"))) {
        return json({ error: "You do not have permission to delete accounts." }, 403);
      }
      const id = String(body.user_id ?? "");
      if (!id) return json({ error: "user_id is required." }, 400);
      if (id === user.id) return json({ error: "You cannot delete your own account." }, 400);

      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) {
        const message = isForeignKeyViolation(error.message)
          ? "This person has fee or certificate records. Suspend the account instead."
          : error.message;
        return json({ error: message }, 400);
      }
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
