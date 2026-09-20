"use client";

import { useState } from "react";
import {
  ACCOUNT_META,
  Account,
  AccountType,
  decimalsFromStep,
} from "@/lib/finance";
import { useLang } from "@/i18n/lang";
import { NumericInput } from "./NumericInput";
import { Modal, PrimaryButton, TextButton, fieldCls, labelCls } from "./ui";

export function AccountDialog({
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
