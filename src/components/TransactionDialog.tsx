"use client";

import { useState } from "react";
import {
  ACCOUNT_META,
  TxKind,
  formatNative,
  roundNative,
  toKey,
} from "@/lib/finance";
import type { Ledger } from "@/lib/useLedger";
import { useCategories } from "@/lib/useCategories";
import { Modal, PrimaryButton, TextButton, fieldCls, labelCls } from "./ui";

const ICON_PRESETS = [
  "🍜", "🛵", "🛍️", "🧾", "🎮", "💊", "💼", "📈",
  "🏠", "🚗", "💡", "🏥", "✈️", "🎁", "📱", "👕",
  "🐾", "🎓", "💸", "⭐",
];

export function TransactionDialog({
  ledger,
  onClose,
}: {
  ledger: Ledger;
  onClose: () => void;
}) {
  const { accounts, addTransaction } = ledger;
  const { list: categories, addCategory } = useCategories();
  const [kind, setKind] = useState<TxKind>("expense");
  const [mode, setMode] = useState<"amount" | "balance">("amount");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Makan");
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("⭐");
  const [catBusy, setCatBusy] = useState(false);
  const [date, setDate] = useState(toKey(new Date()));
  const [note, setNote] = useState("");

  const account = accounts.find((a) => a.id === accountId);
  // Mode saldo: selisih = aktual − tercatat; arah ikut tanda selisih.
  const diff =
    account && mode === "balance" && amount.trim() !== ""
      ? roundNative(Number(amount) - account.balance, account.type)
      : null;
  const hasDiff =
    diff !== null && Number.isFinite(diff) && diff !== 0;
  const effKind: TxKind =
    mode === "balance" ? (diff !== null && diff < 0 ? "expense" : "income") : kind;
  const valid =
    account && category.trim().length > 0 && date
      ? mode === "amount"
        ? Number(amount) > 0
        : hasDiff
      : false;

  return (
    <Modal title="Catat transaksi" onClose={onClose}>
      {accounts.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          Tambahkan akun dulu sebelum mencatat transaksi.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid || !account) return;
            addTransaction({
              accountId: account.id,
              kind: effKind,
              amount:
                mode === "balance" && hasDiff
                  ? Math.abs(diff ?? 0)
                  : Number(amount),
              category: category.trim(),
              date,
              note: note.trim() || undefined,
            });
            onClose();
          }}
          className="flex flex-col gap-3"
        >
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-container p-1">
            {(["amount", "balance"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-xl py-2 text-sm font-semibold transition ${
                  mode === m
                    ? "bg-secondary-container text-on-secondary-container"
                    : "text-on-surface-variant"
                }`}
              >
                {mode === m ? "✓ " : ""}
                {m === "amount" ? "💸 Nominal" : "⚖️ Saldo aktual"}
              </button>
            ))}
          </div>
          {mode === "amount" ? (
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface-container p-1">
              {(["expense", "income"] as TxKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-xl py-2 text-sm font-semibold transition ${
                  kind === k
                    ? k === "expense"
                      ? "bg-error text-on-error"
                      : "bg-primary text-on-primary"
                    : "text-on-surface-variant"
                }`}
              >
                {k === "expense" ? "− Pengeluaran" : "＋ Pemasukan"}
              </button>
            ))}
          </div>
          ) : (
            <div className="rounded-2xl bg-surface-container-low px-3.5 py-2.5 text-sm">
              <p className="text-xs text-on-surface-variant">
                Tercatat:{" "}
                <b>
                  {account
                    ? formatNative(account.balance, account.type)
                    : "—"}
                </b>
              </p>
              {hasDiff ? (
                <p
                  className={`mt-1 font-bold ${
                    (diff ?? 0) < 0 ? "text-error" : "text-success"
                  }`}
                >
                  {(diff ?? 0) < 0 ? "−" : "+"}
                  {account
                    ? formatNative(Math.abs(diff ?? 0), account.type)
                    : ""}{" "}
                  sebagai{" "}
                  {effKind === "expense" ? "Pengeluaran" : "Pemasukan"}
                </p>
              ) : (
                <p className="mt-1 text-xs text-on-surface-variant">
                  {amount.trim() === ""
                    ? "Ketik saldo aktual di bawah — selisihnya jadi transaksi."
                    : "Sama dengan tercatat (tidak ada selisih)."}
                </p>
              )}
            </div>
          )}
          <div>
            <label className={labelCls}>Akun</label>
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
          <div>
            <label className={labelCls}>
              {mode === "amount"
                ? `Nominal (${account ? ACCOUNT_META[account.type].unit : ""})`
                : `Saldo aktual (${account ? ACCOUNT_META[account.type].unit : ""})`}
            </label>
            <input
              className={fieldCls}
              type="number"
              min="0"
              step={account ? ACCOUNT_META[account.type].step : "any"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Kategori</label>
              {!addingCat ? (
                <select
                  className={fieldCls}
                  value={category}
                  onChange={(e) => {
                    if (e.target.value === "__new") setAddingCat(true);
                    else setCategory(e.target.value);
                  }}
                >
                  {categories.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                  <option value="__new">＋ Kategori baru…</option>
                </select>
              ) : (
                <div className="rounded-2xl border border-outline-variant p-2.5">
                  <input
                    className={fieldCls}
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Nama kategori"
                    maxLength={30}
                  />
                  <div className="mt-2 grid grid-cols-10 gap-1">
                    {ICON_PRESETS.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setNewCatIcon(ic)}
                        className={`rounded-lg py-1 text-base ${
                          newCatIcon === ic
                            ? "bg-primary-container ring-2 ring-primary"
                            : "hover:bg-surface-container"
                        }`}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-1">
                    <button
                      type="button"
                      disabled={catBusy}
                      onClick={() => {
                        setAddingCat(false);
                        setNewCatName("");
                      }}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold text-on-surface-variant"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={catBusy || newCatName.trim().length === 0}
                      onClick={() => {
                        const nm = newCatName.trim();
                        if (!nm) return;
                        setCatBusy(true);
                        void addCategory(nm, newCatIcon)
                          .then((ok) => {
                            if (ok) {
                              setCategory(nm);
                              setAddingCat(false);
                              setNewCatName("");
                            }
                          })
                          .finally(() => setCatBusy(false));
                      }}
                      className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary disabled:opacity-50"
                    >
                      {catBusy ? "Menyimpan…" : "Tambah"}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Tanggal</label>
              <input
                className={fieldCls}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Catatan (opsional)</label>
            <input
              className={fieldCls}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="cth: makan siang warteg"
            />
          </div>
          <div className="mt-1 flex justify-end gap-1">
            <TextButton onClick={onClose}>Batal</TextButton>
            <PrimaryButton type="submit" disabled={!valid}>
              Simpan
            </PrimaryButton>
          </div>
        </form>
      )}
    </Modal>
  );
}
