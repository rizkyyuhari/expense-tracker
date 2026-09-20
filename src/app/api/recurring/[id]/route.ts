import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, recurringRules } from "@/db/schema";
import { authUser, unauthorized } from "@/lib/require-user";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function owned(id: string, userId: string) {
  if (!db) return null;
  const rows = await db
    .select()
    .from(recurringRules)
    .where(
      and(eq(recurringRules.id, id), eq(recurringRules.userId, userId)),
    );
  return rows[0] ?? null;
}

export async function PATCH(req: Request, { params }: Ctx) {
  if (!db)
    return Response.json({ error: "db_not_configured" }, { status: 503 });
  const userId = await authUser();
  if (!userId) return unauthorized();
  const { id } = await params;
  const existing = await owned(id, userId);
  if (!existing) return Response.json({ error: "not_found" }, { status: 404 });

  let body: {
    accountId?: unknown;
    kind?: unknown;
    amount?: unknown;
    category?: unknown;
    note?: unknown;
    dayOfMonth?: unknown;
    active?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const patch: Partial<typeof recurringRules.$inferInsert> = {};
  if (body.accountId !== undefined) {
    if (typeof body.accountId !== "string" || !body.accountId)
      return Response.json({ error: "invalid_account" }, { status: 400 });
    const acc = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(eq(accounts.id, body.accountId), eq(accounts.userId, userId)),
      );
    if (acc.length === 0)
      return Response.json({ error: "account_not_found" }, { status: 404 });
    patch.accountId = body.accountId;
  }
  if (body.kind !== undefined) {
    if (body.kind !== "income" && body.kind !== "expense")
      return Response.json({ error: "invalid_kind" }, { status: 400 });
    patch.kind = body.kind;
  }
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0)
      return Response.json({ error: "invalid_amount" }, { status: 400 });
    patch.amountNative = String(amount);
  }
  if (body.category !== undefined) {
    const category =
      typeof body.category === "string" ? body.category.trim() : "";
    if (!category || category.length > 50)
      return Response.json({ error: "invalid_category" }, { status: 400 });
    patch.category = category;
  }
  if (body.note !== undefined) {
    patch.note =
      typeof body.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, 200)
        : null;
  }
  if (body.dayOfMonth !== undefined) {
    const day = Number(body.dayOfMonth);
    if (!Number.isInteger(day) || day < 1 || day > 31)
      return Response.json({ error: "invalid_day" }, { status: 400 });
    patch.dayOfMonth = day;
  }
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean")
      return Response.json({ error: "invalid_active" }, { status: 400 });
    patch.active = body.active;
  }
  if (Object.keys(patch).length === 0)
    return Response.json({ error: "empty_patch" }, { status: 400 });

  const rows = await db
    .update(recurringRules)
    .set(patch)
    .where(
      and(eq(recurringRules.id, id), eq(recurringRules.userId, userId)),
    )
    .returning();
  const updated = rows[0];
  if (!updated) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!db)
    return Response.json({ error: "db_not_configured" }, { status: 503 });
  const userId = await authUser();
  if (!userId) return unauthorized();
  const { id } = await params;
  // Jejak runs ikut terhapus (cascade); transaksi yang sudah diposting tetap.
  const rows = await db
    .delete(recurringRules)
    .where(
      and(eq(recurringRules.id, id), eq(recurringRules.userId, userId)),
    )
    .returning({ id: recurringRules.id });
  if (rows.length === 0)
    return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}
