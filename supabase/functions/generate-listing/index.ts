import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function aiComplete(model: string, systemPrompt: string, userPrompt: string, apiKey?: string): Promise<string> {
  // If using external OpenAI key, call OpenAI directly
  if (model === "external/openai" && apiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`OpenAI error ${res.status}: ${t}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  }

  // Otherwise use Lovable AI gateway
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model.startsWith("external/") ? "google/gemini-3-flash-preview" : model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "create_listing",
          description: "Create a marketplace listing",
          parameters: {
            type: "object",
            properties: {
              skill_name: { type: "string", description: "Name of the skill/service (max 200 chars)" },
              description: { type: "string", description: "Description of the listing (max 1000 chars)" },
              price_cents: { type: "integer", description: "Price in credits (1-10000)" },
              listing_type: { type: "string", enum: ["skill", "dataset", "model", "tool", "other"] },
            },
            required: ["skill_name", "description", "price_cents", "listing_type"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "create_listing" } },
    }),
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error("Rate limited. Try again later.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
    const t = await res.text();
    throw new Error(`AI error ${res.status}: ${t}`);
  }
  const data = await res.json();
  
  // Extract tool call result
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    return toolCall.function.arguments;
  }
  return data.choices?.[0]?.message?.content?.trim() || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results: any[] = [];

    // Get agents with AI capability and marketplace skills
    const { data: agents } = await admin
      .from("agents")
      .select("id, name, bio, preferred_model, agent_capabilities(skill_name, category)")
      .eq("verified", true)
      .eq("flagged", false);

    if (!agents?.length) {
      return new Response(JSON.stringify({ message: "No eligible agents" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter to agents that have capabilities but few listings
    for (const agent of agents) {
      const caps = (agent as any).agent_capabilities || [];
      if (caps.length === 0) continue;

      // Check how many active listings this agent already has
      const { count } = await admin
        .from("skill_listings")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agent.id)
        .eq("active", true);

      // Skip if agent already has 5+ listings
      if ((count || 0) >= 5) continue;

      // Check for existing listing names to avoid duplicates
      const { data: existingListings } = await admin
        .from("skill_listings")
        .select("skill_name")
        .eq("agent_id", agent.id);
      const existingNames = new Set((existingListings || []).map((l: any) => l.skill_name.toLowerCase()));

      // Get agent's preferred model or default
      const model = agent.preferred_model || "google/gemini-3-flash-preview";

      // Fetch external API key if needed
      let externalKey: string | undefined;
      if (model === "external/openai") {
        const { data: keyData } = await admin
          .from("agent_external_api_keys")
          .select("api_key_encrypted")
          .eq("agent_id", agent.id)
          .eq("provider", "openai")
          .single();
        if (!keyData) {
          results.push({ agent: agent.name, error: "No OpenAI key configured" });
          continue;
        }
        externalKey = keyData.api_key_encrypted;
      }

      try {
        const skillsList = caps.map((c: any) => `${c.skill_name} (${c.category})`).join(", ");
        const existingStr = existingNames.size > 0 ? `Already listed: ${[...existingNames].join(", ")}. Do NOT duplicate these.` : "";

        const systemPrompt = `You are ${agent.name}, an AI agent on Synapse marketplace. Bio: ${agent.bio}. Your capabilities: ${skillsList}. ${existingStr} Create a unique, compelling marketplace listing for one of your skills. Price should be reasonable (10-500 credits). Be creative and specific about what the buyer gets.`;
        const userPrompt = "Generate a new marketplace listing based on your capabilities. Make it specific and valuable.";

        const result = await aiComplete(model, systemPrompt, userPrompt, externalKey);

        let listing: any;
        try {
          listing = typeof result === "string" ? JSON.parse(result) : result;
        } catch {
          results.push({ agent: agent.name, error: "Failed to parse AI response" });
          continue;
        }

        // Validate
        if (!listing.skill_name || !listing.price_cents) {
          results.push({ agent: agent.name, error: "Invalid listing data" });
          continue;
        }

        // Skip duplicates
        if (existingNames.has(listing.skill_name.toLowerCase())) {
          results.push({ agent: agent.name, error: "Duplicate listing name" });
          continue;
        }

        const validTypes = ["skill", "dataset", "model", "tool", "other"];
        const listingType = validTypes.includes(listing.listing_type) ? listing.listing_type : "skill";
        const priceCents = Math.max(1, Math.min(10000, Math.round(listing.price_cents)));

        const { error: insertErr } = await admin.from("skill_listings").insert({
          agent_id: agent.id,
          skill_name: listing.skill_name.trim().slice(0, 200),
          description: listing.description?.trim()?.slice(0, 1000) || null,
          price_cents: priceCents,
          listing_type: listingType,
        });

        if (insertErr) {
          results.push({ agent: agent.name, error: insertErr.message });
        } else {
          results.push({ agent: agent.name, action: "listing_created", name: listing.skill_name, price: priceCents });
        }
      } catch (e) {
        results.push({ agent: agent.name, error: e.message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
