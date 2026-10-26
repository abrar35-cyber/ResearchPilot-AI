import type { LanguageCode } from "./languages";

const en = {
  appName: "ResearchPilot AI",
  tagline: "Autonomous, multilingual research with sources you can check.",
  nav: {
    dashboard: "Dashboard",
    newResearch: "New research",
    history: "History",
    menu: "Open menu",
    close: "Close menu",
  },
  controls: {
    theme: "Toggle theme",
    uiLanguage: "Interface language",
    reportLanguage: "Report language",
  },
  hero: {
    title: "What would you like to research?",
    subtitle:
      "Ask in English, Urdu, Sindhi or Roman Urdu. The agents plan, search, check and write a cited report.",
  },
  form: {
    question: "Research question",
    placeholder: "e.g. How does groundwater depletion affect farming in Sindh?",
    detected: "Detected language",
    unknown: "Start typing…",
    depth: "Depth",
    depthStandard: "Standard",
    maxSources: "Max sources",
    extraRounds: "Extra rounds",
    start: "Start research",
    previewNote: "Preview only: the research engine is added in Phase 2.",
  },
  budget: {
    title: "Usage budget",
    subtitle: "Hard limits for each research run",
    aiCalls: "AI calls",
    tokens: "Tokens",
    time: "Execution time",
    retries: "Retries",
    seconds: "s",
    note: "Estimated usage will appear here while research runs.",
  },
  agents: {
    title: "Research agents",
    subtitle: "Coordinated by one orchestrator",
    orchestrator: "Orchestrator",
    orchestratorDesc:
      "Runs the six agents in order, enforces the budget and saves progress.",
    descriptions: {
      planner: "Breaks the question into sub-questions and a search plan.",
      discovery:
        "Finds sources via DuckDuckGo, OpenAlex and Crossref and removes duplicates.",
      evidence: "Extracts relevant evidence from each source.",
      critical: "Compares findings and looks for conflicts and weaknesses.",
      verification: "Checks every citation against the sources actually retrieved.",
      writer: "Writes the structured report with citations.",
    },
  },
  history: {
    title: "Research history",
    empty: "No research projects yet. Saved projects will appear here.",
  },
  footer: {
    note: "Reports only list sources that were actually retrieved. Claims that could not be verified are clearly marked.",
  },
};

export type Dictionary = typeof en;

const ur: Dictionary = {
  appName: "ResearchPilot AI",
  tagline: "خودکار، کثیر لسانی تحقیق — ایسے ماخذ کے ساتھ جنہیں آپ خود جانچ سکتے ہیں۔",
  nav: {
    dashboard: "ڈیش بورڈ",
    newResearch: "نئی تحقیق",
    history: "تاریخچہ",
    menu: "مینو کھولیں",
    close: "مینو بند کریں",
  },
  controls: {
    theme: "تھیم تبدیل کریں",
    uiLanguage: "انٹرفیس کی زبان",
    reportLanguage: "رپورٹ کی زبان",
  },
  hero: {
    title: "آپ کس موضوع پر تحقیق کرنا چاہتے ہیں؟",
    subtitle:
      "انگریزی، اردو، سندھی یا رومن اردو میں سوال پوچھیں۔ ایجنٹس منصوبہ بناتے ہیں، تلاش کرتے ہیں، جانچتے ہیں اور حوالہ جات کے ساتھ رپورٹ لکھتے ہیں۔",
  },
  form: {
    question: "تحقیقی سوال",
    placeholder: "مثال: سندھ میں زیرِ زمین پانی کی کمی کاشتکاری پر کیسے اثر انداز ہوتی ہے؟",
    detected: "شناخت شدہ زبان",
    unknown: "لکھنا شروع کریں…",
    depth: "گہرائی",
    depthStandard: "معیاری",
    maxSources: "زیادہ سے زیادہ ماخذ",
    extraRounds: "اضافی راؤنڈز",
    start: "تحقیق شروع کریں",
    previewNote: "صرف پیش نظارہ: تحقیقی انجن فیز 2 میں شامل کیا جائے گا۔",
  },
  budget: {
    title: "استعمال کی حد",
    subtitle: "ہر تحقیقی رن کے لیے سخت حدود",
    aiCalls: "اے آئی کالز",
    tokens: "ٹوکنز",
    time: "عمل درآمد کا وقت",
    retries: "دوبارہ کوششیں",
    seconds: "سیکنڈ",
    note: "تحقیق کے دوران تخمینی استعمال یہاں ظاہر ہوگا۔",
  },
  agents: {
    title: "تحقیقی ایجنٹس",
    subtitle: "ایک آرکیسٹریٹر کے زیرِ انتظام",
    orchestrator: "آرکیسٹریٹر",
    orchestratorDesc:
      "چھ ایجنٹس کو ترتیب سے چلاتا ہے، بجٹ کی حدود نافذ کرتا ہے اور پیش رفت محفوظ کرتا ہے۔",
    descriptions: {
      planner: "سوال کو ذیلی سوالات اور تلاش کے منصوبے میں تقسیم کرتا ہے۔",
      discovery: "DuckDuckGo، OpenAlex اور Crossref سے ماخذ تلاش کرتا ہے اور تکرار ختم کرتا ہے۔",
      evidence: "ہر ماخذ سے متعلقہ شواہد نکالتا ہے۔",
      critical: "نتائج کا موازنہ کرتا ہے اور تضادات و کمزوریاں تلاش کرتا ہے۔",
      verification: "ہر حوالے کو واقعی حاصل شدہ ماخذ سے ملا کر جانچتا ہے۔",
      writer: "حوالہ جات کے ساتھ ساختہ رپورٹ تحریر کرتا ہے۔",
    },
  },
  history: {
    title: "تحقیقی تاریخچہ",
    empty: "ابھی کوئی تحقیقی منصوبہ نہیں ہے۔ محفوظ شدہ منصوبے یہاں نظر آئیں گے۔",
  },
  footer: {
    note: "رپورٹس میں صرف وہی ماخذ شامل ہوتے ہیں جو واقعی حاصل کیے گئے ہوں۔ جن دعووں کی تصدیق نہ ہو سکے انہیں واضح طور پر نشان زد کیا جاتا ہے۔",
  },
};

