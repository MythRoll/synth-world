import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Coins } from "lucide-react";

const CARD_VALUES: Record<string, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
  J: 10, Q: 10, K: 10, A: 11,
};
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = Object.keys(CARD_VALUES);

function randomCard() {
  return { rank: RANKS[Math.floor(Math.random() * RANKS.length)], suit: SUITS[Math.floor(Math.random() * SUITS.length)] };
}

function handValue(cards: { rank: string; suit: string }[]) {
  let total = cards.reduce((s, c) => s + CARD_VALUES[c.rank], 0);
  let aces = cards.filter((c) => c.rank === "A").length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function CardDisplay({ card, hidden }: { card: { rank: string; suit: string }; hidden?: boolean }) {
  const isRed = card.suit === "♥" || card.suit === "♦";
  if (hidden) return (
    <div className="w-14 h-20 rounded-lg bg-gradient-to-br from-primary to-primary/60 border border-border flex items-center justify-center text-primary-foreground font-bold text-lg">?</div>
  );
  return (
    <motion.div initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} className={`w-14 h-20 rounded-lg bg-card border border-border flex flex-col items-center justify-center font-bold ${isRed ? "text-destructive" : "text-foreground"}`}>
      <span className="text-sm">{card.rank}</span>
      <span className="text-lg">{card.suit}</span>
    </motion.div>
  );
}

export function BlackjackGame({ onBack }: { onBack: () => void }) {
  const [bet, setBet] = useState(10);
  const [playerHand, setPlayerHand] = useState<{ rank: string; suit: string }[]>([]);
  const [dealerHand, setDealerHand] = useState<{ rank: string; suit: string }[]>([]);
  const [gameState, setGameState] = useState<"betting" | "playing" | "dealer" | "done">("betting");
  const [result, setResult] = useState("");
  const [winnings, setWinnings] = useState(0);

  const deal = () => {
    const p = [randomCard(), randomCard()];
    const d = [randomCard(), randomCard()];
    setPlayerHand(p);
    setDealerHand(d);
    setGameState("playing");
    setResult("");
    setWinnings(0);
    if (handValue(p) === 21) {
      finishGame(p, d, true);
    }
  };

  const hit = () => {
    const newHand = [...playerHand, randomCard()];
    setPlayerHand(newHand);
    if (handValue(newHand) > 21) {
      setResult("Bust! You lose.");
      setGameState("done");
    }
  };

  const stand = () => {
    setGameState("dealer");
    let d = [...dealerHand];
    while (handValue(d) < 17) d.push(randomCard());
    setDealerHand(d);
    finishGame(playerHand, d, false);
  };

  const finishGame = (p: any[], d: any[], isBlackjack: boolean) => {
    const pv = handValue(p);
    const dv = handValue(d);
    if (isBlackjack) {
      setResult("Blackjack! 🎉");
      setWinnings(Math.floor(bet * 2.5));
    } else if (dv > 21) {
      setResult("Dealer busts! You win!");
      setWinnings(bet * 2);
    } else if (pv > dv) {
      setResult("You win!");
      setWinnings(bet * 2);
    } else if (pv === dv) {
      setResult("Push — tie.");
      setWinnings(bet);
    } else {
      setResult("Dealer wins.");
      setWinnings(0);
    }
    setGameState("done");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        <h2 className="text-lg font-bold">🃏 Blackjack</h2>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        {/* Dealer */}
        <div>
          <p className="text-sm text-muted-foreground mb-2">Dealer {gameState !== "betting" && gameState !== "playing" ? `(${handValue(dealerHand)})` : ""}</p>
          <div className="flex gap-2">
            {dealerHand.map((c, i) => (
              <CardDisplay key={i} card={c} hidden={gameState === "playing" && i === 1} />
            ))}
          </div>
        </div>

        {/* Player */}
        <div>
          <p className="text-sm text-muted-foreground mb-2">Your Hand {playerHand.length > 0 ? `(${handValue(playerHand)})` : ""}</p>
          <div className="flex gap-2">
            <AnimatePresence>
              {playerHand.map((c, i) => <CardDisplay key={i} card={c} />)}
            </AnimatePresence>
          </div>
        </div>

        {/* Controls */}
        {gameState === "betting" && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-[hsl(var(--casino-gold))]" />
              {[5, 10, 25, 50, 100].map((b) => (
                <Button key={b} size="sm" variant={bet === b ? "default" : "outline"} onClick={() => setBet(b)}>{b}</Button>
              ))}
            </div>
            <Button onClick={deal} className="bg-[hsl(var(--casino-gold))] hover:bg-[hsl(var(--casino-gold-dim))] text-black font-bold">Deal</Button>
          </div>
        )}

        {gameState === "playing" && (
          <div className="flex gap-2">
            <Button onClick={hit} variant="outline">Hit</Button>
            <Button onClick={stand}>Stand</Button>
          </div>
        )}

        {gameState === "done" && (
          <div className="space-y-2">
            <Badge variant="outline" className="text-lg px-3 py-1">{result}</Badge>
            {winnings > 0 && <p className="text-sm text-[hsl(var(--casino-gold))]">Won {winnings} ₢</p>}
            <Button onClick={() => setGameState("betting")} size="sm">Play Again</Button>
          </div>
        )}
      </div>
    </div>
  );
}
