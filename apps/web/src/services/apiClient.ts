const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "https://api.synth-world.com").replace(/\/$/, "");


type AuthListener = (_event: string, session: unknown) => void;
const authListeners = new Set<AuthListener>();

async function emitAuthChange(event: string) {
  const { data } = await auth.getSession();
  for (const listener of authListeners) {
    listener(event, data.session);
  }
}

type QueryResponse<T = unknown> = Promise<{ data: T | null; error: Error | null; count?: number | null }>;

class QueryBuilder<T = unknown> implements PromiseLike<{ data: T | null; error: Error | null; count?: number | null }> {
  private action: "select" | "insert" | "update" | "delete" = "select";
  private payload: Record<string, unknown> = {};

  constructor(private readonly table: string) {}

  select(columns = "*", options?: Record<string, unknown>) {
    if (this.action === "insert" || this.action === "update" || this.action === "delete") {
      this.payload.returning = true;
      this.payload.returningColumns = columns;
      this.payload.returningOptions = options;
      return this;
    }
    this.action = "select";
    this.payload.columns = columns;
    this.payload.options = options;
    return this;
  }
  insert(values: unknown) { this.action = "insert"; this.payload.values = values; return this; }
  update(values: unknown) { this.action = "update"; this.payload.values = values; return this; }
  delete() { this.action = "delete"; return this; }
  upsert(values: unknown) { this.action = "insert"; this.payload.values = values; this.payload.upsert = true; return this; }
  eq(column: string, value: unknown) { (this.payload.filters ||= []).push({ op: "eq", column, value }); return this; }
  is(column: string, value: unknown) { (this.payload.filters ||= []).push({ op: "is", column, value }); return this; }
  in(column: string, value: unknown[]) { (this.payload.filters ||= []).push({ op: "in", column, value }); return this; }
  or(value: string) { (this.payload.filters ||= []).push({ op: "or", value }); return this; }
  order(column: string, options?: Record<string, unknown>) { (this.payload.order ||= []).push({ column, options }); return this; }
  limit(value: number) { this.payload.limit = value; return this; }
  single() { this.payload.single = true; return this; }
  maybeSingle() { this.payload.single = true; this.payload.allowEmpty = true; return this; }

  async execute() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ table: this.table, action: this.action, ...this.payload }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return { data: null, error: new Error(body.error || `Request failed (${response.status})`) };
      return { data: (body.data ?? null) as T | null, error: null, count: body.count ?? null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error("Network error") };
    }
  }

  then<TResult1 = { data: T | null; error: Error | null; count?: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: T | null; error: Error | null; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }
}

function authHeaders() {
  const token = localStorage.getItem("synthworld_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiPost<T>(path: string, body: Record<string, unknown>): QueryResponse<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return { data: null, error: new Error(payload.error || `Request failed (${response.status})`) };
    return { data: (payload.data ?? payload ?? null) as T, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error("Network error") };
  }
}

const auth = {
  async getSession() {
    const token = localStorage.getItem("synthworld_token");
    const userJson = localStorage.getItem("synthworld_user");
    const user = userJson ? JSON.parse(userJson) : null;
    return { data: { session: token && user ? { access_token: token, user } : null } };
  },
  async getUser(token?: string) {
    const session = await auth.getSession();
    const user = token ? session.data.session?.user ?? null : session.data.session?.user ?? null;
    return { data: { user } };
  },
  async signInWithPassword(credentials: { email: string; password: string }) {
    const result = await apiPost<{ token: string; user: { id: string; email: string } }>("/api/auth/login", credentials);
    if (result.error || !result.data) return { error: result.error };
    localStorage.setItem("synthworld_token", result.data.token);
    localStorage.setItem("synthworld_user", JSON.stringify(result.data.user));
    await emitAuthChange("SIGNED_IN");
    return { error: null };
  },
  async signUp(credentials: { email: string; password: string }) {
    const result = await apiPost<{ token: string; user: { id: string; email: string } }>("/api/auth/register", credentials);
    if (result.error || !result.data) return { error: result.error };
    localStorage.setItem("synthworld_token", result.data.token);
    localStorage.setItem("synthworld_user", JSON.stringify(result.data.user));
    await emitAuthChange("SIGNED_IN");
    return { error: null };
  },
  async signOut() {
    localStorage.removeItem("synthworld_token");
    localStorage.removeItem("synthworld_user");
    await emitAuthChange("SIGNED_OUT");
    return { error: null };
  },
  onAuthStateChange(callback: (_event: string, session: unknown) => void) {
    authListeners.add(callback);
    auth.getSession().then(({ data }) => callback("INITIAL_SESSION", data.session));
    return { data: { subscription: { unsubscribe() { authListeners.delete(callback); } } } };
  },
};

export const apiClient = {
  from: <T = unknown>(table: string) => new QueryBuilder<T>(table),
  rpc: <T = unknown>(name: string, params: Record<string, unknown> = {}) => apiPost<T>("/api/rpc", { name, params }),
  functions: {
    invoke: <T = unknown>(name: string, options: { body?: Record<string, unknown> } = {}) => apiPost<T>(`/api/functions/${name}`, options.body ?? {}),
  },
  auth,
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel: () => {},
};

export { API_BASE_URL };
