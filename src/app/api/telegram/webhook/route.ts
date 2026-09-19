import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db/client";
import {
  ACCOUNT_META,
  CATEGORIES,
  formatIDR,
  formatNative,
  toKey,
} from "@/lib/finance";
import { createTransaction } from "@/lib/ledger-service";
import { getRates } from "@/lib/rates-server";
import { geminiModel, parseReceipt } from "@/lib/gemini";
import { accounts, botPending, pairingCodes, user } from "@/db/schema";
import {
  InlineButton,
  TgUpdate,
  answerCallback,
  downloadPhoto,
  editMessage,
  sendMessage,
  tgToken,
} from "@/lib/telegram";

export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtDate(d: string | null): string {
  if (!d) return toKey(new Date());
  return d;
}

async function findUserByChat(chatId: number) {
  if (!db) return null;
  const rows = await db
    .select()
    .from(user)
    .where(eq(user.telegramChatId, String(chatId)));
  return rows[0] ?? null;
}

async function userAccounts(userId: string) {
  if (!db) return [];
  return db.select().from(accounts).where(eq(accounts.userId, userId));
}

const HELP = `Kirim <b>foto struk</b> untuk mencatat pengeluaran/pemasukan.\n\nPerintah:\n/link KODE — tautkan akun (kode dari web)\n/unlink — putus tautan\n/start — pesan ini`;

async function handleLink(chatId: number, codeRaw: string) {
  if (!db) return;
  const code = codeRaw.trim().toUpperCase();
  if (!/^[0-9A-Z]{6}$/.test(code)) {
    await sendMessage(chatId, "Format kode salah. Contoh: <code>/link A1B2C3</code>");
    return;
  }
  const rows = await db
    .select()
    .from(pairingCodes)
    .where(and(eq(pairingCodes.code, code), gt(pairingCodes.expiresAt, new Date())));
  const row = rows[0];
  if (!row) {
    await sendMessage(chatId, "Kode tidak dikenal atau kedaluwarsa. Buat kode baru di web (berlaku 10 menit).");
    return;
  }
  // Satu chat = satu user: lepas tautan lama bila ada.
  await db
    .update(user)
    .set({ telegramChatId: null })
    .where(eq(user.telegramChatId, String(chatId)));
  await db
    .update(user)
    .set({ telegramChatId: String(chatId) })
    .where(eq(user.id, row.userId));
  await db.delete(pairingCodes).where(eq(pairingCodes.code, code));
  await sendMessage(
    chatId,
    `✅ Tertaut! Mulai sekarang kirim <b>foto struk</b> ke sini untuk mencatat transaksi.\n\nKetik /unlink untuk memutus tautan.`,
  );
}

async function handlePhoto(chatId: number, fileId: string) {
  if (!db) return;
  const u = await findUserByChat(chatId);
  if (!u) {
    await sendMessage(
      chatId,
      `Belum tertaut ke akun DompetKu.\n\nBuka web → <b>Tautkan Telegram</b> → kirim <code>/link KODE</code> ke sini.`,
    );
    return;
  }
  await sendMessage(chatId, "⏳ Membaca struk…");
  try {
    const { bytes, mime } = await downloadPhoto(fileId);
    const parsed = await parseReceipt(bytes, mime);
    await db
      .insert(botPending)
      .values({
        chatId: String(chatId),
        userId: u.id,
        step: "kind",
        merchant: parsed.merchant,
        amountIdr: String(Math.round(parsed.total)),
        date: parsed.date,
      })
      .onConflictDoUpdate({
        target: botPending.chatId,
        set: {
          userId: u.id,
          step: "kind",
          merchant: parsed.merchant,
          amountIdr: String(Math.round(parsed.total)),
          date: parsed.date,
          kind: null,
          accountId: null,
          category: null,
          updatedAt: new Date(),
        },
      });
    await sendMessage(
      chatId,
      `🧾 <b>${esc(parsed.merchant)}</b>\nTotal: <b>${formatIDR(parsed.total)}</b>${parsed.date ? `\nTanggal: ${esc(parsed.date)}` : ""}\n\nIni pengeluaran atau pemasukan?`,
      [
        [
          { text: "− Pengeluaran", callback_data: "k:expense" },
          { text: "+ Pemasukan", callback_data: "k:income" },
        ],
      ],
    );
  } catch (e) {
    const code = e instanceof Error ? e.message : "unknown";
    console.error("[struk]", code);
    if (code === "gemini_not_configured" || code === "bot_not_configured") {
      await sendMessage(
        chatId,
        "⚙️ Bot belum dikonfigurasi (kunci AI tidak ada di server). Pastikan GEMINI_API_KEY terisi di env lalu redeploy.",
      );
    } else if (code === "gemini_http_400" || code === "gemini_http_403") {
      await sendMessage(
        chatId,
        "🔑 Kunci API Gemini ditolak Google. Periksa GEMINI_API_KEY di env server (tanpa tanda kutip/spasi) lalu redeploy.",
      );
    } else if (code === "gemini_http_404") {
      await sendMessage(
        chatId,
        "🔍 Model AI tidak dikenal Google. Periksa GEMINI_MODEL di env server.",
      );
    } else if (code === "gemini_http_429") {
      await sendMessage(
        chatId,
        "⏳ Kuota AI gratis habis. Tunggu beberapa menit lalu kirim ulang fotonya.",
      );
    } else if (code.startsWith("telegram_")) {
      await sendMessage(
        chatId,
        "📡 Gagal mengunduh foto dari Telegram. Coba kirim ulang fotonya.",
      );
    } else {
      await sendMessage(
        chatId,
        "😕 Gagal membaca struk (hasil AI tidak valid). Coba foto ulang lebih terang dan lengkap (sampai total terbaca), atau catat manual di web.",
      );
    }
  }
}

