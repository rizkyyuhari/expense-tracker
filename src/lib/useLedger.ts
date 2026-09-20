"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Account,
  DEFAULT_RATES,
  Rates,
  Transaction,
  loadLocal,
  saveLocal,
  seedData,
  storeKeys,
  toIdr,
  toKey,
  uid,
  normalizeIds,
  withAmountIdr,
} from "@/lib/finance";
import { ledgerApi } from "@/lib/ledger-api";

interface RatesResponse {
  usdtIdr: number;
  goldIdrPerGram: number;
  source: string;
  updatedAt: string;
}

/**
 * State buku kas — Neon-first dengan fallback lokal, cache PER USER:
 * - Cache browser di-namespace per userId agar user lain di browser
 *   yang sama tidak pernah melihat/mewarisi data user sebelumnya.
 * - Saat mount: tampilkan cache user ini seketika, lalu cek /api/health.
 *   Jika Neon reachable: cache lama (pra-login) dibuang — sumber
 *   kebenaran pindah ke server. Server kosong + cache berisi → adopsi.
 *   Jika Neon unreachable: pakai cache lama apa adanya (mode offline).
 * - Setiap mutasi: terapkan ke state + cache (UI instan),
 *   lalu mirror ke Neon di background. Gagal mirror → kembali mode lokal.
 */
