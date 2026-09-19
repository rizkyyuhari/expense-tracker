import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts } from "@/db/schema";
import { authUser, unauthorized } from "@/lib/require-user";

export const dynamic = "force-dynamic";

function mapRow(r: typeof accounts.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    balance: Number(r.balanceNative),
  };
}

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  if (!db)
    return Response.json({ error: "db_not_configured" }, { status: 503 });
  const userId = await authUser();
  if (!userId) return unauthorized();
  const { id } = await params;
  let body: { name?: unknown; balance?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const patch: { name?: string; balanceNative?: string } = {};
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 100)
      return Response.json({ error: "invalid_name" }, { status: 400 });
    patch.name = name;
  }
  if (body.balance !== undefined) {
    const balance = Number(body.balance);
    if (!Number.isFinite(balance) || balance < 0)
      return Response.json({ error: "invalid_balance" }, { status: 400 });
    patch.balanceNative = String(balance);
  }
  if (Object.keys(patch).length === 0)
    return Response.json({ error: "empty_patch" }, { status: 400 });

  const rows = await db
    .update(accounts)
    .set(patch)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning();
  const updated = rows[0];
  if (!updated) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ account: mapRow(updated) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!db)
    return Response.json({ error: "db_not_configured" }, { status: 503 });
  const userId = await authUser();
  if (!userId) return unauthorized();
  const { id } = await params;
  // Transaksi ikut terhapus via FK onDelete cascade.
  const rows = await db
    .delete(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
    .returning({ id: accounts.id });
  if (rows.length === 0)
    return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}
