import type { LanguageCode } from "./languages";

export const PACING_TEXT: Record<LanguageCode, (seconds: number) => string> = {
  en: (s) => `Waiting ${s} s to stay within the free-tier token limit…`,
  ur: (s) => `مفت پلان کی ٹوکن حد کے اندر رہنے کے لیے ${s} سیکنڈ انتظار…`,
  sd: (s) => `مفت پلان جي ٽوڪن حد اندر رهڻ لاءِ ${s} سيڪنڊ انتظار…`,
  "roman-ur": (s) => `Free plan ki token limit ke andar rehne ke liye ${s} second intezaar…`,
};