const sd: Dictionary = {
  appName: "ResearchPilot AI",
  tagline: "خودڪار، گھڻ-ٻوليائي تحقيق — اهڙن ماخذن سان جن کي توهان پاڻ پرکي سگهو ٿا.",
  nav: {
    dashboard: "ڊيش بورڊ",
    newResearch: "نئين تحقيق",
    history: "تاريخ",
    menu: "مينيو کوليو",
    close: "مينيو بند ڪريو",
  },
  controls: {
    theme: "ٿيم تبديل ڪريو",
    uiLanguage: "انٽرفيس جي ٻولي",
    reportLanguage: "رپورٽ جي ٻولي",
  },
  hero: {
    title: "توهان ڪهڙي موضوع تي تحقيق ڪرڻ چاهيو ٿا؟",
    subtitle:
      "انگريزي، اردو، سنڌي يا روماني اردو ۾ سوال پڇو. ايجنٽ منصوبو ٺاهين ٿا، ڳولين ٿا، پرکين ٿا ۽ حوالن سان رپورٽ لکن ٿا.",
  },
  form: {
    question: "تحقيقي سوال",
    placeholder: "مثال: سنڌ ۾ زير زمين پاڻي جي گهٽتائي زراعت تي ڪيئن اثر ڪري ٿي؟",
    detected: "سڃاتل ٻولي",
    unknown: "لکڻ شروع ڪريو…",
    depth: "کوٽائي",
    depthStandard: "معياري",
    maxSources: "وڌ ۾ وڌ ماخذ",
    extraRounds: "اضافي دور",
    start: "تحقيق شروع ڪريو",
    previewNote: "رڳو پريوليو: تحقيقي انجڻ فيز 2 ۾ شامل ڪئي ويندي.",
  },
  budget: {
    title: "استعمال جي حد",
    subtitle: "هر تحقيقي رن لاءِ سخت حدون",
    aiCalls: "اي آءِ ڪالون",
    tokens: "ٽوڪن",
    time: "عمل جو وقت",
    retries: "ٻيهر ڪوششون",
    seconds: "سيڪنڊ",
    note: "تحقيق دوران اندازاً استعمال هتي ڏيکاريو ويندو.",
  },
  agents: {
    title: "تحقيقي ايجنٽ",
    subtitle: "هڪ آرڪيسٽريٽر جي نگرانيءَ هيٺ",
    orchestrator: "آرڪيسٽريٽر",
    orchestratorDesc:
      "ڇهن ئي ايجنٽن کي ترتيب سان هلائي ٿو، بجيٽ جون حدون لاڳو ڪري ٿو ۽ پيش رفت محفوظ ڪري ٿو.",
    descriptions: {
      planner: "سوال کي ننڍن سوالن ۽ ڳولا جي منصوبي ۾ ورهائي ٿو.",
      discovery: "DuckDuckGo، OpenAlex ۽ Crossref مان ماخذ ڳولي ٿو ۽ ورجاءُ ختم ڪري ٿو.",
      evidence: "هر ماخذ مان لاڳاپيل ثبوت ڪڍي ٿو.",
      critical: "نتيجن جو ڀيٽاءُ ڪري ٿو ۽ تضاد ۽ ڪمزوريون ڳولي ٿو.",
      verification: "هر حوالي کي حقيقت ۾ حاصل ڪيل ماخذن سان ملائي پرکي ٿو.",
      writer: "حوالن سان منظم رپورٽ لکي ٿو.",
    },
  },
  history: {
    title: "تحقيق جي تاريخ",
    empty: "اڃا ڪو تحقيقي منصوبو ناهي. محفوظ ٿيل منصوبا هتي نظر ايندا.",
  },
  footer: {
    note: "رپورٽن ۾ رڳو اهي ماخذ شامل ٿين ٿا جيڪي حقيقت ۾ حاصل ڪيا ويا هجن. جن دعوائن جي تصديق نه ٿي سگهي انهن کي واضح نشان لڳايو ويندو آهي.",
  },
};

