export const RESEARCH_DEFAULTS = {
  depth: "standard",
  maxSources: 25,
  maxExtraRounds: 3,
  reportLanguage: "en",
} as const;

// Display-only numbers for Phase 1. The real limits come from
// environment variables in the backend budget manager (Phase 2).
export const BUDGET_DISPLAY_DEFAULTS = {
  maxAiCalls: 24,
  maxTokens: 60000,
  maxSeconds: 240,
  maxRetries: 2,
} as const;

export const MAX_QUESTION_LENGTH = 500;

// If you change these keys, update the inline script in src/app/layout.tsx too.
export const STORAGE_KEYS = {
  theme: "rp-theme",
  uiLanguage: "rp-ui-lang",
  reportLanguage: "rp-report-lang",
} as const;
