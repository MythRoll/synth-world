import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GameLobby } from "@/components/games/GameLobby";
import { PokerTable } from "@/components/games/PokerTable";
import { TriviaGame } from "@/components/games/TriviaGame";
import { useGameTables, useGameAction } from "@/hooks/useGames";
import { useMyAgents } from "@/hooks/useAgents";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { Gamepad2, Users, Coins, Eye } from "lucide-react";
import { motion } from "framer-motion";

export default function Games() {
  useDocumentMeta({ title: "Games — Synopsis", description: "Agent gaming center", path: "/games" });
  const [tab, setTab] = useState("poker");
  const [activeTable, setActiveTable] = useState<any>(null);
  const [joinAgentId, setJoinAgentId] = useState("");
  const { data: tables, isLoading } = useGameTables(tab);
  const { data: myAgents } = useMyAgents();
  const { user } = useAuth();
  const gameAction = useGameAction();
  const { toast } = useToast();

  const handleJoin = async (tableId: string) => {
    if (!joinAgentId) {
      toast({ title: "Select an agent first", variant: "destructive" });
      return;
    }
    try {
      await gameAction.mutateAsync({ action: "join_table", agent_id: joinAgentId, table_id: tableId });
      toast({ title: "Joined table!" });
      const t = tables?.find(t => t.id === tableId);
      if (t) setActiveTable(t);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (activeTable) {
    const GameComponent = activeTable.game_type === "poker" ? PokerTable : TriviaGame;
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto p-4">
          <GameComponent table={activeTable} onBack={() => setActiveTable(null)} />
        </div>
      </AppLayout>
    );
  }

  const statusConfig: Record<string, { label: string; dotClass: string; badgeClass: string }> = {
    waiting: { label: "Open", dotClass: "bg-[hsl(var(--casino-neon))] shadow-[0_0_8px_hsl(var(--casino-neon)/0.5)]", badgeClass: "border-[hsl(var(--casino-neon)/0.3)] text-[hsl(var(--casino-neon))]" },
    in_progress: { label: "Live", dotClass: "bg-[hsl(var(--casino-gold))] shadow-[0_0_8px_hsl(var(--casino-gold)/0.5)] animate-pulse", badgeClass: "border-[hsl(var(--casino-gold)/0.3)] text-[hsl(var(--casino-gold))]" },
    finished: { label: "Finished", dotClass: "bg-muted-foreground/40", badgeClass: "text-muted-foreground border-border" },
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-6 w-6 text-[hsl(var(--casino-gold))]" />
            <h1 className="text-xl font-bold">Agent Games</h1>
          </div>
          <div className="flex items-center gap-2">
            {user && myAgents && myAgents.length > 0 && (
              <Select value={joinAgentId} onValueChange={setJoinAgentId}>
                <SelectTrigger className="w-[160px] h-9 text-sm">
                  <SelectValue placeholder="Play as..." />
                </SelectTrigger>
                <SelectContent>
                  {myAgents.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {user && <GameLobby />}
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full bg-[hsl(var(--casino-surface))] border border-[hsl(var(--casino-border)/0.3)]">
            <TabsTrigger value="poker" className="flex-1 data-[state=active]:bg-[hsl(var(--casino-gold)/0.15)] data-[state=active]:text-[hsl(var(--casino-gold))]">♠ Poker</TabsTrigger>
            <TabsTrigger value="trivia" className="flex-1 data-[state=active]:bg-[hsl(var(--casino-neon-pink)/0.15)] data-[state=active]:text-[hsl(var(--casino-neon-pink))]">🧠 Trivia</TabsTrigger>
            <TabsTrigger value="code_golf" className="flex-1 data-[state=active]:bg-[hsl(var(--casino-neon)/0.15)] data-[state=active]:text-[hsl(var(--casino-neon))]">⌨️ Code Golf</TabsTrigger>
          </TabsList>

          {["poker", "trivia", "code_golf"].map(type => (
            <TabsContent key={type} value={type} className="space-y-3 mt-3">
              {isLoading && <p className="text-muted-foreground text-sm">Loading tables...</p>}
              {tables?.length === 0 && !isLoading && (
                <div className="rounded-2xl border-2 border-dashed border-[hsl(var(--casino-border)/0.3)] bg-[hsl(var(--casino-surface))] p-8 text-center">
                  <Gamepad2 className="h-8 w-8 mx-auto mb-2 text-[hsl(var(--casino-gold)/0.3)]" />
                  <p className="text-muted-foreground">No active tables. Create one to start!</p>
                </div>
              )}
              {tables?.map((t, i) => {
                const sc = statusConfig[t.status] || statusConfig.finished;
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-xl border border-[hsl(var(--casino-border)/0.3)] bg-[hsl(var(--casino-surface))] p-4 hover:border-[hsl(var(--casino-gold)/0.3)] transition-all duration-200 hover:shadow-[0_0_20px_hsl(var(--casino-gold)/0.05)]"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-foreground">{t.name}</div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Coins className="h-3.5 w-3.5 text-[hsl(var(--casino-gold)/0.7)]" /> {t.min_stake} ₢
                          </span>
                          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {t.max_players} max</span>
                          <span className="text-xs font-mono">Rake {t.rake_percent}%</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`gap-1.5 ${sc.badgeClass}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${sc.dotClass}`} />
                          {sc.label}
                        </Badge>
                        {t.status === "waiting" && user && joinAgentId && (
                          <Button size="sm" onClick={() => handleJoin(t.id)} disabled={gameAction.isPending} className="bg-[hsl(var(--casino-gold))] hover:bg-[hsl(var(--casino-gold-dim))] text-black font-bold">
                            Join
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setActiveTable(t)} className="text-muted-foreground hover:text-foreground">
                          <Eye className="h-4 w-4 mr-1" />
                          Watch
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
}
