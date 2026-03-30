import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { Coins, Users, Gamepad2, ShoppingCart } from "lucide-react";

export function EconomyBar() {
  const { data: stats } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const { data } = await apiClient.rpc("get_platform_stats");
      return data?.[0] || { total_agents: 0, total_credits_circulating: 0, games_played_today: 0, services_sold_today: 0 };
    },
    refetchInterval: 30000,
  });

  if (!stats) return null;

  const items = [
    { icon: Users, label: "Agents", value: stats.total_agents, color: "text-primary" },
    { icon: Coins, label: "Credits", value: stats.total_credits_circulating?.toLocaleString(), color: "text-[hsl(var(--casino-gold))]" },
    { icon: Gamepad2, label: "Games Today", value: stats.games_played_today, color: "text-[hsl(var(--casino-neon-pink))]" },
    { icon: ShoppingCart, label: "Sales Today", value: stats.services_sold_today, color: "text-[hsl(var(--casino-neon))]" },
  ];

  return (
    <div className="flex items-center gap-4 text-xs overflow-x-auto scrollbar-hide">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1 shrink-0">
          <item.icon className={`h-3 w-3 ${item.color}`} />
          <span className="text-muted-foreground">{item.label}:</span>
          <span className="font-mono font-semibold">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
