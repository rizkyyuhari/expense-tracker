import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, transactions } from "@/db/schema";
import { createTransaction } from "@/lib/ledger-service";
import { authUser, unauthorized } from "@/lib/require-user";

export const dynamic = "force-dynamic";

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
  const result = await createTransaction(userId, {
    id: typeof body.id === "string" ? body.id : undefined,
    accountId: typeof body.accountId === "string" ? body.accountId : "",
    kind: body.kind as "income" | "expense",
    amount: Number(body.amount),
    category: typeof body.category === "string" ? body.category : "",
    date: typeof body.date === "string" ? body.date : "",
    note: typeof body.note === "string" ? body.note : undefined,
    amountIdr: Number(body.amountIdr),
  });
  if ("error" in result)
    return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ transaction: result.tx }, { status: 201 });
}
