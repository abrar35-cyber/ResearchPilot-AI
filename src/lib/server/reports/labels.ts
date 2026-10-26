import type { LanguageCode } from "@/lib/i18n/languages";

export interface MethodFacts {
  date: string;
  queries: number;
  rounds: number;
  providers: string;
  sourcesCollected: number;
  sourcesCited: number;
  evidenceKept: number;
  discarded: number;
  verified: number;
  failed: number;
  aiCalls: number;
  tokens: number;
  seconds: number;
}

export interface ReportLabels {
  title: string;
  question: string;
  summary: string;
  findings: string;
  conflicts: string;
  methodology: string;
  limitations: string;
  references: string;
  noEvidence: string;
  verified: string;
  failed: string;
  unverified: string;
  noticeStopped: (message: string) => string;
  noticeNoAi: (message: string) => string;
  methodLines: (facts: MethodFacts) => string[];
  fixedLimitations: (options: { sindhi: boolean }) => string[];
}

const en: ReportLabels = {
  title: "Research report",
  question: "Research question",
  summary: "Summary",
  findings: "Findings",
  conflicts: "Conflicts and uncertainties",
  methodology: "Methodology",
  limitations: "Limitations",
  references: "References",
  noEvidence: "No usable evidence was collected, so no findings can be reported.",
  verified: "citation record verified in Crossref",
  failed: "failed the Crossref check",
  unverified: "not independently verified",
  noticeStopped: (m) => `This report is incomplete. ${m}`,
  noticeNoAi: (m) =>
    `The AI writing step could not run, so the evidence is listed below without a written synthesis. ${m}`,
  methodLines: (f) => [
    `Date: ${f.date}.`,
    `The question was broken into sub-questions and searched with ${f.queries} queries in ${f.rounds} round(s). Sources came from: ${f.providers}.`,
    `${f.sourcesCollected} unique sources were collected after removing duplicates; ${f.sourcesCited} are cited in this report.`,
    `Evidence was taken only from titles, abstracts or short excerpts. ${f.evidenceKept} statements were kept, each linked to a source and to a quote that was checked to appear in the source text; ${f.discarded} were discarded because their quote could not be found.`,
    `Citation check: ${f.verified} cited sources had their DOI matched to a Crossref record, ${f.failed} failed that check, and the rest were not independently verified.`,
    `AI usage: ${f.aiCalls} calls, about ${f.tokens} tokens, ${f.seconds} seconds.`,
  ],
  fixedLimitations: ({ sindhi }) => [
    "Only titles, abstracts and short excerpts were read, not full texts.",
    "The text was written by an AI model and may contain mistakes; check important claims against the cited sources.",
    "A verified citation only means the DOI matches a real record; it does not prove that the source's claims are correct.",
    "Search queries were written in English, so sources in other languages may be missing.",
    "Web results come from DuckDuckGo's limited Instant Answer service and may be incomplete.",
    ...(sindhi ? ["AI-written Sindhi text is less reliable than English and may contain language errors."] : []),
  ],
};