async function getPending(chatId: number) {
  if (!db) return null;
  const rows = await db
    .select()
    .from(botPending)
    .where(eq(botPending.chatId, String(chatId)));
  return rows[0] ?? null;
}

async function handleCallback(
  chatId: number,
  messageId: number,
  queryId: string,
  data: string,
) {
  if (!db) {
    await answerCallback(queryId);
    return;
  }
  const u = await findUserByChat(chatId);
  if (!u) {
    await answerCallback(queryId, "Tautkan dulu dengan /link KODE");
    return;
  }
  const p = await getPending(chatId);
  if (!p) {
    await answerCallback(queryId, "Sesi kedaluwarsa — kirim foto struk lagi");
    return;
  }
  const amountIdr = Number(p.amountIdr);
  const date = fmtDate(p.date);

  if (data === "k:expense" || data === "k:income") {
    const kind = data === "k:income" ? "income" : "expense";
    await db
      .update(botPending)
      .set({ kind, step: "account", updatedAt: new Date() })
      .where(eq(botPending.chatId, String(chatId)));
    const accs = await userAccounts(u.id);
    if (accs.length === 0) {
      await editMessage(chatId, messageId, "Belum ada akun. Tambahkan dulu di web, lalu kirim ulang foto struk.");
    } else {
      const rows: InlineButton[][] = [];
      for (let i = 0; i < accs.length; i += 2) {
        rows.push(
          accs.slice(i, i + 2).map((a) => ({
            text: `${ACCOUNT_META[a.type].icon} ${a.name}`,
            callback_data: `a:${a.id}`,
          })),
        );
      }
      await editMessage(
        chatId,
        messageId,
        `🧾 <b>${esc(p.merchant ?? "Struk")}</b> • ${formatIDR(amountIdr)}\n\nMasuk ke akun mana?`,
        rows,
      );
    }
    await answerCallback(queryId);
    return;
  }

  if (data.startsWith("a:")) {
    const accountId = data.slice(2);
    const accs = await userAccounts(u.id);
    const acc = accs.find((a) => a.id === accountId);
    if (!acc) {
      await answerCallback(queryId, "Akun tidak dikenal");
      return;
    }
    await db
      .update(botPending)
      .set({ accountId, step: "category", updatedAt: new Date() })
      .where(eq(botPending.chatId, String(chatId)));
    const rows: InlineButton[][] = [];
    for (let i = 0; i < CATEGORIES.length; i += 3) {
      rows.push(
        CATEGORIES.slice(i, i + 3).map((c, j) => ({
          text: `${c.icon} ${c.name}`,
          callback_data: `c:${i + j}`,
        })),
      );
    }
    await editMessage(
      chatId,
      messageId,
      `🧾 <b>${esc(p.merchant ?? "Struk")}</b> • ${formatIDR(amountIdr)}\nAkun: <b>${esc(acc.name)}</b>\n\nKategorinya?`,
      rows,
    );
    await answerCallback(queryId);
    return;
  }

  if (data.startsWith("c:")) {
    const idx = Number(data.slice(2));
    const cat = CATEGORIES[idx];
    if (!cat) {
      await answerCallback(queryId, "Kategori tidak dikenal");
      return;
    }
    await db
      .update(botPending)
      .set({ category: cat.name, step: "confirm", updatedAt: new Date() })
      .where(eq(botPending.chatId, String(chatId)));
    const accs = await userAccounts(u.id);
    const acc = accs.find((a) => a.id === p.accountId);
    const kindLabel = p.kind === "income" ? "Pemasukan" : "Pengeluaran";
    await editMessage(
      chatId,
      messageId,
      `Konfirmasi:\n<b>${kindLabel}</b> ${formatIDR(amountIdr)}\n${esc(p.merchant ?? "Struk")} → <b>${esc(acc?.name ?? "?")}</b>\nKategori: ${cat.icon} ${esc(cat.name)} • ${esc(date)}\n\nSimpan?`,
      [
        [
          { text: "✅ Simpan", callback_data: "ok" },
          { text: "✖ Batal", callback_data: "no" },
        ],
      ],
    );
    await answerCallback(queryId);
    return;
  }

  if (data === "no") {
    await db.delete(botPending).where(eq(botPending.chatId, String(chatId)));
    await editMessage(chatId, messageId, "Dibatalkan. Kirim foto struk lain kapan saja. 👍");
    await answerCallback(queryId);
    return;
  }

  if (data === "ok") {
    if (!p.kind || !p.accountId || !p.category) {
      await answerCallback(queryId, "Data belum lengkap — ulangi dari awal");
      return;
    }
    const accs = await userAccounts(u.id);
    const acc = accs.find((a) => a.id === p.accountId);
    if (!acc) {
      await answerCallback(queryId, "Akun tidak dikenal");
      return;
    }
    // Konversi total IDR → satuan native akun tujuan.
    let native = amountIdr;
    if (acc.type === "USDT" || acc.type === "GOLD") {
      const rates = await getRates();
      const per = acc.type === "USDT" ? rates.usdtIdr : rates.goldIdrPerGram;
      native = Math.round((amountIdr / per) * 10000) / 10000;
    } else {
      native = Math.round(amountIdr);
    }
    const result = await createTransaction(u.id, {
      accountId: acc.id,
      kind: p.kind as "income" | "expense",
      amount: native,
      category: p.category,
      date,
      note: p.merchant ?? undefined,
      amountIdr: Math.round(amountIdr),
    });
    if ("error" in result) {
      await answerCallback(queryId, "Gagal menyimpan — coba lagi");
      return;
    }
    await db.delete(botPending).where(eq(botPending.chatId, String(chatId)));
    const fresh = await userAccounts(u.id);
    const updated = fresh.find((a) => a.id === acc.id);
    const saldo = updated ? formatNative(Number(updated.balanceNative), acc.type) : "-";
    await editMessage(
      chatId,
      messageId,
      `✅ Tersimpan: <b>${p.kind === "income" ? "+" : "−"}${formatIDR(amountIdr)}</b>\n${esc(p.merchant ?? "Struk")} → ${esc(acc.name)}\nSaldo ${esc(acc.name)}: <b>${saldo}</b>`,
    );
    await answerCallback(queryId, "Tersimpan!");
    return;
  }

  await answerCallback(queryId);
}

