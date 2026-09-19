"use client";

import { useState } from "react";
import { formatIDR } from "@/lib/finance";
import type { Ledger } from "@/lib/useLedger";

export function RatesBar({ ledger }: { ledger: Ledger }) {
  const { rates, manualGold, setManualGoldPrice, refreshRates, ratesLoading } =
    ledger;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(manualGold ? String(manualGold) : "");

  const updated = new Date(rates.updatedAt).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section className="rounded-3xl border border-outline-variant bg-surface p-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span>
          <span className="font-semibold">₮ 1 USDT ≈ </span>
          <span className="font-semibold text-primary">
            {formatIDR(rates.usdtIdr)}
          </span>
        </span>
        <span>
          <span className="font-semibold">🪙 Emas </span>
          <span className="font-semibold text-primary">
            {formatIDR(rates.goldIdrPerGram)}/gram
          </span>
          {manualGold ? (
            <span className="ml-1 rounded-full bg-secondary-container px-2 py-0.5 text-xs font-medium text-on-secondary-container">
              manual
            </span>
          ) : null}
        </span>
        <span className="text-xs text-on-surface-variant">
          update {updated} • {rates.source}
        </span>
        <span className="ms-auto flex gap-2">
          <button
            onClick={() => {
              setDraft(manualGold ? String(manualGold) : "");
              setEditing((v) => !v);
            }}
            className="rounded-full border border-outline-variant px-3 py-1.5 text-xs font-semibold text-primary hover:bg-surface-container-low"
          >
            {manualGold ? "Ubah harga Antam" : "Set harga Antam"}
          </button>
          <button
            onClick={() => void refreshRates()}
            disabled={ratesLoading}
            className="rounded-full border border-outline-variant px-3 py-1.5 text-xs font-semibold text-primary hover:bg-surface-container-low disabled:opacity-50"
          >
            {ratesLoading ? "Memuat…" : "↻ Refresh"}
          </button>
        </span>
      </div>
      {editing ? (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = Number(draft.replace(/[^\d]/g, ""));
            setManualGoldPrice(v > 0 ? v : null);
            setEditing(false);
          }}
        >
          <input
            inputMode="numeric"
            placeholder="cth: 2050000 (Rp/gram Antam)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full rounded-xl border border-outline-variant px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
          >
            Simpan
          </button>
          {manualGold ? (
            <button
              type="button"
              onClick={() => {
                setManualGoldPrice(null);
                setEditing(false);
              }}
              className="shrink-0 rounded-full px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-container"
            >
              Auto
            </button>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
