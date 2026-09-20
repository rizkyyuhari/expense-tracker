/**
 * Tipe + logika keuangan inti (dipakai UI lokal & kelak API Neon).
 * Semua nominal akun/transaksi disimpan dalam satuan NATIVE:
 * IDR/CASH = rupiah, USDT = koin, GOLD = gram.
 * Konversi ke Rupiah hanya untuk tampilan/agregasi.
 */

export type AccountType = "IDR" | "CASH" | "USDT" | "GOLD";
export type TxKind = "income" | "expense";
export type Period = "day" | "week" | "month" | "year";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
}

export interface Transaction {
  id: string;
  accountId: string;
  kind: TxKind;
  amount: number;
  category: string;
  date: string; // yyyy-mm-dd (lokal)
  note?: string;
}

export interface Rates {
  usdtIdr: number;
  goldIdrPerGram: number;
  source: string;
  updatedAt: string;
}

export const DEFAULT_RATES: Rates = {
  usdtIdr: 17600,
  goldIdrPerGram: 1950000,
  source: "default",
  updatedAt: new Date().toISOString(),
};

export const ACCOUNT_META: Record<
  AccountType,
  { label: string; unit: string; icon: string; step: string }
> = {
  IDR: { label: "Rupiah (Bank/E-wallet)", unit: "Rp", icon: "🏦", step: "1000" },
  CASH: { label: "Uang Cash", unit: "Rp", icon: "💵", step: "1000" },
  USDT: { label: "Tether USD", unit: "USDT", icon: "₮", step: "0.01" },
  GOLD: { label: "Emas", unit: "gram", icon: "🪙", step: "0.001" },
};

export const CATEGORIES: { name: string; icon: string; color: string }[] = [
  { name: "Makan", icon: "🍜", color: "#f59e0b" },
  { name: "Transport", icon: "🛵", color: "#0ea5e9" },
  { name: "Belanja", icon: "🛍️", color: "#8b5cf6" },
  { name: "Tagihan", icon: "🧾", color: "#ef4444" },
  { name: "Hiburan", icon: "🎮", color: "#ec4899" },
  { name: "Kesehatan", icon: "💊", color: "#10b981" },
  { name: "Gaji", icon: "💼", color: "#1976d2" },
  { name: "Investasi", icon: "📈", color: "#059669" },
  { name: "Lainnya", icon: "💸", color: "#64748b" },
];

export function categoryMeta(name: string) {
  return (
    CATEGORIES.find((c) => c.name === name) ??
    CATEGORIES[CATEGORIES.length - 1]
  );
}

/** Palet untuk kategori custom (di luar daftar bawaan). */
const CATEGORY_PALETTE = [
  "#0ea5e9",
  "#8b5cf6",
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#0284c7",
  "#d946ef",
  "#65a30d",
  "#ea580c",
];

/** Warna kategori: bawaan pakai warna brand, custom dari hash nama (stabil). */
export function colorForCategory(name: string): string {
  const known = CATEGORIES.find((c) => c.name === name);
  if (known) return known.color;
  let h = 0;
  for (let i = 0; i < name.length; i++)
    h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return CATEGORY_PALETTE[h % CATEGORY_PALETTE.length] ?? "#64748b";
}

// ---------- format & konversi ----------

