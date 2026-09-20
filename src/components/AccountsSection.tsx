"use client";

import { useState } from "react";
import {
  ACCOUNT_META,
  Account,
  AccountType,
  formatIDR,
  formatNative,
  toIdr,
} from "@/lib/finance";
import type { Ledger } from "@/lib/useLedger";
import { Modal, PrimaryButton, TextButton, fieldCls, labelCls } from "./ui";

function AccountDialog({
  initial,
  onClose,
  onSave,
}: {
  initial?: Account;
  onClose: () => void;
  onSave: (v: { name: string; type: AccountType; balance: number }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<AccountType>(initial?.type ?? "IDR");
  const [balance, setBalance] = useState(
    initial ? String(initial.balance) : "",
  );

  // Pratinjau selisih saat koreksi: tercatat vs aktual.
  const diff =
    initial && balance !== ""
      ? Number(balance) - initial.balance
      : null;
  const hasDiff = diff !== null && Number.isFinite(diff) && diff !== 0;

  return (
    <Modal title={initial ? "Sesuaikan saldo" : "Tambah akun"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onSave({
            name: name.trim(),
            type,
            balance: Number(balance) || 0,
          });
          onClose();
        }}
        className="flex flex-col gap-3"
      >
        <div>
          <label className={labelCls}>Nama akun</label>
          <input
            className={fieldCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="cth: Bank BCA / Dompet / Binance"
            autoFocus
          />
        </div>
        <div>
          <label className={labelCls}>Jenis aset</label>
          <select
            className={fieldCls}
            value={type}
            onChange={(e) => setType(e.target.value as AccountType)}
            disabled={Boolean(initial)}
          >
            {(Object.keys(ACCOUNT_META) as AccountType[]).map((t) => (
              <option key={t} value={t}>
                {ACCOUNT_META[t].icon} {ACCOUNT_META[t].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>
            {initial
              ? `Saldo aktual saat ini (${ACCOUNT_META[type].unit})`
              : `Saldo awal (${ACCOUNT_META[type].unit})`}
          </label>
          <input
            className={fieldCls}
            type="number"
            min="0"
            step={ACCOUNT_META[type].step}
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="0"
          />
          {initial ? (
            <p className="mt-1 text-xs text-on-surface-variant">
              Tercatat: {formatNative(initial.balance, initial.type)}
            </p>
          ) : null}
          {hasDiff ? (
            <p
              className={`mt-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                (diff ?? 0) > 0
                  ? "bg-success-container text-success"
                  : "bg-error-container text-error"
              }`}
            >
              Selisih {(diff ?? 0) > 0 ? "+" : "−"}
              {formatNative(Math.abs(diff ?? 0), type)} akan dicatat otomatis
              sebagai {(diff ?? 0) > 0 ? "Pemasukan" : "Pengeluaran"} •
              Penyesuaian
            </p>
          ) : null}
        </div>
        <div className="mt-1 flex justify-end gap-1">
          <TextButton onClick={onClose}>Batal</TextButton>
          <PrimaryButton type="submit">Simpan</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

export function AccountsSection({ ledger }: { ledger: Ledger }) {
  const {
    accounts,
    rates,
    addAccount,
    updateAccount,
    adjustBalance,
    deleteAccount,
  } = ledger;
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  return (
    <section>
      <div className="mb-3 flex items-center">
        <h2 className="text-base font-semibold">Akun & Saldo</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="ms-auto rounded-full border border-outline-variant bg-surface px-3.5 py-1.5 text-sm font-semibold text-primary hover:bg-surface-container-low"
        >
          ＋ Tambah akun
        </button>
      </div>
      {accounts.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-outline-variant bg-surface p-6 text-center text-sm text-on-surface-variant">
          Belum ada akun. Tambahkan akun Rupiah, cash, USDT, atau emas dulu.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {accounts.map((a) => (
            <div
              key={a.id}
              className="rounded-3xl border border-outline-variant bg-surface p-4"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-container text-lg">
                  {ACCOUNT_META[a.type].icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{a.name}</p>
                  <p className="text-xs text-on-surface-variant">
                    {ACCOUNT_META[a.type].label}
                  </p>
                </div>
                <span className="ms-auto flex gap-1">
                  <button
                    onClick={() => setEditing(a)}
                    className="rounded-full px-2 py-1 text-xs font-semibold text-primary hover:bg-primary-container"
                  >
                    Sesuaikan
                  </button>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          `Hapus akun "${a.name}" beserta semua transaksinya?`,
                        )
                      )
                        deleteAccount(a.id);
                    }}
                    className="rounded-full px-2 py-1 text-xs font-semibold text-error hover:bg-error-container"
                  >
                    Hapus
                  </button>
                </span>
              </div>
              <p className="mt-3 text-lg font-bold">
                {formatNative(a.balance, a.type)}
              </p>
              {a.type === "IDR" || a.type === "CASH" ? null : (
                <p className="text-sm text-on-surface-variant">
                  ≈ {formatIDR(toIdr(a.balance, a.type, rates))}
                </p>
              )}
            </div>
          ))}
        </div>
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
          onClose={() => setEditing(null)}
          onSave={(v) => {
            // Saldo → rekonsiliasi (selisih tercatat otomatis);
            // nama → update biasa.
            if (v.balance !== editing.balance)
              adjustBalance(editing.id, v.balance);
            if (v.name !== editing.name)
              updateAccount(editing.id, { name: v.name });
          }}
        />
      ) : null}
    </section>
  );
}
