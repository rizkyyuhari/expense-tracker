"use client";

import { useState } from "react";
import {
  ACCOUNT_META,
  TxKind,
  decimalsFromStep,
  formatNative,
  roundNative,
  toKey,
} from "@/lib/finance";
import type { Ledger } from "@/lib/useLedger";
import { useCategories } from "@/lib/useCategories";
import { useLang } from "@/i18n/lang";
import { NumericInput } from "./NumericInput";
import { Modal, PrimaryButton, TextButton, fieldCls, labelCls } from "./ui";

const ICON_PRESETS = [
  "🍜", "🛵", "🛍️", "🧾", "🎮", "💊", "💼", "📈",
  "🏠", "🚗", "💡", "🏥", "✈️", "🎁", "📱", "👕",
  "🐾", "🎓", "💸", "⭐",
];

export function TransactionDialog({
  ledger,
  onClose,
  initialKind,
}: {
  ledger: Ledger;
  onClose: () => void;
  initialKind?: TxKind;
}) {
  const { accounts, addTransaction } = ledger;
  const { list: categories, addCategory } = useCategories();
  const { t } = useLang();
  const [kind, setKind] = useState<TxKind>(initialKind ?? "expense");
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
    <Modal title={t("tx.title")} onClose={onClose}>
      {accounts.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          {t("tx.noAccount")}
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
                {m === "amount" ? t("tx.modeAmount") : t("tx.modeBalance")}
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
                {k === "expense" ? t("tx.expense") : t("tx.income")}
              </button>
            ))}
          </div>
          ) : (
            <div className="rounded-2xl bg-surface-container-low px-3.5 py-2.5 text-sm">
              <p className="text-xs text-on-surface-variant">
                {t("tx.recorded")}{" "}
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
                  {t("tx.as")}{" "}
                  {effKind === "expense" ? t("tx.kindExpense") : t("tx.kindIncome")}
                </p>
              ) : (
                <p className="mt-1 text-xs text-on-surface-variant">
                  {amount.trim() === ""
                    ? t("tx.balanceHint")
                    : t("tx.noDiff")}
                </p>
              )}
            </div>
          )}
          <div>
            <label className={labelCls}>{t("tx.account")}</label>
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
                ? t("tx.amount", { unit: account ? ACCOUNT_META[account.type].unit : "" })
                : t("tx.actualBalance", { unit: account ? ACCOUNT_META[account.type].unit : "" })}
            </label>
            <NumericInput
              className={fieldCls}
              decimals={
                account
                  ? decimalsFromStep(ACCOUNT_META[account.type].step)
                  : 0
              }
              value={amount}
              onChange={setAmount}
              placeholder="0"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t("tx.category")}</label>
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
                  <option value="__new">{t("tx.newCategory")}</option>
                </select>
              ) : (
                <div className="rounded-2xl border border-outline-variant p-2.5">
                  <input
                    className={fieldCls}
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder={t("tx.newCategoryName")}
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
                      {t("common.cancel")}
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
                      {catBusy ? t("common.saving") : t("common.add")}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>{t("tx.date")}</label>
              <input
                className={fieldCls}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>{t("tx.note")}</label>
            <input
              className={fieldCls}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("tx.notePh")}
            />
          </div>
          <div className="mt-1 flex justify-end gap-1">
            <TextButton onClick={onClose}>{t("common.cancel")}</TextButton>
            <PrimaryButton type="submit" disabled={!valid}>
              {t("common.save")}
            </PrimaryButton>
          </div>
        </form>
      )}
    </Modal>
  );
}
