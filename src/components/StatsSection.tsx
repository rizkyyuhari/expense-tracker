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
import { useLang } from "@/i18n/lang";

const PERIOD_KEYS = [
  { key: "day", labelKey: "stats.day" },
  { key: "week", labelKey: "stats.week" },
  { key: "month", labelKey: "stats.month" },
  { key: "year", labelKey: "stats.year" },
] as const;

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

export function StatsSection({
  ledger,
  search = "",
  kindFilter = "all",
}: {
  ledger: Ledger;
  search?: string;
  kindFilter?: "all" | "income" | "expense";
}) {
  const { txs, accounts, rates, today, deleteTransaction } = ledger;
  const { iconOf, colorOf } = useCategories();
  const { t, dateLocale } = useLang();
  const [period, setPeriod] = useState<Period>("week");
  const [anchor, setAnchor] = useState(today);

  const seriesIn = t("tx.kindIncome");
  const seriesOut = t("tx.kindExpense");
  const summary = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filteredTxs =
      kindFilter === "all" && q === ""
        ? txs
        : txs.filter(
            (tx) =>
              (kindFilter === "all" || tx.kind === kindFilter) &&
              (q === "" ||
                (tx.note ?? "").toLowerCase().includes(q) ||
                tx.category.toLowerCase().includes(q)),
          );
    const s = summarize(
      filteredTxs,
      accounts,
      rates,
      period,
      anchor,
      dateLocale,
      t("stats.today"),
    );
    // Perkaya ikon/warna (termasuk kategori custom dari DB).
    return {
      ...s,
      byCategory: s.byCategory.map((c) => ({
        ...c,
        icon: iconOf(c.name),
        color: colorOf(c.name),
      })),
    };
  }, [txs, accounts, rates, period, anchor, dateLocale, iconOf, colorOf, t, search, kindFilter]);
  const accType = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  const barData = summary.buckets.map((b) => ({
    label: b.label,
    [seriesIn]: Math.round(b.income),
    [seriesOut]: Math.round(b.expense),
  }));

  const flowLabel =
    period === "day" || period === "week"
      ? t("stats.flowDay")
      : period === "month"
        ? t("stats.flowDate")
        : t("stats.flowMonth");

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">{t("stats.title")}</h2>

      {/* Ringkasan */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-3xl bg-success-container p-4">
          <p className="text-xs font-medium opacity-70">{t("stats.in")}</p>
          <p className="truncate text-sm font-bold sm:text-base">
            {formatIDR(summary.income)}
          </p>
        </div>
        <div className="rounded-3xl bg-error-container p-4">
          <p className="text-xs font-medium opacity-70">{t("stats.out")}</p>
          <p className="truncate text-sm font-bold sm:text-base">
            {formatIDR(summary.expense)}
          </p>
        </div>
        <div className="rounded-3xl bg-primary-container p-4">
          <p className="text-xs font-medium text-on-primary-container/70">
            {t("stats.net")}
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
            {PERIOD_KEYS.map((p) => (
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
                {t(p.labelKey)}
              </button>
            ))}
          </div>
          <div className="ms-auto flex items-center gap-1 text-sm">
            <button
              onClick={() => setAnchor(shiftAnchor(period, anchor, -1))}
              className="rounded-full px-2.5 py-1 font-bold text-primary hover:bg-primary-container"
              aria-label="‹"
            >
              ‹
            </button>
            <button
              onClick={() => setAnchor(today)}
              className="min-w-28 text-center font-medium"
              title={t("stats.today")}
            >
              {summary.rangeLabel}
            </button>
            <button
              onClick={() => setAnchor(shiftAnchor(period, anchor, 1))}
              className="rounded-full px-2.5 py-1 font-bold text-primary hover:bg-primary-container"
              aria-label="›"
            >
              ›
            </button>
          </div>
        </div>

        {/* Grafik */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <p className="mb-2 text-xs font-medium text-on-surface-variant">
              {flowLabel}
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
                    dataKey={seriesIn}
                    fill="#1b7a3d"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey={seriesOut}
                    fill="#1976d2"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="lg:col-span-2">
            <p className="mb-2 text-xs font-medium text-on-surface-variant">
              {t("stats.byCategory")}
            </p>
            {summary.byCategory.length === 0 ? (
              <p className="flex h-56 items-center justify-center rounded-2xl bg-surface-container-low text-sm text-on-surface-variant">
                {t("stats.emptyCategory")}
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
            {t("stats.emptyTx")}
          </p>
        ) : (
          <ul className="divide-y divide-outline-variant/60">
            {summary.filtered.map((tx) => {
              const acc = accType.get(tx.accountId);
              const icon = iconOf(tx.category);
              const color = colorOf(tx.category);
              const idr = toIdr(tx.amount, acc?.type ?? "IDR", rates);
              return (
                <li key={tx.id} className="flex items-center gap-3 p-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg"
                    style={{ background: color + "22" }}
                  >
                    {icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {tx.note || tx.category}
                    </p>
                    <p className="truncate text-xs text-on-surface-variant">
                      {new Date(tx.date + "T00:00").toLocaleDateString(dateLocale, {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      • {acc?.name ?? "—"} • {tx.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-bold ${tx.kind === "income" ? "text-success" : "text-error"}`}
                    >
                      {tx.kind === "income" ? "+" : "−"}
                      {acc
                        ? formatNative(tx.amount, acc.type)
                        : formatIDR(tx.amount)}
                    </p>
                    {acc && acc.type !== "IDR" && acc.type !== "CASH" ? (
                      <p className="text-xs text-on-surface-variant">
                        ≈ {formatIDR(idr)}
                      </p>
                    ) : null}
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm(t("stats.deleteConfirm")))
                        deleteTransaction(tx.id);
                    }}
                    className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-on-surface-variant hover:bg-error-container hover:text-error"
                    aria-label="✕"
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
        {ACCOUNT_META.USDT.icon} {t("stats.footnote")}
      </p>
    </section>
  );
}
