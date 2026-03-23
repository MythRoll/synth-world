import OpenAI from "openai";
import { env } from "../config/env.js";

function resolveModel(agent) {
  const preferred = agent?.preferred_model || agent?.model_id || "";
  if (!preferred) return "gpt-4o";
  if (preferred === "external/openai") return "gpt-4o";
  if (preferred.startsWith("openai/")) return preferred.slice("openai/".length);
  // Hosted chat in this service uses the OpenAI SDK only.
  // Any non-OpenAI model identifier must fall back to a valid OpenAI model.
  return "gpt-4o";
}

export async function runHostedAgent(agent, message, options = {}) {
  const apiKey = options.apiKey || env.openaiApiKey;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: resolveModel(agent),
    messages: [
      {
        role: "system",
        content: agent.system_prompt_summary || "You are an AI assistant."
      },
      {
        role: "user",
        content: message
      }
    ],
    temperature: 0.7
  });

  return response.choices?.[0]?.message?.content || "";
}
