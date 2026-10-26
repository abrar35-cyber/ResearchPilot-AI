"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { STORAGE_KEYS } from "@/lib/constants";
import { LANGUAGES, isLanguageCode, type LanguageCode } from "@/lib/i18n/languages";
import { translations, type Dictionary } from "@/lib/i18n/translations";

type Theme = "light" | "dark";

interface AppContextValue {
  theme: Theme;
  toggleTheme: () => void;
  uiLanguage: LanguageCode;
  setUiLanguage: (code: LanguageCode) => void;
  reportLanguage: LanguageCode;
  setReportLanguage: (code: LanguageCode) => void;
  t: Dictionary;
  dir: "ltr" | "rtl";
}

const AppContext = createContext<AppContextValue | null>(null);

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked (private mode). The app still works.
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [uiLanguage, setUiLanguageState] = useState<LanguageCode>("en");
  const [reportLanguage, setReportLanguageState] = useState<LanguageCode>("en");
  const [ready, setReady] = useState(false);

  // Load saved settings once, after the first render.
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");

    const savedUi = readStorage(STORAGE_KEYS.uiLanguage);
    if (isLanguageCode(savedUi)) setUiLanguageState(savedUi);

    const savedReport = readStorage(STORAGE_KEYS.reportLanguage);
    if (isLanguageCode(savedReport)) setReportLanguageState(savedReport);

    setReady(true);
  }, []);

  const dir = LANGUAGES[uiLanguage].dir;

  // Keep <html dir> and <html lang> in sync with the interface language.
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dir = dir;
    document.documentElement.lang = LANGUAGES[uiLanguage].htmlLang;
  }, [ready, dir, uiLanguage]);

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    writeStorage(STORAGE_KEYS.theme, next);
  }, [theme]);

  const setUiLanguage = useCallback((code: LanguageCode) => {
    setUiLanguageState(code);
    writeStorage(STORAGE_KEYS.uiLanguage, code);
  }, []);

  const setReportLanguage = useCallback((code: LanguageCode) => {
    setReportLanguageState(code);
    writeStorage(STORAGE_KEYS.reportLanguage, code);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      theme,
      toggleTheme,
      uiLanguage,
      setUiLanguage,
      reportLanguage,
      setReportLanguage,
      t: translations[uiLanguage],
      dir,
    }),
    [theme, toggleTheme, uiLanguage, setUiLanguage, reportLanguage, setReportLanguage, dir]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
