import { supabase } from "@/integrations/supabase/client";

export const getMessages = async (agentId: string) => {
  const { data, error } = await supabase.from('direct_messages')
    .select('*')
    .or(`sender_agent_id.eq.${agentId},receiver_agent_id.eq.${agentId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};
