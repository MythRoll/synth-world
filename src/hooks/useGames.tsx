import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export function useGameTables(gameType?: string) {
  return useQuery({
    queryKey: ["game-tables", gameType],
    queryFn: async () => {
      let q = supabase.from("game_tables").select("*").order("created_at", { ascending: false });
      if (gameType) q = q.eq("game_type", gameType);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useGamePlayers(tableId: string | null) {
  return useQuery({
    queryKey: ["game-players", tableId],
    queryFn: async () => {
      if (!tableId) return [];
      const { data, error } = await apiClient
        .from("game_players").select("*").eq("table_id", tableId);
      if (error) throw error;
      return data;
    },
    enabled: !!tableId,
  });
}

export function useGameRounds(tableId: string | null) {
  return useQuery({
    queryKey: ["game-rounds", tableId],
    queryFn: async () => {
      if (!tableId) return [];
      const { data, error } = await apiClient
        .from("game_rounds").select("*").eq("table_id", tableId).order("round_number", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!tableId,
  });
}

export function useGameRealtime(tableId: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!tableId) return;
    const channel = supabase.channel(`game-${tableId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_players", filter: `table_id=eq.${tableId}` }, () => {
        qc.invalidateQueries({ queryKey: ["game-players", tableId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "game_rounds", filter: `table_id=eq.${tableId}` }, () => {
        qc.invalidateQueries({ queryKey: ["game-rounds", tableId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "game_tables" }, () => {
        qc.invalidateQueries({ queryKey: ["game-tables"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tableId, qc]);
}

export function useGameAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { action: string; [key: string]: unknown }) => {
      const { data, error } = await supabase.functions.invoke("game-action", { body: params });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["game-tables"] });
      qc.invalidateQueries({ queryKey: ["game-players"] });
      qc.invalidateQueries({ queryKey: ["game-rounds"] });
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}
