import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { categories } from "@/db/schema";
import { authUser, unauthorized } from "@/lib/require-user";

export const dynamic = "force-dynamic";

/**
 * Kategori GLOBAL (dibagi semua user).
 * GET: daftar urut nama. POST: tambah {name, icon?} (idempoten per nama).
 */
export async function GET() {
  if (!db)
    return Response.json({ error: "db_not_configured" }, { status: 503 });
  const userId = await authUser();
  if (!userId) return unauthorized();
  const rows = await db
    .select({ name: categories.name, icon: categories.icon })
    .from(categories)
    .orderBy(asc(categories.name));
  return Response.json({ categories: rows });
}

export async function POST(req: Request) {
  if (!db)
    return Response.json({ error: "db_not_configured" }, { status: 503 });
  const userId = await authUser();
  if (!userId) return unauthorized();
  let body: { name?: unknown; icon?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 50)
    return Response.json({ error: "invalid_name" }, { status: 400 });
  const icon =
    typeof body.icon === "string" && body.icon.trim()
      ? [...body.icon.trim()][0] ?? "💸"
      : "💸";
  const inserted = await db
    .insert(categories)
    .values({ name, icon })
    .onConflictDoNothing({ target: categories.name })
    .returning({ name: categories.name, icon: categories.icon });
  const row = inserted[0];
  if (row) return Response.json({ category: row }, { status: 201 });
  const existing = await db
    .select({ name: categories.name, icon: categories.icon })
    .from(categories)
    .where(eq(categories.name, name));
  return Response.json({ category: existing[0] ?? { name, icon } });
}
