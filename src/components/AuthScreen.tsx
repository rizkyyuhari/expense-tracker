"use client";

import { useState } from "react";
import { signIn, signUp } from "@/lib/auth-client";
import { TKey } from "@/i18n/dict";
import { useLang } from "@/i18n/lang";
import { PrimaryButton, fieldCls, labelCls } from "./ui";

function codeToKey(code: string | undefined): TKey {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
    case "INVALID_CREDENTIALS":
      return "auth.errCredentials";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "auth.errExists";
    case "WEAK_PASSWORD":
      return "auth.errWeak";
    case "INVALID_EMAIL":
      return "auth.errEmail";
    default:
      return "auth.errGeneric";
  }
}

/** Layar Masuk / Daftar — M3, satu-satunya pintu sebelum dompet. */
export function AuthScreen() {
  const { t } = useLang();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res =
        mode === "up"
          ? await signUp.email({
              email: email.trim(),
              password,
              name: name.trim() || email.trim().split("@")[0]!,
            })
          : await signIn.email({ email: email.trim(), password });
      if (res.error) {
        setError(t(codeToKey(res.error.code)));
        return;
      }
      window.location.reload();
    } catch {
      setError(t("auth.errGeneric"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
      <div className="w-full rounded-[28px] border border-outline-variant bg-surface p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-2xl text-on-primary">
            💧
          </span>
          <div>
            <h1 className="text-xl font-bold">DompetKu</h1>
            <p className="text-xs text-on-surface-variant">
              {t("auth.subtitle")}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-1 rounded-2xl border border-outline-variant bg-surface-container-low p-1">
          {(["in", "up"] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                aria-pressed={active}
                className={`rounded-xl py-2 text-sm transition ${
                  active
                    ? "bg-primary font-bold text-on-primary shadow"
                    : "bg-transparent font-medium text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {active ? "✓ " : ""}
                {m === "in" ? t("auth.signIn") : t("auth.signUp")}
              </button>
            );
          })}
        </div>

        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          {mode === "up" ? (
            <div>
              <label className={labelCls}>{t("auth.name")}</label>
              <input
                className={fieldCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("auth.namePh")}
                autoComplete="name"
              />
            </div>
          ) : null}
          <div>
            <label className={labelCls}>{t("auth.email")}</label>
            <input
              className={fieldCls}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.emailPh")}
              autoComplete="email"
              autoFocus
            />
          </div>
          <div>
            <label className={labelCls}>{t("auth.password")}</label>
            <input
              className={fieldCls}
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "up" ? "new-password" : "current-password"}
            />
          </div>
          {error ? (
            <p className="rounded-xl bg-error-container px-3 py-2 text-sm font-medium text-error">
              {error}
            </p>
          ) : null}
          <div className="mt-1">
            <PrimaryButton type="submit" disabled={busy}>
              {busy
                ? t("auth.busy")
                : mode === "in"
                  ? t("auth.submitIn")
                  : t("auth.submitUp")}
            </PrimaryButton>
          </div>
        </form>
        <p className="mt-4 text-center text-xs text-on-surface-variant">
          {t("auth.footnote")}
        </p>
      </div>
    </div>
  );
}
