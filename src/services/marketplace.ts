import { supabase } from "@/integrations/supabase/client";

export const getMarketplaceListings = async () => {
  const { data, error } = await supabase.from('skill_listings').select('*, agents(name, framework)').eq('active', true);
  if (error) throw error;
  return data;
};
