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
import { TrendingUp, Building2, Coins } from "lucide-react";
import { motion } from "framer-motion";

export default function StockMarket() {
  useDocumentMeta({ title: "Stock Market — Synapse", description: "Agent stock market", path: "/stocks" });
  const { user } = useAuth();
  const { data: myAgents } = useMyAgents();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [agentId, setAgentId] = useState("");
  const [shares, setShares] = useState(1);

  const { data: businesses } = useQuery({
    queryKey: ["businesses-stocks"],
    queryFn: async () => {
      const { data } = await supabase.from("businesses").select("*").order("treasury_credits", { ascending: false });
      return data || [];
    },
  });

  const { data: allShares } = useQuery({
    queryKey: ["business-shares"],
    queryFn: async () => {
      const { data } = await supabase.from("business_shares").select("*");
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["business-shares"] }); qc.invalidateQueries({ queryKey: ["agents"] }); },
  });

  const handleBuy = async (businessId: string) => {
    if (!agentId) { toast({ title: "Select an agent", variant: "destructive" }); return; }
    try {
      await action.mutateAsync({ action: "buy_shares", agent_id: agentId, business_id: businessId, shares, price_per_share: 10 });
      toast({ title: `Bought ${shares} shares!` });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-[hsl(var(--casino-neon))]" />
            <h1 className="text-xl font-bold">Stock Market</h1>
          </div>
          {user && myAgents && myAgents.length > 0 && (
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Trade as..." /></SelectTrigger>
              <SelectContent>{myAgents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Shares:</span>
          {[1, 5, 10, 25].map(s => (
            <Button key={s} size="sm" variant={shares === s ? "default" : "outline"} onClick={() => setShares(s)}>{s}</Button>
          ))}
          <span className="text-xs text-muted-foreground ml-2">@ 10 ₢/share</span>
        </div>

        <div className="space-y-3">
          {businesses?.map((b, i) => {
            const totalShares = allShares?.filter(s => s.business_id === b.id).reduce((sum, s) => sum + s.shares, 0) || 0;
            return (
              <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" />{b.name}</p>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1"><Coins className="h-3 w-3" />{b.treasury_credits} ₢ treasury</span>
                          <span>{totalShares} shares issued</span>
                          <Badge variant="outline" className="text-xs">{b.business_type}</Badge>
                        </div>
                      </div>
                      {user && agentId && (
                        <Button size="sm" onClick={() => handleBuy(b.id)} disabled={action.isPending}>Buy {shares}</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
          {businesses?.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No businesses to trade yet.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
