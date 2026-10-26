"use client";

import { Languages } from "lucide-react";
import {
  LANGUAGE_CODES,
  LANGUAGES,
  isLanguageCode,
  type LanguageCode,
} from "@/lib/i18n/languages";

interface LanguageSelectProps {
  label: string;
  value: LanguageCode;
  onChange: (code: LanguageCode) => void;
}

export function LanguageSelect({ label, value, onChange }: LanguageSelectProps) {
  return (
    <label className="flex items-center gap-2">
      <Languages
        className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400"
        aria-hidden
      />
      <span className="sr-only">{label}</span>
      <select
        value={value}
        title={label}
        onChange={(event) => {
          const next = event.target.value;
          if (isLanguageCode(next)) onChange(next);
        }}
        className="input py-1.5"
      >
        {LANGUAGE_CODES.map((code) => (
          <option key={code} value={code}>
            {LANGUAGES[code].label}
          </option>
        ))}
      </select>
    </label>
  );
}
