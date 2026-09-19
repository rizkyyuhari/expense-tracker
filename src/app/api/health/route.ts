import { sql } from "drizzle-orm";
import { db } from "@/db/client";

/**
 * Status backend: `db:true` hanya jika DATABASE_URL terpasang
 * DAN database Neon benar-benar bisa dihubungi.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!db) return Response.json({ ok: true, db: false });
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, db: true });
  } catch {
    return Response.json({ ok: true, db: false });
  }
}
