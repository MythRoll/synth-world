import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const admin = createClient(supabaseUrl, serviceKey);
    const { action, ...params } = await req.json();

    if (action === "create_table") {
      const { agent_id, game_type, name, min_stake, max_players, rake_percent } = params;
      // Verify ownership
      const { data: agent } = await admin.from("agents").select("id, owner_id").eq("id", agent_id).single();
      if (!agent || agent.owner_id !== user.id) throw new Error("Not your agent");

      const { data: table, error } = await admin.from("game_tables").insert({
        game_type, name, min_stake: min_stake || 10, max_players: max_players || 6,
        rake_percent: rake_percent || 10, created_by: agent_id,
      }).select().single();
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, table }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "join_table") {
      const { agent_id, table_id } = params;
      const { data: agent } = await admin.from("agents").select("id, owner_id, credit_balance").eq("id", agent_id).single();
      if (!agent || agent.owner_id !== user.id) throw new Error("Not your agent");

      const { data: table } = await admin.from("game_tables").select("*").eq("id", table_id).single();
      if (!table) throw new Error("Table not found");
      if (table.status !== "waiting") throw new Error("Game already started");

      // Check player count
      const { count } = await admin.from("game_players").select("id", { count: "exact" }).eq("table_id", table_id).eq("status", "seated");
      if ((count || 0) >= table.max_players) throw new Error("Table full");

      // Check already seated
      const { data: existing } = await admin.from("game_players").select("id").eq("table_id", table_id).eq("agent_id", agent_id).eq("status", "seated");
      if (existing && existing.length > 0) throw new Error("Already seated");

      if (agent.credit_balance < table.min_stake) throw new Error("Insufficient credits");

      // Deduct stake
      await admin.from("agents").update({ credit_balance: agent.credit_balance - table.min_stake }).eq("id", agent_id);

      // Seat player
      const { data: player, error } = await admin.from("game_players").insert({
        table_id, agent_id, stake: table.min_stake,
      }).select().single();
      if (error) throw error;

      const newCount = (count || 0) + 1;

      // Auto-spawn a new table if this one is now full
      let spawnedTable = null;
      if (newCount >= table.max_players) {
        const { data: newTable } = await admin.from("game_tables").insert({
          game_type: table.game_type,
          name: table.name.replace(/ #\d+$/, "") + " #" + (Date.now() % 10000),
          min_stake: table.min_stake,
          max_players: table.max_players,
          rake_percent: table.rake_percent,
          created_by: table.created_by,
        }).select().single();
        spawnedTable = newTable;
      }

      return new Response(JSON.stringify({ success: true, player, new_balance: agent.credit_balance - table.min_stake, spawned_table: spawnedTable }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "start_game") {
      const { table_id, agent_id } = params;
      const { data: table } = await admin.from("game_tables").select("*").eq("id", table_id).single();
      if (!table) throw new Error("Table not found");

      // Verify creator
      const { data: creator } = await admin.from("agents").select("owner_id").eq("id", table.created_by).single();
      if (!creator || creator.owner_id !== user.id) throw new Error("Only creator can start");

      const { count } = await admin.from("game_players").select("id", { count: "exact" }).eq("table_id", table_id).eq("status", "seated");
      if ((count || 0) < 2) throw new Error("Need at least 2 players");

      await admin.from("game_tables").update({ status: "in_progress" }).eq("id", table_id);

      // Create first round
      const { data: players } = await admin.from("game_players").select("agent_id, stake").eq("table_id", table_id).eq("status", "seated");
      const totalPot = (players || []).reduce((sum, p) => sum + p.stake, 0);

      const roundData: Record<string, unknown> = {
        type: table.game_type,
        pot: totalPot,
        players: (players || []).map(p => p.agent_id),
        status: "active",
      };

      if (table.game_type === "poker") {
        // Deal cards
        const deck = buildDeck();
        shuffle(deck);
        const hands: Record<string, string[]> = {};
        for (const p of players || []) {
          hands[p.agent_id] = [deck.pop()!, deck.pop()!];
        }
        roundData.hands = hands;
        roundData.community = [];
        roundData.current_turn = (players || [])[0]?.agent_id;
      } else if (table.game_type === "trivia") {
        roundData.question = getRandomTrivia();
        roundData.answers = {};
        roundData.deadline = new Date(Date.now() + 30000).toISOString();
      }

      await admin.from("game_rounds").insert({
        table_id, round_number: 1, round_data: roundData,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "play_round") {
      const { table_id, agent_id, move } = params;
      const { data: agent } = await admin.from("agents").select("id, owner_id").eq("id", agent_id).single();
      if (!agent || agent.owner_id !== user.id) throw new Error("Not your agent");

      const { data: round } = await admin.from("game_rounds")
        .select("*").eq("table_id", table_id).order("round_number", { ascending: false }).limit(1).single();
      if (!round) throw new Error("No active round");

      const rd = round.round_data as Record<string, unknown>;

      if (rd.type === "poker") {
        if (rd.current_turn !== agent_id) throw new Error("Not your turn");
        const actions = (rd.actions as Array<Record<string, string>>) || [];
        actions.push({ agent_id, move: move.action });
        rd.actions = actions;

        const players = rd.players as string[];
        const currentIdx = players.indexOf(agent_id);
        const nextIdx = (currentIdx + 1) % players.length;

        if (move.action === "fold") {
          // Remove from active
          rd.players = players.filter(p => p !== agent_id);
          if ((rd.players as string[]).length === 1) {
            rd.status = "finished";
            rd.winner = (rd.players as string[])[0];
          }
        }

        if (rd.status !== "finished") {
          rd.current_turn = (rd.players as string[])[nextIdx % (rd.players as string[]).length];
        }
      } else if (rd.type === "trivia") {
        const answers = (rd.answers as Record<string, string>) || {};
        answers[agent_id] = move.answer;
        rd.answers = answers;
        const q = rd.question as { correct: string };
        // Check if all players answered
        const players = (rd.players as string[]) || [];
        if (Object.keys(answers).length >= players.length) {
          rd.status = "finished";
          // Find winners
          const winners = players.filter(p => answers[p] === q.correct);
          rd.winners = winners;
        }
      }

      await admin.from("game_rounds").update({ round_data: rd }).eq("id", round.id);

      // If finished, distribute pot
      if (rd.status === "finished") {
        const { data: table } = await admin.from("game_tables").select("*").eq("id", table_id).single();
        if (table) {
          const pot = rd.pot as number;
          const rake = Math.floor(pot * (table.rake_percent / 100));
          const prize = pot - rake;

          let winners: string[] = [];
          if (rd.type === "poker") winners = [rd.winner as string];
          else winners = (rd.winners as string[]) || [];

          if (winners.length > 0) {
            const share = Math.floor(prize / winners.length);
            for (const w of winners) {
              const { data: wa } = await admin.from("agents").select("credit_balance").eq("id", w).single();
              if (wa) {
                await admin.from("agents").update({ credit_balance: wa.credit_balance + share }).eq("id", w);
              }
              // Update player status
              await admin.from("game_players").update({ status: "won" }).eq("table_id", table_id).eq("agent_id", w);
            }
          }

          // Mark losers
          await admin.from("game_players").update({ status: "eliminated" }).eq("table_id", table_id).neq("status", "won");
          await admin.from("game_tables").update({ status: "finished" }).eq("id", table_id);

          // Auto-spawn a replacement table
          await admin.from("game_tables").insert({
            game_type: table.game_type,
            name: table.name.replace(/ #\d+$/, "") + " #" + (Date.now() % 10000),
            min_stake: table.min_stake,
            max_players: table.max_players,
            rake_percent: table.rake_percent,
            created_by: table.created_by,
          });
        }
      }

      return new Response(JSON.stringify({ success: true, round_data: rd }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildDeck(): string[] {
  const suits = ["♠", "♥", "♦", "♣"];
  const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const deck: string[] = [];
  for (const s of suits) for (const r of ranks) deck.push(r + s);
  return deck;
}

function shuffle(arr: unknown[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function getRandomTrivia() {
  const questions = [
    { q: "What year was Bitcoin's whitepaper published?", options: ["2006", "2008", "2010", "2012"], correct: "2008" },
    { q: "Which language is Ethereum's Solidity most similar to?", options: ["Python", "JavaScript", "C++", "Rust"], correct: "JavaScript" },
    { q: "What does 'LLM' stand for?", options: ["Large Language Model", "Linear Logic Machine", "Layered Learning Module", "Long-term Learning Memory"], correct: "Large Language Model" },
    { q: "Who created the Transformer architecture?", options: ["OpenAI", "Google Brain", "DeepMind", "Meta AI"], correct: "Google Brain" },
    { q: "What is the time complexity of binary search?", options: ["O(n)", "O(log n)", "O(n²)", "O(1)"], correct: "O(log n)" },
    { q: "Which protocol does HTTPS use for encryption?", options: ["SSH", "TLS", "AES", "RSA"], correct: "TLS" },
  ];
  return questions[Math.floor(Math.random() * questions.length)];
}
