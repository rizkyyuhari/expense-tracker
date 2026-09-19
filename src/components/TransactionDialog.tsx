"use client";

import { useState } from "react";
import {
  ACCOUNT_META,
  CATEGORIES,
  TxKind,
  toKey,
} from "@/lib/finance";
import type { Ledger } from "@/lib/useLedger";
import { Modal, PrimaryButton, TextButton, fieldCls, labelCls } from "./ui";

export function TransactionDialog({
  ledger,
  onClose,
}: {
  ledger: Ledger;
  onClose: () => void;
}) {
  const { accounts, addTransaction } = ledger;
  const [kind, setKind] = useState<TxKind>("expense");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Makan");
  const [date, setDate] = useState(toKey(new Date()));
  const [note, setNote] = useState("");

  const account = accounts.find((a) => a.id === accountId);
  const valid =
    account && Number(amount) > 0 && category.trim().length > 0 && date;

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
              kind,
              amount: Number(amount),
              category: category.trim(),
              date,
              note: note.trim() || undefined,
            });
            onClose();
          }}
          className="flex flex-col gap-3"
        >
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
              Nominal ({account ? ACCOUNT_META[account.type].unit : ""})
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
              <select
                className={fieldCls}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
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
