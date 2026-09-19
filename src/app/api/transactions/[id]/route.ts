import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, transactions } from "@/db/schema";
import { authUser, unauthorized } from "@/lib/require-user";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!db)
    return Response.json({ error: "db_not_configured" }, { status: 503 });
  const userId = await authUser();
  if (!userId) return unauthorized();
  const { id } = await params;

  const found = await db
    .select({ tx: transactions })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(
      and(eq(transactions.id, id), eq(accounts.userId, userId)),
    );
  const tx = found[0]?.tx;
  if (!tx) return Response.json({ error: "not_found" }, { status: 404 });

  await db.delete(transactions).where(eq(transactions.id, id));

  // Kembalikan saldo akun (kebalikan dari saat pencatatan).
  const amount = Number(tx.amountNative);
  await db
    .update(accounts)
    .set({
      balanceNative: sql`${accounts.balanceNative} + ${tx.kind === "income" ? `-${String(amount)}` : String(amount)}`,
    })
    .where(
      and(eq(accounts.id, tx.accountId), eq(accounts.userId, userId)),
    );

  return Response.json({ ok: true });
}
