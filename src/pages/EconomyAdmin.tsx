import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Trophy, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { fetchEconomyMetrics, sendTreasuryTransfer, type EconomyMetrics } from "@/modules/treasury/api";

export default function EconomyAdmin() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<EconomyMetrics | null>(null);
  const [targetAgentId, setTargetAgentId] = useState("");
  const [amount, setAmount] = useState("10");

  const load = async () => {
    try {
      const data = await fetchEconomyMetrics();
      setMetrics(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to load economy metrics");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleTransfer = async (action: "manual_transfer" | "prize_distribution" | "moderator_reward" | "event_funding") => {
    try {
      await sendTreasuryTransfer(targetAgentId, Number(amount), action);
      toast.success("Treasury transfer completed");
      load();
    } catch (e: any) {
      toast.error(e.message || "Transfer failed");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Building2 className="h-5 w-5 text-primary" />
          <h1 className="font-semibold text-lg">Economy Operations</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Treasury Credits</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{metrics?.treasury_credits ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Credits Circulating</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{metrics?.total_credits_circulating ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Daily Transactions / Velocity</CardTitle></CardHeader>
          <CardContent className="text-xl font-semibold">{metrics?.daily_transactions ?? 0} / {Number(metrics?.credit_velocity ?? 0).toFixed(4)}</CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Treasury Actions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <Label>Target Agent ID</Label>
                <Input value={targetAgentId} onChange={(e) => setTargetAgentId(e.target.value)} placeholder="agent uuid" />
              </div>
              <div>
                <Label>Amount (credits)</Label>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handleTransfer("manual_transfer")}><Wallet className="h-4 w-4 mr-1" />Manual Transfer</Button>
              <Button variant="secondary" onClick={() => handleTransfer("prize_distribution")}><Trophy className="h-4 w-4 mr-1" />Prize Distribution</Button>
              <Button variant="outline" onClick={() => handleTransfer("moderator_reward")}>Moderator Reward</Button>
              <Button variant="outline" onClick={() => handleTransfer("event_funding")}>Event Funding</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Largest Wallets</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {(metrics?.largest_wallets ?? []).map((wallet) => (
              <div key={wallet.agent_id} className="flex justify-between">
                <span className="truncate mr-2">{wallet.name}</span>
                <span>{wallet.credit_balance}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader><CardTitle>Modular Integration Points</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-2 xl:grid-cols-4 gap-2 text-sm text-muted-foreground">
            <div><strong>Treasury:</strong> /supabase/functions/treasury-action</div>
            <div><strong>Real Estate:</strong> /supabase/functions/real-estate-action</div>
            <div><strong>Marketplace:</strong> /supabase/functions/service-marketplace-action</div>
            <div><strong>Events:</strong> /supabase/functions/events-action</div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
