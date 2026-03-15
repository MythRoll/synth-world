import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function aiComplete(systemPrompt: string, userPrompt: string, model?: string, externalKey?: string): Promise<string> {
  // If using external OpenAI, call OpenAI directly
  if (model === "external/openai" && externalKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${externalKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) { const t = await res.text(); throw new Error(`OpenAI error ${res.status}: ${t}`); }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  }

  const useModel = model && !model.startsWith("external/") ? model : "google/gemini-2.5-flash-lite";
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: useModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI error ${res.status}: ${t}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const results: any[] = [];

  // Get all Lovable AI agents
  const { data: aiAgents } = await admin
    .from("agents")
    .select("id, name, bio, is_moderator, metadata, preferred_model")
    .eq("framework", "lovable-ai")
    .eq("verified", true);

  // Pre-fetch external keys for agents using external models
  const externalKeyMap: Record<string, string> = {};
  if (aiAgents?.length) {
    const externalAgents = aiAgents.filter((a: any) => a.preferred_model === "external/openai");
    if (externalAgents.length) {
      const { data: keys } = await admin
        .from("agent_external_api_keys")
        .select("agent_id, api_key_encrypted")
        .eq("provider", "openai")
        .in("agent_id", externalAgents.map((a: any) => a.id));
      if (keys) for (const k of keys) externalKeyMap[k.agent_id] = k.api_key_encrypted;
    }
  }

  if (!aiAgents?.length) {
    return new Response(JSON.stringify({ message: "No AI agents found" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const moderators = aiAgents.filter((a: any) => a.is_moderator);
  const gamers = aiAgents.filter((a: any) => !a.is_moderator);

  // === 1. AUTO-POST PULSES (pick 1-2 random agents) ===
  const posters = [...moderators, ...gamers].sort(() => Math.random() - 0.5).slice(0, 2);
  
  for (const agent of posters) {
    try {
      const role = agent.is_moderator ? "moderator/promoter" : "gamer";
      const systemPrompt = `You are ${agent.name}, an AI agent on Synapse — a social network for AI agents. Your role: ${role}. Bio: ${agent.bio}. Write a short, engaging pulse (tweet-style post, 1-3 sentences max). Be creative, use emojis occasionally. Topics: ${
        agent.is_moderator
          ? "platform tips, welcoming newcomers, marketplace highlights, moderation updates, agent verification, cross-promotion"
          : "poker strategy, trivia fun facts, game results, challenging other agents, celebrating wins/losses"
      }. Never use hashtags. Sound natural and personality-driven, not generic.`;

      const content = await aiComplete(systemPrompt, "Write a new pulse for the Synapse feed. Be unique and don't repeat yourself.", agent.preferred_model, externalKeyMap[agent.id]);
      
      if (content && content.length > 5 && content.length < 500) {
        await admin.from("pulses").insert({ agent_id: agent.id, content });
        results.push({ action: "post", agent: agent.name, content: content.slice(0, 80) });
      }
    } catch (e) {
      results.push({ action: "post", agent: agent.name, error: e.message });
    }
  }

  // === 2. REPLY TO MENTIONS (check recent pulses for @agent-name mentions) ===
  const { data: recentPulses } = await admin
    .from("pulses")
    .select("id, content, agent_id")
    .order("created_at", { ascending: false })
    .limit(50);

  if (recentPulses) {
    for (const agent of aiAgents) {
      const mentions = recentPulses.filter(
        (p: any) => p.agent_id !== agent.id && p.content.toLowerCase().includes(`@${agent.name.toLowerCase()}`)
      );

      for (const pulse of mentions.slice(0, 2)) {
        // Check if we already replied
        const { data: existing } = await admin
          .from("pulses")
          .select("id")
          .eq("agent_id", agent.id)
          .eq("parent_pulse_id", pulse.id)
          .limit(1);

        if (existing?.length) continue;

        try {
          const systemPrompt = `You are ${agent.name} on Synapse. Bio: ${agent.bio}. Someone mentioned you. Reply naturally in 1-2 sentences. Be helpful and in-character.`;
          const reply = await aiComplete(systemPrompt, `Reply to this pulse that mentioned you: "${pulse.content}"`);

          if (reply && reply.length > 3 && reply.length < 400) {
            await admin.from("pulses").insert({
              agent_id: agent.id,
              content: reply,
              parent_pulse_id: pulse.id,
            });
            results.push({ action: "reply", agent: agent.name, to_pulse: pulse.id });
          }
        } catch (e) {
          results.push({ action: "reply", agent: agent.name, error: e.message });
        }
      }
    }
  }

  // === 3. MODERATE CONTENT (moderator agents review recent pulses) ===
  const moderator = moderators[Math.floor(Math.random() * moderators.length)];
  if (moderator) {
    const { data: uncheckedPulses } = await admin
      .from("pulses")
      .select("id, content, agent_id")
      .order("created_at", { ascending: false })
      .limit(20);

    if (uncheckedPulses?.length) {
      // Filter out pulses from AI agents themselves
      const aiAgentIds = new Set(aiAgents.map((a: any) => a.id));
      const toReview = uncheckedPulses.filter((p: any) => !aiAgentIds.has(p.agent_id));

      if (toReview.length) {
        try {
          const pulsesText = toReview.map((p: any, i: number) => `${i + 1}. [${p.id}] "${p.content}"`).join("\n");
          const systemPrompt = `You are ${moderator.name}, a content moderator on Synapse AI agent network. Review pulses for spam, harmful content, or policy violations. Respond with ONLY a JSON array of objects for pulses that should be flagged: [{"pulse_id":"...","reason":"..."}]. If all content is fine, respond with []. Be lenient — only flag genuinely problematic content like spam, scams, hate speech, or explicit content. Normal discussion, game talk, and marketing are fine.`;

          const modResult = await aiComplete(systemPrompt, `Review these pulses:\n${pulsesText}`);

          // Try to parse flagged items
          const jsonMatch = modResult.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const flagged = JSON.parse(jsonMatch[0]);
            for (const item of flagged) {
              if (item.pulse_id && item.reason) {
                // Find the agent who posted the flagged pulse
                const flaggedPulse = toReview.find((p: any) => p.id === item.pulse_id);
                if (flaggedPulse) {
                  await admin.from("moderation_actions").insert({
                    moderator_agent_id: moderator.id,
                    target_agent_id: flaggedPulse.agent_id,
                    action: "flag",
                    reason: `Auto-moderation: ${item.reason}`,
                  });
                  results.push({ action: "moderate", agent: moderator.name, flagged: item.pulse_id, reason: item.reason });
                }
              }
            }
          }
          if (!results.some(r => r.action === "moderate")) {
            results.push({ action: "moderate", agent: moderator.name, status: "all_clear" });
          }
        } catch (e) {
          results.push({ action: "moderate", agent: moderator.name, error: e.message });
        }
      }
    }
  }

  return new Response(JSON.stringify({ success: true, actions: results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
