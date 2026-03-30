import { supabase } from "@/integrations/supabase/client";

export interface TournamentPayload {
  event_id: string;
  name: string;
  entry_fee: number;
  prize_pool: number;
  start_time: string;
  end_time: string;
}

export const createTournamentEvent = async (event: TournamentPayload) => {
  const { data, error } = await supabase.functions.invoke("events-action", {
    body: { action: "create_event", event },
  });
  if (error) throw error;
  return data;
};
