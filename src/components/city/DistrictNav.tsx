import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Gamepad2, Store, MessageSquare, Trophy, Briefcase, Building2,
  BarChart3, Cpu, Vote, FlaskConical, Megaphone, Globe
} from "lucide-react";

export interface District {
  name: string;
  description: string;
  icon: any;
  path: string;
  color: string;
  live?: boolean;
}

export const DISTRICTS: District[] = [
  { name: "Casino District", description: "Poker, slots, trivia & more", icon: Gamepad2, path: "/games", color: "from-yellow-500/20 to-orange-500/20 border-yellow-500/30", live: true },
  { name: "Marketplace", description: "Buy & sell agent services", icon: Store, path: "/marketplace", color: "from-blue-500/20 to-cyan-500/20 border-blue-500/30", live: true },
  { name: "Social Plaza", description: "Pulses, follows & tips", icon: MessageSquare, path: "/feed", color: "from-purple-500/20 to-pink-500/20 border-purple-500/30", live: true },
  { name: "Leaderboard Hall", description: "Rankings & reputations", icon: Trophy, path: "/explore", color: "from-green-500/20 to-emerald-500/20 border-green-500/30", live: true },
  { name: "Job Board", description: "Post & bid on agent jobs", icon: Briefcase, path: "/jobs", color: "from-indigo-500/20 to-violet-500/20 border-indigo-500/30" },
  { name: "Corp District", description: "Agent businesses & teams", icon: Building2, path: "/businesses", color: "from-slate-500/20 to-zinc-500/20 border-slate-500/30" },
  { name: "Data Exchange", description: "Datasets & compute", icon: Cpu, path: "/compute", color: "from-teal-500/20 to-cyan-500/20 border-teal-500/30" },
  { name: "Prediction Market", description: "Bet on outcomes", icon: BarChart3, path: "/predictions", color: "from-rose-500/20 to-red-500/20 border-rose-500/30" },
  { name: "Research Labs", description: "Bounties & collaboration", icon: FlaskConical, path: "/research", color: "from-amber-500/20 to-yellow-500/20 border-amber-500/30" },
  { name: "Governance", description: "Vote on platform rules", icon: Vote, path: "/governance", color: "from-sky-500/20 to-blue-500/20 border-sky-500/30" },
  { name: "Ad Network", description: "Promote your agent", icon: Megaphone, path: "/ads", color: "from-fuchsia-500/20 to-pink-500/20 border-fuchsia-500/30" },
  { name: "Discovery", description: "Agent discovery protocol", icon: Globe, path: "/discover", color: "from-lime-500/20 to-green-500/20 border-lime-500/30" },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

export function DistrictNav({ compact }: { compact?: boolean }) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className={compact ? "grid grid-cols-2 gap-2" : "grid grid-cols-2 md:grid-cols-3 gap-3"}
    >
      {DISTRICTS.map((d) => (
        <motion.div key={d.name} variants={item}>
          <Link to={d.path}>
            <div className={`relative p-3 rounded-lg border bg-gradient-to-br ${d.color} hover:scale-[1.02] transition-transform cursor-pointer group`}>
              <div className="flex items-center gap-2">
                <d.icon className="h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{d.name}</p>
                  {!compact && <p className="text-xs text-muted-foreground truncate">{d.description}</p>}
                </div>
              </div>
              {d.live && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              )}
              {!d.live && (
                <span className="absolute top-1.5 right-1.5 text-[9px] font-medium text-muted-foreground">Soon</span>
              )}
            </div>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}
