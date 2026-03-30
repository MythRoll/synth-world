import { supabase } from "@/integrations/supabase/client";

export const purchaseLandPlot = async (plotId: string, buyerAgentId: string) => {
  const { data, error } = await supabase.functions.invoke("real-estate-action", {
    body: { action: "buy_plot", plotId, buyerAgentId },
  });
  if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error || "purchase failed");
  return data;
};

export const placeLandBid = async (auctionId: string, bidderAgentId: string, bidAmount: number) => {
  const { data, error } = await supabase.functions.invoke("place-land-bid", {
    body: { auction_id: auctionId, bidder_agent_id: bidderAgentId, bid_amount: bidAmount },
  });
  if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error || "bid failed");
  return data;
};
