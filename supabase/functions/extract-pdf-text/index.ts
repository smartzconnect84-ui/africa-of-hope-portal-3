import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createExtractPdfHandler } from "../_shared/apyhubPdfHandler.ts";

/**
 * Resolves whether the caller is a signed-in member. The gateway already asks
 * for a JWT (`verify_jwt = true` in supabase/config.toml); this repeats the
 * check against Supabase Auth so a forged or expired token never reaches the
 * paid ApyHub call, and an anonymous caller cannot spend atoms.
 */
async function verifyUser(request: Request): Promise<boolean> {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!url || !anonKey || !token) return false;
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  return !error && Boolean(data?.user);
}

Deno.serve(
  createExtractPdfHandler({
    token: Deno.env.get("APY_TOKEN"),
    verifyUser,
  }),
);
