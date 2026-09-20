"use client";

import { useState } from "react";
import {
  ACCOUNT_META,
  Account,
  AccountType,
  decimalsFromStep,
  formatIDR,
  formatNative,
  toIdr,
} from "@/lib/finance";
import type { Ledger } from "@/lib/useLedger";
import { useLang } from "@/i18n/lang";
import { NumericInput } from "./NumericInput";
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
  const { t } = useLang();

  return (
    <Modal title={initial ? t("accounts.dlgEdit") : t("accounts.dlgAdd")} onClose={onClose}>
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
          <label className={labelCls}>{t("accounts.name")}</label>
          <input
            className={fieldCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("accounts.namePh")}
            autoFocus
          />
        </div>
        <div>
          <label className={labelCls}>{t("accounts.type")}</label>
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
            {t("accounts.balance", { unit: ACCOUNT_META[type].unit })}
          </label>
          <NumericInput
            className={fieldCls}
            decimals={decimalsFromStep(ACCOUNT_META[type].step)}
            value={balance}
            onChange={setBalance}
            placeholder="0"
          />
          {initial ? (
            <p className="mt-1 text-xs text-on-surface-variant">
              {t("accounts.balanceHint")}
            </p>
          ) : null}
        </div>
        <div className="mt-1 flex justify-end gap-1">
          <TextButton onClick={onClose}>{t("common.cancel")}</TextButton>
          <PrimaryButton type="submit">{t("common.save")}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

export function AccountsSection({ ledger }: { ledger: Ledger }) {
  const { accounts, rates, addAccount, updateAccount, deleteAccount } = ledger;
  const { t } = useLang();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  return (
    <section>
      <div className="mb-3 flex items-center">
        <h2 className="text-base font-semibold">{t("accounts.title")}</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="ms-auto rounded-full border border-outline-variant bg-surface px-3.5 py-1.5 text-sm font-semibold text-primary hover:bg-surface-container-low"
        >
          {t("accounts.add")}
        </button>
      </div>
      {accounts.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-outline-variant bg-surface p-6 text-center text-sm text-on-surface-variant">
          {t("accounts.empty")}
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
                    {t("accounts.editBtn")}
                  </button>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          t("accounts.deleteConfirm", { name: a.name }),
                        )
                      )
                        deleteAccount(a.id);
                    }}
                    className="rounded-full px-2 py-1 text-xs font-semibold text-error hover:bg-error-container"
                  >
                    {t("accounts.deleteBtn")}
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
          onSave={(v) =>
            updateAccount(editing.id, { name: v.name, balance: v.balance })
          }
        />
      ) : null}
    </section>
  );
}
