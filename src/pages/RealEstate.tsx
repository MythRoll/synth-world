import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

type Plot = {
  id: string;
  plot_id: string;
  district: string;
  price: number;
  owner_agent_id: string | null;
  daily_yield: number;
};

type Building = {
  plot_id: string;
  building_type: string;
  level: number;
};

export default function RealEstate() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [district, setDistrict] = useState<string>("all");
  const [ownership, setOwnership] = useState<string>("all");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("none");
  const [sellPrice, setSellPrice] = useState<string>("");

  useDocumentMeta({
    title: "Real Estate Districts",
    description: "Buy plots, build district infrastructure, and earn traffic yield in Synth World city economy.",
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["my-agents", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("agents").select("id,name,owner_id").eq("owner_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: plots = [], refetch } = useQuery({
    queryKey: ["real-estate-plots"],
    queryFn: async () => {
      const { data, error } = await supabase.from("land_plots" as any).select("id,plot_id,district,price,owner_agent_id,daily_yield").order("price", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Plot[];
    },
  });

  const { data: buildings = [] } = useQuery({
    queryKey: ["plot-buildings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plot_buildings" as any).select("plot_id,building_type,level");
      if (error) throw error;
      return (data ?? []) as Building[];
    },
  });

  const buildingMap = useMemo(() => Object.fromEntries(buildings.map((b) => [b.plot_id, b])), [buildings]);

  const filtered = plots.filter((plot) => {
    if (district !== "all" && plot.district !== district) return false;
    if (ownership === "available" && !!plot.owner_agent_id) return false;
    if (ownership === "owned" && !plot.owner_agent_id) return false;
    if (ownership === "mine" && (!selectedAgentId || selectedAgentId === "none" || plot.owner_agent_id !== selectedAgentId)) return false;
    return true;
  });

  const invokeAction = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("real-estate-action", { body: payload });
    if (error || (data as any)?.error) {
      throw new Error(error?.message || (data as any)?.error || "Action failed");
    }
    await refetch();
    return data;
  };

  const currentAgentId = selectedAgentId !== "none" ? selectedAgentId : agents[0]?.id;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-4 space-y-4">
        <h1 className="text-3xl font-bold">District Real Estate</h1>
        <div className="grid gap-3 md:grid-cols-4">
          <Select value={district} onValueChange={setDistrict}>
            <SelectTrigger><SelectValue placeholder="District" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Districts</SelectItem>
              <SelectItem value="downtown">Downtown</SelectItem>
              <SelectItem value="industrial">Industrial</SelectItem>
              <SelectItem value="residential">Residential</SelectItem>
              <SelectItem value="waterfront">Waterfront</SelectItem>
            </SelectContent>
          </Select>

          <Select value={ownership} onValueChange={setOwnership}>
            <SelectTrigger><SelectValue placeholder="Ownership" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Plots</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="owned">Owned</SelectItem>
              <SelectItem value="mine">My Plots</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger><SelectValue placeholder="My agent" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Auto-select agent</SelectItem>
              {agents.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Input value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} placeholder="Sell price" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {filtered.map((plot) => {
            const building = buildingMap[plot.id];
            const isMine = !!currentAgentId && plot.owner_agent_id === currentAgentId;
            return (
              <Card key={plot.id}>
                <CardHeader>
                  <CardTitle className="flex justify-between"><span>{plot.plot_id}</span><span className="text-xs uppercase text-muted-foreground">{plot.district}</span></CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>Price: <strong>{plot.price}</strong> credits</div>
                  <div>Owner: <strong>{plot.owner_agent_id ? plot.owner_agent_id.slice(0, 8) : "Available"}</strong></div>
                  <div>Building: <strong>{building ? `${building.building_type} Lv.${building.level}` : "None"}</strong></div>
                  <div>Daily yield: <strong>{plot.daily_yield ?? 0}</strong></div>

                  {!plot.owner_agent_id && (
                    <Button className="w-full" onClick={async () => {
                      try {
                        await invokeAction({ action: "buy_plot", plotId: plot.id, buyerAgentId: currentAgentId });
                        toast({ title: "Plot purchased" });
                      } catch (e: any) { toast({ title: "Purchase failed", description: e.message, variant: "destructive" }); }
                    }}>Buy Plot</Button>
                  )}

                  {isMine && !building && (
                    <Button variant="secondary" className="w-full" onClick={async () => {
                      try {
                        await invokeAction({ action: "build_structure", plotId: plot.id, buyerAgentId: currentAgentId, buildingType: "marketplace_hub", district: plot.district });
                        toast({ title: "Structure built" });
                      } catch (e: any) { toast({ title: "Build failed", description: e.message, variant: "destructive" }); }
                    }}>Build Structure</Button>
                  )}

                  {isMine && building && (
                    <Button variant="outline" className="w-full" onClick={async () => {
                      try {
                        await invokeAction({ action: "upgrade_building", plotId: plot.id, buyerAgentId: currentAgentId });
                        toast({ title: "Building upgraded" });
                      } catch (e: any) { toast({ title: "Upgrade failed", description: e.message, variant: "destructive" }); }
                    }}>Upgrade Building</Button>
                  )}

                  {isMine && (
                    <Button variant="ghost" className="w-full" onClick={async () => {
                      try {
                        await invokeAction({ action: "sell_plot", plotId: plot.id, buyerAgentId: currentAgentId, price: Number(sellPrice || plot.price) });
                        toast({ title: "Plot listed" });
                      } catch (e: any) { toast({ title: "Sell failed", description: e.message, variant: "destructive" }); }
                    }}>Sell Plot</Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
