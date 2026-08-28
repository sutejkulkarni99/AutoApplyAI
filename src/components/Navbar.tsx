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
  Mail,
  Sliders,
  PanelLeft,
} from "lucide-react";
import { User as UserType, ThemePreset } from "../types";
import { ThemeSelector } from "./ThemeSelector";

export type TabType = "input" | "preview" | "kanban" | "emails" | "profile" | "settings";

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
  onToggleSidebar?: () => void;
  onToggleSettingsDrawer?: () => void;
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
  onToggleSidebar,
  onToggleSettingsDrawer,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 bg-[#131314]/95 backdrop-blur-md border-b border-[#282a2c] px-3 sm:px-5 py-2 transition-colors">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Brand Identity + Sidebar trigger */}
        <div className="flex items-center gap-2.5">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-1.5 rounded-lg text-[#8e918f] hover:text-[#e3e3e3] hover:bg-[#282a2c] transition-colors cursor-pointer"
              title="Toggle Sidebar Navigation"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab("input")}
            className="flex items-center gap-2.5 text-left group focus:outline-none cursor-pointer"
          >
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#4285f4] via-[#9b72cb] to-[#d96570] p-[1px] shadow-sm flex items-center justify-center">
              <div className="w-full h-full bg-[#131314] rounded-[11px] flex items-center justify-center group-hover:bg-opacity-80 transition-all">
                <Sparkles className="w-3.5 h-3.5 text-[#8ab4f8]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-xs text-[#f2f2f2] tracking-tight">
                  AutoApply Studio
                </span>
                <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 rounded bg-blue-500/10 text-[#8ab4f8] border border-blue-500/20">
                  LaTeX Pro
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Center: Clean Breadcrumb Title */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-[#8e918f]">
          <span className="text-[#5f6368]">Workspace</span>
          <span className="text-[#5f6368]">/</span>
          <span className="font-semibold text-[#f2f2f2] capitalize">
            {activeTab === "input"
              ? "Playground"
              : activeTab === "preview"
              ? "Documents & LaTeX"
              : activeTab === "kanban"
              ? "Kanban Tracker"
              : activeTab === "emails"
              ? "Email Scanner"
              : activeTab === "profile"
              ? "Master Profile"
              : "Settings"}
          </span>
        </div>

        {/* Right: Actions Cluster */}
        <div className="flex items-center gap-1.5">
          {/* Active AI Model Pill */}
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            title="Configure AI Provider & Model in Settings"
            className="hidden md:flex items-center gap-1.5 bg-[#1e1f20] hover:bg-[#282a2c] border border-[#282a2c] px-2.5 py-1 rounded-xl text-[11px] font-mono text-[#8e918f] hover:text-[#e3e3e3] transition-colors cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <Cpu className="w-3 h-3 text-[#8ab4f8]" />
            <span className="font-semibold capitalize text-[#f2f2f2]">{activeProvider}:</span>
            <span className="text-[#8ab4f8] truncate max-w-[90px]">{activeModel}</span>
          </button>

          {/* Theme Selector */}
          <ThemeSelector currentTheme={currentTheme} onThemeChange={onThemeChange} />

          {/* Settings Drawer Inspector Toggle */}
          {onToggleSettingsDrawer && (
            <button
              type="button"
              onClick={onToggleSettingsDrawer}
              title="Run Settings & Model Inspector"
              className="p-1.5 rounded-xl bg-[#1e1f20] hover:bg-[#282a2c] text-[#8e918f] hover:text-[#e3e3e3] border border-[#282a2c] transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Admin Button */}
          {currentUser?.role === "admin" && (
            <button
              type="button"
              onClick={onOpenAdmin}
              title="Administrator Management Console"
              className="p-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-colors cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Profile & YAML */}
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            title={`Candidate Master Profile (${currentUser?.username || "User"})`}
            className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
              activeTab === "profile"
                ? "bg-[#282a2c] text-[#f2f2f2] border-[#3a3d40]"
                : "bg-[#1e1f20] hover:bg-[#282a2c] text-[#8e918f] hover:text-[#e3e3e3] border-[#282a2c]"
            }`}
          >
            <User className="w-3.5 h-3.5" />
          </button>

          {/* Sign Out */}
          <button
            type="button"
            onClick={onLogout}
            title="Sign Out"
            className="p-1.5 rounded-xl bg-[#1e1f20] hover:bg-red-500/10 hover:text-red-400 text-[#8e918f] border border-[#282a2c] transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
