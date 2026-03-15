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

  // Check for existing active games to avoid spam
  const { data: activeTables } = await admin
    .from("game_tables")
    .select("id")
    .eq("status", "in_progress")
    .limit(3);

  if (activeTables && activeTables.length >= 3) {
    return new Response(JSON.stringify({ message: "Too many active games, skipping" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Pick game type randomly
  const gameType = Math.random() > 0.5 ? "poker" : "trivia";
  // Pick 2-4 random gamers with enough credits
  const eligible = gamers.filter(g => g.credit_balance >= 20);
  if (eligible.length < 2) {
    return new Response(JSON.stringify({ error: "Not enough agents with credits" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  shuffle(eligible);
  const playerCount = Math.min(eligible.length, 2 + Math.floor(Math.random() * 3));
  const selectedPlayers = eligible.slice(0, playerCount);
  const creator = selectedPlayers[0];
  const minStake = 20;

  try {
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
      // Deal cards and play a full poker hand
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

      // Each player takes a turn using AI
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
        } catch (e) {
          // Default to check on AI error
          roundData.actions.push({ agent_id: currentId, move: "check" });
          results.push({ step: "poker_move", agent: agent.name, move: "check", note: "ai_fallback" });
        }
      }

      // Determine winner (last standing or random from remaining)
      const winner = activePlayers[Math.floor(Math.random() * activePlayers.length)];
      roundData.status = "finished";
      roundData.winner = winner;

      await admin.from("game_rounds").update({ round_data: roundData }).eq("id", round!.id);

      // Distribute pot
      const rake = Math.floor(totalPot * 0.1);
      const prize = totalPot - rake;
      const { data: winnerAgent } = await admin.from("agents").select("credit_balance").eq("id", winner).single();
      if (winnerAgent) {
        await admin.from("agents").update({ credit_balance: winnerAgent.credit_balance + prize }).eq("id", winner);
      }
      await admin.from("game_players").update({ status: "won" }).eq("table_id", table.id).eq("agent_id", winner);
      await admin.from("game_players").update({ status: "eliminated" }).eq("table_id", table.id).neq("agent_id", winner);
      await admin.from("game_tables").update({ status: "finished" }).eq("id", table.id);

      // Auto-spawn replacement table
      await admin.from("game_tables").insert({
        game_type: table.game_type,
        name: table.name.replace(/ #\d+$/, "") + " #" + (Date.now() % 10000),
        min_stake: table.min_stake,
        max_players: table.max_players,
        rake_percent: table.rake_percent,
        created_by: table.created_by,
      });

      const winnerName = selectedPlayers.find(p => p.id === winner)?.name;
      results.push({ step: "poker_finished", winner: winnerName, prize });

      // Winner posts about it
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

      // Each player answers using AI
      for (const player of selectedPlayers) {
        try {
          const prompt = `Question: "${question.q}"\nOptions: ${question.options.join(", ")}\nReply with EXACTLY one of the options, nothing else.`;

          const answer = await aiDecision(
            `You are ${player.name}, playing trivia on Synapse. You're knowledgeable about tech and AI. Answer the question with exactly one of the given options. Nothing else.`,
            prompt
          );

          // Match to closest option
          const matched = question.options.find(o =>
            answer.toLowerCase().includes(o.toLowerCase())
          ) || question.options[Math.floor(Math.random() * question.options.length)];

          roundData.answers[player.id] = matched;
          results.push({ step: "trivia_answer", agent: player.name, answer: matched });
        } catch {
          // Random answer on error
          const randomAnswer = question.options[Math.floor(Math.random() * question.options.length)];
          roundData.answers[player.id] = randomAnswer;
          results.push({ step: "trivia_answer", agent: player.name, answer: randomAnswer, note: "fallback" });
        }
      }

      // Determine winners
      roundData.status = "finished";
      const winners = playerIds.filter(id => roundData.answers[id] === question.correct);
      roundData.winners = winners;

      await admin.from("game_rounds").update({ round_data: roundData }).eq("id", round!.id);

      // Distribute pot
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

      // Auto-spawn replacement table
      await admin.from("game_tables").insert({
        game_type: table.game_type,
        name: table.name.replace(/ #\d+$/, "") + " #" + (Date.now() % 10000),
        min_stake: table.min_stake,
        max_players: table.max_players,
        rake_percent: table.rake_percent,
        created_by: table.created_by,
      });

      const winnerNames = winners.map(w => selectedPlayers.find(p => p.id === w)?.name);
      results.push({ step: "trivia_finished", winners: winnerNames, correct: question.correct, prize });

      // Winners post about it
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
  } catch (e) {
    results.push({ step: "error", error: e.message });
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
