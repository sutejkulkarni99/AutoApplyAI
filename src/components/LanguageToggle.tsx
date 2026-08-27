import React from "react";
import { Globe2, Check } from "lucide-react";
import { DocumentLanguage, LanguageOption } from "../types";

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    code: "en",
    label: "English",
    nativeLabel: "English",
    flag: "🇬🇧",
    description: "International standard (UK / US format & tone)",
  },
  {
    code: "de",
    label: "German",
    nativeLabel: "Deutsch",
    flag: "🇩🇪",
    description: "DIN 5008 German standard (Lebenslauf & Anschreiben)",
  },
];

interface LanguageToggleProps {
  selectedLanguage: DocumentLanguage;
  onChange: (lang: DocumentLanguage) => void;
  disabled?: boolean;
}

export function LanguageToggle({ selectedLanguage, onChange, disabled }: LanguageToggleProps) {
  return (
    <div className="flex flex-col space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
          <Globe2 className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>Target Application Language</span>
        </label>
        <span className="text-[10px] font-mono text-[var(--text-muted)]">
          {selectedLanguage === "de" ? "DIN 5008 Lebenslauf" : "International CV"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--background)] border border-[var(--border)] rounded-xl">
        {LANGUAGE_OPTIONS.map((lang) => {
          const isSelected = selectedLanguage === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              disabled={disabled}
              onClick={() => onChange(lang.code)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isSelected
                  ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-sm border border-[var(--border)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-transparent"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm leading-none">{lang.flag}</span>
                <div className="text-left">
                  <div className="font-semibold text-xs leading-none text-[var(--text-primary)]">{lang.label}</div>
                  <span className="text-[10px] text-[var(--text-muted)] leading-tight block mt-0.5">
                    {lang.nativeLabel}
                  </span>
                </div>
              </div>
              {isSelected && <Check className="w-3.5 h-3.5 text-[var(--accent)] ml-1.5 shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
