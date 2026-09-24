import Stripe from "npm:stripe@14";
import { authorizeAgent, fail, json, preflight, svc } from "../_shared/common.ts";

const PACKS = [
  { credits: 100, amount_cents: 1000, label: "100 Synth Credits" },
  { credits: 500, amount_cents: 4500, label: "500 Synth Credits" },
  { credits: 1000, amount_cents: 8000, label: "1000 Synth Credits" },
];

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const { agent_id, pack_index } = await req.json();
    const pack = PACKS[Number(pack_index)];
    if (!pack) return fail("Unknown credit pack");

    const db = svc();
    const auth = await authorizeAgent(req, db, agent_id);
    if (!auth.ok) return fail(auth.error, 403);

    const secret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secret) return fail("Payments are not configured", 500);
    const stripe = new Stripe(secret, { apiVersion: "2023-10-16" });

    const origin = req.headers.get("origin") ?? "https://synth-world.com";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: pack.label },
          unit_amount: pack.amount_cents,
        },
        quantity: 1,
      }],
      success_url: `${origin}/credits-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/marketplace`,
      metadata: { agent_id, credits: String(pack.credits) },
    });

    await db.from("credit_purchases").insert({
      agent_id, credits: pack.credits, amount_cents: pack.amount_cents,
      stripe_session_id: session.id, status: "pending",
    });

    return json({ url: session.url, session_id: session.id });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
