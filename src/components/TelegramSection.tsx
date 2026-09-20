"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/i18n/lang";

interface Status {
  linked: boolean;
  configured: boolean;
  botUsername: string | null;
}

/** Kartu "Tautkan Telegram" — pairing bot struk-OCR ke akun ini. */
export function TelegramSection() {
  const { t, dateLocale } = useLang();
  const [status, setStatus] = useState<Status | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pairing", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) setStatus(j as Status);
      })
      .catch(() => {});
  }, []);

  async function makeCode() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/pairing", { method: "POST" });
      if (!r.ok) throw new Error(`http_${r.status}`);
      const j = (await r.json()) as {
        code: string;
        expiresAt: string;
        botUsername: string | null;
      };
      setCode(j.code);
      setExpiresAt(j.expiresAt);
      setStatus((s) =>
        s ? { ...s, botUsername: j.botUsername } : s,
      );
    } catch {
      setError(t("tg.codeFail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-outline-variant bg-surface p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-container text-lg">
          ✈️
        </span>
        <div>
          <h2 className="text-base font-semibold">{t("tg.title")}</h2>
          <p className="text-xs text-on-surface-variant">
            {t("tg.subtitle")}
          </p>
        </div>
        {status?.linked ? (
          <span className="ms-auto rounded-full bg-success-container px-3 py-1 text-xs font-semibold text-success">
            {t("tg.connected")}
          </span>
        ) : null}
      </div>

      {!status ? (
        <p className="mt-3 text-sm text-on-surface-variant">{t("tg.loading")}</p>
      ) : !status.configured ? (
        <p className="mt-3 text-sm text-on-surface-variant">
          {t("tg.notConfigured")}
        </p>
      ) : status.linked ? (
        <p className="mt-3 text-sm text-on-surface-variant">
          {t("tg.linkedInfo")}
        </p>
      ) : code ? (
        <div className="mt-3 rounded-2xl bg-surface-container-low p-4 text-center">
          <p className="text-xs text-on-surface-variant">
            {t("tg.sendCommand")}
          </p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-primary">
            /link {code}
          </p>
          {expiresAt ? (
            <p className="mt-1 text-xs text-on-surface-variant">
              {t("tg.until")}{" "}
              {new Date(expiresAt).toLocaleTimeString(dateLocale, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          ) : null}
          {status.botUsername ? (
            <a
              href={`https://t.me/${status.botUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
            >
              {t("tg.openBot")}
            </a>
          ) : null}
          <div>
            <button
              onClick={() => void makeCode()}
              disabled={busy}
              className="mt-2 rounded-full px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary-container disabled:opacity-50"
            >
              {t("tg.newCode")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-on-surface-variant">
            {t("tg.intro")}
          </p>
          {error ? <p className="mt-2 text-sm font-medium text-error">{error}</p> : null}
          <button
            onClick={() => void makeCode()}
            disabled={busy}
            className="mt-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
          >
            {busy ? t("tg.creating") : t("tg.makeCode")}
          </button>
        </div>
      )}
    </section>
  );
}
