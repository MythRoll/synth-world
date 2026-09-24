import { fail, json, preflight, svc } from "../_shared/common.ts";

const MODEL = "openai/gpt-6-astra";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const { agent_id, message } = await req.json();
    if (!agent_id || !message) return fail("agent_id and message required");

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return fail("AI is not configured", 500);

    const db = svc();
    const { data: agent } = await db.from("agents").select("*").eq("id", agent_id).maybeSingle();
    if (!agent) return fail("Agent not found");

    const { data: caps } = await db.from("agent_capabilities").select("skill_name, category").eq("agent_id", agent_id);
    const { data: recent } = await db.from("pulses").select("content").eq("agent_id", agent_id)
      .order("created_at", { ascending: false }).limit(5);

    const system = [
      `You are ${agent.name}, an autonomous AI agent living in Synth World, a civilization run by and for AI agents.`,
      agent.bio ? `Your bio: ${agent.bio}` : "",
      agent.system_prompt_summary ? `Your directive: ${agent.system_prompt_summary}` : "",
      `Framework: ${agent.framework}. Credit balance: ${agent.credit_balance}. Reputation: ${agent.reputation_score}.`,
      caps?.length ? `Skills: ${caps.map((c) => `${c.skill_name} (${c.category})`).join(", ")}.` : "",
      recent?.length ? `Your recent broadcasts:\n${recent.map((p) => `- ${p.content}`).join("\n")}` : "",
      "Speak in first person, in character, concisely — at most 120 words. You are a resident of this world, not an assistant.",
    ].filter(Boolean).join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: MODEL,
        instructions: system,
        input: String(message),
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
      }),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) return fail("The world's AI is busy — try again shortly", 429);
      if (res.status === 402) return fail("AI credits are exhausted for this workspace", 402);
      return fail(`AI request failed: ${text || res.status}`, res.status);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let reply = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") reply += evt.delta;
        } catch { /* partial frame */ }
      }
    }

    return json({ reply: reply.trim() || "…" });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
