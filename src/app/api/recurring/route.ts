import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, recurringRules } from "@/db/schema";
import { wibTodayKey } from "@/lib/finance";
import { authUser, unauthorized } from "@/lib/require-user";

export const dynamic = "force-dynamic";

function mapRow(
  r: typeof recurringRules.$inferSelect,
  acc: { name: string; type: string } | null,
) {
  return {
    id: r.id,
    accountId: r.accountId,
    accountName: acc?.name ?? "?",
    accountType: acc?.type ?? "IDR",
    kind: r.kind,
    amount: Number(r.amountNative),
    category: r.category,
    note: r.note ?? undefined,
    dayOfMonth: r.dayOfMonth,
    startMonth: r.startMonth,
    active: r.active,
  };
}

export async function GET() {
  if (!db)
    return Response.json({ error: "db_not_configured" }, { status: 503 });
  const userId = await authUser();
  if (!userId) return unauthorized();
  const rows = await db
    .select({ rule: recurringRules, acc: accounts })
    .from(recurringRules)
    .leftJoin(accounts, eq(recurringRules.accountId, accounts.id))
    .where(eq(recurringRules.userId, userId))
    .orderBy(asc(recurringRules.createdAt));
  return Response.json({
    rules: rows.map((r) =>
      mapRow(r.rule, r.acc ? { name: r.acc.name, type: r.acc.type } : null),
    ),
  });
}

export async function POST(req: Request) {
  if (!db)
    return Response.json({ error: "db_not_configured" }, { status: 503 });
  const userId = await authUser();
  if (!userId) return unauthorized();
  let body: {
    accountId?: unknown;
    kind?: unknown;
    amount?: unknown;
    category?: unknown;
    note?: unknown;
    dayOfMonth?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.accountId !== "string" || !body.accountId)
    return Response.json({ error: "invalid_account" }, { status: 400 });
  const kind = body.kind === "expense" ? "expense" : "income";
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0)
    return Response.json({ error: "invalid_amount" }, { status: 400 });
  const day = Number(body.dayOfMonth);
  if (!Number.isInteger(day) || day < 1 || day > 31)
    return Response.json({ error: "invalid_day" }, { status: 400 });
  const category =
    typeof body.category === "string" && body.category.trim()
      ? body.category.trim().slice(0, 50)
      : "Gaji";

  const acc = await db
    .select({ id: accounts.id, name: accounts.name, type: accounts.type })
    .from(accounts)
    .where(
      and(eq(accounts.id, body.accountId), eq(accounts.userId, userId)),
    );
  const a = acc[0];
  if (!a) return Response.json({ error: "account_not_found" }, { status: 404 });

  const rows = await db
    .insert(recurringRules)
    .values({
      userId,
      accountId: body.accountId,
      kind,
      amountNative: String(amount),
      category,
      note:
        typeof body.note === "string" && body.note.trim()
          ? body.note.trim().slice(0, 200)
          : null,
      dayOfMonth: day,
      startMonth: wibTodayKey().slice(0, 7),
    })
    .returning();
  const created = rows[0];
  if (!created)
    return Response.json({ error: "insert_failed" }, { status: 500 });
  return Response.json(
    { rule: mapRow(created, { name: a.name, type: a.type }) },
    { status: 201 },
  );
}
