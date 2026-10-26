export const RESEARCH_DEFAULTS = {
  depth: "standard",
  maxSources: 25,
  maxExtraRounds: 3,
  reportLanguage: "en",
} as const;

// Fallback numbers for the usage display. The live limits come from the
// server (environment variables) and replace these on the project page.
export const BUDGET_DISPLAY_DEFAULTS = {
  maxAiCalls: 24,
  maxTokens: 60000,
  maxSeconds: 240,
  maxRetries: 2,
} as const;

export const MAX_QUESTION_LENGTH = 500;
export const MIN_QUESTION_LENGTH = 10;

// If you change the theme or uiLanguage keys, update the inline script in src/app/layout.tsx too.
export const STORAGE_KEYS = {
  theme: "rp-theme",
  uiLanguage: "rp-ui-lang",
  reportLanguage: "rp-report-lang",
  accessCode: "rp-access-code",
} as const;
