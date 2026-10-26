export type LanguageCode = "en" | "ur" | "sd" | "roman-ur";

export interface LanguageInfo {
  code: LanguageCode;
  label: string;
  englishName: string;
  dir: "ltr" | "rtl";
  htmlLang: string;
}

export const LANGUAGES: Record<LanguageCode, LanguageInfo> = {
  en: { code: "en", label: "English", englishName: "English", dir: "ltr", htmlLang: "en" },
  ur: { code: "ur", label: "اردو", englishName: "Urdu", dir: "rtl", htmlLang: "ur" },
  sd: { code: "sd", label: "سنڌي", englishName: "Sindhi", dir: "rtl", htmlLang: "sd" },
  "roman-ur": {
    code: "roman-ur",
    label: "Roman Urdu",
    englishName: "Roman Urdu",
    dir: "ltr",
    htmlLang: "ur-Latn",
  },
};

export const LANGUAGE_CODES = Object.keys(LANGUAGES) as LanguageCode[];

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === "string" && LANGUAGE_CODES.includes(value as LanguageCode);
}
