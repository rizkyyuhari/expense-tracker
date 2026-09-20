"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ACCOUNT_META,
  Period,
  addDays,
  formatIDR,
  formatNative,
  parseKey,
  summarize,
  toIdr,
  toKey,
} from "@/lib/finance";
import type { Ledger } from "@/lib/useLedger";
import { useCategories } from "@/lib/useCategories";

const PERIODS: { key: Period; label: string }[] = [
  { key: "day", label: "Hari" },
  { key: "week", label: "Minggu" },
  { key: "month", label: "Bulan" },
  { key: "year", label: "Tahun" },
];

function shiftAnchor(period: Period, anchor: string, dir: 1 | -1): string {
  const d = parseKey(anchor);
  if (period === "day") return toKey(addDays(d, dir));
  if (period === "week") return toKey(addDays(d, dir * 7));
  if (period === "year")
    return toKey(new Date(d.getFullYear() + dir, d.getMonth(), d.getDate()));
  return toKey(new Date(d.getFullYear(), d.getMonth() + dir, 1));
}

function shortIdr(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} jt`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)} rb`;
  return String(Math.round(v));
}

export function StatsSection({ ledger }: { ledger: Ledger }) {
  const { txs, accounts, rates, today, deleteTransaction } = ledger;
  const { iconOf, colorOf } = useCategories();
  const [period, setPeriod] = useState<Period>("week");
  const [anchor, setAnchor] = useState(today);

  const summary = useMemo(() => {
    const s = summarize(txs, accounts, rates, period, anchor);
    // Perkaya ikon/warna (termasuk kategori custom dari DB).
    return {
      ...s,
      byCategory: s.byCategory.map((c) => ({
        ...c,
        icon: iconOf(c.name),
        color: colorOf(c.name),
      })),
    };
  }, [txs, accounts, rates, period, anchor, iconOf, colorOf]);
  const accType = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  const barData = summary.buckets.map((b) => ({
    label: b.label,
    Pemasukan: Math.round(b.income),
    Pengeluaran: Math.round(b.expense),
  }));

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">Statistik</h2>

      {/* Ringkasan */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-3xl bg-success-container p-4">
          <p className="text-xs font-medium opacity-70">Masuk</p>
          <p className="truncate text-sm font-bold sm:text-base">
            {formatIDR(summary.income)}
          </p>
        </div>
        <div className="rounded-3xl bg-error-container p-4">
          <p className="text-xs font-medium opacity-70">Keluar</p>
          <p className="truncate text-sm font-bold sm:text-base">
            {formatIDR(summary.expense)}
          </p>
        </div>
        <div className="rounded-3xl bg-primary-container p-4">
          <p className="text-xs font-medium text-on-primary-container/70">
            Bersih
          </p>
          <p className="truncate text-sm font-bold text-on-primary-container sm:text-base">
            {formatIDR(summary.net)}
          </p>
        </div>
      </div>

      {/* Tab periode + navigator */}
      <div className="mt-3 rounded-3xl border border-outline-variant bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-surface-container p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  period === p.key
                    ? "bg-secondary-container text-on-secondary-container"
                    : "text-on-surface-variant"
                }`}
              >
                {period === p.key ? "✓ " : ""}
                {p.label}
              </button>
            ))}
          </div>
          <div className="ms-auto flex items-center gap-1 text-sm">
            <button
              onClick={() => setAnchor(shiftAnchor(period, anchor, -1))}
              className="rounded-full px-2.5 py-1 font-bold text-primary hover:bg-primary-container"
              aria-label="Periode sebelumnya"
            >
              ‹
            </button>
            <button
              onClick={() => setAnchor(today)}
              className="min-w-28 text-center font-medium"
              title="Kembali ke hari ini"
            >
              {summary.rangeLabel}
            </button>
            <button
              onClick={() => setAnchor(shiftAnchor(period, anchor, 1))}
              className="rounded-full px-2.5 py-1 font-bold text-primary hover:bg-primary-container"
              aria-label="Periode berikutnya"
            >
              ›
            </button>
          </div>
        </div>

        {/* Grafik */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <p className="mb-2 text-xs font-medium text-on-surface-variant">
              Arus kas per {period === "day" ? "hari" : period === "week" ? "hari" : period === "month" ? "tanggal" : "bulan"}
            </p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d3e2f3" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                    minTickGap={12}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => shortIdr(v)}
                    width={52}
                  />
                  <Tooltip
                    formatter={(v) => formatIDR(Number(v))}
                    contentStyle={{ borderRadius: 16, fontSize: 12 }}
                  />
                  <Bar
                    dataKey="Pemasukan"
                    fill="#1b7a3d"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="Pengeluaran"
                    fill="#1976d2"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="lg:col-span-2">
            <p className="mb-2 text-xs font-medium text-on-surface-variant">
              Pengeluaran per kategori
            </p>
            {summary.byCategory.length === 0 ? (
              <p className="flex h-56 items-center justify-center rounded-2xl bg-surface-container-low text-sm text-on-surface-variant">
                Belum ada pengeluaran di periode ini.
              </p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary.byCategory}
                      dataKey="total"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={3}
                    >
                      {summary.byCategory.map((c) => (
                        <Cell key={c.name} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => formatIDR(Number(v))}
                      contentStyle={{ borderRadius: 16, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {summary.byCategory.map((c) => (
                <li key={c.name} className="flex items-center gap-1">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: c.color }}
                  />
                  {c.icon} {c.name} · {formatIDR(c.total)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Daftar transaksi */}
      <div className="mt-3 rounded-3xl border border-outline-variant bg-surface p-2">
        {summary.filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-on-surface-variant">
            Belum ada transaksi di periode ini. Tekan “Catat” untuk menambah.
          </p>
        ) : (
          <ul className="divide-y divide-outline-variant/60">
            {summary.filtered.map((t) => {
              const acc = accType.get(t.accountId);
              const icon = iconOf(t.category);
              const color = colorOf(t.category);
              const idr = toIdr(t.amount, acc?.type ?? "IDR", rates);
              return (
                <li key={t.id} className="flex items-center gap-3 p-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg"
                    style={{ background: color + "22" }}
                  >
                    {icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {t.note || t.category}
                    </p>
                    <p className="truncate text-xs text-on-surface-variant">
                      {new Date(t.date + "T00:00").toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      • {acc?.name ?? "—"} • {t.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-bold ${t.kind === "income" ? "text-success" : "text-error"}`}
                    >
                      {t.kind === "income" ? "+" : "−"}
                      {acc
                        ? formatNative(t.amount, acc.type)
                        : formatIDR(t.amount)}
                    </p>
                    {acc && acc.type !== "IDR" && acc.type !== "CASH" ? (
                      <p className="text-xs text-on-surface-variant">
                        ≈ {formatIDR(idr)}
                      </p>
                    ) : null}
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm("Hapus transaksi ini? Saldo akun akan dikembalikan."))
                        deleteTransaction(t.id);
                    }}
                    className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-on-surface-variant hover:bg-error-container hover:text-error"
                    aria-label="Hapus transaksi"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="mt-2 text-xs text-on-surface-variant">
        {ACCOUNT_META.USDT.icon} Nominal USDT & emas otomatis dikonversi ke
        Rupiah memakai kurs di atas.
      </p>
    </section>
  );
}
