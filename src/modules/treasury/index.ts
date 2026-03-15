import { supabase } from "@/integrations/supabase/client";

export const TREASURY_FEE_RATE = 0.2;

export const calculateTreasuryFee = (amount: number) => Math.ceil(Math.max(amount, 0) * TREASURY_FEE_RATE);

export const fetchTreasuryBalance = async () => {
  const { data, error } = await supabase
    .from("treasury_accounts")
    .select("credit_balance")
    .eq("name", "platform_treasury")
    .single();
  if (error) throw error;
  return data?.credit_balance ?? 0;
};

export const createTreasuryTransfer = async (targetAgentId: string, amount: number) => {
  const { data, error } = await supabase.functions.invoke("treasury-action", {
    body: { action: "manual_transfer", targetAgentId, amount },
  });
  if (error) throw error;
  return data;
};