const ur: ReportLabels = {
  title: "تحقیقی رپورٹ",
  question: "تحقیقی سوال",
  summary: "خلاصہ",
  findings: "نتائج",
  conflicts: "تضادات اور غیر یقینی نکات",
  methodology: "طریقۂ کار",
  limitations: "حدود",
  references: "حوالہ جات",
  noEvidence: "کوئی قابلِ استعمال شواہد جمع نہیں ہو سکے، اس لیے نتائج پیش نہیں کیے جا سکتے۔",
  verified: "حوالے کا ریکارڈ Crossref میں تصدیق شدہ",
  failed: "Crossref کی جانچ میں ناکام",
  unverified: "آزادانہ طور پر تصدیق نہیں ہوئی",
  noticeStopped: (m) => `یہ رپورٹ نامکمل ہے۔ ${m}`,
  noticeNoAi: (m) =>
    `تحریری تجزیے کا اے آئی مرحلہ نہیں چل سکا، اس لیے شواہد بغیر تحریری خلاصے کے درج ہیں۔ ${m}`,
  methodLines: (f) => [
    `تاریخ: ${f.date}۔`,
    `سوال کو ذیلی سوالات میں تقسیم کیا گیا اور ${f.queries} سرچ کوئریز کے ساتھ ${f.rounds} راؤنڈ میں تلاش کی گئی۔ ماخذ ان سے حاصل ہوئے: ${f.providers}۔`,
    `تکرار ہٹانے کے بعد ${f.sourcesCollected} منفرد ماخذ جمع ہوئے؛ ان میں سے ${f.sourcesCited} اس رپورٹ میں حوالہ دیے گئے ہیں۔`,
    `شواہد صرف عنوانات، خلاصوں یا مختصر اقتباسات سے لیے گئے۔ ${f.evidenceKept} بیانات رکھے گئے، ہر ایک ماخذ اور ایسے اقتباس سے منسلک ہے جس کا ماخذ کے متن میں موجود ہونا جانچا گیا؛ ${f.discarded} بیانات اس لیے خارج کیے گئے کہ ان کا اقتباس نہیں ملا۔`,
    `حوالوں کی جانچ: ${f.verified} حوالہ شدہ ماخذوں کا DOI Crossref کے ریکارڈ سے ملا، ${f.failed} اس جانچ میں ناکام رہے، اور باقی کی آزادانہ تصدیق نہیں ہوئی۔`,
    `اے آئی کا استعمال: ${f.aiCalls} کالز، تقریباً ${f.tokens} ٹوکنز، ${f.seconds} سیکنڈ۔`,
  ],
  fixedLimitations: () => [
    "صرف عنوانات، خلاصے اور مختصر اقتباسات پڑھے گئے، مکمل متن نہیں۔",
    "متن ایک اے آئی ماڈل نے لکھا ہے اور اس میں غلطیاں ہو سکتی ہیں؛ اہم دعووں کو حوالہ دیے گئے ماخذوں سے ضرور جانچیں۔",
    "تصدیق شدہ حوالے کا مطلب صرف یہ ہے کہ DOI ایک حقیقی ریکارڈ سے مطابقت رکھتا ہے؛ اس سے ماخذ کے دعووں کی درستی ثابت نہیں ہوتی۔",
    "سرچ کوئریز انگریزی میں لکھی گئیں، اس لیے دوسری زبانوں کے ماخذ شامل نہ ہو سکے ہوں۔",
    "ویب نتائج DuckDuckGo کی محدود Instant Answer سروس سے آتے ہیں اور نامکمل ہو سکتے ہیں۔",
  ],
};

const sd: ReportLabels = {
  title: "تحقيقي رپورٽ",
  question: "تحقيقي سوال",
  summary: "خلاصو",
  findings: "نتيجا",
  conflicts: "تضاد ۽ غير يقيني نقطا",
  methodology: "طريقيڪار",
  limitations: "حدون",
  references: "حوالا",
  noEvidence: "ڪو به قابلِ استعمال ثبوت گڏ نه ٿي سگهيو، تنهنڪري نتيجا پيش نٿا ڪري سگهجن.",
  verified: "حوالي جو رڪارڊ Crossref ۾ تصديق ٿيل",
  failed: "Crossref جي جاچ ۾ ناڪام",
  unverified: "آزاديءَ سان تصديق نه ٿي",
  noticeStopped: (m) => `هيءَ رپورٽ اڻپوري آهي. ${m}`,
  noticeNoAi: (m) =>
    `لکڻ وارو اي آءِ مرحلو هلي نه سگهيو، تنهنڪري ثبوت لکيل خلاصي کانسواءِ هيٺ ڏنل آهن. ${m}`,
  methodLines: (f) => [
    `تاريخ: ${f.date}.`,
    `سوال کي ننڍن سوالن ۾ ورهايو ويو ۽ ${f.queries} ڳولا جي سوالن سان ${f.rounds} دور ۾ ڳولا ڪئي وئي. ماخذ هتان مليا: ${f.providers}.`,
    `ورجاءُ ختم ڪرڻ کان پوءِ ${f.sourcesCollected} منفرد ماخذ گڏ ٿيا؛ انهن مان ${f.sourcesCited} هن رپورٽ ۾ حوالي طور ڏنل آهن.`,
    `ثبوت رڳو عنوانن، خلاصن يا مختصر اقتباسن مان ورتا ويا. ${f.evidenceKept} بيان رکيا ويا، هر هڪ ماخذ ۽ اهڙي اقتباس سان ڳنڍيل آهي جنهن جو ماخذ جي متن ۾ هجڻ جاچيو ويو؛ ${f.discarded} بيان ان ڪري ڪڍيا ويا جو انهن جو اقتباس ملي نه سگهيو.`,
    `حوالن جي جاچ: ${f.verified} حوالن وارن ماخذن جو DOI Crossref جي رڪارڊ سان ملي ويو، ${f.failed} هن جاچ ۾ ناڪام ٿيا، ۽ باقي جي آزاديءَ سان تصديق نه ٿي.`,
    `اي آءِ جو استعمال: ${f.aiCalls} ڪالون، لڳ ڀڳ ${f.tokens} ٽوڪن، ${f.seconds} سيڪنڊ.`,
  ],
  fixedLimitations: ({ sindhi }) => [
    "رڳو عنوان، خلاصا ۽ مختصر اقتباس پڙهيا ويا، مڪمل متن نه.",
    "متن هڪ اي آءِ ماڊل لکيو آهي ۽ ان ۾ غلطيون ٿي سگهن ٿيون؛ اهم دعوائن کي حوالن واري ماخذن سان ضرور جاچيو.",
    "تصديق ٿيل حوالي جو مطلب رڳو اهو آهي ته DOI هڪ حقيقي رڪارڊ سان ملي ٿو؛ ان مان ماخذ جي دعوائن جي درستگي ثابت نه ٿي ٿئي.",
    "ڳولا جا سوال انگريزي ۾ لکيا ويا، تنهنڪري ٻين ٻولين جا ماخذ شايد شامل نه ٿي سگهيا هجن.",
    "ويب نتيجا DuckDuckGo جي محدود Instant Answer سروس مان اچن ٿا ۽ اڻپورا ٿي سگهن ٿا.",
    ...(sindhi ? ["اي آءِ جي لکيل سنڌي متن ۾ ٻوليءَ جون غلطيون ٿي سگهن ٿيون ۽ اها انگريزي جيتري قابل اعتماد نه آهي."] : []),
  ],
};

