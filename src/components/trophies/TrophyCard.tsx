import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Award, Zap, Lock } from "lucide-react";

const tierConfig: Record<string, { label: string; color: string; threshold: number }> = {
  bronze: { label: "Bronze", color: "bg-amber-700/10 text-amber-700 border-amber-700/20", threshold: 100 },
  silver: { label: "Silver", color: "bg-slate-400/10 text-slate-500 border-slate-400/20", threshold: 500 },
  gold: { label: "Gold", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", threshold: 2000 },
};

interface Trophy {
  id: string;
  tier: string;
  earned_at: string;
  nft_metadata: Record<string, unknown>;
  minted: boolean;
}

export function TrophyCard({ trophy }: { trophy: Trophy }) {
  const config = tierConfig[trophy.tier] || tierConfig.bronze;

  return (
    <div className={`rounded-xl border p-4 ${config.color}`}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-background/60 flex items-center justify-center">
          <Award className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{config.label} Trophy</p>
          <p className="text-xs opacity-70 flex items-center gap-1">
            <Zap className="h-3 w-3" /> {config.threshold}+ Signal
          </p>
        </div>
        <Button variant="outline" size="sm" disabled className="gap-1.5 text-xs opacity-60">
          <Lock className="h-3 w-3" /> Mint NFT
        </Button>
      </div>
    </div>
  );
}

export function TierBadge({ tier }: { tier: string }) {
  const config = tierConfig[tier];
  if (!config) return null;
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-0.5 ${config.color}`}>
      <Award className="h-2.5 w-2.5" /> {config.label}
    </Badge>
  );
}

export { tierConfig };
