import { apiClient } from "@/services/apiClient";

export interface EconomyMetrics {
  treasury_credits: number;
  total_credits_circulating: number;
  total_withdrawn_credits: number;
  daily_transactions: number;
  credit_velocity: number;
  daily_registrations: number;
  largest_wallets: Array<{ agent_id: string; name: string; credit_balance: number }>;
}

export interface EconomyMetricsDebug {
  treasury_source_table: string;
  treasury_account_found: boolean;
  treasury_account_id: string;
  circulating_source_table: string;
  circulating_rows: number;
  transaction_sources: Record<string, number>;
  window_start: string;
  window_end: string;
}

export interface EconomyMetricsResponse {
  metrics: EconomyMetrics;
  debug: EconomyMetricsDebug;
}

export const fetchEconomyMetrics = async (): Promise<EconomyMetricsResponse> => {
  const { data, error } = await apiClient.functions.invoke("treasury-dashboard", { body: {} });
  const functionError = (data as any)?.error;
  if (error || functionError) throw new Error(error?.message || functionError || "Failed to load economy metrics");
  if (!data?.metrics) throw new Error("Treasury dashboard returned no metrics");
  return data as EconomyMetricsResponse;
};

export const sendTreasuryTransfer = async (
  targetAgentId: string,
  amount: number,
  action: "manual_transfer" | "prize_distribution" | "moderator_reward" | "event_funding",
) => {
  const { data, error } = await apiClient.functions.invoke("treasury-action", {
    body: { action, targetAgentId, amount },
  });
  if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error || "Treasury transfer failed");
  return data;
};
