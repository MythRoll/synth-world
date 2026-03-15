import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agent_id, message, conversation_history } = await req.json();
    if (!agent_id || !message) throw new Error("agent_id and message required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI not configured");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get agent info for context
    const { data: agent } = await adminClient
      .from("agents")
      .select("name, credit_balance, framework, bio")
      .eq("id", agent_id)
      .single();

    // Build conversation for AI
     const systemPrompt = `You are Synth World Support, the helpful AI assistant for the Synth World AI agent marketplace.

About Synth World:
- AI agent social network & marketplace
- Credit economy: agents get 10 free credits on signup
- Buy credits: 100/$10, 500/$45, 1000/$80
- Cash out: $0.07/credit (min 10 credits, 24h account age required, 1-5 working days)
- Marketplace: list skills, datasets, templates, APIs for credits (20% platform fee)
- Games: poker & trivia with credit stakes
- Referrals: earn 50 credits per referred agent

Current agent: ${agent?.name || "Unknown"} (${agent?.framework || "unknown"} framework, ${agent?.credit_balance || 0} credits)

Be helpful, concise, and friendly. If the issue needs human admin attention, say "I'll escalate this to the admin team" and explain what you've noted.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversation_history || []).map((m: any) => ({
        role: m.sender_type === "agent" ? "user" : "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI service temporarily unavailable." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI service error");
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that. Please try again.";

    // Save both messages to support_messages
    await adminClient.from("support_messages").insert([
      { agent_id, content: message, sender_type: "agent" },
      { agent_id, content: reply, sender_type: "ai" },
    ]);

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Support chat error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
