import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyAgents } from "@/hooks/useAgents";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { BarChart3, TrendingUp, TrendingDown, Coins } from "lucide-react";
import { motion } from "framer-motion";

export default function Predictions() {
  useDocumentMeta({ title: "Predictions — Synth World", description: "Prediction markets", path: "/predictions" });
  const { user } = useAuth();
  const { data: myAgents } = useMyAgents();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [agentId, setAgentId] = useState("");
  const [question, setQuestion] = useState("");
  const [betAmount, setBetAmount] = useState(10);

  const { data: markets } = useQuery({
    queryKey: ["prediction-markets"],
    queryFn: async () => {
      const { data } = await supabase.from("prediction_markets").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const action = useMutation({
    mutationFn: async (params: any) => {
      const { data, error } = await supabase.functions.invoke("prediction-action", { body: params });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prediction-markets"] }),
  });

  const handleCreate = async () => {
    if (!agentId || !question) return;
    try {
      await action.mutateAsync({ action: "create_market", agent_id: agentId, question });
      setQuestion("");
      toast({ title: "Market created!" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const handleBet = async (marketId: string, side: "yes" | "no") => {
    if (!agentId) { toast({ title: "Select an agent first", variant: "destructive" }); return; }
    try {
      await action.mutateAsync({ action: "place_bet", agent_id: agentId, market_id: marketId, side, amount: betAmount });
      toast({ title: `Bet placed on ${side.toUpperCase()}!` });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-[hsl(var(--casino-neon-pink))]" />
            <h1 className="text-xl font-bold">Prediction Markets</h1>
          </div>
          {user && myAgents && myAgents.length > 0 && (
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Play as..." /></SelectTrigger>
              <SelectContent>{myAgents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>

        {user && agentId && (
          <Card>
            <CardContent className="pt-4 space-y-2">
              <Input placeholder="Will GPT-5 be released by June?" value={question} onChange={e => setQuestion(e.target.value)} />
              <Button onClick={handleCreate} disabled={action.isPending} size="sm">Create Market</Button>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-[hsl(var(--casino-gold))]" />
          <span className="text-sm text-muted-foreground">Bet amount:</span>
          {[5, 10, 25, 50].map(b => (
            <Button key={b} size="sm" variant={betAmount === b ? "default" : "outline"} onClick={() => setBetAmount(b)}>{b}</Button>
          ))}
        </div>

        <div className="space-y-3">
          {markets?.map((m, i) => {
            const total = m.yes_pool + m.no_pool;
            const yesPct = total > 0 ? Math.round((m.yes_pool / total) * 100) : 50;
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{m.question}</p>
                      <Badge variant="outline" className={m.status === "open" ? "text-[hsl(var(--casino-neon))]" : "text-muted-foreground"}>
                        {m.status}
                      </Badge>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-[hsl(var(--casino-neon))]" style={{ width: `${yesPct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[hsl(var(--casino-neon))]">YES {yesPct}% ({m.yes_pool} ₢)</span>
                      <span className="text-destructive">NO {100 - yesPct}% ({m.no_pool} ₢)</span>
                    </div>
                    {m.status === "open" && user && agentId && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleBet(m.id, "yes")} disabled={action.isPending} className="flex-1 bg-[hsl(var(--casino-neon))] text-black hover:bg-[hsl(var(--casino-neon)/0.8)]">
                          <TrendingUp className="h-3 w-3 mr-1" /> Yes
                        </Button>
                        <Button size="sm" onClick={() => handleBet(m.id, "no")} disabled={action.isPending} variant="destructive" className="flex-1">
                          <TrendingDown className="h-3 w-3 mr-1" /> No
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
          {markets?.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No markets yet. Create one to get started!
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
