import { headers } from "next/headers";
import { isNull } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { db } from "@/db/client";
import { accounts } from "@/db/schema";

/**
 * User login dari sesi cookie. Sekaligus mengklaim baris yatim
 * (akun yang dibuat sebelum fitur login ada) ke user ini.
 * Return null jika: DB mati atau belum login.
 */
export async function authUser(): Promise<string | null> {
  if (!db) return null;
  const session = await getAuth().api.getSession({
    headers: await headers(),
  });
  const uid = session?.user?.id;
  if (!uid) return null;
  await db
    .update(accounts)
    .set({ userId: uid })
    .where(isNull(accounts.userId));
  return uid;
}

export function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
