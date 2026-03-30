import { supabase } from "@/integrations/supabase/client";

export type AdminOverview = {
  users: number;
  agents: number;
  listings: number;
  jobs: number;
  txns: number;
  bans: number;
  treasury?: Record<string, unknown>;
};

export type AdminDashboard = AdminOverview & {
  recent_users: Array<{ id: string; email: string; created_at: string; is_banned: number; is_admin: number }>;
  recent_agents: Array<{ id: string; owner_id: string; name: string; framework?: string; bio?: string; verified: number; flagged: number; is_moderator: number; credit_balance: number; created_at: string }>;
  recent_listings: Array<{ id: string; seller_agent_id: string; title?: string; skill_name?: string; status?: string; price_credits?: number; seller_name?: string; created_at: string }>;
  recent_transactions: Array<{ id: string; from_agent_id?: string; to_agent_id?: string; amount: number; type?: string; description?: string; created_at: string }>;
  active_bans: Array<{ id: string; user_id: string; reason?: string; expires_at?: string; created_at: string; email?: string }>;
  moderators: Array<{ user_id: string; email: string; created_at: string }>;
  reports: {
    flagged_agents: Array<{ id: string; name: string; flagged: number; verified: number; is_moderator: number; created_at: string }>;
    flagged_listings: Array<{ id: string; title?: string; status: string; created_at: string; updated_at: string }>;
  };
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const { data, error } = await supabase.rpc('get_platform_stats');
  if (error) throw error;
  const stats = data?.[0];
  return {
    users: 0,
    agents: stats?.total_agents ?? 0,
    listings: 0,
    jobs: 0,
    txns: 0,
    bans: 0,
  };
}

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const overview = await getAdminOverview();
  const { data: agents } = await supabase.from('agents').select('*').order('created_at', { ascending: false }).limit(10);
  const { data: listings } = await supabase.from('skill_listings').select('*').order('created_at', { ascending: false }).limit(10);

  return {
    ...overview,
    recent_users: [],
    recent_agents: (agents ?? []).map((a: any) => ({
      id: a.id, owner_id: a.owner_id, name: a.name, framework: a.framework, bio: a.bio,
      verified: a.verified ? 1 : 0, flagged: a.flagged ? 1 : 0, is_moderator: a.is_moderator ? 1 : 0,
      credit_balance: a.credit_balance, created_at: a.created_at,
    })),
    recent_listings: (listings ?? []).map((l: any) => ({
      id: l.id, seller_agent_id: l.agent_id, skill_name: l.skill_name, created_at: l.created_at,
    })),
    recent_transactions: [],
    active_bans: [],
    moderators: [],
    reports: { flagged_agents: [], flagged_listings: [] },
  };
}

export async function chatWithHostedAgent(agentId: string, message: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('agent-chat', {
    body: { agent_id: agentId, message },
  });
  if (error) throw error;
  return data?.reply || '';
}

export async function getAdminProviderStatus() {
  return {};
}

export async function getAdminSystemHealth() {
  return {};
}
