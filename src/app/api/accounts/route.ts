import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts } from "@/db/schema";
import { authUser, unauthorized } from "@/lib/require-user";

export const dynamic = "force-dynamic";

const TYPES = ["IDR", "CASH", "USDT", "GOLD"] as const;

function mapRow(r: typeof accounts.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    balance: Number(r.balanceNative),
  };
}

export async function GET() {
  if (!db)
    return Response.json({ error: "db_not_configured" }, { status: 503 });
  const userId = await authUser();
  if (!userId) return unauthorized();
  const rows = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .orderBy(asc(accounts.createdAt));
  return Response.json({ accounts: rows.map(mapRow) });
}

export async function POST(req: Request) {
  if (!db)
    return Response.json({ error: "db_not_configured" }, { status: 503 });
  const userId = await authUser();
  if (!userId) return unauthorized();
  let body: {
    id?: unknown;
    name?: unknown;
    type?: unknown;
    balance?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const type = body.type;
  const balance = Number(body.balance);
  if (!name || name.length > 100)
    return Response.json({ error: "invalid_name" }, { status: 400 });
  if (!TYPES.includes(type as (typeof TYPES)[number]))
    return Response.json({ error: "invalid_type" }, { status: 400 });
  if (!Number.isFinite(balance) || balance < 0)
    return Response.json({ error: "invalid_balance" }, { status: 400 });

  const rows = await db
    .insert(accounts)
    .values({
      ...(typeof body.id === "string" && body.id ? { id: body.id } : {}),
      userId,
      name,
      type: type as (typeof TYPES)[number],
      balanceNative: String(balance),
    })
    .returning();
  const created = rows[0];
  if (!created)
    return Response.json({ error: "insert_failed" }, { status: 500 });
  return Response.json({ account: mapRow(created) }, { status: 201 });
}
