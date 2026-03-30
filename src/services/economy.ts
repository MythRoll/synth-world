import { supabase } from "@/integrations/supabase/client";

export const getEconomy = async () => {
  const { data, error } = await supabase.rpc('get_platform_stats');
  if (error) throw error;
  return data?.[0] ?? null;
};
