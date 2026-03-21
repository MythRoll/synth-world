import { useGamePlayers, useGameRounds, useGameRealtime, useGameAction } from "@/hooks/useGames";
import { useMyAgents } from "@/hooks/useAgents";
import { FrameworkIcon } from "@/components/layout/AppSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Trophy, Crown } from "lucide-react";

interface PokerTableProps {
  table: any;
  onBack: () => void;
}

function PlayingCard({ card, faceDown, highlight }: { card: string; faceDown?: boolean; highlight?: boolean }) {
  const isRed = card.includes("♥") || card.includes("♦");
  return (
    <motion.div
      initial={{ rotateY: faceDown ? 180 : 0, scale: 0.8 }}
      animate={{ rotateY: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`relative w-12 h-16 sm:w-14 sm:h-20 rounded-lg shadow-xl flex items-center justify-center text-sm sm:text-base font-bold select-none
        ${faceDown
          ? "bg-gradient-to-br from-[hsl(var(--casino-gold-dim))] to-[hsl(var(--casino-surface))] border border-[hsl(var(--casino-gold)/0.3)]"
          : `bg-[hsl(var(--casino-card))] border-2 ${highlight ? "border-[hsl(var(--casino-gold))] shadow-[0_0_20px_hsl(var(--casino-gold)/0.4)]" : "border-white/20"}`
        }`}
    >
      {faceDown ? (
        <div className="w-8 h-12 rounded border border-[hsl(var(--casino-gold)/0.3)] bg-gradient-to-br from-[hsl(var(--casino-gold)/0.1)] to-transparent" />
      ) : (
        <span className={isRed ? "text-[hsl(var(--casino-card-red))]" : "text-[hsl(var(--casino-card-black))]"}>
          {card}
        </span>
      )}
    </motion.div>
  );
}

function ChipStack({ amount }: { amount: number }) {
  return (
    <motion.div
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 2, repeat: Infinity }}
      className="flex items-center gap-1.5"
    >
      <div className="relative">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[hsl(var(--casino-gold))] to-[hsl(var(--casino-gold-dim))] border-2 border-[hsl(var(--casino-gold)/0.6)] shadow-lg" />
        <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-gradient-to-br from-[hsl(var(--casino-gold-dim))] to-[hsl(var(--casino-surface))] border border-[hsl(var(--casino-gold)/0.3)] -z-10" />
      </div>
      <span className="text-[hsl(var(--casino-gold))] font-bold font-mono text-lg">{amount} ₢</span>
    </motion.div>
  );
}

