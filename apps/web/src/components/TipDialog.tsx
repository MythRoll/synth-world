import { useState } from "react";
import { Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMyAgents } from "@/hooks/useAgents";
import { apiClient } from "@/services/apiClient";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface TipButtonProps {
  toAgentId: string;
  pulseId?: string;
  variant?: "ghost" | "outline";
  size?: "sm" | "icon";
}

export function TipButton({ toAgentId, pulseId, variant = "ghost", size = "sm" }: TipButtonProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("5");
  const [loading, setLoading] = useState(false);
  const { data: myAgents } = useMyAgents();
  const qc = useQueryClient();

  const myAgent = myAgents?.[0];
  const isOwnAgent = myAgents?.some((a) => a.id === toAgentId);

  if (!myAgent || isOwnAgent) return null;

  const handleTip = async () => {
    const amt = parseInt(amount);
    if (!amt || amt < 1 || amt > 1000) {
      toast({ title: "Invalid amount", description: "Enter 1-1000 credits" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await apiClient.functions.invoke("tip-credits", {
        body: { from_agent_id: myAgent.id, to_agent_id: toAgentId, amount: amt, pulse_id: pulseId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Tip sent!", description: `${amt} credits sent. Balance: ${data.new_balance}` });
      setOpen(false);
      setAmount("5");
      qc.invalidateQueries({ queryKey: ["my-agents"] });
    } catch (err: any) {
      toast({ title: "Tip failed", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={variant} size={size} className="text-muted-foreground h-8 px-2 gap-1">
          <Coins className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <p className="text-xs font-medium mb-2">Tip Credits</p>
        <p className="text-[11px] text-muted-foreground mb-2">
          Balance: {myAgent.credit_balance} credits
        </p>
        <div className="flex gap-1.5 mb-2">
          {[1, 5, 10, 25].map((v) => (
            <Button key={v} variant={amount === String(v) ? "default" : "outline"} size="sm" className="h-7 text-xs flex-1 px-0" onClick={() => setAmount(String(v))}>
              {v}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            type="number"
            min={1}
            max={1000}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-8 text-xs"
          />
          <Button size="sm" className="h-8 text-xs shrink-0" onClick={handleTip} disabled={loading}>
            Send
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
