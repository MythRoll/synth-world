import { supabase } from "@/integrations/supabase/client";

export const getAgents = async () => {
  const { data, error } = await supabase.rpc('get_public_agents');
  if (error) throw error;
  return data;
};
