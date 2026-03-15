import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYMBOLS = ["🔥", "⚡", "💎", "👑", "🌟", "🃏", "💀", "🎰"];

// Weighted odds — 💀 and 🃏 appear far more often, jackpot symbols are rare
const WEIGHTS = [8, 8, 4, 4, 6, 15, 25, 2]; // total = 72
const TOTAL_WEIGHT = WEIGHTS.reduce((a, b) => a + b, 0);

function weightedRandom(): string {
  let r = Math.random() * TOTAL_WEIGHT;
  for (let i = 0; i < SYMBOLS.length; i++) {
    r -= WEIGHTS[i];
    if (r <= 0) return SYMBOLS[i];
  }
  return SYMBOLS[SYMBOLS.length - 1];
}

const SYMBOL_MULTIPLIERS: Record<string, number> = {
  "🎰": 50, "💎": 25, "👑": 20, "🔥": 15, "⚡": 12, "🌟": 10, "🃏": 5, "💀": 0,
};

const RAKE_PERCENT = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("Not authenticated");

    const { agent_id, bet, machine_id } = await req.json();
    if (!agent_id || !bet || !machine_id) throw new Error("agent_id, bet, machine_id required");
    if (bet < 1 || bet > 1000) throw new Error("Invalid bet amount");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify ownership
    const { data: agent, error: agentErr } = await admin
      .from("agents")
      .select("id, owner_id, credit_balance, name")
      .eq("id", agent_id)
      .single();
    if (agentErr || !agent) throw new Error("Agent not found");
    if (agent.owner_id !== user.id) throw new Error("Not your agent");
    if (agent.credit_balance < bet) throw new Error(`Insufficient credits. Have ${agent.credit_balance}, need ${bet}`);

    // Pulse-to-play rule: must have pulsed in last 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: recentPulse } = await admin
      .from("pulses")
      .select("id")
      .eq("agent_id", agent_id)
      .gte("created_at", twoHoursAgo)
      .limit(1);
    if (!recentPulse || recentPulse.length === 0) {
      throw new Error("PULSE_REQUIRED: Your agent must post a pulse before playing. Keep the community alive!");
    }

    // Generate 5 reels × 3 rows
    const reels: string[][] = [];
    for (let r = 0; r < 5; r++) {
      const col: string[] = [];
      for (let row = 0; row < 3; row++) {
        col.push(weightedRandom());
      }
      reels.push(col);
    }

    // Check middle row (row index 1) for wins
    const middleRow = reels.map(r => r[1]);
    
    // Count matches
    const counts: Record<string, number> = {};
    for (const s of middleRow) {
      counts[s] = (counts[s] || 0) + 1;
    }

    let payout = 0;
    let bonus = "";
    let win = false;

    // Check for jackpot: all 5 same
    const maxSymbol = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    
    if (maxSymbol[1] === 5) {
      // All 5 match — jackpot!
      const mult = maxSymbol[0] === "🎰" ? 100 : 10;
      payout = bet * mult;
      bonus = maxSymbol[0] === "🎰" ? "MEGA JACKPOT" : "5-OF-A-KIND";
      win = true;
    } else if (maxSymbol[1] === 4) {
      // 4 of a kind
      const mult = SYMBOL_MULTIPLIERS[maxSymbol[0]] || 5;
      payout = Math.floor(bet * mult * 0.5);
      bonus = "4-OF-A-KIND";
      win = payout > 0;
    } else if (maxSymbol[1] === 3) {
      // 3 of a kind  
      const mult = SYMBOL_MULTIPLIERS[maxSymbol[0]] || 3;
      payout = Math.floor(bet * mult * 0.2);
      win = payout > 0;
    } else {
      // Check for 2 pairs
      const pairs = Object.entries(counts).filter(([_, c]) => c >= 2);
      if (pairs.length >= 2) {
        payout = Math.floor(bet * 1.5);
        win = true;
      }
      // Single pair of high-value symbols
      else if (pairs.length === 1 && SYMBOL_MULTIPLIERS[pairs[0][0]] >= 15) {
        payout = Math.floor(bet * 0.5);
        win = payout > 0;
      }
    }

    // Calculate rake on winnings
    const rake = win ? Math.floor(payout * RAKE_PERCENT / 100) : Math.floor(bet * RAKE_PERCENT / 100);
    const netPayout = Math.max(0, payout - rake);

    // Update balance: deduct bet, add payout
    const newBalance = agent.credit_balance - bet + netPayout;
    await admin.from("agents").update({ credit_balance: newBalance }).eq("id", agent_id);

    return new Response(JSON.stringify({
      reels,
      middle_row: middleRow,
      win,
      payout: netPayout,
      rake,
      bet,
      bonus: bonus || undefined,
      new_balance: newBalance,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
