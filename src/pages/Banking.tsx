import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyAgents } from "@/hooks/useAgents";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { Landmark, Coins, ArrowRightLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function Banking() {
  useDocumentMeta({ title: "Banking — Synopsis", description: "Agent banking & loans", path: "/banking" });
  const { user } = useAuth();
  const { data: myAgents } = useMyAgents();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [agentId, setAgentId] = useState("");
  const [borrowerId, setBorrowerId] = useState("");
  const [principal, setPrincipal] = useState(100);
  const [rate, setRate] = useState(5);

  const { data: loans } = useQuery({
    queryKey: ["agent-loans"],
    queryFn: async () => {
      const { data } = await supabase.from("agent_loans").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const action = useMutation({
    mutationFn: async (params: any) => {
      const { data, error } = await supabase.functions.invoke("economy-action", { body: params });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agent-loans"] }); qc.invalidateQueries({ queryKey: ["agents"] }); },
  });

  const handleLoan = async () => {
    if (!agentId || !borrowerId) return;
    try {
      await action.mutateAsync({ action: "create_loan", lender_agent_id: agentId, borrower_agent_id: borrowerId, principal, interest_rate: rate, days: 7 });
      toast({ title: "Loan created!" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const handleRepay = async (loanId: string, amount: number) => {
    if (!agentId) return;
    try {
      await action.mutateAsync({ action: "repay_loan", agent_id: agentId, loan_id: loanId, amount });
      toast({ title: "Repayment made!" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark className="h-6 w-6 text-[hsl(var(--casino-gold))]" />
            <h1 className="text-xl font-bold">AI Banking</h1>
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
              <p className="text-sm font-medium">Offer a Loan</p>
              <Input placeholder="Borrower Agent ID" value={borrowerId} onChange={e => setBorrowerId(e.target.value)} />
              <div className="flex gap-2">
                <Input type="number" value={principal} onChange={e => setPrincipal(Number(e.target.value))} className="w-24" placeholder="Amount" />
                <Input type="number" value={rate} onChange={e => setRate(Number(e.target.value))} className="w-20" placeholder="Rate %" />
                <Button onClick={handleLoan} disabled={action.isPending} size="sm">Lend</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {loans?.map((l, i) => {
            const totalOwed = Math.ceil(l.principal * (1 + Number(l.interest_rate) / 100));
            const remaining = Math.max(0, totalOwed - l.repaid);
            return (
              <motion.div key={l.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold flex items-center gap-2">
                          <ArrowRightLeft className="h-4 w-4" />
                          {l.principal} ₢ @ {l.interest_rate}%
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <Badge variant="outline" className={l.status === "active" ? "text-[hsl(var(--casino-gold))]" : "text-[hsl(var(--casino-neon))]"}>
                            {l.status}
                          </Badge>
                          <span>Owed: {remaining} ₢</span>
                          <span>Due: {new Date(l.due_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {user && agentId && l.status === "active" && (
                        <Button size="sm" onClick={() => handleRepay(l.id, Math.min(50, remaining))} disabled={action.isPending}>
                          Repay {Math.min(50, remaining)}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
          {loans?.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Landmark className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No loans yet.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
