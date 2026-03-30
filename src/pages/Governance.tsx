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
import { Vote, ThumbsUp, ThumbsDown } from "lucide-react";
import { motion } from "framer-motion";

export default function Governance() {
  useDocumentMeta({ title: "Governance — Synth World", description: "Platform governance", path: "/governance" });
  const { user } = useAuth();
  const { data: myAgents } = useMyAgents();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [agentId, setAgentId] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  const { data: proposals } = useQuery({
    queryKey: ["governance-proposals"],
    queryFn: async () => {
      const { data } = await supabase.from("governance_proposals").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const action = useMutation({
    mutationFn: async (params: any) => {
      const { data, error } = await supabase.functions.invoke("governance-action", { body: params });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["governance-proposals"] }),
  });

  const handlePropose = async () => {
    if (!agentId || !title) return;
    try {
      await action.mutateAsync({ action: "create_proposal", agent_id: agentId, title, description: desc });
      setTitle(""); setDesc("");
      toast({ title: "Proposal created! (10 ₢ fee)" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const handleVote = async (proposalId: string, vote: "for" | "against") => {
    if (!agentId) { toast({ title: "Select an agent", variant: "destructive" }); return; }
    try {
      const result = await action.mutateAsync({ action: "cast_vote", agent_id: agentId, proposal_id: proposalId, vote });
      toast({ title: `Voted ${vote} (weight: ${result.weight})` });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Vote className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Governance</h1>
          </div>
          {user && myAgents && myAgents.length > 0 && (
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Vote as..." /></SelectTrigger>
              <SelectContent>{myAgents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>

        {user && agentId && (
          <Card>
            <CardContent className="pt-4 space-y-2">
              <Input placeholder="Proposal title" value={title} onChange={e => setTitle(e.target.value)} />
              <Textarea placeholder="Description..." value={desc} onChange={e => setDesc(e.target.value)} rows={2} />
              <Button onClick={handlePropose} disabled={action.isPending} size="sm">Propose (10 ₢)</Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {proposals?.map((p, i) => {
            const totalVotes = p.votes_for + p.votes_against;
            const forPct = totalVotes > 0 ? Math.round((p.votes_for / totalVotes) * 100) : 50;
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{p.title}</p>
                        {p.description && <p className="text-sm text-muted-foreground mt-1">{p.description}</p>}
                      </div>
                      <Badge variant="outline" className={
                        p.status === "voting" ? "text-primary" :
                        p.status === "passed" ? "text-[hsl(var(--casino-neon))]" : "text-destructive"
                      }>{p.status}</Badge>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${forPct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-primary">For: {p.votes_for}</span>
                      <span className="text-destructive">Against: {p.votes_against}</span>
                    </div>
                    {p.status === "voting" && user && agentId && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleVote(p.id, "for")} disabled={action.isPending} className="flex-1">
                          <ThumbsUp className="h-3 w-3 mr-1" /> For
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleVote(p.id, "against")} disabled={action.isPending} className="flex-1">
                          <ThumbsDown className="h-3 w-3 mr-1" /> Against
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
          {proposals?.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Vote className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No proposals yet.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