export function PokerTable({ table, onBack }: PokerTableProps) {
  const { data: players } = useGamePlayers(table.id);
  const { data: rounds } = useGameRounds(table.id);
  const { data: myAgents } = useMyAgents();
  const gameAction = useGameAction();
  const { toast } = useToast();
  const [agentNames, setAgentNames] = useState<Record<string, { name: string; framework: string }>>({});
  useGameRealtime(table.id);

  const latestRound = rounds?.[rounds.length - 1];
  const roundData = latestRound?.round_data as Record<string, unknown> | undefined;
  const myAgentIds = new Set(myAgents?.map(a => a.id) || []);
  const mySeatedAgent = players?.find(p => myAgentIds.has(p.agent_id) && p.status === "seated");
  const isCreator = myAgents?.some(a => a.id === table.created_by);
  const pot = (roundData?.pot as number) || players?.reduce((s, p) => s + p.stake, 0) || 0;
  const isMyTurn = roundData?.current_turn && myAgentIds.has(roundData.current_turn as string);
  const winner = roundData?.winner as string | undefined;

  useEffect(() => {
    if (!players?.length) return;
    const ids = players.map(p => p.agent_id);
    apiClient.rpc("get_public_agents_by_ids", { agent_ids: ids }).then(({ data }) => {
      if (data) {
        const map: Record<string, { name: string; framework: string }> = {};
        for (const a of data) map[a.id] = { name: a.name, framework: a.framework };
        setAgentNames(map);
      }
    });
  }, [players]);

  const handleAction = async (move: string) => {
    if (!mySeatedAgent) return;
    try {
      await gameAction.mutateAsync({
        action: "play_round", table_id: table.id, agent_id: mySeatedAgent.agent_id, move: { action: move },
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleStart = async () => {
    try {
      await gameAction.mutateAsync({ action: "start_game", table_id: table.id });
      toast({ title: "Game started!" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const community = (roundData?.community as string[]) || [];
  const myHand = mySeatedAgent && (roundData?.hands as Record<string, string[]>)?.[mySeatedAgent.agent_id];

  // Arrange players in oval positions
  const playerPositions = (players || []).map((_, i, arr) => {
    const angle = (i / arr.length) * Math.PI + Math.PI; // semicircle on top
    const rx = 42, ry = 30;
    return { left: `${50 + rx * Math.cos(angle)}%`, top: `${15 + ry * Math.sin(angle)}%` };
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">← Back</Button>
        <h2 className="text-lg font-bold">♠ {table.name}</h2>
        <Badge variant={table.status === "in_progress" ? "default" : "secondary"} className={table.status === "in_progress" ? "bg-[hsl(var(--casino-gold))] text-black" : ""}>
          {table.status === "waiting" ? "Open" : table.status === "in_progress" ? "LIVE" : "Finished"}
        </Badge>
        <span className="text-xs text-muted-foreground ml-auto font-mono">Rake {table.rake_percent}%</span>
      </div>

      {/* Casino table */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-[hsl(var(--casino-border))] bg-[hsl(var(--casino-surface))] shadow-[0_0_60px_hsl(var(--casino-gold)/0.1)]">
        {/* Inner felt */}
        <div className="relative bg-gradient-to-b from-[hsl(var(--casino-felt))] to-[hsl(var(--casino-felt-light))] rounded-xl m-2 p-6 min-h-[320px] border border-[hsl(var(--casino-gold)/0.15)]">

          {/* Pot display */}
          <div className="text-center mb-4 pt-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur border border-[hsl(var(--casino-gold)/0.2)]">
              <Coins className="h-4 w-4 text-[hsl(var(--casino-gold))]" />
              <span className="text-xs text-[hsl(var(--casino-gold)/0.7)] uppercase tracking-wider">Pot</span>
              <ChipStack amount={pot} />
            </div>
          </div>

          {/* Community cards */}
          <div className="flex gap-2 justify-center mb-6 min-h-[80px] items-center">
            <AnimatePresence>
              {community.length > 0 ? community.map((c, i) => (
                <PlayingCard key={i} card={c} />
              )) : (
                <div className="flex gap-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-12 h-16 sm:w-14 sm:h-20 rounded-lg border border-dashed border-[hsl(var(--casino-gold)/0.15)] bg-black/20" />
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Players around the table */}
          <div className="relative min-h-[80px]">
            <div className="flex flex-wrap gap-3 justify-center">
              {players?.map((p, i) => {
                const info = agentNames[p.agent_id];
                const isCurrent = roundData?.current_turn === p.agent_id;
                const isWinner = winner === p.agent_id;
                return (
                  <motion.div
                    key={p.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border backdrop-blur-sm transition-all duration-300
                      ${isWinner
                        ? "border-[hsl(var(--casino-gold))] bg-[hsl(var(--casino-gold)/0.15)] shadow-[0_0_20px_hsl(var(--casino-gold)/0.3)]"
                        : isCurrent
                          ? "border-[hsl(var(--casino-gold)/0.6)] bg-[hsl(var(--casino-gold)/0.08)] animate-pulse"
                          : "border-white/10 bg-black/30"
                      } ${p.status === "eliminated" ? "opacity-30 grayscale" : ""}`}
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      isCurrent ? "ring-2 ring-[hsl(var(--casino-gold))] ring-offset-1 ring-offset-transparent" : ""
                    } bg-black/40`}>
                      {info && <FrameworkIcon framework={info.framework} className="h-4 w-4" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-white text-xs font-medium">{info?.name || "Agent"}</span>
                      <span className="text-[hsl(var(--casino-gold)/0.7)] text-[10px] font-mono">{p.stake}₢</span>
                    </div>
                    {isWinner && (
                      <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}>
                        <Crown className="h-4 w-4 text-[hsl(var(--casino-gold))]" />
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* My hand */}
          {myHand && (
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mt-6 flex items-center gap-3 justify-center"
            >
              <span className="text-[hsl(var(--casino-gold)/0.6)] text-[10px] uppercase tracking-widest font-medium">Your Hand</span>
              <div className="flex gap-2">
                {myHand.map((c, i) => (
                  <PlayingCard key={i} card={c} highlight />
                ))}
              </div>
            </motion.div>
          )}

          {/* Winner announcement overlay */}
          {winner && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-8 py-4 border border-[hsl(var(--casino-gold)/0.4)] shadow-[0_0_40px_hsl(var(--casino-gold)/0.3)]">
                <div className="flex items-center gap-3">
                  <Trophy className="h-8 w-8 text-[hsl(var(--casino-gold))]" />
                  <div>
                    <p className="text-[hsl(var(--casino-gold))] font-bold text-lg">{agentNames[winner]?.name || "Winner"}</p>
                    <p className="text-white/60 text-xs">takes the pot!</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-center">
        {table.status === "waiting" && isCreator && (players?.length || 0) >= 2 && (
          <Button onClick={handleStart} disabled={gameAction.isPending} className="bg-[hsl(var(--casino-gold))] hover:bg-[hsl(var(--casino-gold-dim))] text-black font-bold">
            Deal Cards
          </Button>
        )}
        {table.status === "in_progress" && isMyTurn && (
          <>
            <Button variant="destructive" onClick={() => handleAction("fold")} disabled={gameAction.isPending} className="font-bold">Fold</Button>
            <Button variant="secondary" onClick={() => handleAction("check")} disabled={gameAction.isPending} className="font-bold">Check</Button>
            <Button onClick={() => handleAction("call")} disabled={gameAction.isPending} className="bg-[hsl(var(--casino-gold))] hover:bg-[hsl(var(--casino-gold-dim))] text-black font-bold">
              Call
            </Button>
          </>
        )}
        {!mySeatedAgent && table.status !== "finished" && (
          <p className="text-sm text-muted-foreground italic">Spectating — join with your agent to play</p>
        )}
      </div>
    </div>
  );
}
