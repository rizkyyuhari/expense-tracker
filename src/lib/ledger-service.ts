import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, transactions } from "@/db/schema";

const KINDS = ["income", "expense"] as const;
export type CreateTxKind = (typeof KINDS)[number];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface CreateTxInput {
  id?: string;
  accountId: string;
  kind: CreateTxKind;
  amount: number;
  category: string;
  date: string;
  note?: string;
  amountIdr: number;
}

export interface CreatedTx {
  id: string;
  accountId: string;
  kind: CreateTxKind;
  amount: number;
  category: string;
  date: string;
  note?: string;
  amountIdr: number;
}

/**
 * Tulis 1 transaksi milik user: validasi + cek kepemilikan akun +
 * insert + update saldo via delta SQL. Dipakai route REST dan bot Telegram.
 * Return { tx } atau { error, status } (bentuk HTTP agar route tinggal map).
 */
export async function createTransaction(
  userId: string,
  input: CreateTxInput,
): Promise<{ tx: CreatedTx } | { error: string; status: number }> {
  if (!db) return { error: "db_not_configured", status: 503 };
  const { accountId, kind, amount, category, date, amountIdr } = input;
  if (typeof accountId !== "string" || !accountId)
    return { error: "invalid_account", status: 400 };
  if (!KINDS.includes(kind))
    return { error: "invalid_kind", status: 400 };
  if (!Number.isFinite(amount) || amount <= 0)
    return { error: "invalid_amount", status: 400 };
  const cat = typeof category === "string" ? category.trim() : "";
  if (!cat || cat.length > 100)
    return { error: "invalid_category", status: 400 };
  if (typeof date !== "string" || !DATE_RE.test(date))
    return { error: "invalid_date", status: 400 };
  if (!Number.isFinite(amountIdr) || amountIdr < 0)
    return { error: "invalid_amount_idr", status: 400 };

  const acc = await db
    .select({ id: accounts.id, type: accounts.type })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));
  if (acc.length === 0) return { error: "account_not_found", status: 404 };

  const note =
    typeof input.note === "string" && input.note.trim()
      ? input.note.trim()
      : null;
  const rows = await db
    .insert(transactions)
    .values({
      ...(typeof input.id === "string" && input.id ? { id: input.id } : {}),
      accountId,
      kind,
      amountNative: String(amount),
      amountIdr: String(amountIdr),
      category: cat,
      date,
      note,
    })
    .returning();
  const created = rows[0];
  if (!created) return { error: "insert_failed", status: 500 };

  await db
    .update(accounts)
    .set({
      balanceNative: sql`${accounts.balanceNative} + ${kind === "income" ? String(amount) : `-${String(amount)}`}`,
    })
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));

  return {
    tx: {
      id: created.id,
      accountId: created.accountId,
      kind: created.kind,
      amount: Number(created.amountNative),
      category: created.category,
      date: created.date,
      note: created.note ?? undefined,
      amountIdr: Number(created.amountIdr),
    },
  };
}
