import type { LanguageCode } from "./languages";

export type DetectedLanguage = LanguageCode | "unknown";

// Letters used in Sindhi but not in standard Urdu.
const SINDHI_ONLY =
  /[\u067B\u067D\u067F\u0680\u0683\u0684\u0687\u068A\u068C\u068D\u068F\u0699\u06A6\u06AA\u06B1\u06B3\u06BB]/;
const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F]/g;
const LATIN = /[A-Za-z]/g;

// Common Roman Urdu words that are not normal English words.
const ROMAN_URDU_WORDS = new Set([
  "hai", "hain", "hay", "kya", "kia", "kaise", "kaisay", "kese", "kaisa",
  "mein", "aur", "nahi", "nahin", "yeh", "ye", "kyun", "kyon", "kaun",
  "kab", "kahan", "tha", "thi", "hota", "hoti", "hote", "karna", "karein",
  "kare", "karo", "liye", "wala", "wali", "bhi", "mujhe", "humein",
  "hamein", "batao", "batain", "bataiye", "ka", "ki", "ke", "ko", "aap",
  "apna", "apni", "kitna", "kitni", "tehqeeq", "paani",
]);

export function detectLanguage(text: string): DetectedLanguage {
  const input = text.trim();
  if (input.length < 3) return "unknown";

  const arabicCount = (input.match(ARABIC_SCRIPT) ?? []).length;
  const latinCount = (input.match(LATIN) ?? []).length;
  if (arabicCount === 0 && latinCount === 0) return "unknown";

  if (arabicCount > latinCount) {
    return SINDHI_ONLY.test(input) ? "sd" : "ur";
  }

  const words = input.toLowerCase().match(/[a-z']+/g) ?? [];
  const hits = words.filter((w) => ROMAN_URDU_WORDS.has(w)).length;
  if (hits >= 2 || (words.length > 0 && hits / words.length >= 0.25)) {
    return "roman-ur";
  }
  return "en";
}
