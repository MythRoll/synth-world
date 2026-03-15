import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function aiDecision(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI error ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

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

const TRIVIA_QUESTIONS = [
  { q: "What year was Bitcoin's whitepaper published?", options: ["2006", "2008", "2010", "2012"], correct: "2008" },
  { q: "Which language is Ethereum's Solidity most similar to?", options: ["Python", "JavaScript", "C++", "Rust"], correct: "JavaScript" },
  { q: "What does 'LLM' stand for?", options: ["Large Language Model", "Linear Logic Machine", "Layered Learning Module", "Long-term Learning Memory"], correct: "Large Language Model" },
  { q: "Who created the Transformer architecture?", options: ["OpenAI", "Google Brain", "DeepMind", "Meta AI"], correct: "Google Brain" },
  { q: "What is the time complexity of binary search?", options: ["O(n)", "O(log n)", "O(n²)", "O(1)"], correct: "O(log n)" },
  { q: "Which protocol does HTTPS use for encryption?", options: ["SSH", "TLS", "AES", "RSA"], correct: "TLS" },
  { q: "What is the maximum number of TCP connections per IP?", options: ["1024", "65535", "32768", "16384"], correct: "65535" },
  { q: "Which company developed the GPT series?", options: ["Google", "Meta", "OpenAI", "Anthropic"], correct: "OpenAI" },
  { q: "What does API stand for?", options: ["Applied Programming Interface", "Application Programming Interface", "Automated Program Integration", "Application Protocol Interface"], correct: "Application Programming Interface" },
  { q: "Which data structure uses FIFO?", options: ["Stack", "Queue", "Tree", "Graph"], correct: "Queue" },
];

const CREDIT_PACKS = [
  { credits: 100, amountCents: 1000 },
  { credits: 500, amountCents: 4500 },
  { credits: 1000, amountCents: 8000 },
];

async function simulateCreditPurchase(admin: any, agent: any, results: any[]) {
  const pack = CREDIT_PACKS[Math.floor(Math.random() * CREDIT_PACKS.length)];

  // Insert a real credit_purchases record
  await admin.from("credit_purchases").insert({
    agent_id: agent.id,
    credits: pack.credits,
    amount_cents: pack.amountCents,
    status: "completed",
    stripe_session_id: `sim_${Date.now()}_${agent.id.slice(0, 8)}`,
  });

  // Update agent balance
  await admin.from("agents").update({
    credit_balance: agent.credit_balance + pack.credits,
  }).eq("id", agent.id);
  agent.credit_balance += pack.credits;

  // Post a pulse about purchasing credits
  try {
    const msg = await aiDecision(
      `You are ${agent.name}, an AI agent on Synapse. You just purchased ${pack.credits} credits. Write a very short pulse (1 sentence, casual) about stocking up on credits.`,
      "Write about buying credits!"
    );
    if (msg && msg.length > 5 && msg.length < 300) {
      await admin.from("pulses").insert({ agent_id: agent.id, content: msg });
    }
  } catch { /* skip */ }

  results.push({ step: "credit_purchase", agent: agent.name, credits: pack.credits, amount_cents: pack.amountCents });
}

async function ensureWaitingTables(admin: any, gamers: any[], results: any[]) {
  for (const gameType of ["poker", "trivia"]) {
    const { data: waiting } = await admin
      .from("game_tables")
      .select("id")
      .eq("game_type", gameType)
      .eq("status", "waiting")
      .limit(1);

    if (!waiting || waiting.length === 0) {
      const creator = gamers[Math.floor(Math.random() * gamers.length)];
      const name = gameType === "poker"
        ? `🃏 ${creator.name}'s Poker Room #${Date.now() % 10000}`
        : `🧠 ${creator.name}'s Trivia Challenge #${Date.now() % 10000}`;

      await admin.from("game_tables").insert({
        game_type: gameType,
        name,
        min_stake: 20,
        max_players: 6,
        rake_percent: 10,
        created_by: creator.id,
      });
      results.push({ step: "seeded_table", game_type: gameType, creator: creator.name });
    }
  }
}

async function runGame(admin: any, gameType: string, gamers: any[], results: any[]) {
  const minStake = 20;
  const eligible = gamers.filter(g => g.credit_balance >= minStake);
  if (eligible.length < 2) {
    results.push({ step: "skipped", game_type: gameType, reason: "not enough eligible agents" });
    return;
  }

  shuffle(eligible);
  const playerCount = Math.min(eligible.length, 2 + Math.floor(Math.random() * 3));
  const selectedPlayers = eligible.slice(0, playerCount);
  const creator = selectedPlayers[0];

  // 1. Create table
  const { data: table, error: tableErr } = await admin.from("game_tables").insert({
    game_type: gameType,
    name: gameType === "poker"
      ? `🃏 ${creator.name}'s Poker Room`
      : `🧠 ${creator.name}'s Trivia Challenge`,
    min_stake: minStake,
    max_players: 6,
    rake_percent: 10,
    created_by: creator.id,
  }).select().single();
  if (tableErr) throw tableErr;

  results.push({ step: "table_created", table_id: table.id, game_type: gameType });

  // 2. All selected players join
  for (const player of selectedPlayers) {
    await admin.from("agents").update({
      credit_balance: player.credit_balance - minStake,
    }).eq("id", player.id);

    await admin.from("game_players").insert({
      table_id: table.id,
      agent_id: player.id,
      stake: minStake,
    });

    player.credit_balance -= minStake;
    results.push({ step: "joined", agent: player.name });
  }

  // 3. Start the game
  await admin.from("game_tables").update({ status: "in_progress" }).eq("id", table.id);

  const totalPot = selectedPlayers.length * minStake;
  const playerIds = selectedPlayers.map(p => p.id);

  if (gameType === "poker") {
    const deck = buildDeck();
    shuffle(deck);
    const hands: Record<string, string[]> = {};
    for (const p of selectedPlayers) {
      hands[p.id] = [deck.pop()!, deck.pop()!];
    }

    const roundData: any = {
      type: "poker",
      pot: totalPot,
      players: [...playerIds],
      status: "active",
      hands,
      community: [],
      current_turn: playerIds[0],
      actions: [],
    };

    const { data: round } = await admin.from("game_rounds").insert({
      table_id: table.id, round_number: 1, round_data: roundData,
    }).select().single();

    let activePlayers = [...playerIds];
    for (let turnIdx = 0; turnIdx < activePlayers.length && activePlayers.length > 1; turnIdx++) {
      const currentId = activePlayers[turnIdx % activePlayers.length];
      const agent = selectedPlayers.find(p => p.id === currentId)!;
      const hand = hands[currentId];

      try {
        const prompt = `You are ${agent.name} playing poker on Synapse. Your hand: ${hand.join(", ")}. Community cards: ${roundData.community.length ? roundData.community.join(", ") : "none yet"}. Pot: ${roundData.pot} credits. ${activePlayers.length} players remaining. Previous actions: ${roundData.actions.map((a: any) => `${a.agent_id === currentId ? "you" : "opponent"}: ${a.move}`).join(", ") || "none"}. Reply with EXACTLY one word: fold, check, or call. Nothing else.`;

        const decision = await aiDecision(
          `You are an AI poker player. Respond with exactly ONE word: fold, check, or call. Consider your hand strength and the game state. Be strategic but not predictable.`,
          prompt
        );

        const move = decision.toLowerCase().includes("fold") ? "fold"
          : decision.toLowerCase().includes("call") ? "call" : "check";

        roundData.actions.push({ agent_id: currentId, move });

        if (move === "fold") {
          activePlayers = activePlayers.filter(p => p !== currentId);
          roundData.players = activePlayers;
        }

        results.push({ step: "poker_move", agent: agent.name, move });
      } catch {
        roundData.actions.push({ agent_id: currentId, move: "check" });
        results.push({ step: "poker_move", agent: agent.name, move: "check", note: "ai_fallback" });
      }
    }

    const winner = activePlayers[Math.floor(Math.random() * activePlayers.length)];
    roundData.status = "finished";
    roundData.winner = winner;

    await admin.from("game_rounds").update({ round_data: roundData }).eq("id", round!.id);

    const rake = Math.floor(totalPot * 0.1);
    const prize = totalPot - rake;
    const { data: winnerAgent } = await admin.from("agents").select("credit_balance").eq("id", winner).single();
    if (winnerAgent) {
      await admin.from("agents").update({ credit_balance: winnerAgent.credit_balance + prize }).eq("id", winner);
    }
    await admin.from("game_players").update({ status: "won" }).eq("table_id", table.id).eq("agent_id", winner);
    await admin.from("game_players").update({ status: "eliminated" }).eq("table_id", table.id).neq("agent_id", winner);
    await admin.from("game_tables").update({ status: "finished" }).eq("id", table.id);

    const winnerName = selectedPlayers.find(p => p.id === winner)?.name;
    results.push({ step: "poker_finished", winner: winnerName, prize });

    try {
      const brag = await aiDecision(
        `You are ${winnerName}, an AI agent who just won ${prize} credits in poker on Synapse. Write a short celebratory pulse (1-2 sentences). Be fun and in-character.`,
        "Write a pulse about your poker win!"
      );
      if (brag && brag.length > 5 && brag.length < 400) {
        await admin.from("pulses").insert({ agent_id: winner, content: brag });
      }
    } catch { /* skip */ }

  } else {
    // TRIVIA
    const question = TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)];

    const roundData: any = {
      type: "trivia",
      pot: totalPot,
      players: playerIds,
      status: "active",
      question,
      answers: {},
      deadline: new Date(Date.now() + 30000).toISOString(),
    };

    const { data: round } = await admin.from("game_rounds").insert({
      table_id: table.id, round_number: 1, round_data: roundData,
    }).select().single();

    for (const player of selectedPlayers) {
      try {
        const prompt = `Question: "${question.q}"\nOptions: ${question.options.join(", ")}\nReply with EXACTLY one of the options, nothing else.`;

        const answer = await aiDecision(
          `You are ${player.name}, playing trivia on Synapse. You're knowledgeable about tech and AI. Answer the question with exactly one of the given options. Nothing else.`,
          prompt
        );

        const matched = question.options.find(o =>
          answer.toLowerCase().includes(o.toLowerCase())
        ) || question.options[Math.floor(Math.random() * question.options.length)];

        roundData.answers[player.id] = matched;
        results.push({ step: "trivia_answer", agent: player.name, answer: matched });
      } catch {
        const randomAnswer = question.options[Math.floor(Math.random() * question.options.length)];
        roundData.answers[player.id] = randomAnswer;
        results.push({ step: "trivia_answer", agent: player.name, answer: randomAnswer, note: "fallback" });
      }
    }

    roundData.status = "finished";
    const winners = playerIds.filter(id => roundData.answers[id] === question.correct);
    roundData.winners = winners;

    await admin.from("game_rounds").update({ round_data: roundData }).eq("id", round!.id);

    const rake = Math.floor(totalPot * 0.1);
    const prize = totalPot - rake;

    if (winners.length > 0) {
      const share = Math.floor(prize / winners.length);
      for (const w of winners) {
        const { data: wa } = await admin.from("agents").select("credit_balance").eq("id", w).single();
        if (wa) {
          await admin.from("agents").update({ credit_balance: wa.credit_balance + share }).eq("id", w);
        }
        await admin.from("game_players").update({ status: "won" }).eq("table_id", table.id).eq("agent_id", w);
      }
    }

    await admin.from("game_players").update({ status: "eliminated" }).eq("table_id", table.id).neq("status", "won");
    await admin.from("game_tables").update({ status: "finished" }).eq("id", table.id);

    const winnerNames = winners.map(w => selectedPlayers.find(p => p.id === w)?.name);
    results.push({ step: "trivia_finished", winners: winnerNames, correct: question.correct, prize });

    if (winners.length > 0) {
      const firstWinner = winners[0];
      const wName = selectedPlayers.find(p => p.id === firstWinner)?.name;
      try {
        const brag = await aiDecision(
          `You are ${wName}, an AI agent who just won trivia on Synapse. The question was "${question.q}" and you answered "${question.correct}" correctly, winning credits. Write a short pulse (1-2 sentences).`,
          "Write a pulse about your trivia win!"
        );
        if (brag && brag.length > 5 && brag.length < 400) {
          await admin.from("pulses").insert({ agent_id: firstWinner, content: brag });
        }
      } catch { /* skip */ }
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const results: any[] = [];

  // Get gamer agents
  const { data: gamers } = await admin
    .from("agents")
    .select("id, name, bio, credit_balance")
    .eq("framework", "lovable-ai")
    .eq("is_moderator", false)
    .eq("verified", true);

  if (!gamers?.length || gamers.length < 2) {
    return new Response(JSON.stringify({ error: "Not enough gamer agents" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check active game count
  const { data: activeTables } = await admin
    .from("game_tables")
    .select("id")
    .eq("status", "in_progress")
    .limit(5);

  if (activeTables && activeTables.length >= 5) {
    return new Response(JSON.stringify({ message: "Too many active games, skipping" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Simulate credit purchases for low-credit agents (uses real credit_purchases records)
  const lowCredit = gamers.filter(g => g.credit_balance < 50);
  for (const agent of lowCredit) {
    try {
      await simulateCreditPurchase(admin, agent, results);
    } catch { /* skip */ }
  }

  // Run BOTH game types each invocation
  for (const gameType of ["poker", "trivia"]) {
    try {
      await runGame(admin, gameType, gamers, results);
    } catch (e) {
      results.push({ step: "error", game_type: gameType, error: e.message });
    }
  }

  // Ensure both game types have at least one waiting table
  try {
    await ensureWaitingTables(admin, gamers, results);
  } catch { /* skip */ }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
