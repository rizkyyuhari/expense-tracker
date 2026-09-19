/**
 * Baca struk via Gemini Flash vision (free tier).
 * Kirim foto → terima JSON { merchant, date, total }.
 */

export interface ReceiptParse {
  merchant: string;
  date: string | null; // yyyy-mm-dd atau null
  total: number; // rupiah (atau nominal tercetak)
}

function geminiKey(): string | null {
  const k = process.env.GEMINI_API_KEY;
  return k && k.length > 10 ? k : null;
}

export function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

/** Urutan model dicoba: pilihan user dulu, lalu kandidat gratis lain.
 * ID model Gemini sering dipensiunkan, jadi 404 → lanjut ke berikutnya. */
function modelChain(): string[] {
  const first = geminiModel();
  const fallbacks = [
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash-lite",
  ];
  return [first, ...fallbacks.filter((m) => m !== first)];
}

const PROMPT = `Baca foto struk belanja Indonesia ini. Balas HANYA JSON valid tanpa penjelasan, format persis:
{"merchant": "nama toko", "date": "YYYY-MM-DD atau null bila tak terbaca", "total": angka_total_akhir_setelah_pajak_diskon}
Aturan: total = angka GRAND TOTAL/TOTAL BAYAR (bukan subtotal, bukan kembalian, bukan tunai). Hilangkan pemisah ribuan (Rp87.500 jadi 87500). merchant = nama toko/market di kop struk, "Struk" bila tak terbaca.`;

function toTotal(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    // Struk IDR nyaris tak pernah berkoma: buang semua non-digit
    // ("Rp110.000" / "110,000" → 110000).
    const digits = v.replace(/[^\d]/g, "");
    if (!digits) return null;
    return Number(digits);
  }
  return null;
}

function extractJson(text: string): ReceiptParse {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    console.error("[gemini] no_json, raw:", cleaned.slice(0, 300));
    throw new Error("gemini_no_json");
  }
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    console.error("[gemini] json_syntax, raw:", cleaned.slice(0, 300));
    throw new Error("gemini_no_json");
  }
  const total =
    toTotal(o.total) ??
    toTotal(o.grand_total) ??
    toTotal(o.total_bayar) ??
    toTotal(o.jumlah);
  if (total === null || !Number.isFinite(total) || total <= 0) {
    console.error("[gemini] bad_total, raw:", cleaned.slice(0, 300));
    throw new Error("gemini_bad_total");
  }
  const date =
    typeof o.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.date)
      ? o.date
      : null;
  const merchantRaw =
    typeof o.merchant === "string" && o.merchant.trim()
      ? o.merchant.trim()
      : typeof o.toko === "string" && o.toko.trim()
        ? o.toko.trim()
        : typeof o.store === "string" && o.store.trim()
          ? o.store.trim()
          : "Struk";
  return { merchant: merchantRaw.slice(0, 80), date, total };
}

export async function parseReceipt(
  image: Uint8Array,
  mime: string,
): Promise<ReceiptParse> {
  const key = geminiKey();
  if (!key) throw new Error("gemini_not_configured");
  const base64 = Buffer.from(image).toString("base64");
  for (const model of modelChain()) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: mime, data: base64 } },
              ],
            },
          ],
          generationConfig: {
          temperature: 0,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
        },
        }),
      },
    );
    // Model tidak dikenal/pensiun → coba kandidat berikutnya.
    if (r.status === 404) continue;
    if (!r.ok) throw new Error(`gemini_http_${r.status}`);
    const j = (await r.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) throw new Error("gemini_empty");
    return extractJson(text);
  }
  throw new Error("gemini_http_404");
}
