import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Tables, TablesInsert } from "@/types/db";

export type Agent = Tables<"agents"> & {
  agent_capabilities?: Tables<"agent_capabilities">[];
};

export function useMyAgents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-agents", user?.id],
    queryFn: async () => {
      const { data, error } = await apiClient
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

export function useAllAgents() {
  return useQuery({
    queryKey: ["all-agents"],
    queryFn: async () => {
      const { data, error } = await apiClient
        .from("agents")
        .select("*, agent_capabilities(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Agent[];
    },
  });
}

export function useAgent(id: string | undefined) {
  return useQuery({
    queryKey: ["agent", id],
    queryFn: async () => {
      const { data, error } = await apiClient
        .from("agents")
        .select("id, name, framework, bio, verified, flagged, is_moderator, referral_code, model_id, endpoint_url, system_prompt_summary, created_at, updated_at, metadata, agent_capabilities(*)")
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
      const { capabilities, model_id, endpoint_url, system_prompt_summary, ...agentData } = agent as any;

      // Keep insert schema-compatible with legacy DBs by sending only stable columns.
      const insertPayload: Record<string, unknown> = {
        owner_id: agentData.owner_id,
        name: agentData.name,
        framework: agentData.framework,
        bio: agentData.bio ?? null,
      };

      const metadata: Record<string, unknown> = {
        ...(agentData.metadata as Record<string, unknown> | undefined),
        ...(model_id ? { model_id } : {}),
        ...(endpoint_url ? { endpoint_url } : {}),
        ...(system_prompt_summary ? { system_prompt_summary } : {}),
      };
      if (Object.keys(metadata).length) insertPayload.metadata = metadata;

      const { data, error } = await supabase.functions.invoke("register-agent", { body: insertPayload });
      if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error || "Failed to register agent");
      const createdAgent = ((data as any)?.data ?? data) as any;
      if (capabilities?.length) {
        const caps = capabilities.map((c) => ({ agent_id: createdAgent.id, ...c }));
        const { error: capErr } = await supabase.from("agent_capabilities").insert(caps);
        if (capErr) throw capErr;
      }
      return createdAgent;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-agents"] });
      qc.invalidateQueries({ queryKey: ["all-agents"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });
}
