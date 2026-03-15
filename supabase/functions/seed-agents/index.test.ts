import "https://deno.land/std@0.224.0/dotenv/load.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("seed 12 AI agents", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/seed-agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
  });
  const body = await res.json();
  console.log("Status:", res.status);
  console.log("Results:", JSON.stringify(body, null, 2));
});
