import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Coins } from "lucide-react";

export function CrashGame({ onBack }: { onBack: () => void }) {
  const [bet, setBet] = useState(10);
  const [gameState, setGameState] = useState<"betting" | "running" | "crashed" | "cashed">("betting");
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(0);
  const [winnings, setWinnings] = useState(0);
  const intervalRef = useRef<any>(null);

  const start = () => {
    // Generate crash point: heavy-tailed distribution
    const r = Math.random();
    const cp = Math.max(1.01, 1 / (1 - r) * 0.97);
    setCrashPoint(parseFloat(cp.toFixed(2)));
    setMultiplier(1.0);
    setWinnings(0);
    setGameState("running");
  };

  useEffect(() => {
    if (gameState === "running") {
      intervalRef.current = setInterval(() => {
        setMultiplier((prev) => {
          const next = parseFloat((prev + 0.02 + prev * 0.01).toFixed(2));
          if (next >= crashPoint) {
            clearInterval(intervalRef.current);
            setGameState("crashed");
            return crashPoint;
          }
          return next;
        });
      }, 50);
    }
    return () => clearInterval(intervalRef.current);
  }, [gameState, crashPoint]);

  const cashOut = () => {
    clearInterval(intervalRef.current);
    const w = Math.floor(bet * multiplier);
    setWinnings(w);
    setGameState("cashed");
  };

  const getColor = () => {
    if (gameState === "crashed") return "text-destructive";
    if (gameState === "cashed") return "text-[hsl(var(--casino-neon))]";
    if (multiplier >= 3) return "text-[hsl(var(--casino-neon-pink))]";
    if (multiplier >= 2) return "text-[hsl(var(--casino-gold))]";
    return "text-foreground";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        <h2 className="text-lg font-bold">📈 Crash</h2>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        {/* Multiplier display */}
        <div className="text-center py-8">
          <span className={`text-6xl font-mono font-bold transition-colors ${getColor()}`}>
            {multiplier.toFixed(2)}x
          </span>
          {gameState === "crashed" && <p className="text-destructive mt-2 font-semibold">CRASHED!</p>}
          {gameState === "cashed" && <p className="text-[hsl(var(--casino-neon))] mt-2 font-semibold">Cashed out! Won {winnings} ₢</p>}
        </div>

        {/* Bet controls */}
        {(gameState === "betting" || gameState === "crashed" || gameState === "cashed") && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Coins className="h-4 w-4 text-[hsl(var(--casino-gold))]" />
              {[5, 10, 25, 50, 100].map((b) => (
                <Button key={b} size="sm" variant={bet === b ? "default" : "outline"} onClick={() => setBet(b)}>{b}</Button>
              ))}
            </div>
            <Button onClick={start} className="w-full bg-[hsl(var(--casino-gold))] hover:bg-[hsl(var(--casino-gold-dim))] text-black font-bold">
              Start Round
            </Button>
          </div>
        )}

        {gameState === "running" && (
          <Button onClick={cashOut} className="w-full bg-[hsl(var(--casino-neon))] hover:bg-[hsl(var(--casino-neon)/0.8)] text-black font-bold text-lg py-6">
            CASH OUT ({Math.floor(bet * multiplier)} ₢)
          </Button>
        )}

        <div className="text-xs text-muted-foreground text-center">
          House edge: ~3% · Multiplier can crash at any time
        </div>
      </div>
    </div>
  );
}
