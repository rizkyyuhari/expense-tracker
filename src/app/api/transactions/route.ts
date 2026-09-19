import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, transactions } from "@/db/schema";
import { authUser, unauthorized } from "@/lib/require-user";

export const dynamic = "force-dynamic";

const KINDS = ["income", "expense"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function mapRow(r: typeof transactions.$inferSelect) {
  return {
    id: r.id,
    accountId: r.accountId,
    kind: r.kind,
    amount: Number(r.amountNative),
    category: r.category,
    date: r.date,
    note: r.note ?? undefined,
    amountIdr: Number(r.amountIdr),
  };
}

export async function GET() {
  if (!db)
    return Response.json({ error: "db_not_configured" }, { status: 503 });
  const userId = await authUser();
  if (!userId) return unauthorized();
  const rows = await db
    .select({ tx: transactions })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(eq(accounts.userId, userId))
    .orderBy(desc(transactions.date), desc(transactions.createdAt));
  return Response.json({ transactions: rows.map((r) => mapRow(r.tx)) });
}

export async function POST(req: Request) {
  if (!db)
    return Response.json({ error: "db_not_configured" }, { status: 503 });
  const userId = await authUser();
  if (!userId) return unauthorized();
  let body: {
    id?: unknown;
    accountId?: unknown;
    kind?: unknown;
    amount?: unknown;
    category?: unknown;
    date?: unknown;
    note?: unknown;
    amountIdr?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const kind = body.kind;
  const amount = Number(body.amount);
  const category =
    typeof body.category === "string" ? body.category.trim() : "";
  const date = body.date;
  const amountIdr = Number(body.amountIdr);
  if (typeof body.accountId !== "string" || !body.accountId)
    return Response.json({ error: "invalid_account" }, { status: 400 });
  if (!KINDS.includes(kind as (typeof KINDS)[number]))
    return Response.json({ error: "invalid_kind" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0)
    return Response.json({ error: "invalid_amount" }, { status: 400 });
  if (!category || category.length > 100)
    return Response.json({ error: "invalid_category" }, { status: 400 });
  if (typeof date !== "string" || !DATE_RE.test(date))
    return Response.json({ error: "invalid_date" }, { status: 400 });
  if (!Number.isFinite(amountIdr) || amountIdr < 0)
    return Response.json({ error: "invalid_amount_idr" }, { status: 400 });

  const acc = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(eq(accounts.id, body.accountId), eq(accounts.userId, userId)),
    );
  if (acc.length === 0)
    return Response.json({ error: "account_not_found" }, { status: 404 });

  const k = kind as (typeof KINDS)[number];
  const rows = await db
    .insert(transactions)
    .values({
      ...(typeof body.id === "string" && body.id ? { id: body.id } : {}),
      accountId: body.accountId,
      kind: k,
      amountNative: String(amount),
      amountIdr: String(amountIdr),
      category,
      date,
      note:
        typeof body.note === "string" && body.note.trim()
          ? body.note.trim()
          : null,
    })
    .returning();
  const created = rows[0];
  if (!created)
    return Response.json({ error: "insert_failed" }, { status: 500 });

  // Saldo akun dihitung di SQL agar konsisten (tambah/kurang delta).
  await db
    .update(accounts)
    .set({
      balanceNative: sql`${accounts.balanceNative} + ${k === "income" ? String(amount) : `-${String(amount)}`}`,
    })
    .where(
      and(eq(accounts.id, body.accountId), eq(accounts.userId, userId)),
    );

  return Response.json({ transaction: mapRow(created) }, { status: 201 });
}
