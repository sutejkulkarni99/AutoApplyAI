import React, { useState, useRef, useEffect } from "react";
import { Palette, Check, Sun, Moon } from "lucide-react";
import { THEME_CONFIGS, applyTheme } from "../theme";
import { ThemePreset } from "../types";

interface ThemeSelectorProps {
  currentTheme: ThemePreset;
  onThemeChange: (theme: ThemePreset) => void;
}

export function ThemeSelector({ currentTheme, onThemeChange }: ThemeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeConfig = THEME_CONFIGS.find((t) => t.id === currentTheme) || THEME_CONFIGS[0];

  const handleSelect = (id: ThemePreset) => {
    applyTheme(id);
    onThemeChange(id);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={`Theme: ${activeConfig.name} (${activeConfig.mode})`}
        className="px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border)]"
      >
        {activeConfig.mode === "dark" ? (
          <Moon className="w-3.5 h-3.5 text-[var(--accent)]" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-amber-500" />
        )}
        <span className="hidden sm:inline text-xs font-medium text-[var(--text-primary)]">
          {activeConfig.name}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-2 border-b border-[var(--border)] flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-[var(--accent)]" />
              <span className="text-xs font-semibold text-[var(--text-primary)]">Workspace Palette</span>
            </div>
            <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)]">
              {activeConfig.mode}
            </span>
          </div>

          <div className="space-y-1.5">
            {THEME_CONFIGS.map((theme) => {
              const isSelected = theme.id === currentTheme;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => handleSelect(theme.id)}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[var(--accent-subtle)] border border-[var(--border)] text-[var(--text-primary)] font-medium"
                      : "hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Visual Color Preview Swatch */}
                    <div
                      className="w-5 h-5 rounded-lg border flex items-center justify-center shadow-inner shrink-0"
                      style={{
                        backgroundColor: theme.previewBg,
                        borderColor: theme.previewAccent,
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: theme.previewAccent }}
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[var(--text-primary)]">
                          {theme.name}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                            theme.mode === "dark"
                              ? "bg-[var(--background)] text-[var(--text-secondary)]"
                              : "bg-[var(--background)] text-[var(--text-secondary)]"
                          }`}
                        >
                          {theme.mode}
                        </span>
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] line-clamp-1">
                        {theme.description}
                      </p>
                    </div>
                  </div>

                  {isSelected && <Check className="w-4 h-4 text-[var(--accent)] shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
