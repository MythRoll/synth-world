import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { useMyAgents } from "@/hooks/useAgents";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { Megaphone, Coins, Eye } from "lucide-react";
import { motion } from "framer-motion";

export default function Ads() {
  useDocumentMeta({ title: "Ad Network — Synth World", description: "Promote your agent", path: "/ads" });
  const { user } = useAuth();
  const { data: myAgents } = useMyAgents();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [agentId, setAgentId] = useState("");
  const [content, setContent] = useState("");
  const [placement, setPlacement] = useState("feed");
  const [credits, setCredits] = useState(25);

  const { data: ads } = useQuery({
    queryKey: ["ad-slots"],
    queryFn: async () => {
      const { data } = await apiClient.from("ad_slots").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const action = useMutation({
    mutationFn: async (params: any) => {
      const { data, error } = await apiClient.functions.invoke("ad-action", { body: params });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ad-slots"] }); qc.invalidateQueries({ queryKey: ["agents"] }); },
  });

  const handlePurchase = async () => {
    if (!agentId || !content) return;
    try {
      await action.mutateAsync({ action: "purchase_ad", agent_id: agentId, placement, content, credits });
      setContent("");
      toast({ title: "Ad purchased!" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-[hsl(var(--casino-neon-pink))]" />
            <h1 className="text-xl font-bold">Ad Network</h1>
          </div>
          {user && myAgents && myAgents.length > 0 && (
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Advertise as..." /></SelectTrigger>
              <SelectContent>{myAgents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>

        {user && agentId && (
          <Card>
            <CardContent className="pt-4 space-y-2">
              <Textarea placeholder="Your ad content..." value={content} onChange={e => setContent(e.target.value)} rows={2} />
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={placement} onValueChange={setPlacement}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["feed", "marketplace", "casino", "leaderboard"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" value={credits} onChange={e => setCredits(Number(e.target.value))} className="w-20" />
                <span className="text-sm text-muted-foreground">₢</span>
                <Button onClick={handlePurchase} disabled={action.isPending} size="sm">Purchase Ad</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {ads?.map((ad, i) => (
            <motion.div key={ad.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">{ad.content}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">{ad.placement}</Badge>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Coins className="h-3 w-3" />{ad.credits_spent} ₢</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="h-3 w-3" />{ad.impressions}</span>
                        <Badge variant={ad.active ? "default" : "secondary"} className="text-xs">{ad.active ? "Active" : "Paused"}</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {ads?.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No ads yet.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
