import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, transactions } from "@/db/schema";
import { authUser, unauthorized } from "@/lib/require-user";

export const dynamic = "force-dynamic";

const TYPES = ["IDR", "CASH", "USDT", "GOLD"] as const;
const KINDS = ["income", "expense"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/ledger/replace — tulis ulang buku kas MILIK USER LOGIN.
 * Dipakai untuk: migrasi data lokal → Neon, "Muat contoh", "Hapus semua".
 * Body: { accounts: [{id,name,type,balance}], transactions: [{id,accountId,kind,amount,category,date,note?,amountIdr}] }
 */
export async function POST(req: Request) {
  if (!db)
    return Response.json({ error: "db_not_configured" }, { status: 503 });
  const userId = await authUser();
  if (!userId) return unauthorized();
  let body: {
    accounts?: unknown;
    transactions?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!Array.isArray(body.accounts) || !Array.isArray(body.transactions))
    return Response.json({ error: "invalid_shape" }, { status: 400 });

  try {
    const accRows = body.accounts.map((a) => {
      const o = a as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name.trim() : "";
      const balance = Number(o.balance);
      if (
        typeof o.id !== "string" ||
        !o.id ||
        !name ||
        !TYPES.includes(o.type as (typeof TYPES)[number]) ||
        !Number.isFinite(balance)
      )
        throw new Error("invalid_account");
      return {
        id: o.id as string,
        userId,
        name,
        type: o.type as (typeof TYPES)[number],
        balanceNative: String(balance),
      };
    });
    const accIds = new Set(accRows.map((a) => a.id));
    const txRows = body.transactions.map((t) => {
      const o = t as Record<string, unknown>;
      const amount = Number(o.amount);
      const category =
        typeof o.category === "string" ? o.category.trim() : "";
      // amountIdr opsional (data lokal lama tidak menyimpannya);
      // fallback ke nominal native agar request tidak 400.
      const rawIdr = Number(o.amountIdr);
      const amountIdr =
        Number.isFinite(rawIdr) && rawIdr >= 0 ? rawIdr : amount;
      if (
        typeof o.id !== "string" ||
        !o.id ||
        typeof o.accountId !== "string" ||
        !accIds.has(o.accountId) ||
        !KINDS.includes(o.kind as (typeof KINDS)[number]) ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !category ||
        typeof o.date !== "string" ||
        !DATE_RE.test(o.date)
      )
        throw new Error("invalid_transaction");
      return {
        id: o.id as string,
        accountId: o.accountId as string,
        kind: o.kind as (typeof KINDS)[number],
        amountNative: String(amount),
        amountIdr: String(amountIdr),
        category,
        date: o.date as string,
        note:
          typeof o.note === "string" && o.note.trim() ? o.note.trim() : null,
      };
    });

    // Hapus hanya milik user ini. FK: transaksi dulu, baru akun.
    const mine = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.userId, userId));
    const myIds = mine.map((m) => m.id);
    if (myIds.length > 0) {
      await db.delete(transactions).where(inArray(transactions.accountId, myIds));
      await db.delete(accounts).where(eq(accounts.userId, userId));
    }
    if (accRows.length > 0) await db.insert(accounts).values(accRows);
    if (txRows.length > 0) await db.insert(transactions).values(txRows);

    return Response.json({
      ok: true,
      accounts: accRows.length,
      transactions: txRows.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "replace_failed";
    const status = msg.startsWith("invalid_") ? 400 : 500;
    return Response.json({ error: msg }, { status });
  }
}
