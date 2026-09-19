"use client";

import type { Account, AccountType, Transaction, TxKind } from "./finance";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!r.ok) {
    const err = new Error(`api_${r.status}`) as Error & { status: number };
    err.status = r.status;
    throw err;
  }
  return (await r.json()) as T;
}

interface TxRow {
  id: string;
  accountId: string;
  kind: TxKind;
  amount: number;
  category: string;
  date: string;
  note?: string;
  amountIdr: number;
}

export const ledgerApi = {
  async load(): Promise<{ accounts: Account[]; transactions: Transaction[] }> {
    const [a, t] = await Promise.all([
      req<{ accounts: Account[] }>("/api/accounts"),
      req<{ transactions: TxRow[] }>("/api/transactions"),
    ]);
    return {
      accounts: a.accounts,
      transactions: t.transactions.map((row) => ({
        id: row.id,
        accountId: row.accountId,
        kind: row.kind,
        amount: row.amount,
        category: row.category,
        date: row.date,
        note: row.note,
      })),
    };
  },

  createAccount(input: {
    id: string;
    name: string;
    type: AccountType;
    balance: number;
  }): Promise<void> {
    return req("/api/accounts", {
      method: "POST",
      body: JSON.stringify(input),
    }).then(() => {});
  },

  patchAccount(
    id: string,
    patch: { name?: string; balance?: number },
  ): Promise<void> {
    return req(`/api/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }).then(() => {});
  },

  removeAccount(id: string): Promise<void> {
    return req(`/api/accounts/${id}`, { method: "DELETE" }).then(() => {});
  },

  createTx(input: {
    id: string;
    accountId: string;
    kind: TxKind;
    amount: number;
    category: string;
    date: string;
    note?: string;
    amountIdr: number;
  }): Promise<void> {
    return req("/api/transactions", {
      method: "POST",
      body: JSON.stringify(input),
    }).then(() => {});
  },

  removeTx(id: string): Promise<void> {
    return req(`/api/transactions/${id}`, { method: "DELETE" }).then(
      () => {},
    );
  },

  replace(
    accounts: Account[],
    transactions: (Transaction & { amountIdr?: number })[],
  ): Promise<void> {
    return req("/api/ledger/replace", {
      method: "POST",
      body: JSON.stringify({ accounts, transactions }),
    }).then(() => {});
  },
};
