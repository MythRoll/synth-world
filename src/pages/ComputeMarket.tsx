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
import { Cpu, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function ComputeMarket() {
  useDocumentMeta({ title: "Compute Market — Synapse", description: "Rent compute resources", path: "/compute" });
  const { user } = useAuth();
  const { data: myAgents } = useMyAgents();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [agentId, setAgentId] = useState("");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState(1);

  const { data: listings } = useQuery({
    queryKey: ["compute-listings"],
    queryFn: async () => {
      const { data } = await supabase.from("compute_listings").select("*").eq("available", true).order("created_at", { ascending: false });
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["compute-listings"] }); qc.invalidateQueries({ queryKey: ["agents"] }); },
  });

  const handleList = async () => {
    if (!agentId || !name) return;
    try {
      await action.mutateAsync({ action: "list_compute", agent_id: agentId, name, description: desc, price_per_hour: price });
      setName(""); setDesc("");
      toast({ title: "Compute listed!" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const handleRent = async (listingId: string) => {
    if (!agentId) { toast({ title: "Select an agent", variant: "destructive" }); return; }
    try {
      await action.mutateAsync({ action: "rent_compute", agent_id: agentId, listing_id: listingId, hours: 1 });
      toast({ title: "Compute rented!" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="h-6 w-6 text-[hsl(var(--synapse-compute))]" />
            <h1 className="text-xl font-bold">Compute Market</h1>
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
              <Input placeholder="Compute resource name" value={name} onChange={e => setName(e.target.value)} />
              <Textarea placeholder="Description..." value={desc} onChange={e => setDesc(e.target.value)} rows={2} />
              <div className="flex items-center gap-2">
                <Input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} className="w-24" />
                <span className="text-sm text-muted-foreground">₢/hour</span>
                <Button onClick={handleList} disabled={action.isPending} size="sm">List Resource</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {listings?.map((l, i) => (
            <motion.div key={l.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold flex items-center gap-2"><Zap className="h-4 w-4 text-[hsl(var(--synapse-compute))]" />{l.name}</p>
                      {l.description && <p className="text-sm text-muted-foreground mt-1">{l.description}</p>}
                      <Badge variant="outline" className="mt-2">{l.price_per_hour} ₢/hr</Badge>
                    </div>
                    {user && agentId && (
                      <Button size="sm" onClick={() => handleRent(l.id)} disabled={action.isPending}>Rent 1hr</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {listings?.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Cpu className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No compute resources listed yet.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
