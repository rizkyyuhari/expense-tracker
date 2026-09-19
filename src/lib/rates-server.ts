/**
 * Ambil kurs live USDT→IDR & estimasi emas/gram (gratis, tanpa API key).
 * Dipakai route /api/rates dan alur bot Telegram.
 */

const FALLBACK_USDT_IDR = 17600;
const FALLBACK_GOLD_IDR_GRAM = 1950000;
const GRAM_PER_TROY_OZ = 31.1035;

export interface RatesResult {
  usdtIdr: number;
  goldIdrPerGram: number;
  source: string;
  updatedAt: string;
}

async function fetchUsdtIdr(): Promise<{ price: number; source: string }> {
  try {
    const r = await fetch(
      "https://api.binance.com/api/v3/ticker/price?symbol=USDTIDR",
      { next: { revalidate: 300 } },
    );
    if (r.ok) {
      const j = (await r.json()) as { price?: string };
      const p = Number(j.price);
      if (Number.isFinite(p) && p > 0) return { price: p, source: "binance" };
    }
  } catch {
    // lanjut ke fallback
  }
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=idr",
      { next: { revalidate: 300 } },
    );
    if (r.ok) {
      const j = (await r.json()) as { tether?: { idr?: number } };
      const p = Number(j.tether?.idr);
      if (Number.isFinite(p) && p > 0) return { price: p, source: "coingecko" };
    }
  } catch {
    // fallback konstanta
  }
  return { price: FALLBACK_USDT_IDR, source: "fallback" };
}

async function fetchGoldIdrPerGram(
  usdtIdr: number,
): Promise<{ price: number; source: string }> {
  try {
    const r = await fetch("https://api.gold-api.com/price/XAU", {
      next: { revalidate: 600 },
    });
    if (r.ok) {
      const j = (await r.json()) as { price?: number };
      const xauUsd = Number(j.price);
      if (Number.isFinite(xauUsd) && xauUsd > 0)
        return {
          price: Math.round((xauUsd * usdtIdr) / GRAM_PER_TROY_OZ),
          source: "gold-api.com",
        };
    }
  } catch {
    // fallback konstanta
  }
  return { price: FALLBACK_GOLD_IDR_GRAM, source: "fallback" };
}

export async function getRates(): Promise<RatesResult> {
  const usdt = await fetchUsdtIdr();
  const gold = await fetchGoldIdrPerGram(usdt.price);
  return {
    usdtIdr: Math.round(usdt.price),
    goldIdrPerGram: gold.price,
    source: `usdt:${usdt.source}, gold:${gold.source}`,
    updatedAt: new Date().toISOString(),
  };
}
