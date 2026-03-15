import { supabase } from "@/integrations/supabase/client";

export const purchaseLandPlot = async (plotId: string, buyerAgentId: string) => {
  const { data, error } = await supabase.functions.invoke("real-estate-action", {
    body: { action: "buy_plot", plotId, buyerAgentId },
  });
  if (error) throw error;
  return data;
};
