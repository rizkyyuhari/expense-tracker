"use client";

import { useMemo, useState } from "react";
import { AccountDialog } from "./AccountDialog";
import { LangToggle, useLang } from "@/i18n/lang";
import { RatesBar } from "./RatesBar";
import { RecurringSection } from "./RecurringSection";
import { StatsSection } from "./StatsSection";
import { TelegramSection } from "./TelegramSection";
import {
  ACCOUNT_META,
  TxKind,
  formatIDR,
  formatNative,
  toIdr,
} from "@/lib/finance";
import type { Ledger } from "@/lib/useLedger";
import { useCategories } from "@/lib/useCategories";

export type Tab = "browse" | "history" | "cards" | "settings";

const TABS: { key: Tab; icon: string; labelKey: "nav.browse" | "nav.history" | "nav.cards" | "nav.settings" }[] = [
  { key: "browse", icon: "▤", labelKey: "nav.browse" },
  { key: "history", icon: "◷", labelKey: "nav.history" },
  { key: "cards", icon: "▦", labelKey: "nav.cards" },
  { key: "settings", icon: "⚙", labelKey: "nav.settings" },
];

export function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const { t } = useLang();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4 px-2">
        {TABS.map((it) => {
          const active = tab === it.key;
          return (
            <button
              key={it.key}
              onClick={() => setTab(it.key)}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
                active ? "text-primary" : "text-on-surface-variant"
              }`}
            >
              <span className="text-xl leading-none">{it.icon}</span>
              {t(it.labelKey)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function DesktopNav({
  tab,
  setTab,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  const { t } = useLang();
  return (
    <header className="mb-6 hidden items-center gap-2 md:flex">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-xl text-on-primary">
        💧
      </span>
      <span className="mr-4 text-lg font-extrabold">DompetKu</span>
      <div className="flex rounded-full bg-surface p-1 shadow-sm">
        {TABS.map((it) => {
          const active = tab === it.key;
          return (
            <button
              key={it.key}
              onClick={() => setTab(it.key)}
              className={`rounded-full px-5 py-2 text-sm font-bold transition ${
                active
                  ? "bg-primary text-on-primary shadow"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {t(it.labelKey)}
            </button>
          );
        })}
      </div>
      <span className="ms-auto">
        <LangToggle />
      </span>
    </header>
  );
}

