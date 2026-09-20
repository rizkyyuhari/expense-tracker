"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { TKey, en, id } from "./dict";

export type Lang = "id" | "en";
const STORE_KEY = "etw-lang-v1";

function detect(): Lang {
  try {
    return localStorage.getItem(STORE_KEY) === "en" ? "en" : "id";
  } catch {
    return "id";
  }
}

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  dateLocale: string;
}

const Ctx = createContext<LangCtx>({
  lang: "id",
  setLang: () => {},
  t: (key) => id[key],
  dateLocale: "id-ID",
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("id");
  const [ready, setReady] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- baca preferensi sekali saat mount */
  useEffect(() => {
    setLangState(detect());
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      if (ready) localStorage.setItem(STORE_KEY, lang);
    } catch {
      // abaikan
    }
  }, [lang, ready]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);

  const t = useCallback(
    (key: TKey, vars?: Record<string, string | number>) => {
      let s: string = (lang === "en" ? en : id)[key];
      if (vars) {
        for (const [k, v] of Object.entries(vars))
          s = s.replace(`{${k}}`, String(v));
      }
      return s;
    },
    [lang],
  );

  const value = useMemo(
    () => ({ lang, setLang, t, dateLocale: lang === "en" ? "en-US" : "id-ID" }),
    [lang, setLang, t],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  return useContext(Ctx);
}

/** Toggle ID/EN gaya segmented M3 untuk header. */
export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <span className="flex rounded-full border border-outline-variant bg-surface p-0.5 text-xs font-semibold">
      {(["id", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-full px-2.5 py-1 uppercase transition ${
            lang === l
              ? "bg-secondary-container text-on-secondary-container"
              : "text-on-surface-variant"
          }`}
        >
          {l}
        </button>
      ))}
    </span>
  );
}