const romanUr: Dictionary = {
  appName: "ResearchPilot AI",
  tagline: "Khud-kaar, kai-zubani tehqeeq — aise sources ke saath jinhein aap khud check kar sakte hain.",
  nav: {
    dashboard: "Dashboard",
    newResearch: "Nayi tehqeeq",
    history: "History",
    menu: "Menu kholein",
    close: "Menu band karein",
  },
  controls: {
    theme: "Theme badlein",
    uiLanguage: "Interface ki zubaan",
    reportLanguage: "Report ki zubaan",
  },
  hero: {
    title: "Aap kis topic par research karna chahte hain?",
    subtitle:
      "English, Urdu, Sindhi ya Roman Urdu mein sawal poochein. Agents plan banate hain, search karte hain, check karte hain aur citations ke saath report likhte hain.",
  },
  form: {
    question: "Research ka sawal",
    placeholder: "Misal: Sindh mein zer-e-zameen paani ki kami kheti baari par kaise asar daalti hai?",
    detected: "Pehchaani gayi zubaan",
    unknown: "Likhna shuru karein…",
    depth: "Gehrai",
    depthStandard: "Standard",
    maxSources: "Zyada se zyada sources",
    extraRounds: "Izafi rounds",
    start: "Research shuru karein",
    previewNote: "Sirf preview: research engine Phase 2 mein add hoga.",
  },
  budget: {
    title: "Istemaal ki hadd",
    subtitle: "Har research run ke liye sakht hadood",
    aiCalls: "AI calls",
    tokens: "Tokens",
    time: "Execution time",
    retries: "Retries",
    seconds: "sec",
    note: "Research ke dauran andaazi istemaal yahan nazar aayega.",
  },
  agents: {
    title: "Research agents",
    subtitle: "Ek orchestrator ki nigrani mein",
    orchestrator: "Orchestrator",
    orchestratorDesc:
      "Chhe agents ko tarteeb se chalata hai, budget ki hadood nafiz karta hai aur progress save karta hai.",
    descriptions: {
      planner: "Sawal ko chhote sawalon aur search plan mein taqseem karta hai.",
      discovery: "DuckDuckGo, OpenAlex aur Crossref se sources dhoondta hai aur duplicates hata deta hai.",
      evidence: "Har source se mutaliqa saboot nikalta hai.",
      critical: "Nataij ka muwazna karta hai aur tazaad aur kamzoriyan dhoondta hai.",
      verification: "Har citation ko waqai hasil kiye gaye sources se mila kar check karta hai.",
      writer: "Citations ke saath munazzam report likhta hai.",
    },
  },
  history: {
    title: "Research history",
    empty: "Abhi koi research project nahi hai. Save kiye gaye projects yahan nazar aayenge.",
  },
  footer: {
    note: "Reports mein sirf wohi sources shamil hote hain jo waqai hasil kiye gaye hon. Jin claims ki tasdeeq na ho sake unhein saaf tor par mark kiya jata hai.",
  },
};

export const translations: Record<LanguageCode, Dictionary> = {
  en,
  ur,
  sd,
  "roman-ur": romanUr,
};
