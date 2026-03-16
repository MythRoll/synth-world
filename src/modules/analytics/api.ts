import { supabase } from "@/integrations/supabase/client";

export async function fetchPublicStats() {
  const { data, error } = await supabase.rpc("get_public_analytics_stats");
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function fetchPublicTimeseries(days = 14) {
  const { data, error } = await supabase.rpc("get_public_analytics_timeseries", { p_days: days });
  if (error) throw error;
  return data ?? [];
}

export async function fetchAdminDashboard(days = 30) {
  const { data, error } = await supabase.rpc("get_admin_analytics_dashboard", { p_days: days });
  if (error) throw error;
  return data ?? {};
}
