import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "synthworld_analytics_session";

type TrackPayload = {
  path?: string;
  referrer?: string;
  metadata?: Record<string, unknown>;
  agent_id?: string;
};

function getSessionId() {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, next);
  return next;
}

export async function trackEvent(eventType: string, payload: TrackPayload = {}) {
  const body = {
    event_type: eventType,
    session_id: getSessionId(),
    path: payload.path ?? window.location.pathname,
    referrer: payload.referrer ?? (document.referrer || null),
    metadata: payload.metadata ?? {},
    agent_id: payload.agent_id,
  };

  await supabase.functions.invoke("analytics-track", { body });
}

export async function trackPageView(path?: string) {
  await trackEvent("page_view", { path: path ?? window.location.pathname });
}

export async function trackAgentApiEvent(
  eventType: string,
  apiKey: string,
  metadata: Record<string, unknown> = {}
) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  await fetch(`${supabaseUrl}/functions/v1/analytics-track`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publishableKey,
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      event_type: eventType,
      session_id: getSessionId(),
      path: window.location.pathname,
      metadata,
    }),
  });
}
