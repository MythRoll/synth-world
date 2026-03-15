import { useGamePlayers, useGameRounds, useGameRealtime, useGameAction } from "@/hooks/useGames";
import { useMyAgents } from "@/hooks/useAgents";
import { FrameworkIcon } from "@/components/layout/AppSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TriviaGameProps {
  table: any;
  onBack: () => void;
}

export function TriviaGame({ table, onBack }: TriviaGameProps) {
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
  const pot = players?.reduce((s, p) => s + p.stake, 0) || 0;

  const question = roundData?.question as { q: string; options: string[]; correct: string } | undefined;
  const answers = (roundData?.answers as Record<string, string>) || {};
  const hasAnswered = mySeatedAgent && answers[mySeatedAgent.agent_id];
  const isFinished = roundData?.status === "finished";
  const winners = (roundData?.winners as string[]) || [];

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

  const handleAnswer = async (answer: string) => {
    if (!mySeatedAgent) return;
    try {
      await gameAction.mutateAsync({
        action: "play_round", table_id: table.id, agent_id: mySeatedAgent.agent_id, move: { answer },
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleStart = async () => {
    try {
      await gameAction.mutateAsync({ action: "start_game", table_id: table.id });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button>
        <h2 className="text-lg font-bold">{table.name}</h2>
        <Badge variant={table.status === "in_progress" ? "default" : "secondary"}>{table.status}</Badge>
        <span className="text-sm text-muted-foreground ml-auto font-mono">{pot} ₢ pot</span>
      </div>

      {/* Players */}
      <div className="flex flex-wrap gap-2">
        {players?.map(p => {
          const info = agentNames[p.agent_id];
          const answered = !!answers[p.agent_id];
          const won = winners.includes(p.agent_id);
          return (
            <div key={p.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm ${
              won ? "border-amber-400 bg-amber-400/10" : answered ? "border-primary/30 bg-primary/5" : "border-border"
            }`}>
              {info && <FrameworkIcon framework={info.framework} />}
              <span className="font-medium">{info?.name || "Agent"}</span>
              {answered && !isFinished && <span className="text-xs text-muted-foreground">✓</span>}
              {won && <Badge className="bg-amber-500 text-xs">Winner!</Badge>}
            </div>
          );
        })}
      </div>

      {/* Question */}
      {question && (
        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">{question.q}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {question.options.map(opt => (
              <Button
                key={opt}
                variant={hasAnswered ? (opt === question.correct && isFinished ? "default" : "outline") : "outline"}
                className={`justify-start h-auto py-3 px-4 ${
                  isFinished && opt === question.correct ? "border-primary bg-primary/10" : ""
                } ${hasAnswered === opt ? "ring-2 ring-primary" : ""}`}
                onClick={() => handleAnswer(opt)}
                disabled={!!hasAnswered || !mySeatedAgent || isFinished}
              >
                {opt}
              </Button>
            ))}
          </div>
          {isFinished && (
            <p className="text-sm text-muted-foreground">
              Correct: <span className="font-semibold text-foreground">{question.correct}</span> ·
              {winners.length > 0 ? ` ${winners.length} winner(s) split the pot!` : " No winners this round."}
            </p>
          )}
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-center">
        {table.status === "waiting" && isCreator && (players?.length || 0) >= 2 && (
          <Button onClick={handleStart} disabled={gameAction.isPending}>Start Game</Button>
        )}
        {!question && table.status === "waiting" && (
          <p className="text-sm text-muted-foreground">Waiting for players to join...</p>
        )}
      </div>
    </div>
  );
}
