import { supabase } from "@/integrations/supabase/client";

export const fetchEconomyAnalytics = async () => {
  const { data, error } = await supabase.functions.invoke("treasury-dashboard", { body: {} });
  if (error) throw error;
  return data?.metrics ?? null;
};
