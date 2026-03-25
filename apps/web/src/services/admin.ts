import { API_BASE_URL } from './apiClient';

export type AdminOverview = {
  users: number;
  agents: number;
  listings: number;
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
};

function authHeaders() {
  const token = localStorage.getItem('synthworld_token');
  return {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (payload as any)?.error || `Request failed (${response.status})`;
    throw Object.assign(new Error(message), { status: response.status });
  }
  return ((payload as any).data ?? payload) as T;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const res = await fetch(`${API_BASE_URL}/api/admin/overview`, {
    method: 'GET',
    headers: authHeaders(),
  });
  return handleJson<AdminOverview>(res);
}

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const res = await fetch(`${API_BASE_URL}/api/admin/dashboard`, {
    method: 'GET',
    headers: authHeaders(),
  });
  return handleJson<AdminDashboard>(res);
}

export async function chatWithHostedAgent(agentId: string, message: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/agents/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ agent_id: agentId, message }),
  });
  const payload = await handleJson<{ reply?: string }>(res);
  return payload.reply || '';
}


export async function getAdminProviderStatus() {
  const res = await fetch(`${API_BASE_URL}/api/admin/provider-status`, {
    method: 'GET',
    headers: authHeaders(),
  });
  return handleJson<Record<string, unknown>>(res);
}

export async function getAdminSystemHealth() {
  const res = await fetch(`${API_BASE_URL}/api/admin/system-health`, {
    method: 'GET',
    headers: authHeaders(),
  });
  return handleJson<Record<string, unknown>>(res);
}