export function useLedger(userId: string) {
  const [ready, setReady] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [rates, setRates] = useState<Rates>(DEFAULT_RATES);
  const [manualGold, setManualGold] = useState<number | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [dbMode, setDbMode] = useState(false);

  const accKey = `${storeKeys.accounts}:${userId}`;
  const txKey = `${storeKeys.txs}:${userId}`;

  /* eslint-disable react-hooks/set-state-in-effect -- hidrasi awal dari external systems (localStorage + Neon), saat mount / ganti user */
  useEffect(() => {
    // Cache milik user ini. User baru SELALU mulai kosong — tidak ada
    // data contoh otomatis (dulu seed contoh ikut ter-adopsi ke user baru).
    let localAcc = loadLocal<Account[] | null>(accKey, null);
    let localTx = loadLocal<Transaction[] | null>(txKey, null);
    if (localAcc === null || localTx === null) {
      localAcc = localAcc ?? [];
      localTx = localTx ?? [];
      saveLocal(accKey, localAcc);
      saveLocal(txKey, localTx);
    }
    setAccounts(localAcc);
    setTxs(localTx);
    setManualGold(loadLocal<number | null>(storeKeys.manualGold, null));
    const cached = loadLocal<Rates | null>(storeKeys.rates, null);
    if (cached) setRates(cached);

    void (async () => {
      try {
        const h = await fetch("/api/health", { cache: "no-store" }).then(
          (r) => r.json() as Promise<{ db: boolean }>,
        );
        if (!h.db) {
          // Offline: pakai cache lama (pra-login) apa adanya.
          const legacyAcc = loadLocal<Account[]>(storeKeys.accounts, []);
          const legacyTx = loadLocal<Transaction[]>(storeKeys.txs, []);
          if (legacyAcc.length > 0 || legacyTx.length > 0) {
            setAccounts(legacyAcc);
            setTxs(legacyTx);
            localAcc = legacyAcc;
            localTx = legacyTx;
          }
          setReady(true);
          return;
        }
        // Online: cache lama tidak dipakai lagi (anti-bocor antar user).
        try {
          localStorage.removeItem(storeKeys.accounts);
          localStorage.removeItem(storeKeys.txs);
        } catch {
          // abaikan (mode privat dsb.)
        }
        const server = await ledgerApi.load();
        if (
          server.accounts.length === 0 &&
          (localAcc.length > 0 || localTx.length > 0)
        ) {
          // Server kosong tapi lokal berisi → adopsi data lokal ke Neon.
          // Normalisasi dulu: ID lama (pra-UUID) ditolak kolom uuid Postgres.
          const normalized = normalizeIds(localAcc, localTx);
          const payload = withAmountIdr(
            normalized.transactions,
            normalized.accounts,
            cached ?? DEFAULT_RATES,
          );
          // Retry 3x: Neon kadang service_overloaded sesaat.
          let adopted = false;
          for (let attempt = 1; attempt <= 3 && !adopted; attempt++) {
            try {
              await ledgerApi.replace(normalized.accounts, payload);
              adopted = true;
            } catch {
              if (attempt < 3)
                await new Promise((r) => setTimeout(r, 1500 * attempt));
            }
          }
          if (!adopted) throw new Error("adopt_failed");
          // Pakai ID baru agar mirror berikutnya cocok dengan server.
          localAcc = normalized.accounts;
          localTx = normalized.transactions;
          setAccounts(localAcc);
          setTxs(localTx);
          saveLocal(accKey, localAcc);
          saveLocal(txKey, localTx);
        } else {
          setAccounts(server.accounts);
          setTxs(server.transactions);
          saveLocal(accKey, server.accounts);
          saveLocal(txKey, server.transactions);
        }
        setDbMode(true);
        // Sapu aturan rutin yang jatuh tempo (idempoten); bila ada yang
        // diposting, muat ulang agar saldo & daftar langsung mutakhir.
        try {
          const rr = await fetch("/api/recurring/run", { method: "POST" });
          if (rr.ok) {
            const jr = (await rr.json()) as { created?: number };
            if (jr.created && jr.created > 0) {
              const s2 = await ledgerApi.load();
              setAccounts(s2.accounts);
              setTxs(s2.transactions);
              saveLocal(accKey, s2.accounts);
              saveLocal(txKey, s2.transactions);
            }
          }
        } catch {
          // abaikan — cron server yang akan mengejar
        }
      } catch {
        // tetap mode lokal
      } finally {
        setReady(true);
      }
    })();
  }, [userId, accKey, txKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const refreshRates = useCallback(async () => {
    setRatesLoading(true);
    try {
      const r = await fetch("/api/rates", { cache: "no-store" });
      if (r.ok) {
        const j = (await r.json()) as RatesResponse;
        const next: Rates = {
          usdtIdr: j.usdtIdr,
          goldIdrPerGram: j.goldIdrPerGram,
          source: j.source,
          updatedAt: j.updatedAt,
        };
        setRates(next);
        saveLocal(storeKeys.rates, next);
        return;
      }
    } catch {
      // pakai kurs terakhir / default
    } finally {
      setRatesLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- fetch kurs eksternal saat siap; setState terjadi di continuation async */
  useEffect(() => {
    if (ready) void refreshRates();
  }, [ready, refreshRates]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Harga emas efektif: override manual (Antam) menang atas kurs auto.
  const effectiveRates = useMemo<Rates>(
    () =>
      manualGold && manualGold > 0
        ? { ...rates, goldIdrPerGram: manualGold, source: rates.source + "+manual-antam" }
        : rates,
    [rates, manualGold],
  );

  const persistAccounts = useCallback(
    (next: Account[]) => {
      setAccounts(next);
      saveLocal(accKey, next);
    },
    [accKey],
  );
  const persistTxs = useCallback(
    (next: Transaction[]) => {
      setTxs(next);
      saveLocal(txKey, next);
    },
    [txKey],
  );

  /** Mirror ke Neon di background (1x retry); gagal terus → mode lokal. */
  const mirror = useCallback((fn: () => Promise<void>, retries = 1) => {
    void (async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          await fn();
          return;
        } catch {
          if (attempt >= retries) {
            setDbMode(false);
            return;
          }
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        }
      }
    })();
  }, []);

  const addTransaction = useCallback(
    (input: Omit<Transaction, "id">) => {
      const tx: Transaction = { ...input, id: uid() };
      const acc = accounts.find((a) => a.id === tx.accountId);
      const nextAcc = accounts.map((a) =>
        a.id === tx.accountId
          ? {
              ...a,
              balance:
                a.balance + (tx.kind === "income" ? tx.amount : -tx.amount),
            }
          : a,
      );
      persistAccounts(nextAcc);
      persistTxs([tx, ...txs]);
      if (dbMode && acc) {
        mirror(() =>
          ledgerApi.createTx({
            ...tx,
            amountIdr: toIdr(tx.amount, acc.type, effectiveRates),
          }),
        );
      }
    },
    [accounts, txs, dbMode, effectiveRates, mirror, persistAccounts, persistTxs],
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      const tx = txs.find((t) => t.id === id);
      if (!tx) return;
      persistAccounts(
        accounts.map((a) =>
          a.id === tx.accountId
            ? {
                ...a,
                balance:
                  a.balance - (tx.kind === "income" ? tx.amount : -tx.amount),
              }
            : a,
        ),
      );
      persistTxs(txs.filter((t) => t.id !== id));
      if (dbMode) mirror(() => ledgerApi.removeTx(id));
    },
    [accounts, txs, dbMode, mirror, persistAccounts, persistTxs],
  );

  const addAccount = useCallback(
    (input: Omit<Account, "id">) => {
      const acc: Account = { ...input, id: uid() };
      const next = [...accounts, acc];
      persistAccounts(next);
      if (dbMode) mirror(() => ledgerApi.createAccount(acc));
    },
    [accounts, dbMode, mirror, persistAccounts],
  );

  const updateAccount = useCallback(
    (id: string, patch: Partial<Pick<Account, "name" | "balance">>) => {
      persistAccounts(
        accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      );
      if (dbMode) mirror(() => ledgerApi.patchAccount(id, patch));
    },
    [accounts, dbMode, mirror, persistAccounts],
  );

  const deleteAccount = useCallback(
    (id: string) => {
      persistAccounts(accounts.filter((a) => a.id !== id));
      persistTxs(txs.filter((t) => t.accountId !== id));
      if (dbMode) mirror(() => ledgerApi.removeAccount(id));
    },
    [accounts, txs, dbMode, mirror, persistAccounts, persistTxs],
  );

  const setManualGoldPrice = useCallback((v: number | null) => {
    setManualGold(v);
    saveLocal(storeKeys.manualGold, v);
  }, []);

  const reseed = useCallback(() => {
    const s = seedData();
    persistAccounts(s.accounts);
    persistTxs(s.txs);
    saveLocal(storeKeys.seeded, true);
    if (dbMode)
      mirror(() =>
        ledgerApi.replace(
          s.accounts,
          withAmountIdr(s.txs, s.accounts, effectiveRates),
        ),
      );
  }, [dbMode, effectiveRates, mirror, persistAccounts, persistTxs]);

  const clearAll = useCallback(() => {
    persistAccounts([]);
    persistTxs([]);
    if (dbMode) mirror(() => ledgerApi.replace([], []));
  }, [dbMode, mirror, persistAccounts, persistTxs]);

  const today = toKey(new Date());

  /** Muat ulang data server (tidak menimpa cache lokal yang belum sinkron). */
  const reload = useCallback(async () => {
    try {
      const server = await ledgerApi.load();
      const localHas =
        loadLocal<Account[] | null>(accKey, null) !== null &&
        (accounts.length > 0 || txs.length > 0);
      if (
        server.accounts.length > 0 ||
        server.transactions.length > 0 ||
        !localHas
      ) {
        setAccounts(server.accounts);
        setTxs(server.transactions);
        saveLocal(accKey, server.accounts);
        saveLocal(txKey, server.transactions);
      }
    } catch {
      // abaikan
    }
  }, [accKey, txKey, accounts.length, txs.length]);

  return {
    ready,
    accounts,
    txs,
    rates: effectiveRates,
    rawRates: rates,
    manualGold,
    ratesLoading,
    dbMode,
    today,
    refreshRates,
    addTransaction,
    deleteTransaction,
    addAccount,
    updateAccount,
    deleteAccount,
    setManualGoldPrice,
    reseed,
    clearAll,
    reload,
  };
}

export type Ledger = ReturnType<typeof useLedger>;
