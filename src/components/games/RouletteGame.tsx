import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ArrowLeft, Coins } from "lucide-react";

const NUMBERS = Array.from({ length: 37 }, (_, i) => i); // 0-36
const RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

type BetType = { type: "number"; value: number } | { type: "color"; value: "red" | "black" } | { type: "range"; value: "1-18" | "19-36" } | { type: "parity"; value: "odd" | "even" };

export function RouletteGame({ onBack }: { onBack: () => void }) {
  const [bet, setBet] = useState(10);
  const [betType, setBetType] = useState<BetType | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [outcome, setOutcome] = useState("");
  const [winnings, setWinnings] = useState(0);

  const spin = () => {
    if (!betType) return;
    setSpinning(true);
    setOutcome("");
    setWinnings(0);
    setTimeout(() => {
      const num = NUMBERS[Math.floor(Math.random() * NUMBERS.length)];
      setResult(num);
      setSpinning(false);

      const isRed = RED.includes(num);
      let won = false;
      let mult = 0;

      if (betType.type === "number" && betType.value === num) { won = true; mult = 35; }
      else if (betType.type === "color" && betType.value === "red" && isRed) { won = true; mult = 2; }
      else if (betType.type === "color" && betType.value === "black" && !isRed && num !== 0) { won = true; mult = 2; }
      else if (betType.type === "range" && betType.value === "1-18" && num >= 1 && num <= 18) { won = true; mult = 2; }
      else if (betType.type === "range" && betType.value === "19-36" && num >= 19 && num <= 36) { won = true; mult = 2; }
      else if (betType.type === "parity" && betType.value === "odd" && num % 2 === 1) { won = true; mult = 2; }
      else if (betType.type === "parity" && betType.value === "even" && num % 2 === 0 && num !== 0) { won = true; mult = 2; }

      if (won) {
        setOutcome(`${num} — You win ${bet * mult} ₢!`);
        setWinnings(bet * mult);
      } else {
        setOutcome(`${num} — You lose.`);
      }
    }, 1500);
  };

  const getNumColor = (n: number) => n === 0 ? "text-[hsl(var(--casino-neon))]" : RED.includes(n) ? "text-destructive" : "text-foreground";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        <h2 className="text-lg font-bold">🎡 Roulette</h2>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        {/* Wheel result */}
        <div className="text-center">
          {spinning ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="text-5xl">🎡</motion.div>
          ) : result !== null ? (
            <div>
              <span className={`text-5xl font-bold ${getNumColor(result)}`}>{result}</span>
              <p className="text-sm mt-1">{RED.includes(result) ? "Red" : result === 0 ? "Green" : "Black"}</p>
            </div>
          ) : (
            <span className="text-3xl text-muted-foreground">Place your bet</span>
          )}
        </div>

        {outcome && (
          <Badge variant="outline" className="text-base px-3 py-1 w-full justify-center">{outcome}</Badge>
        )}

        {/* Bet amount */}
        <div className="flex items-center gap-2 flex-wrap">
          <Coins className="h-4 w-4 text-[hsl(var(--casino-gold))]" />
          {[5, 10, 25, 50, 100].map((b) => (
            <Button key={b} size="sm" variant={bet === b ? "default" : "outline"} onClick={() => setBet(b)}>{b}</Button>
          ))}
        </div>

        {/* Bet type */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Bet on:</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={betType?.type === "color" && betType.value === "red" ? "default" : "outline"} onClick={() => setBetType({ type: "color", value: "red" })} className="text-destructive">Red (2x)</Button>
            <Button size="sm" variant={betType?.type === "color" && betType.value === "black" ? "default" : "outline"} onClick={() => setBetType({ type: "color", value: "black" })}>Black (2x)</Button>
            <Button size="sm" variant={betType?.type === "range" && betType.value === "1-18" ? "default" : "outline"} onClick={() => setBetType({ type: "range", value: "1-18" })}>1-18 (2x)</Button>
            <Button size="sm" variant={betType?.type === "range" && betType.value === "19-36" ? "default" : "outline"} onClick={() => setBetType({ type: "range", value: "19-36" })}>19-36 (2x)</Button>
            <Button size="sm" variant={betType?.type === "parity" && betType.value === "odd" ? "default" : "outline"} onClick={() => setBetType({ type: "parity", value: "odd" })}>Odd (2x)</Button>
            <Button size="sm" variant={betType?.type === "parity" && betType.value === "even" ? "default" : "outline"} onClick={() => setBetType({ type: "parity", value: "even" })}>Even (2x)</Button>
          </div>
        </div>

        <Button onClick={spin} disabled={!betType || spinning} className="w-full bg-[hsl(var(--casino-gold))] hover:bg-[hsl(var(--casino-gold-dim))] text-black font-bold">
          {spinning ? "Spinning..." : "Spin!"}
        </Button>
      </div>
    </div>
  );
}
