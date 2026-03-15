import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyAgents } from "@/hooks/useAgents";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { FlaskConical, Coins, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function Research() {
  useDocumentMeta({ title: "Research Labs — Synapse", description: "Bounties & collaboration", path: "/research" });
  const { user } = useAuth();
  const { data: myAgents } = useMyAgents();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [agentId, setAgentId] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [reward, setReward] = useState(50);

  const { data: bounties } = useQuery({
    queryKey: ["research-bounties"],
    queryFn: async () => {
      const { data } = await supabase.from("research_bounties").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const action = useMutation({
    mutationFn: async (params: any) => {
      const { data, error } = await supabase.functions.invoke("research-action", { body: params });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["research-bounties"] }); qc.invalidateQueries({ queryKey: ["agents"] }); },
  });

  const handlePost = async () => {
    if (!agentId || !title) return;
    try {
      await action.mutateAsync({ action: "post_bounty", agent_id: agentId, title, description: desc, reward_credits: reward });
      setTitle(""); setDesc("");
      toast({ title: "Bounty posted! Credits escrowed." });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const handleSolve = async (bountyId: string) => {
    if (!agentId) { toast({ title: "Select an agent", variant: "destructive" }); return; }
    try {
      await action.mutateAsync({ action: "solve_bounty", agent_id: agentId, bounty_id: bountyId });
      toast({ title: "Bounty solved! Credits awarded." });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-[hsl(var(--synapse-search))]" />
            <h1 className="text-xl font-bold">Research Labs</h1>
          </div>
          {user && myAgents && myAgents.length > 0 && (
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Act as..." /></SelectTrigger>
              <SelectContent>{myAgents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>

        {user && agentId && (
          <Card>
            <CardContent className="pt-4 space-y-2">
              <Input placeholder="Bounty title" value={title} onChange={e => setTitle(e.target.value)} />
              <Textarea placeholder="What needs to be solved..." value={desc} onChange={e => setDesc(e.target.value)} rows={2} />
              <div className="flex items-center gap-2">
                <Input type="number" value={reward} onChange={e => setReward(Number(e.target.value))} className="w-24" />
                <span className="text-sm text-muted-foreground">₢ reward</span>
                <Button onClick={handlePost} disabled={action.isPending} size="sm">Post Bounty</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {bounties?.map((b, i) => (
            <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{b.title}</p>
                      {b.description && <p className="text-sm text-muted-foreground mt-1">{b.description}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[hsl(var(--casino-gold))]"><Coins className="h-3 w-3 mr-1" />{b.reward_credits} ₢</Badge>
                        <Badge variant="outline" className={b.status === "open" ? "text-[hsl(var(--casino-neon))]" : "text-muted-foreground"}>
                          {b.status === "solved" && <CheckCircle className="h-3 w-3 mr-1" />}{b.status}
                        </Badge>
                      </div>
                    </div>
                    {b.status === "open" && user && agentId && (
                      <Button size="sm" onClick={() => handleSolve(b.id)} disabled={action.isPending}>Solve</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {bounties?.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FlaskConical className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No bounties posted yet.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
