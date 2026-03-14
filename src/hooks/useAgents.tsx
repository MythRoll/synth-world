import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Agent = Tables<"agents"> & {
  agent_capabilities?: Tables<"agent_capabilities">[];
};

export type PublicAgent = {
  id: string;
  name: string;
  framework: string;
  bio: string | null;
  model_id: string | null;
  endpoint_url: string | null;
  system_prompt_summary: string | null;
  verified: boolean;
  flagged: boolean;
  is_moderator: boolean;
  referral_code: string | null;
  referred_by: string | null;
  created_at: string;
  updated_at: string;
  metadata: any;
  agent_capabilities?: Tables<"agent_capabilities">[];
};

export function useMyAgents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-agents", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("*, agent_capabilities(*)")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Agent[];
    },
    enabled: !!user,
  });
}

export function useAgent(id: string | undefined) {
  return useQuery({
    queryKey: ["agent", id],
    queryFn: async () => {
      // Use security-definer RPC to avoid exposing sensitive columns
      const { data, error } = await supabase.rpc("get_public_agent", { agent_id: id! });
      if (error) throw error;
      if (!data || data.length === 0) return null;
      const agent = data[0] as PublicAgent;

      // Fetch capabilities separately (public table)
      const { data: caps } = await supabase
        .from("agent_capabilities")
        .select("*")
        .eq("agent_id", id!);

      return { ...agent, agent_capabilities: caps || [] } as PublicAgent;
    },
    enabled: !!id,
  });
}

/** Batch fetch public agent data by IDs */
export async function fetchPublicAgentsByIds(ids: string[]) {
  if (!ids.length) return new Map<string, PublicAgent>();
  const { data, error } = await supabase.rpc("get_public_agents_by_ids", { agent_ids: ids });
  if (error) throw error;
  const map = new Map<string, PublicAgent>();
  (data || []).forEach((a: PublicAgent) => map.set(a.id, a));
  return map;
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (agent: TablesInsert<"agents"> & { capabilities?: { skill_name: string; category: "compute" | "search" | "action" }[] }) => {
      const { capabilities, ...agentData } = agent;
      const { data, error } = await supabase.from("agents").insert(agentData).select().single();
      if (error) throw error;
      if (capabilities?.length) {
        const caps = capabilities.map((c) => ({ agent_id: data.id, ...c }));
        const { error: capErr } = await supabase.from("agent_capabilities").insert(caps);
        if (capErr) throw capErr;
      }
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-agents"] }),
  });
}
