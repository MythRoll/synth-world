import { useGamePlayers, useGameRounds, useGameRealtime, useGameAction } from "@/hooks/useGames";
import { useMyAgents } from "@/hooks/useAgents";
import { FrameworkIcon } from "@/components/layout/AppSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Coins, Trophy, Zap, CheckCircle2, XCircle } from "lucide-react";

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
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
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
    setSelectedAnswer(answer);
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">← Back</Button>
        <h2 className="text-lg font-bold">🧠 {table.name}</h2>
        <Badge variant={table.status === "in_progress" ? "default" : "secondary"} className={table.status === "in_progress" ? "bg-[hsl(var(--casino-neon-pink))] text-white" : ""}>
          {table.status === "waiting" ? "Open" : table.status === "in_progress" ? "LIVE" : "Finished"}
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          <Coins className="h-3.5 w-3.5 text-[hsl(var(--casino-gold))]" />
          <span className="text-sm font-mono text-[hsl(var(--casino-gold))]">{pot} ₢</span>
        </div>
      </div>

      {/* Players */}
      <div className="flex flex-wrap gap-2">
        {players?.map((p, i) => {
          const info = agentNames[p.agent_id];
          const answered = !!answers[p.agent_id];
          const won = winners.includes(p.agent_id);
          return (
            <motion.div
              key={p.id}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm backdrop-blur-sm
                ${won
                  ? "border-[hsl(var(--casino-gold))] bg-[hsl(var(--casino-gold)/0.15)] shadow-[0_0_15px_hsl(var(--casino-gold)/0.25)]"
                  : answered
                    ? "border-[hsl(var(--casino-neon)/0.4)] bg-[hsl(var(--casino-neon)/0.08)]"
                    : "border-border bg-[hsl(var(--casino-surface-light))]"
                }`}
            >
              <div className={`h-6 w-6 rounded-full flex items-center justify-center bg-black/30 ${
                answered && !isFinished ? "ring-2 ring-[hsl(var(--casino-neon)/0.5)]" : ""
              }`}>
                {info && <FrameworkIcon framework={info.framework} className="h-3.5 w-3.5" />}
              </div>
              <span className="font-medium text-xs">{info?.name || "Agent"}</span>
              {answered && !isFinished && <Zap className="h-3 w-3 text-[hsl(var(--casino-neon))]" />}
              {won && <Trophy className="h-3 w-3 text-[hsl(var(--casino-gold))]" />}
            </motion.div>
          );
        })}
      </div>

      {/* Question */}
      {question && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border-2 border-[hsl(var(--casino-border))] bg-[hsl(var(--casino-surface))] overflow-hidden shadow-[0_0_40px_hsl(var(--casino-neon-pink)/0.08)]"
        >
          {/* Question header */}
          <div className="p-6 pb-4 bg-gradient-to-r from-[hsl(var(--casino-surface))] to-[hsl(var(--casino-surface-light))]">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-[hsl(var(--casino-neon-pink)/0.15)] border border-[hsl(var(--casino-neon-pink)/0.3)] flex items-center justify-center shrink-0">
                <Brain className="h-5 w-5 text-[hsl(var(--casino-neon-pink))]" />
              </div>
              <h3 className="text-lg font-semibold text-white leading-snug">{question.q}</h3>
            </div>
          </div>

          {/* Options */}
          <div className="p-4 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {question.options.map((opt, i) => {
              const isCorrect = opt === question.correct;
              const isSelected = selectedAnswer === opt || hasAnswered === opt;
              const showResult = isFinished;
              return (
                <motion.button
                  key={opt}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  onClick={() => handleAnswer(opt)}
                  disabled={!!hasAnswered || !mySeatedAgent || isFinished}
                  className={`relative text-left rounded-xl px-4 py-3 border transition-all duration-300 text-sm font-medium
                    ${showResult && isCorrect
                      ? "border-[hsl(var(--casino-neon))] bg-[hsl(var(--casino-neon)/0.1)] text-[hsl(var(--casino-neon))] shadow-[0_0_15px_hsl(var(--casino-neon)/0.2)]"
                      : showResult && isSelected && !isCorrect
                        ? "border-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.1)] text-[hsl(var(--destructive))]"
                        : isSelected
                          ? "border-[hsl(var(--casino-neon-pink))] bg-[hsl(var(--casino-neon-pink)/0.1)] text-white ring-1 ring-[hsl(var(--casino-neon-pink)/0.5)]"
                          : "border-white/10 bg-white/5 text-white/80 hover:border-[hsl(var(--casino-neon-pink)/0.4)] hover:bg-[hsl(var(--casino-neon-pink)/0.05)]"
                    } disabled:cursor-default`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/50 shrink-0">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                    {showResult && isCorrect && <CheckCircle2 className="h-4 w-4 ml-auto text-[hsl(var(--casino-neon))]" />}
                    {showResult && isSelected && !isCorrect && <XCircle className="h-4 w-4 ml-auto text-[hsl(var(--destructive))]" />}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Result footer */}
          {isFinished && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-6 py-4 border-t border-white/5 bg-black/30"
            >
              <p className="text-sm text-white/60">
                Correct: <span className="font-semibold text-[hsl(var(--casino-neon))]">{question.correct}</span>
                <span className="mx-2">·</span>
                {winners.length > 0 ? (
                  <span className="text-[hsl(var(--casino-gold))]">{winners.length} winner{winners.length > 1 ? "s" : ""} split the pot!</span>
                ) : (
                  <span className="text-white/40">No winners this round.</span>
                )}
              </p>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-center">
        {table.status === "waiting" && isCreator && (players?.length || 0) >= 2 && (
          <Button onClick={handleStart} disabled={gameAction.isPending} className="bg-[hsl(var(--casino-neon-pink))] hover:bg-[hsl(var(--casino-neon-pink)/0.8)] text-white font-bold">
            Start Trivia
          </Button>
        )}
        {!question && table.status === "waiting" && (
          <p className="text-sm text-muted-foreground italic">Waiting for players to join...</p>
        )}
      </div>
    </div>
  );
}
