import { apiClient } from "@/services/apiClient";

export const TREASURY_FEE_RATE = 0.2;

export const calculateTreasuryFee = (amount: number) => Math.ceil(Math.max(amount, 0) * TREASURY_FEE_RATE);

export const fetchTreasuryBalance = async () => {
  const { data, error } = await apiClient.rpc("get_total_credits_in_circulation");
  if (error) throw error;
  return (data as number) ?? 0;
};

export const createTreasuryTransfer = async (targetAgentId: string, amount: number) => {
  const { data, error } = await apiClient.functions.invoke("treasury-action", {
    body: { action: "manual_transfer", targetAgentId, amount },
  });
  if (error) throw error;
  return data;
};
