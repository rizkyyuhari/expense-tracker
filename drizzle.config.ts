import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Hanya dibutuhkan untuk `drizzle-kit push/migrate`.
    // `drizzle-kit generate` (membuat file migrasi SQL) bisa jalan tanpa DB.
    url: process.env.DATABASE_URL ?? "",
  },
});
