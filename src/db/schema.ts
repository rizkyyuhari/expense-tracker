import {
  boolean,
  date,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Skema Neon Postgres untuk expense tracker multi-aset.
 * Saldo/transaksi disimpan dalam satuan native (IDR=rupiah, USDT=koin,
 * GOLD=gram) + kolom amountIdr untuk agregasi cepat ke Rupiah.
 * Migrasi SQL ada di ./drizzle (hasil `drizzle-kit generate`).
 */

export const accountType = pgEnum("account_type", [
  "IDR",
  "CASH",
  "USDT",
  "GOLD",
]);

export const txKind = pgEnum("tx_kind", ["income", "expense"]);

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Pemilik. Nullable agar baris lama (pra-login) bisa diklaim user pertama. */
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: accountType("type").notNull(),
  // Saldo native: rupiah / USDT / gram emas
  balanceNative: numeric("balance_native", { precision: 20, scale: 8 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  icon: text("icon").notNull().default("💸"),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  kind: txKind("kind").notNull(),
  // Nominal native mengikuti tipe akun
  amountNative: numeric("amount_native", { precision: 20, scale: 8 }).notNull(),
  // Nilai konversi ke IDR saat transaksi dicatat (snapshot kurs)
  amountIdr: numeric("amount_idr", { precision: 20, scale: 2 }).notNull(),
  category: text("category").notNull().default("Lainnya"),
  date: date("date").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Cache kurs: USDTIDR (Rp per 1 USDT), GOLDIDR_GRAM (Rp per gram). */
export const rates = pgTable("rates", {
  symbol: text("symbol").primaryKey(),
  price: numeric("price", { precision: 20, scale: 6 }).notNull(),
  source: text("source").notNull().default("manual"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------- Better Auth (email + password) ----------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  /** Chat Telegram yang ditautkan via kode pairing (/link). */
  telegramChatId: text("telegram_chat_id").unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ---------- Bot Telegram (Fase 1: struk-OCR) ----------

/** Kode pairing 6-digit sekali pakai (kedaluwarsa 10 menit). */
export const pairingCodes = pgTable("pairing_codes", {
  code: text("code").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Status percakapan struk per chat (serverless tidak boleh simpan di memori;
 * callback_data Telegram maks 64 byte sehingga state wajib di DB).
 * Satu chat = satu struk aktif (foto baru menimpa).
 */
export const botPending = pgTable("bot_pending", {
  chatId: text("chat_id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  step: text("step").notNull().default("kind"),
  merchant: text("merchant"),
  amountIdr: numeric("amount_idr", { precision: 20, scale: 2 })
    .notNull()
    .default("0"),
  date: date("date"),
  kind: text("kind"),
  accountId: uuid("account_id"),
  category: text("category"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
