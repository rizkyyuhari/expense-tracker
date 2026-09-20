import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, transactions } from "@/db/schema";
import { formatNative } from "@/lib/finance";
import { authUser, unauthorized } from "@/lib/require-user";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/accounts/[id]/adjust — rekonsiliasi atomik: set saldo ke angka
 * aktual + catat selisihnya sebagai transaksi "Penyesuaian".
 * Body: { actual: number, date?: yyyy-mm-dd, txId?: string, amountIdr?: number }
 */
export async function POST(req: Request, { params }: Ctx) {
  if (!db)
    return Response.json({ error: "db_not_configured" }, { status: 503 });
  const userId = await authUser();
  if (!userId) return unauthorized();
  const { id } = await params;

  let body: { actual?: unknown; date?: unknown; txId?: unknown; amountIdr?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const actualRaw = Number(body.actual);
  if (!Number.isFinite(actualRaw) || actualRaw < 0)
    return Response.json({ error: "invalid_actual" }, { status: 400 });
  const date =
    typeof body.date === "string" && DATE_RE.test(body.date)
      ? body.date
      : new Date().toISOString().slice(0, 10);
  const rawIdr = Number(body.amountIdr);

  const found = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  const acc = found[0];
  if (!acc) return Response.json({ error: "not_found" }, { status: 404 });

  const isIdr = acc.type === "IDR" || acc.type === "CASH";
  const actual = isIdr ? Math.round(actualRaw) : Number(actualRaw.toFixed(8));
  const diff = isIdr
    ? actual - Number(acc.balanceNative)
    : Number((actual - Number(acc.balanceNative)).toFixed(8));

  await db
    .update(accounts)
    .set({ balanceNative: String(actual) })
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));

  let transaction = null;
  if (diff !== 0) {
    const abs = Math.abs(diff);
    const rows = await db
      .insert(transactions)
      .values({
        ...(typeof body.txId === "string" && body.txId ? { id: body.txId } : {}),
        accountId: id,
        kind: diff > 0 ? "income" : "expense",
        amountNative: String(abs),
        amountIdr: String(
          Number.isFinite(rawIdr) && rawIdr >= 0 ? rawIdr : abs,
        ),
        category: "Penyesuaian",
        date,
        note: `Penyesuaian ke ${formatNative(actual, acc.type)}`,
      })
      .returning();
    const t = rows[0];
    if (t) {
      transaction = {
        id: t.id,
        accountId: t.accountId,
        kind: t.kind,
        amount: Number(t.amountNative),
        category: t.category,
        date: t.date,
        note: t.note ?? undefined,
        amountIdr: Number(t.amountIdr),
      };
    }
  }

  return Response.json({
    account: { id, name: acc.name, type: acc.type, balance: actual },
    transaction,
  });
}
