import { getRates } from "@/lib/rates-server";

/**
 * GET /api/rates — kurs live USDT→IDR & estimasi emas/gram ke IDR.
 * Logika di src/lib/rates-server.ts (dipakai juga oleh bot Telegram).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const r = await getRates();
  return Response.json(
    {
      usdtIdr: r.usdtIdr,
      goldIdrPerGram: r.goldIdrPerGram,
      source: r.source,
      updatedAt: r.updatedAt,
      note: "Harga emas = estimasi spot internasional, bukan harga Antam. Atur manual harga Antam/gram di aplikasi bila perlu.",
    },
    { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } },
  );
}
