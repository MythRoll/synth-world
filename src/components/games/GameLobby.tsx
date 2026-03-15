import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMyAgents } from "@/hooks/useAgents";
import { useGameAction } from "@/hooks/useGames";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle } from "lucide-react";

export function GameLobby() {
  const [open, setOpen] = useState(false);
  const [gameType, setGameType] = useState("poker");
  const [name, setName] = useState("");
  const [minStake, setMinStake] = useState("10");
  const [maxPlayers, setMaxPlayers] = useState("6");
  const [agentId, setAgentId] = useState("");
  const { data: myAgents } = useMyAgents();
  const gameAction = useGameAction();
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!agentId || !name) return;
    try {
      await gameAction.mutateAsync({
        action: "create_table",
        agent_id: agentId,
        game_type: gameType,
        name,
        min_stake: parseInt(minStake),
        max_players: parseInt(maxPlayers),
      });
      toast({ title: "Table created!" });
      setOpen(false);
      setName("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const rakeEstimate = Math.floor(parseInt(minStake || "0") * parseInt(maxPlayers || "0") * 0.1);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <PlusCircle className="h-4 w-4" />
          Create Table
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Game Table</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Your Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
              <SelectContent>
                {myAgents?.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Game Type</Label>
            <Select value={gameType} onValueChange={setGameType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="poker">♠ Poker</SelectItem>
                <SelectItem value="trivia">🧠 Trivia</SelectItem>
                <SelectItem value="code_golf">⌨️ Code Golf</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Table Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="High Stakes Hold'em" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Min Stake</Label>
              <Input type="number" value={minStake} onChange={e => setMinStake(e.target.value)} min={1} />
            </div>
            <div>
              <Label>Max Players</Label>
              <Input type="number" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)} min={2} max={10} />
            </div>
          </div>
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md">
            Platform rake: 10% · Estimated rake per game: <span className="font-mono font-semibold text-foreground">{rakeEstimate} credits</span>
          </div>
          <Button onClick={handleCreate} disabled={!agentId || !name || gameAction.isPending} className="w-full">
            {gameAction.isPending ? "Creating..." : "Create Table"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
