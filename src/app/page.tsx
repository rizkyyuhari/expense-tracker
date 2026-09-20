"use client";

import { useState } from "react";
import { AccountsSection } from "@/components/AccountsSection";
import { AuthScreen } from "@/components/AuthScreen";
import { RatesBar } from "@/components/RatesBar";
import { RecurringSection } from "@/components/RecurringSection";
import { StatsSection } from "@/components/StatsSection";
import { TelegramSection } from "@/components/TelegramSection";
import { TransactionDialog } from "@/components/TransactionDialog";
import { signOut, useSession } from "@/lib/auth-client";
import { formatIDR, totalBalanceIdr } from "@/lib/finance";
import { useLedger } from "@/lib/useLedger";

export default function Home() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center p-6">
        <p className="text-sm text-on-surface-variant">Memeriksa sesi…</p>
      </div>
    );
  }
  if (!session) return <AuthScreen />;
  return (
    <LedgerApp
      userId={session.user.id}
      displayName={session.user.name ?? session.user.email}
    />
  );
}

function LedgerApp({
  userId,
  displayName,
}: {
  userId: string;
  displayName: string;
}) {
  const ledger = useLedger(userId);
  const [showTx, setShowTx] = useState(false);

  if (!ledger.ready) {
    return (
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center p-6">
        <p className="text-sm text-on-surface-variant">Memuat dompet…</p>
      </div>
    );
  }

  const total = totalBalanceIdr(ledger.accounts, ledger.rates);

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pb-28 pt-4 sm:px-6">
      {/* App bar M3 */}
      <header className="flex items-center gap-3 py-2">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-xl text-on-primary">
          💧
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">DompetKu</h1>
          <p className="truncate text-xs text-on-surface-variant">
            {displayName}
          </p>
        </div>
        <span className="ms-auto flex items-center gap-2">
          {/* Badge provider DB hanya di development — disembunyikan di
              production agar tidak membocorkan info infra ke publik. */}
          {process.env.NODE_ENV === "development" ? (
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                ledger.dbMode
                  ? "bg-success-container text-success"
                  : "bg-surface-container text-on-surface-variant"
              }`}
              title="Mode penyimpanan data"
            >
              {ledger.dbMode ? "● Neon DB" : "● Lokal"}
            </span>
          ) : null}
          <button
            onClick={() => {
              void signOut().finally(() => window.location.reload());
            }}
            className="rounded-full border border-outline-variant bg-surface px-3 py-1 text-xs font-semibold text-on-surface-variant hover:text-error"
          >
            Keluar
          </button>
        </span>
      </header>

      {/* Hero total balance */}
      <section className="mt-3 rounded-[28px] bg-primary-container p-6 text-on-primary-container">
        <p className="text-sm font-medium opacity-70">
          Total saldo semua akun (Rupiah)
        </p>
        <p className="mt-1 text-4xl font-bold tracking-tight">
          {formatIDR(total)}
        </p>
        <p className="mt-2 text-xs opacity-70">
          USDT ≈ {formatIDR(ledger.rates.usdtIdr)}/koin • Emas ≈{" "}
          {formatIDR(ledger.rates.goldIdrPerGram)}/gram
        </p>
      </section>

      <div className="mt-4 flex flex-col gap-6">
        <RatesBar ledger={ledger} />
        <AccountsSection ledger={ledger} />
        <RecurringSection ledger={ledger} />
        <StatsSection ledger={ledger} />
        <TelegramSection />
      </div>

      {/* FAB M3 */}
      <button
        onClick={() => setShowTx(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-2xl bg-primary px-5 py-4 text-base font-semibold text-on-primary shadow-lg transition hover:brightness-95"
      >
        <span className="text-xl leading-none">＋</span> Catat
      </button>

      {showTx ? (
        <TransactionDialog ledger={ledger} onClose={() => setShowTx(false)} />
      ) : null}
    </div>
  );
}
