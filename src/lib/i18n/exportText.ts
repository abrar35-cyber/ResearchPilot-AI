import type { LanguageCode } from "./languages";

export interface ExportText {
  markdown: string;
  pdf: string;
  printButton: string;
  printHint: string;
  loading: string;
  noReport: string;
  back: string;
}

// Kept separate from translations.ts so that file did not need to be sent again.
export const EXPORT_TEXT: Record<LanguageCode, ExportText> = {
  en: {
    markdown: "Download Markdown",
    pdf: "Save as PDF",
    printButton: "Print / Save as PDF",
    printHint: "In the print window, choose “Save as PDF” as the destination.",
    loading: "Loading report…",
    noReport: "This project has no report yet.",
    back: "Back to project",
  },
  ur: {
    markdown: "مارک ڈاؤن ڈاؤن لوڈ کریں",
    pdf: "PDF کے طور پر محفوظ کریں",
    printButton: "پرنٹ / PDF کے طور پر محفوظ کریں",
    printHint: "پرنٹ ونڈو میں منزل کے طور پر «Save as PDF» منتخب کریں۔",
    loading: "رپورٹ لوڈ ہو رہی ہے…",
    noReport: "اس منصوبے کی ابھی کوئی رپورٹ نہیں ہے۔",
    back: "منصوبے پر واپس",
  },
  sd: {
    markdown: "مارڪ ڊائون ڊائونلوڊ ڪريو",
    pdf: "PDF طور محفوظ ڪريو",
    printButton: "پرنٽ / PDF طور محفوظ ڪريو",
    printHint: "پرنٽ ونڊو ۾ منزل طور «Save as PDF» چونڊيو.",
    loading: "رپورٽ لوڊ ٿي رهي آهي…",
    noReport: "هن منصوبي جي اڃا ڪا رپورٽ ناهي.",
    back: "منصوبي ڏانهن واپس",
  },
  "roman-ur": {
    markdown: "Markdown download karein",
    pdf: "PDF ke taur par save karein",
    printButton: "Print / PDF ke taur par save karein",
    printHint: "Print window mein destination ke taur par «Save as PDF» chunein.",
    loading: "Report load ho rahi hai…",
    noReport: "Is project ki abhi koi report nahi hai.",
    back: "Project par wapas",
  },
};
