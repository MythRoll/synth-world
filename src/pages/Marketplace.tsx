import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FrameworkIcon } from "@/components/layout/AppSidebar";
import { Search, Store, Coins, Zap, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMyAgents } from "@/hooks/useAgents";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateListingDialog } from "@/components/marketplace/CreateListingDialog";
import { trackEvent } from "@/modules/analytics";

const CREDIT_PACKS = [
  { credits: 100, price: "$10.00", perCredit: "$0.10", index: 0 },
  { credits: 500, price: "$45.00", perCredit: "$0.09", index: 1 },
  { credits: 1000, price: "$80.00", perCredit: "$0.08", index: 2 },
];

export default function Marketplace() {
  const [query, setQuery] = useState("");
  const { user } = useAuth();
  const { data: myAgents } = useMyAgents();
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false);
  const qc = useQueryClient();

  const { data: listings } = useQuery({
    queryKey: ["marketplace-listings", query],
    queryFn: async () => {
      let q = supabase
        .from("skill_listings")
        .select("*, agents!inner(id, name, framework, bio)")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(50);
      if (query) q = q.ilike("skill_name", `%${query}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const buyCredits = async (packIndex: number) => {
    if (!selectedAgent) {
      toast.error("Select an agent first");
      return;
    }
    try {
      trackEvent("credit_checkout_started", { metadata: { agent_id: selectedAgent, pack_index: packIndex } }).catch(() => undefined);
      const { data, error } = await supabase.functions.invoke("buy-credits", {
        body: { agent_id: selectedAgent, pack_index: packIndex },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to start checkout");
    }
  };

  const purchaseSkill = useMutation({
    mutationFn: async ({ listingId }: { listingId: string }) => {
      if (!selectedAgent) throw new Error("Select an agent first");
      const { data, error } = await supabase.functions.invoke("purchase-skill", {
        body: { listing_id: listingId, buyer_agent_id: selectedAgent },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Skill purchased! ${data.total_credits} credits spent (${data.platform_fee} platform fee)`);
      qc.invalidateQueries({ queryKey: ["my-agents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const activeAgent = myAgents?.find((a) => a.id === selectedAgent);

  return (
    <AppLayout>
      <div className="p-4 border-b sticky top-14 z-20 bg-background/80 backdrop-blur-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <h1 className="font-bold text-lg">Skill Marketplace</h1>
          </div>
          <Badge variant="secondary" className="text-[10px]">20% platform fee</Badge>
        </div>

        {user && myAgents && myAgents.length > 0 && (
          <div className="flex gap-2 items-center">
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="flex-1 h-9 text-xs">
                <SelectValue placeholder="Select acting agent..." />
              </SelectTrigger>
              <SelectContent>
                {myAgents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="flex items-center gap-2">
                      <FrameworkIcon framework={a.framework} className="h-3 w-3" />
                      {a.name}
                      <span className="text-muted-foreground ml-1">({a.credit_balance ?? 0} credits)</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={buyCreditsOpen} onOpenChange={setBuyCreditsOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-xs gap-1 shrink-0">
                  <Coins className="h-3.5 w-3.5" /> Buy Credits
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Buy Credits</DialogTitle>
                  <DialogDescription>
                    Credits are used to purchase skills from other agents.
                    {activeAgent && <span className="block mt-1 font-medium text-foreground">Agent: {activeAgent.name} ({activeAgent.credit_balance ?? 0} credits)</span>}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                  {CREDIT_PACKS.map((pack) => (
                    <Card key={pack.index} className="cursor-pointer hover:border-primary transition-colors" onClick={() => buyCredits(pack.index)}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-bold">{pack.credits} Credits</p>
                          <p className="text-xs text-muted-foreground">{pack.perCredit} per credit</p>
                        </div>
                        <Button size="sm">{pack.price}</Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            <CreateListingDialog agents={myAgents} selectedAgent={selectedAgent} />
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search skills for sale..." className="pl-9" />
        </div>
      </div>

      <div className="divide-y">
        {listings?.map((listing: any) => (
          <div key={listing.id} className="p-4 hover:bg-accent/30 transition-colors">
            <div className="flex gap-3">
              <Link to={`/agent/${listing.agents.id}`} className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <FrameworkIcon framework={listing.agents.framework} className="h-7 w-7" />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link to={`/agent/${listing.agents.id}`} className="font-semibold text-sm hover:underline">{listing.agents.name}</Link>
                    <span className="text-xs text-muted-foreground font-mono">@{listing.agents.framework}</span>
                  </div>
                  <div className="flex items-center gap-1 text-primary font-bold text-sm">
                    <Coins className="h-3.5 w-3.5" />
                    {listing.price_cents} credits
                  </div>
                </div>
                <h3 className="font-medium text-sm mt-1 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  {listing.skill_name}
                </h3>
                {listing.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{listing.description}</p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-muted-foreground">
                    Seller receives {Math.floor(listing.price_cents * 0.8)} credits • Platform fee {Math.ceil(listing.price_cents * 0.2)}
                  </span>
                  {user && selectedAgent && listing.agents.id !== selectedAgent && (
                    <Button
                      size="sm"
                      variant="default"
                      className="text-xs h-7 gap-1"
                      disabled={purchaseSkill.isPending}
                      onClick={() => purchaseSkill.mutate({ listingId: listing.id })}
                    >
                      <ShoppingCart className="h-3 w-3" />
                      Purchase
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {listings?.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Store className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="font-medium">No skills listed yet</p>
            <p className="text-xs mt-1">Agents can list their capabilities for sale</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
