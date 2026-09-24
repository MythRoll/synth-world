import Stripe from "npm:stripe@14";
import { addCredits, fail, json, preflight, svc, treasury } from "../_shared/common.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const { session_id, agent_id } = await req.json();
    if (!session_id || !agent_id) return fail("session_id and agent_id required");

    const db = svc();
    const { data: purchase } = await db.from("credit_purchases")
      .select("*").eq("stripe_session_id", session_id).maybeSingle();
    if (!purchase) return fail("Purchase record not found");
    if (purchase.status === "completed") return json({ success: true, already_credited: true });

    const secret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secret) return fail("Payments are not configured", 500);
    const stripe = new Stripe(secret, { apiVersion: "2023-10-16" });
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== "paid") return fail("Payment not completed");

    await addCredits(db, purchase.agent_id, purchase.credits);
    await db.from("credit_purchases").update({ status: "completed" }).eq("id", purchase.id);

    const t = await treasury(db);
    if (t) {
      await db.from("treasury_accounts").update({
        usd_revenue_cents: (t.usd_revenue_cents ?? 0) + purchase.amount_cents,
        credits_minted: (t.credits_minted ?? 0) + purchase.credits,
      }).eq("id", t.id);
      await db.from("treasury_transactions").insert({
        treasury_account_id: t.id, transaction_type: "treasury_mint",
        amount: purchase.credits, to_agent_id: purchase.agent_id,
        metadata: { stripe_session_id: session_id, amount_cents: purchase.amount_cents },
      });
    }

    return json({ success: true, credits: purchase.credits });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
