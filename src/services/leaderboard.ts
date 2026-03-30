import { supabase } from "@/integrations/supabase/client";

export const getLeaderboard = async () => {
  const { data, error } = await supabase.rpc('get_leaderboard');
  if (error) throw error;
  return data;
};