function Avatar({ name, size = "h-11 w-11 text-lg" }: { name: string; size?: string }) {
  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-primary font-extrabold text-on-primary`}
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

// ------------------------------ BROWSE ------------------------------

export function BrowseScreen({
  ledger,
  userName,
  onOpenTx,
  onGoTab,
}: {
  ledger: Ledger;
  userName: string;
  onOpenTx: (kind: TxKind) => void;
  onGoTab: (t: Tab) => void;
}) {
  const { accounts, txs, rates } = ledger;
  const { t, dateLocale } = useLang();
  const { iconOf, colorOf } = useCategories();
  const [chip, setChip] = useState<"all" | TxKind>("all");

  const total = useMemo(
    () => accounts.reduce((s, a) => s + toIdr(a.balance, a.type, rates), 0),
    [accounts, rates],
  );

  const latest = useMemo(() => {
    const q = txs.filter((x) => chip === "all" || x.kind === chip);
    return [...q]
      .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))
      .slice(0, 6);
  }, [txs, chip]);

  const actions: { label: string; icon: string; fn: () => void }[] = [
    { label: t("browse.receive"), icon: "↓", fn: () => onOpenTx("income") },
    { label: t("browse.send"), icon: "↑", fn: () => onOpenTx("expense") },
    { label: t("browse.more"), icon: "⋯", fn: () => onGoTab("settings") },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Header ala desain */}
      <div className="flex items-center gap-3">
        <Avatar name={userName} />
        <div>
          <p className="text-xs text-on-surface-variant">{t("browse.hello")}</p>
          <p className="text-lg font-extrabold leading-tight">{userName}</p>
        </div>
        <button
          onClick={() => onGoTab("history")}
          aria-label="History"
          className="ms-auto flex h-11 w-11 items-center justify-center rounded-full bg-surface text-lg shadow-sm"
        >
          🔔
        </button>
      </div>

      {/* Hero total */}
      <section className="rounded-[28px] bg-primary p-6 text-on-primary">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium opacity-70">{t("browse.total")}</p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight">
              {formatIDR(total)}
            </p>
          </div>
          <button
            onClick={() => onGoTab("cards")}
            className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold"
          >
            {t("browse.change")} ⌄
          </button>
        </div>
        <p className="mt-2 text-xs opacity-70">
          USDT ≈ {formatIDR(rates.usdtIdr)}
          {t("app.perCoin")} • {t("app.gold")} ≈{" "}
          {formatIDR(rates.goldIdrPerGram)}
          {t("app.perGram")}
        </p>
      </section>

      {/* Aksi cepat */}
      <section className="grid grid-cols-3 gap-2 rounded-[28px] bg-secondary-container/60 p-4">
        {actions.map((a) => (
          <button key={a.label} onClick={a.fn} className="flex flex-col items-center gap-2">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl font-bold text-on-primary shadow">
              {a.icon}
            </span>
            <span className="text-sm font-bold">{a.label}</span>
          </button>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="flex flex-col gap-5 lg:col-span-2">
          {/* Akun */}
          <section>
            <h2 className="mb-3 text-base font-extrabold">{t("browse.sendAgain")}</h2>
            {accounts.length === 0 ? (
              <button
                onClick={() => onGoTab("cards")}
                className="w-full rounded-3xl border border-dashed border-outline-variant bg-surface p-5 text-center text-sm font-semibold text-primary"
              >
                {t("accounts.add")}
              </button>
            ) : (
              <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-1">
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => onGoTab("cards")}
                    className="flex w-20 shrink-0 flex-col items-center gap-1.5"
                  >
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary-container text-2xl">
                      {ACCOUNT_META[a.type].icon}
                    </span>
                    <span className="w-full truncate text-center text-xs font-bold">
                      {a.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Transaksi terakhir */}
        <section className="lg:col-span-3">
          <div className="mb-3 flex items-center">
            <h2 className="text-base font-extrabold">{t("browse.latest")}</h2>
            <button
              onClick={() => onGoTab("history")}
              className="ms-auto text-xs font-bold text-primary"
            >
              {t("browse.seeAll")} →
            </button>
          </div>
          <div className="no-scrollbar -mx-1 mb-3 flex gap-2 overflow-x-auto px-1">
            {(
              [
                { k: "all", label: t("browse.all") },
                { k: "income", label: t("browse.in") },
                { k: "expense", label: t("browse.out") },
              ] as const
            ).map((c) => (
              <button
                key={c.k}
                onClick={() => setChip(c.k)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
                  chip === c.k
                    ? "bg-primary text-on-primary"
                    : "bg-surface text-on-surface-variant shadow-sm"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {latest.length === 0 ? (
            <p className="rounded-3xl bg-surface p-6 text-center text-sm text-on-surface-variant">
              {t("browse.emptyTx")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {latest.map((x) => {
                const acc = accounts.find((a) => a.id === x.accountId);
                return (
                  <li
                    key={x.id}
                    className="flex items-center gap-3 rounded-3xl bg-surface p-3.5 shadow-sm"
                  >
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl"
                      style={{ background: colorOf(x.category) + "1e" }}
                    >
                      {iconOf(x.category)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold">
                        {x.note || x.category}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {new Date(x.date + "T00:00").toLocaleDateString(
                          dateLocale,
                          { day: "numeric", month: "short" },
                        )}{" "}
                        • {acc?.name ?? "—"}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 text-sm font-extrabold ${
                        x.kind === "income" ? "text-success" : "text-error"
                      }`}
                    >
                      {x.kind === "income" ? "+" : "−"}
                      {formatIDR(
                        toIdr(x.amount, acc?.type ?? "IDR", rates),
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// ------------------------------ HISTORY ------------------------------

export function HistoryScreen({ ledger }: { ledger: Ledger }) {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | TxKind>("all");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-extrabold">{t("history.title")}</h1>
      <div className="flex items-center gap-2 rounded-full bg-surface px-4 py-3 shadow-sm">
        <span>🔍</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("history.search")}
          className="w-full bg-transparent text-sm outline-none placeholder:text-on-surface-variant"
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-extrabold">{t("history.type")}</p>
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          {(
            [
              { k: "all", label: t("history.all") },
              { k: "income", label: t("tx.kindIncome") },
              { k: "expense", label: t("tx.kindExpense") },
            ] as const
          ).map((c) => (
            <button
              key={c.k}
              onClick={() => setKind(c.k)}
              className={`shrink-0 rounded-full px-5 py-2.5 text-xs font-bold transition ${
                kind === c.k
                  ? "bg-primary text-on-primary"
                  : "bg-surface text-on-surface-variant shadow-sm"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <StatsSection ledger={ledger} search={q} kindFilter={kind} />
    </div>
  );
}

// ------------------------------ CARDS ------------------------------

export function CardsScreen({ ledger }: { ledger: Ledger }) {
  const { accounts, txs, addAccount, updateAccount, deleteAccount } = ledger;
  const { t } = useLang();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const selected =
    accounts.find((a) => a.id === (selectedId ?? accounts[0]?.id)) ??
    accounts[0] ??
    null;
  const editing = editingId
    ? (accounts.find((a) => a.id === editingId) ?? null)
    : null;
  const txCount = selected
    ? txs.filter((x) => x.accountId === selected.id).length
    : 0;

  const rows: { label: string; value: string }[] = selected
    ? [
        { label: t("cards.holder"), value: selected.name },
        { label: t("cards.branch"), value: ACCOUNT_META[selected.type].label },
        {
          label: t("cards.balance"),
          value: formatNative(selected.balance, selected.type),
        },
        {
          label: t("cards.balanceIdr"),
          value: formatIDR(toIdr(selected.balance, selected.type, ledger.rates)),
        },
        { label: t("cards.txCount"), value: String(txCount) },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-extrabold">{t("cards.title")}</h1>
      {accounts.length === 0 ? (
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-3xl border border-dashed border-outline-variant bg-surface p-8 text-center text-sm font-bold text-primary"
        >
          {t("cards.empty")}
        </button>
      ) : (
        <>
          <div className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-1 md:grid md:grid-cols-3 md:overflow-visible">
            {accounts.map((a, i) => {
              const active = selected?.id === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={`w-72 shrink-0 snap-center rounded-[28px] p-6 text-left transition md:w-auto ${
                    active || (i === 0 && !selectedId)
                      ? "bg-primary text-on-primary shadow-lg"
                      : "border border-outline-variant bg-surface"
                  }`}
                >
                  <div className="flex">
                    <span className="h-8 w-8 rounded-full bg-white/50" />
                    <span className="-ml-4 h-8 w-8 rounded-full bg-white/30" />
                  </div>
                  <p className={`mt-6 text-xs ${active || (i === 0 && !selectedId) ? "opacity-70" : "text-on-surface-variant"}`}>
                    {a.name}
                  </p>
                  <p className="mt-1 text-2xl font-extrabold">
                    {formatNative(a.balance, a.type)}
                  </p>
                  <p className={`mt-4 text-xs font-semibold ${active || (i === 0 && !selectedId) ? "opacity-70" : "text-on-surface-variant"}`}>
                    {ACCOUNT_META[a.type].label} • ≈{" "}
                    {formatIDR(toIdr(a.balance, a.type, ledger.rates))}
                  </p>
                </button>
              );
            })}
          </div>

          {selected ? (
            <div className="rounded-[28px] bg-surface p-6 shadow-sm">
              <h2 className="text-base font-extrabold">{t("cards.details")}</h2>
              <dl className="mt-3 flex flex-col gap-3">
                {rows.map((r) => (
                  <div key={r.label} className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-on-surface-variant">{r.label}</dt>
                    <dd className="truncate text-sm font-extrabold">{r.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setEditingId(selected.id)}
                  className="rounded-full bg-secondary-container px-4 py-2 text-xs font-bold text-on-secondary-container"
                >
                  {t("accounts.editBtn")}
                </button>
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        t("accounts.deleteConfirm", { name: selected.name }),
                      )
                    )
                      deleteAccount(selected.id);
                  }}
                  className="rounded-full bg-error-container px-4 py-2 text-xs font-bold text-error"
                >
                  {t("accounts.deleteBtn")}
                </button>
                <button
                  onClick={() => setShowAdd(true)}
                  className="ms-auto rounded-full bg-primary px-4 py-2 text-xs font-bold text-on-primary"
                >
                  {t("accounts.add")}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
      {showAdd ? (
        <AccountDialog
          onClose={() => setShowAdd(false)}
          onSave={(v) => addAccount(v)}
        />
      ) : null}
      {editing ? (
        <AccountDialog
          initial={editing}
          onClose={() => setEditingId(null)}
          onSave={(v) =>
            updateAccount(editing.id, { name: v.name, balance: v.balance })
          }
        />
      ) : null}
    </div>
  );
}

// ------------------------------ SETTINGS ------------------------------

export function SettingsScreen({
  ledger,
  displayName,
  email,
  onSignOut,
}: {
  ledger: Ledger;
  displayName: string;
  email: string;
  onSignOut: () => void;
}) {
  const { t } = useLang();
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-extrabold">{t("settings.title")}</h1>

      <section className="flex items-center gap-3 rounded-[28px] bg-surface p-5 shadow-sm">
        <Avatar name={displayName} size="h-14 w-14 text-2xl" />
        <div className="min-w-0">
          <p className="truncate text-base font-extrabold">{displayName}</p>
          <p className="truncate text-xs text-on-surface-variant">{email}</p>
        </div>
        <button
          onClick={onSignOut}
          className="ms-auto shrink-0 rounded-full bg-error-container px-4 py-2 text-xs font-bold text-error"
        >
          {t("settings.signOut")}
        </button>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-extrabold">{t("settings.language")}</h2>
        <div className="rounded-[28px] bg-surface p-4 shadow-sm">
          <LangToggleFull />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-extrabold">{t("settings.rates")}</h2>
        <RatesBar ledger={ledger} />
      </section>

      <RecurringSection ledger={ledger} />
      <TelegramSection />
    </div>
  );
}

function LangToggleFull() {
  const { t } = useLang();
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold">{t("settings.language")}</span>
      <LangToggle />
    </div>
  );
}
