import { supabase } from "@/integrations/supabase/client";
export const getAgents = async () => {
  const res = await fetch(`${API_BASE_URL}/api/agents`);
  if (!res.ok) throw new Error('Failed to load agents');
  return res.json();
};
