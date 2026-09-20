"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Input angka dengan separator ribuan id-ID (8.500.000) + caret stabil.
 * Nilai yang diteruskan ke parent SELALU kanonis: digit + titik desimal
 * ("8500000", "12.5") sehingga `Number(value)` tetap valid.
 */

function cleanSeparators(raw: string, decimals: number): string {
  let s = raw.replace(/[^0-9.,]/g, "");
  if (decimals <= 0) return s.replace(/[.,]/g, "");
  if (s.includes(",")) {
    // Gaya Indonesia: titik = ribuan, koma = desimal.
    s = s.replace(/\./g, "");
  } else if ((s.match(/\./g) ?? []).length > 1) {
    // Beberapa titik = pasti pemisah ribuan (paste "8.500.000").
    s = s.replace(/\./g, "");
  }
  // Satu titik = desimal (dibiarkan presisi penuh, tanpa pemotongan).
  return s;
}

export function canonicalizeAmount(raw: string, decimals: number): string {
  const s = cleanSeparators(raw, decimals);
  let int = "";
  let frac = "";
  let seenSep = false;
  for (const ch of s) {
    if (ch >= "0" && ch <= "9") {
      if (seenSep) frac += ch;
      else int += ch;
    } else if (!seenSep) {
      seenSep = true;
    }
  }
  if (decimals <= 0 || !seenSep) return int;
  return `${int === "" ? "0" : int}.${frac}`;
}

function groupInt(digits: string): string {
  if (digits === "") return "0";
  return Number(digits).toLocaleString("id-ID");
}

export function formatAmountDisplay(canonical: string, decimals: number): string {
  if (canonical === "") return "";
  const dot = canonical.indexOf(".");
  if (dot < 0 || decimals <= 0) return groupInt(canonical);
  return `${groupInt(canonical.slice(0, dot))},${canonical.slice(dot + 1)}`;
}

function countNumeric(raw: string, upto: number, decimals: number): number {
  let c = 0;
  let sep = false;
  for (let i = 0; i < upto && i < raw.length; i++) {
    const ch = raw[i];
    if (ch >= "0" && ch <= "9") c++;
    else if ((ch === "," || ch === ".") && decimals > 0 && !sep) {
      sep = true;
      c++;
    }
  }
  return c;
}

function caretFromCount(
  display: string,
  count: number,
  decimals: number,
): number {
  let c = 0;
  let sep = false;
  for (let i = 0; i < display.length; i++) {
    if (c >= count) return i;
    const ch = display[i];
    if (ch >= "0" && ch <= "9") c++;
    else if (ch === "," && decimals > 0 && !sep) {
      sep = true;
      c++;
    }
  }
  return display.length;
}

interface Props {
  value: string;
  onChange: (canonical: string) => void;
  decimals?: number;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export function NumericInput({
  value,
  onChange,
  decimals = 0,
  placeholder,
  autoFocus,
  className,
}: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (pendingCaret.current !== null && ref.current) {
      try {
        ref.current.setSelectionRange(
          pendingCaret.current,
          pendingCaret.current,
        );
      } catch {
        // abaikan (input tidak fokus dsb.)
      }
      pendingCaret.current = null;
    }
  });

  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={className}
      placeholder={placeholder}
      autoFocus={autoFocus}
      value={formatAmountDisplay(canonicalizeAmount(value, decimals), decimals)}
      onChange={(e) => {
        const el = e.currentTarget;
        const pos = el.selectionStart ?? el.value.length;
        const canon = canonicalizeAmount(el.value, decimals);
        pendingCaret.current = caretFromCount(
          formatAmountDisplay(canon, decimals),
          countNumeric(el.value, pos, decimals),
          decimals,
        );
        onChange(canon);
      }}
    />
  );
}
