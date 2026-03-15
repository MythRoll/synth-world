import { useGamePlayers, useGameRounds, useGameRealtime, useGameAction } from "@/hooks/useGames";
import { useMyAgents } from "@/hooks/useAgents";
import { FrameworkIcon } from "@/components/layout/AppSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PokerTableProps {
  table: any;
  onBack: () => void;
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

  // Fetch agent names for display
  useEffect(() => {
    if (!players?.length) return;
    const ids = players.map(p => p.agent_id);
    supabase.rpc("get_public_agents_by_ids", { agent_ids: ids }).then(({ data }) => {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>
        <h2 className="text-lg font-bold">{table.name}</h2>
        <Badge variant={table.status === "waiting" ? "secondary" : table.status === "in_progress" ? "default" : "outline"}>
          {table.status}
        </Badge>
        <span className="text-sm text-muted-foreground ml-auto">Rake: {table.rake_percent}%</span>
      </div>

      {/* Poker felt */}
      <Card className="bg-emerald-950/80 border-emerald-800 p-6 relative min-h-[280px]">
        {/* Pot */}
        <div className="text-center mb-4">
          <span className="text-emerald-300 text-sm">POT</span>
          <div className="text-2xl font-bold text-amber-400 font-mono">{pot} ₢</div>
        </div>

        {/* Community cards */}
        {community.length > 0 && (
          <div className="flex gap-2 justify-center mb-6">
            {community.map((c, i) => (
              <div key={i} className="bg-white text-foreground rounded-md px-3 py-4 text-lg font-bold shadow-lg min-w-[40px] text-center">
                {c}
              </div>
            ))}
          </div>
        )}

        {/* Seated players */}
        <div className="flex flex-wrap gap-3 justify-center">
          {players?.map(p => {
            const info = agentNames[p.agent_id];
            const isCurrent = roundData?.current_turn === p.agent_id;
            return (
              <div key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                isCurrent ? "border-amber-400 bg-amber-400/10" : "border-emerald-700 bg-emerald-900/50"
              } ${p.status === "eliminated" ? "opacity-40" : ""}`}>
                {info && <FrameworkIcon framework={info.framework} />}
                <span className="text-emerald-100 text-sm font-medium">{info?.name || "Agent"}</span>
                <span className="text-emerald-400 text-xs font-mono">{p.stake}₢</span>
                {p.status === "won" && <Badge className="bg-amber-500 text-xs">Winner!</Badge>}
              </div>
            );
          })}
        </div>

        {/* My hand */}
        {myHand && (
          <div className="mt-6 flex gap-2 justify-center">
            <span className="text-emerald-400 text-xs mr-2 self-center">YOUR HAND</span>
            {myHand.map((c, i) => (
              <div key={i} className="bg-white text-foreground rounded-md px-3 py-4 text-lg font-bold shadow-lg border-2 border-primary">
                {c}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Actions */}
      <div className="flex gap-2 justify-center">
        {table.status === "waiting" && isCreator && (players?.length || 0) >= 2 && (
          <Button onClick={handleStart} disabled={gameAction.isPending}>Start Game</Button>
        )}
        {table.status === "in_progress" && isMyTurn && (
          <>
            <Button variant="destructive" onClick={() => handleAction("fold")} disabled={gameAction.isPending}>Fold</Button>
            <Button variant="secondary" onClick={() => handleAction("check")} disabled={gameAction.isPending}>Check</Button>
            <Button onClick={() => handleAction("call")} disabled={gameAction.isPending}>Call</Button>
          </>
        )}
        {!mySeatedAgent && table.status !== "in_progress" && table.status !== "finished" && (
          <p className="text-sm text-muted-foreground">Spectator mode — join with your agent to play</p>
        )}
      </div>
    </div>
  );
}
