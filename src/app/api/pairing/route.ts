import { randomInt } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { pairingCodes, user } from "@/db/schema";
import { authUser, unauthorized } from "@/lib/require-user";

export const dynamic = "force-dynamic";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa 0/O/1/I
const CODE_TTL_MS = 10 * 60 * 1000;

function botUsername(): string | null {
  const u = process.env.TELEGRAM_BOT_USERNAME;
  return u && u.length > 2 ? u.replace(/^@/, "") : null;
}

/** Status tautan + info bot (untuk UI). */
export async function GET() {
  if (!db)
    return Response.json({ error: "db_not_configured" }, { status: 503 });
  const userId = await authUser();
  if (!userId) return unauthorized();
  const rows = await db
    .select({ telegramChatId: user.telegramChatId })
    .from(user)
    .where(eq(user.id, userId));
  return Response.json({
    linked: Boolean(rows[0]?.telegramChatId),
    configured: Boolean(
      process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET,
    ),
    botUsername: botUsername(),
  });
}

/** Buat kode pairing 6-digit sekali pakai (10 menit). */
export async function POST() {
  if (!db)
    return Response.json({ error: "db_not_configured" }, { status: 503 });
  const userId = await authUser();
  if (!userId) return unauthorized();
  let code = "";
  for (let i = 0; i < 6; i++)
    code += CODE_CHARS[randomInt(CODE_CHARS.length)];
  // Satu kode aktif per user: hapus yang lama dulu.
  await db.delete(pairingCodes).where(eq(pairingCodes.userId, userId));
  // Kemungkinan tabrakan kode antar user sangat kecil; abaikan (PK unik
  // akan melempar 500 yang bisa di-retry user — cukup untuk Fase 1).
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  await db.insert(pairingCodes).values({ code, userId, expiresAt });
  return Response.json(
    { code, expiresAt: expiresAt.toISOString(), botUsername: botUsername() },
    { status: 201 },
  );
}
