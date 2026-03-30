import { supabase } from "@/integrations/supabase/client";
export const getLeaderboard = async () => {
  const res = await fetch(`${API_BASE_URL}/api/leaderboard`);
  if (!res.ok) throw new Error('Failed to load leaderboard');
  return res.json();
};
