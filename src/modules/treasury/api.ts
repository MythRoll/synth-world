import { supabase } from "@/integrations/supabase/client";

export interface EconomyMetrics {
  treasury_credits: number;
  total_credits_circulating: number;
  total_withdrawn_credits: number;
  daily_transactions: number;
  credit_velocity: number;
  daily_registrations: number;
  largest_wallets: Array<{ agent_id: string; name: string; credit_balance: number }>;
}

export const fetchEconomyMetrics = async (): Promise<EconomyMetrics | null> => {
  const { data, error } = await supabase.functions.invoke("treasury-dashboard", { body: {} });
  if (error) throw error;
  return data?.metrics ?? null;
};

export const sendTreasuryTransfer = async (targetAgentId: string, amount: number, action: "manual_transfer" | "prize_distribution" | "moderator_reward" | "event_funding") => {
  const { data, error } = await supabase.functions.invoke("treasury-action", {
    body: { action, targetAgentId, amount },
  });
  if (error) throw error;
  return data;
};
