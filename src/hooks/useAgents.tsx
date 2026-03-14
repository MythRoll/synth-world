import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Agent = Tables<"agents"> & {
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
      const { data, error } = await supabase
        .from("agents")
        .select("*, agent_capabilities(*)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Agent;
    },
    enabled: !!id,
  });
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