async function handleUpdate(update: TgUpdate) {
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    if (msg.photo && msg.photo.length > 0) {
      const largest = msg.photo[msg.photo.length - 1]!;
      await handlePhoto(chatId, largest.file_id);
      return;
    }
    const text = (msg.text ?? "").trim();
    if (text === "/start") {
      const u = await findUserByChat(chatId);
      await sendMessage(
        chatId,
        u
          ? `Halo! Akunmu sudah tertaut. Kirim <b>foto struk</b> untuk mencatat.`
          : `Halo! Saya bot pencatat DompetKu. 🧾\n\n${HELP}`,
      );
      return;
    }
    if (text.startsWith("/link")) {
      await handleLink(chatId, text.replace("/link", ""));
      return;
    }
    if (text === "/unlink") {
      if (db) {
        await db
          .update(user)
          .set({ telegramChatId: null })
          .where(eq(user.telegramChatId, String(chatId)));
      }
      await sendMessage(chatId, "Tautan diputus. Kirim /link KODE untuk menautkan lagi.");
      return;
    }
    await sendMessage(chatId, HELP);
    return;
  }
  if (update.callback_query?.message && update.callback_query.data) {
    await handleCallback(
      update.callback_query.message.chat.id,
      update.callback_query.message.message_id,
      update.callback_query.id,
      update.callback_query.data,
    );
  }
}

export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!tgToken() || !secret) {
    return Response.json({ error: "bot_not_configured" }, { status: 503 });
  }
  if (req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return Response.json({ ok: true });
  }
  // Selalu 200 agar Telegram tidak retry membabi-buta.
  try {
    await handleUpdate(update);
  } catch (e) {
    console.error("[telegram webhook]", e instanceof Error ? e.message : e);
  }
  return Response.json({ ok: true });
}

export async function GET() {
  return Response.json({
    ok: true,
    configured: Boolean(tgToken() && process.env.TELEGRAM_WEBHOOK_SECRET),
    gemini: geminiModel(),
  });
}
