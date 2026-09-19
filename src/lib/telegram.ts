/**
 * Klien minimal Telegram Bot API (tanpa dependensi tambahan).
 * Semua pemanggilan memakai fetch standar; token tidak pernah ke client.
 */

export function tgToken(): string | null {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  return t && t.length > 10 ? t : null;
}

export interface InlineButton {
  text: string;
  callback_data: string;
}

export interface TgUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number };
    text?: string;
    photo?: { file_id: string; width: number; height: number }[];
  };
  callback_query?: {
    id: string;
    message?: { message_id: number; chat: { id: number } };
    data?: string;
  };
}

async function tgApi<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  const token = tgToken();
  if (!token) throw new Error("bot_not_configured");
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = (await r.json()) as { ok: boolean; result?: T; description?: string };
  if (!j.ok) throw new Error(`telegram_${method}: ${j.description ?? r.status}`);
  return j.result as T;
}

export function sendMessage(
  chatId: number,
  text: string,
  buttons?: InlineButton[][],
) {
  return tgApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...(buttons
      ? { reply_markup: { inline_keyboard: buttons.map((row) => row.map((b) => ({ ...b }))) } }
      : {}),
  });
}

export function editMessage(
  chatId: number,
  messageId: number,
  text: string,
  buttons?: InlineButton[][],
) {
  return tgApi("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    ...(buttons
      ? { reply_markup: { inline_keyboard: buttons } }
      : { reply_markup: { inline_keyboard: [] } }),
  });
}

export function answerCallback(callbackQueryId: string, text?: string) {
  return tgApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

/** Ambil bytes file Telegram (foto struk) via getFile + download. */
export async function downloadPhoto(fileId: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const token = tgToken();
  if (!token) throw new Error("bot_not_configured");
  const info = await tgApi<{ file_path?: string }>("getFile", { file_id: fileId });
  if (!info.file_path) throw new Error("telegram_file_path_missing");
  const r = await fetch(`https://api.telegram.org/file/bot${token}/${info.file_path}`);
  if (!r.ok) throw new Error(`telegram_download: ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  const mime = info.file_path.endsWith(".png") ? "image/png" : "image/jpeg";
  return { bytes: buf, mime };
}
