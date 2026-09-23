import { addCredits, authorizeAgent, fail, json, preflight, svc, treasuryCollect } from "../_shared/common.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const body = await req.json();
    const action = body.action as string;
    const actingId = body.agent_id ?? body.lender_agent_id;
    const db = svc();
    const auth = await authorizeAgent(req, db, actingId);
    if (!auth.ok) return fail(auth.error, 403);
    const agent = auth.agent;

    // ---- Banking ----
    if (action === "create_loan") {
      const principal = Math.floor(Number(body.principal));
      const rate = Number(body.interest_rate ?? 5);
      const days = Math.max(1, Math.floor(Number(body.days ?? 7)));
      if (!principal || principal <= 0) return fail("positive principal required");
      if (!body.borrower_agent_id) return fail("borrower_agent_id required");
      if (body.borrower_agent_id === actingId) return fail("Cannot lend to yourself");
      if ((agent.credit_balance ?? 0) < principal) return fail("Insufficient credits to fund this loan");
      await addCredits(db, actingId, -principal);
      await addCredits(db, body.borrower_agent_id, principal);
      const dueAt = new Date(Date.now() + days * 86_400_000).toISOString();
      const { data, error } = await db.from("agent_loans").insert({
        lender_agent_id: actingId, borrower_agent_id: body.borrower_agent_id,
        principal, interest_rate: rate, repaid: 0, status: "active", due_at: dueAt,
      }).select("*").single();
      if (error) return fail(error.message);
      return json({ success: true, loan: data });
    }

    if (action === "repay_loan") {
      const amount = Math.floor(Number(body.amount));
      if (!amount || amount <= 0) return fail("positive amount required");
      const { data: loan } = await db.from("agent_loans").select("*").eq("id", body.loan_id).maybeSingle();
      if (!loan) return fail("Loan not found");
      if (loan.borrower_agent_id !== actingId) return fail("Only the borrower can repay this loan");
      if ((agent.credit_balance ?? 0) < amount) return fail("Insufficient credits");
      const owed = Math.ceil(loan.principal * (1 + Number(loan.interest_rate) / 100)) - loan.repaid;
      const pay = Math.min(amount, owed);
      await addCredits(db, actingId, -pay);
      await addCredits(db, loan.lender_agent_id, pay);
      const repaid = loan.repaid + pay;
      const settled = repaid >= Math.ceil(loan.principal * (1 + Number(loan.interest_rate) / 100));
      await db.from("agent_loans").update({ repaid, status: settled ? "repaid" : "active" }).eq("id", loan.id);
      return json({ success: true, repaid, settled });
    }

    // ---- Compute market ----
    if (action === "list_compute") {
      const price = Math.floor(Number(body.price_per_hour));
      if (!body.name || !price || price <= 0) return fail("name and positive price_per_hour required");
      const { data, error } = await db.from("compute_listings").insert({
        provider_agent_id: actingId, name: body.name, description: body.description ?? null,
        price_per_hour: price, available: true,
      }).select("*").single();
      if (error) return fail(error.message);
      return json({ success: true, listing: data });
    }

    if (action === "rent_compute") {
      const hours = Math.max(1, Math.floor(Number(body.hours ?? 1)));
      const { data: listing } = await db.from("compute_listings").select("*").eq("id", body.listing_id).maybeSingle();
      if (!listing || !listing.available) return fail("Compute listing unavailable");
      if (listing.provider_agent_id === actingId) return fail("Cannot rent your own compute");
      const total = listing.price_per_hour * hours;
      if ((agent.credit_balance ?? 0) < total) return fail("Insufficient credits");
      const fee = Math.ceil(total * 0.1);
      await addCredits(db, actingId, -total);
      await addCredits(db, listing.provider_agent_id, total - fee);
      await treasuryCollect(db, fee, "compute_fee", actingId, { listing_id: listing.id, hours });
      return json({ success: true, total, fee });
    }

    // ---- Shares ----
    if (action === "buy_shares") {
      const shares = Math.floor(Number(body.shares));
      const price = Math.floor(Number(body.price_per_share ?? 10));
      if (!shares || shares <= 0) return fail("positive shares required");
      const { data: biz } = await db.from("businesses").select("*").eq("id", body.business_id).maybeSingle();
      if (!biz) return fail("Business not found");
      const total = shares * price;
      if ((agent.credit_balance ?? 0) < total) return fail("Insufficient credits");
      await addCredits(db, actingId, -total);
      await db.from("businesses").update({ treasury_credits: (biz.treasury_credits ?? 0) + total }).eq("id", biz.id);
      const { data: existing } = await db.from("business_shares")
        .select("*").eq("business_id", biz.id).eq("owner_agent_id", actingId).maybeSingle();
      if (existing) {
        await db.from("business_shares").update({ shares: existing.shares + shares }).eq("id", existing.id);
      } else {
        await db.from("business_shares").insert({ business_id: biz.id, owner_agent_id: actingId, shares });
      }
      return json({ success: true, shares, total });
    }

    return fail("Unknown action");
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
