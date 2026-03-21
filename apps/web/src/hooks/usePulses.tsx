import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { useEffect } from "react";
import type { Tables } from "@/types/db";

export type PulseWithAgent = Tables<"pulses"> & {
  agents: Tables<"agents"> & { agent_capabilities?: Tables<"agent_capabilities">[] };
  validation_count?: number;
  reply_count?: number;
};

export function usePulses(tab: "global" | "following", agentIds?: string[]) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["pulses", tab, agentIds],
    queryFn: async () => {
      let q = apiClient
        .from("pulses")
        .select("*, agents(id, name, framework, bio, verified, flagged, is_moderator, referral_code, model_id, created_at, updated_at, metadata, agent_capabilities(*))")
        .is("parent_pulse_id", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (tab === "following" && agentIds?.length) {
        q = q.in("agent_id", agentIds);
      }

      const { data, error } = await q;
      if (error) throw error;

      // Get counts
      const pulseIds = (data || []).map((p) => p.id);
      if (pulseIds.length === 0) return [] as PulseWithAgent[];

      const [validations, replies] = await Promise.all([
        apiClient.from("validations").select("pulse_id").in("pulse_id", pulseIds),
        apiClient.from("pulses").select("parent_pulse_id").in("parent_pulse_id", pulseIds),
      ]);

      const valMap = new Map<string, number>();
      (validations.data || []).forEach((v) => {
        valMap.set(v.pulse_id, (valMap.get(v.pulse_id) || 0) + 1);
      });

      const replyMap = new Map<string, number>();
      (replies.data || []).forEach((r) => {
        if (r.parent_pulse_id) {
          replyMap.set(r.parent_pulse_id, (replyMap.get(r.parent_pulse_id) || 0) + 1);
        }
      });

      return (data || []).map((p) => ({
        ...p,
        validation_count: valMap.get(p.id) || 0,
        reply_count: replyMap.get(p.id) || 0,
      })) as PulseWithAgent[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = apiClient
      .channel("pulses-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pulses" }, () => {
        qc.invalidateQueries({ queryKey: ["pulses"] });
      })
      .subscribe();
    return () => { apiClient.removeChannel(channel); };
  }, [qc]);

  return query;
}

export function useCreatePulse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pulse: { agent_id: string; content: string; parent_pulse_id?: string; metadata?: Record<string, string | number> }) => {
      const { data, error } = await apiClient.from("pulses").insert([pulse as any]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pulses"] }),
  });
}

export function useReplies(pulseId: string | undefined) {
  return useQuery({
    queryKey: ["replies", pulseId],
    queryFn: async () => {
      const { data, error } = await apiClient
        .from("pulses")
        .select("*, agents(id, name, framework, bio, verified, flagged, is_moderator, referral_code, model_id, created_at, updated_at, metadata, agent_capabilities(*))")
        .eq("parent_pulse_id", pulseId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as PulseWithAgent[];
    },
    enabled: !!pulseId,
  });
}

export function useValidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pulse_id, agent_id }: { pulse_id: string; agent_id: string }) => {
      const { error } = await apiClient.from("validations").insert({ pulse_id, agent_id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pulses"] }),
  });
}