export function formatIDR(n: number): string {
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

export function formatNative(n: number, type: AccountType): string {  if (type === "IDR" || type === "CASH")
    return "Rp" + Math.round(n).toLocaleString("id-ID");
  if (type === "USDT")
    return `${n.toLocaleString("en-US", { maximumFractionDigits: 4 })} USDT`;
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 4 })} gram`;
}

/** Bulatkan nominal ke presisi wajar per tipe aset. */
export function roundNative(n: number, type: AccountType): number {
  if (!Number.isFinite(n)) return n;
  if (type === "IDR" || type === "CASH") return Math.round(n);
  return Number(n.toFixed(8));
}

const WD_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
export const WEEKDAY_SHORT = WD_SHORT;

/**
 * Tanggal efektif jadwal bulanan: jepit ke akhir bulan bila hari tidak ada
 * (tgl 31 di Februari → tgl 28/29), lalu MAJU ke Jumat bila jatuh Sabtu/Minggu.
 */
export function effectiveMonthlyDate(
  year: number,
  monthIdx: number,
  day: number,
): Date {
  const dim = new Date(year, monthIdx + 1, 0).getDate();
  const d = new Date(year, monthIdx, Math.min(Math.max(day, 1), dim));
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d;
}

export interface RecurringPreview {
  year: number;
  monthIdx: number;
  monthLabel: string;
  scheduledDay: number;
  effective: Date;
  effectiveKey: string;
  shifted: boolean;
  weekday: string;
}

/** N tanggal efektif ke depan mulai bulan ini (lewati yang sudah lewat). */
export function previewRecurring(
  day: number,
  count: number,
  from: Date = new Date(),
): RecurringPreview[] {
  const out: RecurringPreview[] = [];
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  let y = from.getFullYear();
  let m = from.getMonth();
  let guard = 0;
  while (out.length < count && guard < 24) {
    const eff = effectiveMonthlyDate(y, m, day);
    const effDay = new Date(eff.getFullYear(), eff.getMonth(), eff.getDate());
    if (effDay >= today) {
      const scheduled = new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
      out.push({
        year: y,
        monthIdx: m,
        monthLabel: monthNames[m] ?? "",
        scheduledDay: scheduled.getDate(),
        effective: eff,
        effectiveKey: toKey(eff),
        shifted: eff.getTime() !== scheduled.getTime(),
        weekday: WD_SHORT[eff.getDay()] ?? "",
      });
    }
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
    guard++;
  }
  return out;
}

/** Tanggal hari ini zona Asia/Jakarta (yyyy-mm-dd) — untuk batas periode server. */
export function wibTodayKey(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return parts; // format en-CA = yyyy-mm-dd
}

export function toIdr(
  amountNative: number,
  type: AccountType,
  rates: Rates,
): number {
  if (type === "IDR" || type === "CASH") return amountNative;
  if (type === "USDT") return amountNative * rates.usdtIdr;
  return amountNative * rates.goldIdrPerGram;
}

// ---------- tanggal ----------

export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

const DAY_LABEL = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTH_LABEL = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export interface Bucket {
  key: string;
  label: string;
  income: number;
  expense: number;
}

export function periodRange(
  period: Period,
  anchorKey: string,
): { start: string; end: string } {
  const a = parseKey(anchorKey);
  if (period === "day") return { start: anchorKey, end: anchorKey };
  if (period === "week")
    return { start: toKey(addDays(a, -6)), end: anchorKey };
  if (period === "month") {
    const s = new Date(a.getFullYear(), a.getMonth(), 1);
    const e = new Date(a.getFullYear(), a.getMonth() + 1, 0);
    return { start: toKey(s), end: toKey(e) };
  }
  return {
    start: `${a.getFullYear()}-01-01`,
    end: `${a.getFullYear()}-12-31`,
  };
}

export function buildBuckets(period: Period, anchorKey: string): Bucket[] {
  const a = parseKey(anchorKey);
  if (period === "day")
    return [{ key: anchorKey, label: "Hari ini", income: 0, expense: 0 }];
  if (period === "week")
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(a, i - 6);
      return {
        key: toKey(d),
        label: DAY_LABEL[d.getDay()] ?? "",
        income: 0,
        expense: 0,
      };
    });
  if (period === "month") {
    const days = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(a.getFullYear(), a.getMonth(), i + 1);
      return { key: toKey(d), label: String(i + 1), income: 0, expense: 0 };
    });
  }
  return MONTH_LABEL.map((label, i) => ({
    key: `${a.getFullYear()}-${String(i + 1).padStart(2, "0")}`,
    label,
    income: 0,
    expense: 0,
  }));
}

function bucketKeyFor(period: Period, dateKey: string): string {
  if (period === "year") return dateKey.slice(0, 7);
  return dateKey;
}

export interface Summary {
  income: number;
  expense: number;
  net: number;
  buckets: Bucket[];
  byCategory: { name: string; total: number; icon: string; color: string }[];
  filtered: Transaction[];
  rangeLabel: string;
}

export function summarize(
  txs: Transaction[],
  accounts: Account[],
  rates: Rates,
  period: Period,
  anchorKey: string,
): Summary {
  const { start, end } = periodRange(period, anchorKey);
  const accType = new Map(accounts.map((a) => [a.id, a.type]));
  const buckets = buildBuckets(period, anchorKey);
  const byBucket = new Map(buckets.map((b) => [b.key, b]));
  const byCat = new Map<string, number>();
  const filtered: Transaction[] = [];

  for (const t of txs) {
    if (t.date < start || t.date > end) continue;
    filtered.push(t);
    const idr = toIdr(t.amount, accType.get(t.accountId) ?? "IDR", rates);
    const b = byBucket.get(bucketKeyFor(period, t.date));
    if (b) {
      if (t.kind === "income") b.income += idr;
      else b.expense += idr;
    }
    if (t.kind === "expense")
      byCat.set(t.category, (byCat.get(t.category) ?? 0) + idr);
  }
  filtered.sort((x, y) =>
    x.date === y.date ? 0 : x.date < y.date ? 1 : -1,
  );

  const income = buckets.reduce((s, b) => s + b.income, 0);
  const expense = buckets.reduce((s, b) => s + b.expense, 0);
  const byCategory = [...byCat.entries()]
    .map(([name, total]) => {
      const m = categoryMeta(name);
      return { name, total, icon: m.icon, color: m.color };
    })
    .sort((a, b) => b.total - a.total);

  const fmt = (k: string) =>
    parseKey(k).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  const rangeLabel =
    period === "day"
      ? fmt(anchorKey)
      : period === "year"
        ? String(parseKey(anchorKey).getFullYear())
        : `${fmt(start)} – ${fmt(end)}`;

  return { income, expense, net: income - expense, buckets, byCategory, filtered, rangeLabel };
}

export function totalBalanceIdr(accounts: Account[], rates: Rates): number {
  return accounts.reduce((s, a) => s + toIdr(a.balance, a.type, rates), 0);
}

/** Transaksi + snapshot kurs (kolom amountIdr di Neon). */
export interface TxWithIdr extends Transaction {
  amountIdr: number;
}

export function withAmountIdr(
  txs: Transaction[],
  accounts: Account[],
  rates: Rates,
): TxWithIdr[] {
  const typeOf = new Map(accounts.map((a) => [a.id, a.type]));
  return txs.map((t) => ({
    ...t,
    amountIdr: toIdr(t.amount, typeOf.get(t.accountId) ?? "IDR", rates),
  }));
}

/**
 * Remap seluruh ID ke UUID baru (kolom Neon bertipe uuid).
 * Dipakai sekali saat adopsi data lokal lama (id format acak pra-UUID)
 * ke server — relasi transaksi→akun ikut dipetakan ulang.
 */
export function normalizeIds(
  accounts: Account[],
  txs: Transaction[],
): { accounts: Account[]; transactions: Transaction[] } {
  const accMap = new Map<string, string>();
  const nextAccounts = accounts.map((a) => {
    const nid = uid();
    accMap.set(a.id, nid);
    return { ...a, id: nid };
  });
  const nextTxs = txs.map((t) => ({
    ...t,
    id: uid(),
    accountId: accMap.get(t.accountId) ?? t.accountId,
  }));
  return { accounts: nextAccounts, transactions: nextTxs };
}

// ---------- penyimpanan lokal ----------

const K = {
  accounts: "etw-accounts-v1",
  txs: "etw-txs-v1",
  rates: "etw-rates-v1",
  manualGold: "etw-manual-gold-v1",
  seeded: "etw-seeded-v1",
} as const;

export function uid(): string {
  // UUID asli agar id yang dibuat di browser sama dengan PK di Neon
  // (sinkronisasi lokal ⇄ cloud tanpa pemetaan ulang).
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function daysAgo(n: number): string {
  return toKey(addDays(new Date(), -n));
}

export function seedData(): { accounts: Account[]; txs: Transaction[] } {
  const bank: Account = { id: uid(), name: "Bank BCA", type: "IDR", balance: 2500000 };
  const cash: Account = { id: uid(), name: "Dompet Cash", type: "CASH", balance: 750000 };
  const usdt: Account = { id: uid(), name: "Binance USDT", type: "USDT", balance: 120 };
  const gold: Account = { id: uid(), name: "Emas Antam", type: "GOLD", balance: 5 };
  const mk = (
    accountId: string,
    kind: TxKind,
    amount: number,
    category: string,
    ago: number,
    note?: string,
  ): Transaction => ({
    id: uid(),
    accountId,
    kind,
    amount,
    category,
    date: daysAgo(ago),
    note,
  });
  const txs: Transaction[] = [
    mk(bank.id, "income", 8500000, "Gaji", 9, "Gaji bulanan"),
    mk(bank.id, "expense", 450000, "Belanja", 8, "Belanja bulanan"),
    mk(cash.id, "expense", 75000, "Makan", 6, "Makan siang"),
    mk(cash.id, "expense", 35000, "Transport", 6, "Bensin"),
    mk(usdt.id, "income", 200, "Investasi", 5, "Profit trading"),
    mk(bank.id, "expense", 320000, "Tagihan", 4, "Listrik + internet"),
    mk(cash.id, "expense", 120000, "Hiburan", 3, "Nonton + kopi"),
    mk(bank.id, "expense", 150000, "Kesehatan", 2, "Vitamin"),
    mk(cash.id, "expense", 60000, "Makan", 1, "Sarapan + makan malam"),
    mk(usdt.id, "expense", 50, "Investasi", 1, "Rebalance"),
    mk(cash.id, "expense", 45000, "Transport", 0, "Parkir + ojek"),
    mk(gold.id, "income", 2, "Investasi", 12, "Beli emas 2 gram"),
  ];
  return { accounts: [bank, cash, usdt, gold], txs };
}

export function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // abaikan (mode privat dsb.)
  }
}

export const storeKeys = K;
