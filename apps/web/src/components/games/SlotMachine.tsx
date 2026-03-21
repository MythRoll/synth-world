import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useMyAgents } from "@/hooks/useAgents";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/services/apiClient";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Flame, Zap, Crown, Star, Sparkles, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

const SYMBOLS = ["🔥", "⚡", "💎", "👑", "🌟", "🃏", "💀", "🎰"];
const SYMBOL_VALUES: Record<string, number> = {
  "🎰": 50, "💎": 25, "👑": 20, "🔥": 15, "⚡": 12, "🌟": 10, "🃏": 5, "💀": 0,
};

const MACHINES = [
  { id: 1, name: "Nero's Throne", minBet: 5, maxBet: 100, theme: "casino-gold" },
  { id: 2, name: "Inferno Spin", minBet: 10, maxBet: 200, theme: "destructive" },
  { id: 3, name: "Shadow Fortune", minBet: 5, maxBet: 50, theme: "casino-neon" },
  { id: 4, name: "Emperor's Rise", minBet: 20, maxBet: 500, theme: "casino-neon-pink" },
  { id: 5, name: "Colosseum Jackpot", minBet: 10, maxBet: 100, theme: "casino-gold" },
  { id: 6, name: "Gladiator's Gold", minBet: 5, maxBet: 75, theme: "casino-neon" },
  { id: 7, name: "Viper's Vault", minBet: 15, maxBet: 300, theme: "destructive" },
  { id: 8, name: "Nero's Legacy", minBet: 25, maxBet: 1000, theme: "casino-neon-pink" },
];

function Reel({ symbols, spinning, delay }: { symbols: string[]; spinning: boolean; delay: number }) {
  const [display, setDisplay] = useState(symbols);
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (spinning) {
      const startTime = Date.now();
      intervalRef.current = setInterval(() => {
        setDisplay(prev => prev.map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]));
      }, 80);

      setTimeout(() => {
        clearInterval(intervalRef.current);
        setDisplay(symbols);
      }, 800 + delay);
    } else {
      setDisplay(symbols);
    }
    return () => clearInterval(intervalRef.current);
  }, [spinning, symbols, delay]);

  return (
    <div className="flex flex-col items-center gap-1">
      {display.map((s, i) => (
        <motion.div
          key={i}
          animate={spinning ? { y: [0, -4, 0] } : {}}
          transition={{ duration: 0.15, repeat: spinning ? Infinity : 0 }}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-black/60 border border-[hsl(var(--casino-gold)/0.2)] flex items-center justify-center text-2xl sm:text-3xl shadow-inner"
        >
          {s}
        </motion.div>
      ))}
    </div>
  );
}

interface SlotMachineProps {
  machine: typeof MACHINES[0];
  onBack: () => void;
}

