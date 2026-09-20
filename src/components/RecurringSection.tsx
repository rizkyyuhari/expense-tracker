"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ACCOUNT_META,
  AccountType,
  TxKind,
  WEEKDAY_SHORT,
  formatNative,
  previewRecurring,
} from "@/lib/finance";
import type { Ledger } from "@/lib/useLedger";
import { useCategories } from "@/lib/useCategories";
import { Modal, PrimaryButton, TextButton, fieldCls, labelCls } from "./ui";

interface Rule {
  id: string;
  accountId: string;
  accountName: string;
  accountType: AccountType;
  kind: TxKind;
  amount: number;
  category: string;
  note?: string;
  dayOfMonth: number;
  active: boolean;
}

function nextLabel(day: number): string {
  const p = previewRecurring(day, 1)[0];
  if (!p) return "—";
  const tgl = `${p.weekday}, ${p.effective.getDate()} ${p.monthLabel} ${p.year}`;
  if (!p.shifted) return tgl;
  const schedWd =
    WEEKDAY_SHORT[new Date(p.year, p.monthIdx, p.scheduledDay).getDay()] ?? "";
  return `${tgl} (maju — tgl ${p.scheduledDay} = ${schedWd})`;
}

function RuleDialog({
  accounts,
  initial,
  onClose,
  onSaved,
}: {
  accounts: Ledger["accounts"];
  initial?: Rule;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { list: categories } = useCategories();
  const [kind, setKind] = useState<TxKind>(initial?.kind ?? "income");
  const [accountId, setAccountId] = useState(
    initial?.accountId ?? accounts[0]?.id ?? "",
  );
  const [amount, setAmount] = useState(
    initial ? String(initial.amount) : "",
  );
  const [day, setDay] = useState(
    initial ? String(initial.dayOfMonth) : "25",
  );
  const [category, setCategory] = useState(initial?.category ?? "Gaji");
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayNum = Number(day);
  const validDay = Number.isInteger(dayNum) && dayNum >= 1 && dayNum <= 31;
  const valid =
    accountId && Number(amount) > 0 && validDay && category.trim().length > 0;

  async function save() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        accountId,
        kind,
        amount: Number(amount),
        dayOfMonth: dayNum,
        category: category.trim(),
        note: note.trim() || undefined,
      };
      const r = await fetch(
        initial ? `/api/recurring/${initial.id}` : "/api/recurring",
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!r.ok) throw new Error(`http_${r.status}`);
      onSaved();
      onClose();
    } catch {
      setError("Gagal menyimpan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={initial ? "Ubah jadwal rutin" : "Tambah pemasukan rutin"}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-container p-1">
          {(["income", "expense"] as TxKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-xl py-2 text-sm font-semibold transition ${
                kind === k
                  ? k === "income"
                    ? "bg-primary text-on-primary"
                    : "bg-error text-on-error"
                  : "text-on-surface-variant"
              }`}
            >
              {k === "income" ? "＋ Pemasukan" : "− Pengeluaran"}
            </button>
          ))}
        </div>
        <div>
          <label className={labelCls}>Masuk ke akun</label>
          <select
            className={fieldCls}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {ACCOUNT_META[a.type].icon} {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nominal / bulan</label>
            <input
              className={fieldCls}
              type="number"
              min="0"
              step="1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="8500000"
            />
          </div>
          <div>
            <label className={labelCls}>Tanggal (1–31)</label>
            <input
              className={fieldCls}
              type="number"
              min="1"
              max="31"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              placeholder="25"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Kategori</label>
            <select
              className={fieldCls}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Catatan (opsional)</label>
            <input
              className={fieldCls}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Gaji Januari"
            />
          </div>
        </div>
        {validDay ? (
          <div className="rounded-2xl bg-surface-container-low px-3.5 py-2.5 text-xs text-on-surface-variant">
            <p className="font-semibold text-on-surface">Berikutnya:</p>
            {previewRecurring(dayNum, 3).map((p) => (
              <p key={p.effectiveKey}>
                • {p.weekday}, {p.effective.getDate()} {p.monthLabel}{" "}
                {p.year}
                {p.shifted ? (
                  <span>
                    {" "}
                    (maju — tgl {p.scheduledDay} hari libur)
                  </span>
                ) : null}
              </p>
            ))}
            <p className="mt-1">
              Bila tanggal jatuh Sabtu/Minggu, tercatat di Jumat sebelumnya.
            </p>
          </div>
        ) : null}
        {error ? (
          <p className="rounded-xl bg-error-container px-3 py-2 text-sm font-medium text-error">
            {error}
          </p>
        ) : null}
        <div className="mt-1 flex justify-end gap-1">
          <TextButton onClick={onClose}>Batal</TextButton>
          <PrimaryButton onClick={() => void save()} disabled={!valid || busy}>
            {busy ? "Menyimpan…" : "Simpan"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

export function RecurringSection({ ledger }: { ledger: Ledger }) {
  const { accounts, reload } = ledger;
  const [rules, setRules] = useState<Rule[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [runBusy, setRunBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/recurring", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { rules?: Rule[] };
      if (Array.isArray(j.rules)) setRules(j.rules);
    } catch {
      // abaikan
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- muat referensi eksternal sekali saat mount */
  useEffect(() => {
    void refresh();
  }, [refresh]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function toggleActive(rule: Rule) {
    await fetch(`/api/recurring/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !rule.active }),
    }).catch(() => {});
    void refresh();
  }

  async function removeRule(rule: Rule) {
    if (
      !window.confirm(
        `Hapus jadwal "${rule.category}" tiap tgl ${rule.dayOfMonth}? Transaksi yang sudah tercatat tidak ikut terhapus.`,
      )
    )
      return;
    await fetch(`/api/recurring/${rule.id}`, { method: "DELETE" }).catch(
      () => {},
    );
    void refresh();
  }

  async function runNow() {
    setRunBusy(true);
    setRunMsg(null);
    try {
      const r = await fetch("/api/recurring/run", { method: "POST" });
      if (!r.ok) throw new Error();
      const j = (await r.json()) as { created?: number };
      const n = j.created ?? 0;
      setRunMsg(
        n > 0
          ? `✅ ${n} transaksi jatuh tempo tercatat.`
          : "Tidak ada yang jatuh tempo. Semua sudah tercatat. 👍",
      );
      if (n > 0) await reload();
    } catch {
      setRunMsg("Gagal memproses. Coba lagi.");
    } finally {
      setRunBusy(false);
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center">
        <h2 className="text-base font-semibold">Gaji & Rutin</h2>
        <span className="ms-auto flex gap-2">
          <button
            onClick={() => void runNow()}
            disabled={runBusy}
            className="rounded-full border border-outline-variant bg-surface px-3.5 py-1.5 text-sm font-semibold text-primary hover:bg-surface-container-low disabled:opacity-50"
          >
            {runBusy ? "Memproses…" : "↻ Proses sekarang"}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-full border border-outline-variant bg-surface px-3.5 py-1.5 text-sm font-semibold text-primary hover:bg-surface-container-low"
          >
            ＋ Tambah
          </button>
        </span>
      </div>
      {runMsg ? (
        <p className="mb-3 rounded-2xl bg-surface-container-low px-4 py-2.5 text-sm text-on-surface-variant">
          {runMsg}
        </p>
      ) : null}
      {rules.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-outline-variant bg-surface p-6 text-center text-sm text-on-surface-variant">
          Belum ada jadwal otomatis. Tambahkan gaji bulananmu agar tercatat
          sendiri tiap bulan.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rules.map((r) => (
            <div
              key={r.id}
              className={`rounded-3xl border border-outline-variant bg-surface p-4 ${
                r.active ? "" : "opacity-60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-container text-lg">
                  {r.kind === "income" ? "💼" : "🔁"}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {r.category} • {r.accountName}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {formatNative(r.amount, r.accountType)} • tiap tgl{" "}
                    {r.dayOfMonth}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-on-surface-variant">
                Berikutnya: <b>{nextLabel(r.dayOfMonth)}</b>
              </p>
              <div className="mt-2 flex gap-1">
                <button
                  onClick={() => void toggleActive(r)}
                  className="rounded-full px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary-container"
                >
                  {r.active ? "⏸ Nonaktifkan" : "▶ Aktifkan"}
                </button>
                <button
                  onClick={() => setEditing(r)}
                  className="rounded-full px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary-container"
                >
                  Ubah
                </button>
                <button
                  onClick={() => void removeRule(r)}
                  className="rounded-full px-2.5 py-1 text-xs font-semibold text-error hover:bg-error-container"
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {showAdd ? (
        <RuleDialog
          accounts={accounts}
          onClose={() => setShowAdd(false)}
          onSaved={() => void refresh()}
        />
      ) : null}
      {editing ? (
        <RuleDialog
          accounts={accounts}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void refresh()}
        />
      ) : null}
    </section>
  );
}
