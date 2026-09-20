import { db } from "@/db/client";
import { processDueRules } from "@/lib/recurring-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/recurring — dipanggil Vercel Cron (harian) untuk SEMUA user.
 * Diamankan CRON_SECRET: Vercel mengirimnya sebagai header Authorization
 * bila env tersebut diset. Cron-job.org dkk: ?secret=...
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16)
    return Response.json({ error: "cron_not_configured" }, { status: 503 });
  const auth = req.headers.get("authorization");
  const url = new URL(req.url);
  const ok =
    auth === `Bearer ${secret}` || url.searchParams.get("secret") === secret;
  if (!ok) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!db)
    return Response.json({ error: "db_not_configured" }, { status: 503 });
  try {
    const r = await processDueRules();
    return Response.json({ ok: true, ...r });
  } catch {
    return Response.json({ error: "run_failed" }, { status: 500 });
  }
}
