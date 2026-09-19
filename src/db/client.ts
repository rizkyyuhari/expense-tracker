import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;

/**
 * HTTP driver Neon (aman untuk serverless/edge Vercel).
 * `null` saat DATABASE_URL belum diset — aplikasi tetap jalan
 * dengan penyimpanan lokal, API /api/health melaporkan statusnya.
 */
export const db = url ? drizzle(neon(url), { schema }) : null;

export function isDbConfigured(): boolean {
  return url !== undefined && url.length > 0;
}
