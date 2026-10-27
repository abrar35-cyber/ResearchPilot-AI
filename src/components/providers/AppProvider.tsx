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

const VISITOR_KEY = "rp-visitor-id";
const VISITOR_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

interface AppContextValue {
  theme: Theme;
  toggleTheme: () => void;
  uiLanguage: LanguageCode;
  setUiLanguage: (code: LanguageCode) => void;
  reportLanguage: LanguageCode;
  setReportLanguage: (code: LanguageCode) => void;
  /**
   * Despite the name, this is NOT a password any more. It is an anonymous random id
   * created automatically in this browser, used only to keep each visitor's history
   * separate. (The old name is kept so other files did not need to change.)
   */
  accessCode: string;
  /** True once saved settings were read from the browser. */
  ready: boolean;
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

function createVisitorId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [uiLanguage, setUiLanguageState] = useState<LanguageCode>("en");
  const [reportLanguage, setReportLanguageState] = useState<LanguageCode>("en");
  const [visitorId, setVisitorId] = useState("");
  const [ready, setReady] = useState(false);

  // Load saved settings once, after the first render.
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");

    const savedUi = readStorage(STORAGE_KEYS.uiLanguage);
    if (isLanguageCode(savedUi)) setUiLanguageState(savedUi);

    const savedReport = readStorage(STORAGE_KEYS.reportLanguage);
    if (isLanguageCode(savedReport)) setReportLanguageState(savedReport);

    let id = readStorage(VISITOR_KEY);
    if (!id || !VISITOR_PATTERN.test(id)) {
      id = createVisitorId();
      writeStorage(VISITOR_KEY, id);
    }
    setVisitorId(id);

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
      accessCode: visitorId,
      ready,
      t: translations[uiLanguage],
      dir,
    }),
    [theme, toggleTheme, uiLanguage, setUiLanguage, reportLanguage, setReportLanguage, visitorId, ready, dir]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