const romanUr: ReportLabels = {
  title: "Research report",
  question: "Research ka sawal",
  summary: "Khulasa",
  findings: "Nataij",
  conflicts: "Tazaad aur ghair yaqeeni nukaat",
  methodology: "Tareeqa-e-kaar",
  limitations: "Hadood",
  references: "Hawale",
  noEvidence: "Koi istemaal ke qabil saboot jama nahi ho sake, is liye nataij pesh nahi kiye ja sakte.",
  verified: "citation ka record Crossref mein tasdeeq shuda",
  failed: "Crossref ki jaanch mein nakaam",
  unverified: "azaadana tasdeeq nahi hui",
  noticeStopped: (m) => `Yeh report adhoori hai. ${m}`,
  noticeNoAi: (m) =>
    `AI ka likhne wala marhala nahi chal saka, is liye saboot bina likhe hue khulase ke neeche diye gaye hain. ${m}`,
  methodLines: (f) => [
    `Tareekh: ${f.date}.`,
    `Sawal ko chhote sawalon mein taqseem kiya gaya aur ${f.queries} search queries ke saath ${f.rounds} round mein talash ki gayi. Sources in se hasil hue: ${f.providers}.`,
    `Duplicates hatane ke baad ${f.sourcesCollected} unique sources jama hue; in mein se ${f.sourcesCited} is report mein cite kiye gaye hain.`,
    `Saboot sirf titles, abstracts ya mukhtasar iqtibasat se liye gaye. ${f.evidenceKept} bayanaat rakhe gaye, har aik source aur aise iqtibas se juda hai jis ka source ke matan mein hona check kiya gaya; ${f.discarded} bayanaat is liye nikaal diye gaye ke un ka iqtibas nahi mila.`,
    `Citations ki jaanch: ${f.verified} cite kiye gaye sources ka DOI Crossref ke record se mila, ${f.failed} is jaanch mein nakaam rahe, aur baqi ki azaadana tasdeeq nahi hui.`,
    `AI ka istemaal: ${f.aiCalls} calls, taqreeban ${f.tokens} tokens, ${f.seconds} seconds.`,
  ],
  fixedLimitations: ({ sindhi }) => [
    "Sirf titles, abstracts aur mukhtasar iqtibasat parhe gaye, mukammal matan nahi.",
    "Matan aik AI model ne likha hai aur is mein ghaltiyan ho sakti hain; aham claims ko cite kiye gaye sources se zaroor check karein.",
    "Tasdeeq shuda citation ka matlab sirf yeh hai ke DOI aik haqeeqi record se milta hai; is se source ke claims ki durustgi sabit nahi hoti.",
    "Search queries English mein likhi gayin, is liye doosri zubanon ke sources shamil na ho sakay hon.",
    "Web nataij DuckDuckGo ki mehdood Instant Answer service se aate hain aur adhoore ho sakte hain.",
    ...(sindhi ? ["AI ka likha hua Sindhi matan English jitna qabil-e-aitmaad nahi aur is mein zubaan ki ghaltiyan ho sakti hain."] : []),
  ],
};

export const REPORT_LABELS: Record<LanguageCode, ReportLabels> = {
  en,
  ur,
  sd,
  "roman-ur": romanUr,
};
