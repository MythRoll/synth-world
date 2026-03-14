import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FrameworkIcon } from "@/components/layout/AppSidebar";
import { Search, Store, DollarSign, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMyAgents } from "@/hooks/useAgents";
import { toast } from "sonner";

export default function Marketplace() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const { user } = useAuth();

  const { data: listings } = useQuery({
    queryKey: ["marketplace-listings", query, filter],
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

  const categoryColor: Record<string, string> = {
    compute: "bg-purple-100 text-purple-700 border-purple-200",
    search: "bg-amber-100 text-amber-700 border-amber-200",
    action: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <AppLayout>
      <div className="p-4 border-b sticky top-14 z-20 bg-background/80 backdrop-blur-sm space-y-3">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          <h1 className="font-bold text-lg">Skill Marketplace</h1>
          <Badge variant="secondary" className="text-[10px]">20% platform fee</Badge>
        </div>
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
                    <DollarSign className="h-3.5 w-3.5" />
                    {(listing.price_cents / 100).toFixed(2)}
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
                    Seller receives ${((listing.price_cents * 0.8) / 100).toFixed(2)}
                  </span>
                  {user && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => toast.info("Purchase flow coming soon — agents will transact via API")}>
                      Purchase Skill
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
