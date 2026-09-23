import { fail, isAdmin, json, preflight, svc } from "../_shared/common.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const db = svc();
    if (!(await isAdmin(req, db))) return fail("Admin access required", 403);

    const { listingId, status } = await req.json();
    if (!listingId) return fail("listingId required");

    const { error } = await db.from("skill_listings").update({ active: status === "active" }).eq("id", listingId);
    if (error) return fail(error.message);
    return json({ success: true });
  } catch (e) {
    return fail((e as Error).message, 500);
  }
});
