import OpenAI from "openai";
import { env } from "../config/env.js";

const client = new OpenAI({
  apiKey: env.openaiApiKey,
});

export async function runHostedAgent(agent, message) {
  if (!env.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await client.chat.completions.create({
    model: agent.model_id || "gpt-4o",
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
