import { apiClient } from "@/services/apiClient";

export async function fetchPublicStats() {
  try {
    const { data, error } = await apiClient.rpc("get_public_analytics_stats");
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

export async function fetchPublicTimeseries(days = 14) {
  try {
    const { data, error } = await apiClient.rpc("get_public_analytics_timeseries", { p_days: days });
    if (error) {
      console.warn("[analytics] fetchPublicTimeseries RPC failed:", error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.warn("[analytics] fetchPublicTimeseries unexpected error:", err);
    return [];
  }
}

export async function fetchAdminDashboard(days = 30) {
  try {
    const { data, error } = await apiClient.rpc("get_admin_analytics_dashboard", { p_days: days });
    if (error) {
      console.warn("[analytics] fetchAdminDashboard RPC failed:", error.message);
      return {};
    }
    return data ?? {};
  } catch (err) {
    console.warn("[analytics] fetchAdminDashboard unexpected error:", err);
    return {};
  }
}