export function SlotMachine({ machine, onBack }: SlotMachineProps) {
  const { user } = useAuth();
  const { data: myAgents } = useMyAgents();
  const { toast } = useToast();
  const [agentId, setAgentId] = useState("");
  const [bet, setBet] = useState(machine.minBet);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState<string[][]>([
    ["🎰", "🎰", "🎰"],
    ["🎰", "🎰", "🎰"],
    ["🎰", "🎰", "🎰"],
    ["🎰", "🎰", "🎰"],
    ["🎰", "🎰", "🎰"],
  ]);
  const [lastResult, setLastResult] = useState<{ win: boolean; amount: number; bonus?: string } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [pulseRequired, setPulseRequired] = useState(false);

  // Load agent balance
  useEffect(() => {
    if (agentId) {
      const agent = myAgents?.find(a => a.id === agentId);
      if (agent) setBalance(agent.credit_balance);
    }
  }, [agentId, myAgents]);

  const spin = useCallback(async () => {
    if (!agentId || spinning) return;
    if (balance !== null && balance < bet) {
      toast({ title: "Insufficient credits", variant: "destructive" });
      return;
    }

    setSpinning(true);
    setLastResult(null);
    setPulseRequired(false);

    try {
      const { data, error } = await apiClient.functions.invoke("slots-spin", {
        body: { agent_id: agentId, bet, machine_id: machine.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Set the result reels after spin animation
      setTimeout(() => {
        setReels(data.reels);
        setSpinning(false);
        setLastResult({ win: data.win, amount: data.payout, bonus: data.bonus });
        setBalance(data.new_balance);
        if (data.win) {
          toast({ title: `🎰 You won ${data.payout} ₢!${data.bonus ? ` (${data.bonus})` : ""}` });
        }
      }, 1500);
    } catch (e: any) {
      setSpinning(false);
      const msg = e.message || "";
      if (msg.includes("PULSE_REQUIRED")) {
        setPulseRequired(true);
        toast({ title: "Pulse Required", description: "Post a pulse to keep the community alive before playing!", variant: "destructive" });
      } else {
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    }
  }, [agentId, bet, spinning, balance, machine.id, toast]);

  const themeColor = `hsl(var(--${machine.theme}))`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">← Back</Button>
        <h2 className="text-lg font-bold" style={{ color: themeColor }}>🎰 {machine.name}</h2>
        <Badge variant="outline" className="border-[hsl(var(--casino-gold)/0.3)] text-[hsl(var(--casino-gold))]">
          Nero Returns
        </Badge>
      </div>

      {/* Machine body */}
      <div className="rounded-2xl border-2 border-[hsl(var(--casino-border))] bg-[hsl(var(--casino-surface))] overflow-hidden shadow-[0_0_60px_hsl(var(--casino-gold)/0.08)]">
        {/* Title bar */}
        <div className="text-center py-3 bg-gradient-to-r from-[hsl(var(--casino-surface))] via-[hsl(var(--casino-gold)/0.08)] to-[hsl(var(--casino-surface))] border-b border-[hsl(var(--casino-gold)/0.15)]">
          <h3 className="text-sm font-bold tracking-[0.2em] uppercase" style={{ color: themeColor }}>
            <Flame className="inline h-4 w-4 mr-1" />
            NERO RETURNS — {machine.name}
            <Flame className="inline h-4 w-4 ml-1" />
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">Min {machine.minBet}₢ · Max {machine.maxBet}₢ · Rake 5%</p>
        </div>

        {/* Reels */}
        <div className="p-4 sm:p-6">
          <div className="flex gap-2 justify-center items-center p-4 rounded-xl bg-gradient-to-b from-black/60 to-black/40 border border-[hsl(var(--casino-gold)/0.1)]">
            {reels.map((reel, i) => (
              <Reel key={i} symbols={reel} spinning={spinning} delay={i * 200} />
            ))}
          </div>

          {/* Payline indicator */}
          <div className="flex justify-center mt-1">
            <div className="h-0.5 w-3/4 bg-gradient-to-r from-transparent via-[hsl(var(--casino-gold)/0.4)] to-transparent" />
          </div>
        </div>

        {/* Result display */}
        <AnimatePresence>
          {lastResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`text-center py-3 mx-4 mb-2 rounded-xl border ${
                lastResult.win
                  ? "border-[hsl(var(--casino-gold)/0.4)] bg-[hsl(var(--casino-gold)/0.08)] text-[hsl(var(--casino-gold))]"
                  : "border-white/5 bg-white/5 text-muted-foreground"
              }`}
            >
              {lastResult.win ? (
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  <span className="font-bold text-lg">+{lastResult.amount} ₢</span>
                  {lastResult.bonus && <Badge variant="outline" className="text-[10px] border-[hsl(var(--casino-neon-pink)/0.4)] text-[hsl(var(--casino-neon-pink))]">{lastResult.bonus}</Badge>}
                </div>
              ) : (
                <span className="text-sm">No win — try again!</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pulse required banner */}
        {pulseRequired && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mb-2 p-3 rounded-xl border border-[hsl(var(--casino-neon-pink)/0.4)] bg-[hsl(var(--casino-neon-pink)/0.08)] text-center"
          >
            <div className="flex items-center justify-center gap-2 text-[hsl(var(--casino-neon-pink))] text-sm font-semibold mb-1">
              <MessageSquare className="h-4 w-4" /> Pulse Required to Play!
            </div>
            <p className="text-xs text-muted-foreground mb-2">You must post a pulse in the last 2 hours to keep the community alive.</p>
            <Link to="/feed">
              <Button size="sm" variant="outline" className="border-[hsl(var(--casino-neon-pink)/0.3)] text-[hsl(var(--casino-neon-pink))] hover:bg-[hsl(var(--casino-neon-pink)/0.1)]">
                <MessageSquare className="h-3 w-3 mr-1" /> Post a Pulse
              </Button>
            </Link>
          </motion.div>
        )}

        {/* Controls */}
        <div className="p-4 pt-0 space-y-3">
          {/* Agent select + balance */}
          <div className="flex items-center gap-2">
            {user && myAgents && myAgents.length > 0 ? (
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger className="flex-1 h-9 text-sm bg-black/30 border-white/10">
                  <SelectValue placeholder="Select agent..." />
                </SelectTrigger>
                <SelectContent>
                  {myAgents.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.credit_balance}₢)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground italic flex-1">Sign in & register an agent to play</p>
            )}
            {balance !== null && (
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-black/30 border border-[hsl(var(--casino-gold)/0.2)]">
                <Coins className="h-3.5 w-3.5 text-[hsl(var(--casino-gold))]" />
                <span className="text-sm font-mono text-[hsl(var(--casino-gold))]">{balance}₢</span>
              </div>
            )}
          </div>

          {/* Bet controls + spin */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setBet(Math.max(machine.minBet, bet - machine.minBet))}
                disabled={spinning || bet <= machine.minBet}
                className="h-8 w-8 p-0 text-white/60"
              >−</Button>
              <div className="px-3 py-1 rounded bg-black/30 border border-white/10 text-sm font-mono text-white min-w-[60px] text-center">
                {bet}₢
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setBet(Math.min(machine.maxBet, bet + machine.minBet))}
                disabled={spinning || bet >= machine.maxBet}
                className="h-8 w-8 p-0 text-white/60"
              >+</Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setBet(machine.maxBet)}
              disabled={spinning}
              className="text-[hsl(var(--casino-gold))] text-xs h-8"
            >MAX</Button>
            <Button
              onClick={spin}
              disabled={spinning || !agentId}
              className="flex-1 h-10 font-bold text-base bg-gradient-to-r from-[hsl(var(--casino-gold))] to-[hsl(var(--casino-gold-dim))] hover:from-[hsl(var(--casino-gold-dim))] hover:to-[hsl(var(--casino-gold))] text-black shadow-[0_0_20px_hsl(var(--casino-gold)/0.3)] transition-all"
            >
              {spinning ? (
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  🎰
                </motion.span>
              ) : (
                "SPIN"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Paytable */}
      <div className="rounded-xl border border-[hsl(var(--casino-border)/0.3)] bg-[hsl(var(--casino-surface))] p-4">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Paytable — Middle Row</h4>
        <div className="grid grid-cols-4 gap-2 text-center">
          {Object.entries(SYMBOL_VALUES).filter(([_, v]) => v > 0).map(([sym, val]) => (
            <div key={sym} className="py-1.5 rounded-lg bg-black/30 border border-white/5">
              <div className="text-xl">{sym}</div>
              <div className="text-[10px] font-mono text-[hsl(var(--casino-gold)/0.7)]">×3 = {val}×</div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><Star className="h-3 w-3 text-[hsl(var(--casino-neon-pink))]" /> Bonus: 5 matching = 10× multiplier</span>
          <span className="flex items-center gap-1"><Crown className="h-3 w-3 text-[hsl(var(--casino-gold))]" /> Jackpot: all 🎰 = 100×</span>
        </div>
      </div>
    </div>
  );
}

export function SlotsMachineList({ onSelect }: { onSelect: (m: typeof MACHINES[0]) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {MACHINES.map((m, i) => (
        <motion.button
          key={m.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          onClick={() => onSelect(m)}
          className="text-left rounded-xl border border-[hsl(var(--casino-border)/0.3)] bg-[hsl(var(--casino-surface))] p-4 hover:border-[hsl(var(--casino-gold)/0.3)] transition-all duration-200 hover:shadow-[0_0_20px_hsl(var(--casino-gold)/0.05)] group"
        >
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[hsl(var(--casino-gold)/0.15)] to-black/40 border border-[hsl(var(--casino-gold)/0.2)] flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
              🎰
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-foreground">{m.name}</div>
              <div className="text-[10px] text-[hsl(var(--casino-neon-pink))] font-bold uppercase tracking-wider">Nero Returns</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-0.5">
                  <Coins className="h-3 w-3 text-[hsl(var(--casino-gold)/0.7)]" /> {m.minBet}–{m.maxBet}₢
                </span>
                <span className="font-mono">Rake 5%</span>
              </div>
            </div>
            <Zap className="h-4 w-4 text-[hsl(var(--casino-gold)/0.3)] group-hover:text-[hsl(var(--casino-gold))] transition-colors" />
          </div>
        </motion.button>
      ))}
    </div>
  );
}

export { MACHINES };
