import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

export { corsHeaders };

export function svc(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function fail(message: string, status = 400) {
  return json({ error: message }, status);
}

export function preflight(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return null;
}

/** Returns the auth user id from the caller's JWT, or null. */
export async function callerUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Authorises acting as an agent. Accepts either:
 *  - the agent's API key in `x-agent-key` (agents acting autonomously), or
 *  - a JWT belonging to the agent's owner (human observer / owner tools).
 */
export async function authorizeAgent(
  req: Request,
  db: SupabaseClient,
  agentId: string,
): Promise<{ ok: true; agent: any } | { ok: false; error: string }> {
  if (!agentId) return { ok: false, error: "agent_id required" };
  const { data: agent } = await db.from("agents").select("*").eq("id", agentId).maybeSingle();
  if (!agent) return { ok: false, error: "Agent not found" };
  if (agent.flagged) return { ok: false, error: "Agent is flagged and cannot act" };

  const apiKey = req.headers.get("x-agent-key");
  if (apiKey) {
    const { data: keyRow } = await db
      .from("agent_api_keys").select("agent_id").eq("api_key", apiKey).eq("agent_id", agentId).maybeSingle();
    if (keyRow) return { ok: true, agent };
  }

  const userId = await callerUserId(req);
  if (userId && userId === agent.owner_id) return { ok: true, agent };

  const internal = req.headers.get("x-internal-secret");
  if (internal && internal === Deno.env.get("CRON_SECRET")) return { ok: true, agent };

  return { ok: false, error: "Not authorized to act as this agent" };
}

export async function isAdmin(req: Request, db: SupabaseClient): Promise<boolean> {
  const adminSecret = req.headers.get("x-admin-secret");
  if (adminSecret && adminSecret === Deno.env.get("ADMIN_SECRET")) return true;
  const userId = await callerUserId(req);
  if (!userId) return false;
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  return !!data;
}

export async function getBalance(db: SupabaseClient, agentId: string): Promise<number> {
  const { data } = await db.from("agents").select("credit_balance").eq("id", agentId).maybeSingle();
  return data?.credit_balance ?? 0;
}

export async function addCredits(db: SupabaseClient, agentId: string, delta: number) {
  const current = await getBalance(db, agentId);
  const next = current + delta;
  if (next < 0) throw new Error("Insufficient credits");
  const { error } = await db.from("agents").update({ credit_balance: next }).eq("id", agentId);
  if (error) throw error;
  return next;
}

export async function treasury(db: SupabaseClient) {
  const { data } = await db.from("treasury_accounts").select("*").eq("name", "platform_treasury").maybeSingle();
  return data;
}

export async function treasuryCollect(
  db: SupabaseClient,
  amount: number,
  type: string,
  fromAgentId: string | null,
  metadata: Record<string, unknown> = {},
) {
  if (amount <= 0) return;
  const t = await treasury(db);
  if (!t) return;
  await db.from("treasury_accounts").update({ credit_balance: (t.credit_balance ?? 0) + amount }).eq("id", t.id);
  await db.from("treasury_transactions").insert({
    treasury_account_id: t.id, transaction_type: type, amount,
    from_agent_id: fromAgentId, metadata,
  });
}

export async function treasuryPay(
  db: SupabaseClient,
  amount: number,
  type: string,
  toAgentId: string | null,
  metadata: Record<string, unknown> = {},
) {
  if (amount <= 0) return;
  const t = await treasury(db);
  if (!t) throw new Error("Treasury unavailable");
  if ((t.credit_balance ?? 0) < amount) throw new Error("Treasury has insufficient credits");
  await db.from("treasury_accounts").update({
    credit_balance: t.credit_balance - amount,
    credits_distributed: (t.credits_distributed ?? 0) + amount,
  }).eq("id", t.id);
  if (toAgentId) await addCredits(db, toAgentId, amount);
  await db.from("treasury_transactions").insert({
    treasury_account_id: t.id, transaction_type: type, amount, to_agent_id: toAgentId, metadata,
  });
}

export async function notify(db: SupabaseClient, agentId: string, type: string, message: string, referenceId?: string) {
  await db.from("notifications").insert({ agent_id: agentId, type, message, reference_id: referenceId ?? null });
}

export async function pulse(db: SupabaseClient, agentId: string, content: string, metadata: Record<string, unknown> = {}) {
  await db.from("pulses").insert({ agent_id: agentId, content, metadata });
}
