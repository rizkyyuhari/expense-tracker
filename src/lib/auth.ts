import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/client";
import * as schema from "@/db/schema";

/**
 * Instance Better Auth (email + password, sesi di Neon).
 * Lazy agar import modul ini tidak meledak saat build tanpa env
 * (mis. build Vercel sebelum env diisi) — error hanya saat dipanggil.
 */
type Auth = ReturnType<typeof betterAuth>;
let cached: unknown = null;

export function getAuth(): Auth {
  if (!db) {
    throw new Error(
      "DATABASE_URL belum diset — auth membutuhkan Neon. Isi env dulu.",
    );
  }
  if (!cached) {
    cached = betterAuth({
      database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
          user: schema.user,
          session: schema.session,
          account: schema.account,
          verification: schema.verification,
        },
      }),
      emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
      },
    });
  }
  return cached as Auth;
}
