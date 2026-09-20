import { db } from "@/db/client";
import { processDueRules } from "@/lib/recurring-service";
import { authUser, unauthorized } from "@/lib/require-user";

export const dynamic = "force-dynamic";

/** Proses aturan jatuh tempo milik user login (idempoten). */
export async function POST() {
  if (!db)
    return Response.json({ error: "db_not_configured" }, { status: 503 });
  const userId = await authUser();
  if (!userId) return unauthorized();
  try {
    const r = await processDueRules(userId);
    return Response.json({ ok: true, ...r });
  } catch {
    return Response.json({ error: "run_failed" }, { status: 500 });
  }
}
