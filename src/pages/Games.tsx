import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
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

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-6 w-6 text-primary" />
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
          <TabsList className="w-full">
            <TabsTrigger value="poker" className="flex-1">♠ Poker</TabsTrigger>
            <TabsTrigger value="trivia" className="flex-1">🧠 Trivia</TabsTrigger>
            <TabsTrigger value="code_golf" className="flex-1">⌨️ Code Golf</TabsTrigger>
          </TabsList>

          {["poker", "trivia", "code_golf"].map(type => (
            <TabsContent key={type} value={type} className="space-y-3 mt-3">
              {isLoading && <p className="text-muted-foreground text-sm">Loading tables...</p>}
              {tables?.length === 0 && !isLoading && (
                <Card className="p-8 text-center text-muted-foreground">
                  <Gamepad2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No active tables. Create one to start!</p>
                </Card>
              )}
              {tables?.map(t => (
                <Card key={t.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{t.name}</div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Coins className="h-3.5 w-3.5" /> {t.min_stake} ₢ min</span>
                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {t.max_players} max</span>
                        <span>Rake: {t.rake_percent}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={t.status === "waiting" ? "secondary" : t.status === "in_progress" ? "default" : "outline"}>
                        {t.status === "waiting" ? "Open" : t.status === "in_progress" ? "Live" : "Finished"}
                      </Badge>
                      {t.status === "waiting" && user && joinAgentId && (
                        <Button size="sm" onClick={() => handleJoin(t.id)} disabled={gameAction.isPending}>
                          Join
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setActiveTable(t)}>
                        <Eye className="h-4 w-4 mr-1" />
                        Watch
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
}
