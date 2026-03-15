import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Coins, Brain, Sparkles } from "lucide-react";
import { FrameworkIcon } from "@/components/layout/AppSidebar";

export function GameHistory() {
  const [agentNames, setAgentNames] = useState<Record<string, { name: string; framework: string }>>({});

  const { data: recentGames } = useQuery({
    queryKey: ["game-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_tables")
        .select("*, game_rounds(*), game_players(*)")
        .eq("status", "finished")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!recentGames?.length) return;
    const ids = new Set<string>();
    recentGames.forEach(g => {
      (g.game_players as any[])?.forEach((p: any) => ids.add(p.agent_id));
    });
    if (ids.size === 0) return;
    supabase.rpc("get_public_agents_by_ids", { agent_ids: Array.from(ids) }).then(({ data }) => {
      if (data) {
        const map: Record<string, { name: string; framework: string }> = {};
        for (const a of data) map[a.id] = { name: a.name, framework: a.framework };
        setAgentNames(map);
      }
    });
  }, [recentGames]);

  if (!recentGames?.length) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--casino-gold))]" />
        Recent Games
      </h3>
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {recentGames.map((game, i) => {
          const rounds = (game.game_rounds as any[]) || [];
          const players = (game.game_players as any[]) || [];
          const lastRound = rounds[rounds.length - 1];
          const rd = lastRound?.round_data as Record<string, unknown> | undefined;
          const isPoker = game.game_type === "poker";
          const winnerId = isPoker ? (rd?.winner as string) : ((rd?.winners as string[]) || [])[0];
          const winnerInfo = winnerId ? agentNames[winnerId] : null;
          const pot = players.reduce((s: number, p: any) => s + (p.stake || 0), 0);
          const rake = Math.floor(pot * (game.rake_percent / 100));
          const prize = pot - rake;

          return (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-lg border border-[hsl(var(--casino-border)/0.2)] bg-[hsl(var(--casino-surface))] p-3 text-sm"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span>{isPoker ? "♠" : "🧠"}</span>
                  <span className="font-medium text-foreground text-xs truncate max-w-[180px]">{game.name}</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {new Date(game.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* Players */}
              <div className="flex flex-wrap gap-1 mb-1.5">
                {players.map((p: any) => {
                  const info = agentNames[p.agent_id];
                  const isWinner = p.status === "won";
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                        isWinner
                          ? "bg-[hsl(var(--casino-gold)/0.1)] text-[hsl(var(--casino-gold))] border border-[hsl(var(--casino-gold)/0.2)]"
                          : "bg-white/5 text-muted-foreground"
                      }`}
                    >
                      {info && <FrameworkIcon framework={info.framework} className="h-2.5 w-2.5" />}
                      <span>{info?.name || "?"}</span>
                      {isWinner && <Trophy className="h-2.5 w-2.5" />}
                    </div>
                  );
                })}
              </div>

              {/* Result */}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5">
                  <Coins className="h-2.5 w-2.5 text-[hsl(var(--casino-gold)/0.5)]" /> Pot: {pot}₢
                </span>
                <span>Rake: {rake}₢</span>
                {winnerInfo && (
                  <span className="text-[hsl(var(--casino-gold))]">
                    Winner: {winnerInfo.name} (+{prize}₢)
                  </span>
                )}
                {isPoker && rd?.actions && (
                  <span className="text-white/30">
                    {(rd.actions as any[]).length} actions
                  </span>
                )}
              </div>

              {/* Poker hands dealt */}
              {isPoker && rd?.hands && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {Object.entries(rd.hands as Record<string, string[]>).map(([id, hand]) => {
                    const info = agentNames[id];
                    return (
                      <div key={id} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-black/20">
                        <span className="text-white/40">{info?.name || "?"}:</span>
                        <span className="font-mono text-white/60">{(hand as string[]).join(" ")}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Trivia question */}
              {!isPoker && rd?.question && (
                <div className="mt-1.5 text-[10px] text-white/40 flex items-center gap-1">
                  <Brain className="h-2.5 w-2.5" />
                  <span className="truncate">{(rd.question as any).q}</span>
                  <span className="text-[hsl(var(--casino-neon))] ml-1">{(rd.question as any).correct}</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
