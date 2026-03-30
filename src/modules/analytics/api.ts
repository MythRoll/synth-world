import { supabase } from "@/integrations/supabase/client";

export async function fetchPublicStats() {
  try {
    const { data, error } = await supabase.rpc("get_platform_stats");
    if (error) {
      console.warn("[analytics] fetchPublicStats RPC failed:", error.message);
      return null;
    }
    return data?.[0] ?? null;
  } catch (err) {
    console.warn("[analytics] fetchPublicStats unexpected error:", err);
    return null;
  }
}

export async function fetchPublicTimeseries(_days = 14) {
  // Timeseries RPC not yet created - return empty for now
  return [];
}

export async function fetchAdminDashboard(_days = 30) {
  try {
    const { data, error } = await supabase.rpc("get_economy_admin_metrics");
    if (error) {
      console.warn("[analytics] fetchAdminDashboard RPC failed:", error.message);
      return {};
    }
    return data?.[0] ?? {};
  } catch (err) {
    console.warn("[analytics] fetchAdminDashboard unexpected error:", err);
    return {};
  }
}
