import React from "react";
import {
  FileCode2,
  Sparkles,
  FileCheck2,
  Kanban,
  User,
  Settings,
  Shield,
  LogOut,
  Cpu,
  Globe2,
} from "lucide-react";
import { User as UserType, ThemePreset } from "../types";
import { ThemeSelector } from "./ThemeSelector";

export type TabType = "input" | "preview" | "kanban" | "profile" | "settings";

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  currentUser: UserType | null;
  activeModel: string;
  activeProvider: string;
  currentTheme: ThemePreset;
  onThemeChange: (theme: ThemePreset) => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
}

export function Navbar({
  activeTab,
  setActiveTab,
  currentUser,
  activeModel,
  activeProvider,
  currentTheme,
  onThemeChange,
  onOpenAdmin,
  onLogout,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 bg-[var(--surface)]/90 backdrop-blur-md border-b border-[var(--border)] px-4 sm:px-6 py-2.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveTab("input")}
            className="flex items-center gap-3 text-left group focus:outline-none"
          >
            <div className="w-8 h-8 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center shadow-sm group-hover:opacity-90 transition-opacity">
              <FileCode2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-[var(--text-primary)] tracking-tight">
                  AutoApply
                </span>
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--text-primary)] border border-[var(--border)]">
                  LaTeX Suite
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-secondary)] font-mono leading-none hidden sm:block mt-0.5">
                LaTeX Application Suite • English & German
              </p>
            </div>
          </button>
        </div>

        {/* Center: Main App Navigation Hierarchy */}
        <nav className="flex items-center bg-[var(--background)] p-1 rounded-xl border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setActiveTab("input")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === "input"
                ? "bg-[var(--accent)] text-white shadow-sm font-semibold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>1. Tailor Job</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === "preview"
                ? "bg-[var(--accent)] text-white shadow-sm font-semibold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>2. Documents & PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("kanban")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === "kanban"
                ? "bg-[var(--accent)] text-white shadow-sm font-semibold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            }`}
          >
            <Kanban className="w-3.5 h-3.5" />
            <span>3. Tracker</span>
          </button>
        </nav>

        {/* Right: Actions Cluster */}
        <div className="flex items-center gap-2">
          {/* Active AI Model Pill */}
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            title="Configure AI Provider & Model in Settings"
            className="hidden md:flex items-center gap-2 bg-[var(--background)] hover:bg-[var(--surface-hover)] border border-[var(--border)] px-2.5 py-1.5 rounded-xl text-[11px] font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
            <Cpu className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span className="font-semibold capitalize text-[var(--text-primary)]">{activeProvider}:</span>
            <span className="text-[var(--accent)] truncate max-w-[110px]">{activeModel}</span>
          </button>

          {/* Theme Selector */}
          <ThemeSelector currentTheme={currentTheme} onThemeChange={onThemeChange} />

          {/* Admin Button */}
          {currentUser?.role === "admin" && (
            <button
              type="button"
              onClick={onOpenAdmin}
              title="Administrator Management Console"
              className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-colors cursor-pointer"
            >
              <Shield className="w-4 h-4" />
            </button>
          )}

          {/* Profile & YAML */}
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            title={`Candidate Master Profile (${currentUser?.username || "User"})`}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              activeTab === "profile"
                ? "bg-[var(--accent-subtle)] text-[var(--text-primary)] border-[var(--border)]"
                : "bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border)]"
            }`}
          >
            <User className="w-4 h-4" />
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            title="System Settings & LLM API Keys"
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              activeTab === "settings"
                ? "bg-[var(--accent-subtle)] text-[var(--text-primary)] border-[var(--border)]"
                : "bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border)]"
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Sign Out */}
          <button
            type="button"
            onClick={onLogout}
            title="Sign Out"
            className="p-2 rounded-xl bg-[var(--background)] hover:bg-red-500/10 hover:text-red-400 text-[var(--text-muted)] border border-[var(--border)] transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
