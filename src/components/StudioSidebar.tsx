import React from "react";
import {
  Sparkles,
  Play,
  FileCode2,
  FileCheck2,
  Kanban,
  User,
  Settings,
  Shield,
  LogOut,
  Mail,
  HelpCircle,
  Search,
  Bell,
  Key,
  ChevronDown,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { User as UserType, ThemePreset } from "../types";

export type StudioTabType = "input" | "preview" | "kanban" | "emails" | "profile" | "settings";

interface StudioSidebarProps {
  activeTab: StudioTabType;
  setActiveTab: (tab: StudioTabType) => void;
  currentUser: UserType | null;
  activeModel: string;
  activeProvider: string;
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean | ((prev: boolean) => boolean)) => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
  onOpenSettingsDrawer: () => void;
  emailEnabled?: boolean;
}

export function StudioSidebar({
  activeTab,
  setActiveTab,
  currentUser,
  activeModel,
  activeProvider,
  isCollapsed,
  setIsCollapsed,
  onOpenAdmin,
  onLogout,
  onOpenSettingsDrawer,
  emailEnabled = true,
}: StudioSidebarProps) {
  return (
    <aside
      className={`relative flex flex-col bg-[#131314] text-[#e3e3e3] border-r border-[#282a2c] transition-all duration-300 select-none z-30 shrink-0 ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Top Header / App Brand */}
      <div className="flex items-center justify-between px-3.5 py-3.5 border-b border-[#282a2c]/60">
        <button
          type="button"
          onClick={() => setActiveTab("input")}
          className="flex items-center gap-2.5 text-left group overflow-hidden focus:outline-none cursor-pointer"
        >
          {/* Multi-color Sparkle icon */}
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#4285f4] via-[#9b72cb] to-[#d96570] p-[1.5px] shadow-sm shrink-0 flex items-center justify-center">
            <div className="w-full h-full bg-[#131314] rounded-[10px] flex items-center justify-center group-hover:bg-opacity-80 transition-all">
              <Sparkles className="w-4 h-4 text-[#8ab4f8]" />
            </div>
          </div>

          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-[#f2f2f2] tracking-tight truncate">
                  AutoApply
                </span>
              </div>
              <span className="text-[10px] text-[#8e918f] font-mono leading-none truncate">
                Homelab Studio
              </span>
            </div>
          )}
        </button>

        {/* Toggle Collapse */}
        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="p-1 rounded-lg text-[#8e918f] hover:text-[#e3e3e3] hover:bg-[#282a2c] transition-colors cursor-pointer"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 custom-scrollbar">
        {/* Main Nav */}
        <nav className="space-y-1">
          <button
            type="button"
            onClick={() => setActiveTab("input")}
            title="Job Tailor Playground"
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeTab === "input"
                ? "bg-[#282a2c] text-[#f2f2f2] font-semibold shadow-sm"
                : "text-[#8e918f] hover:text-[#e3e3e3] hover:bg-[#1e1f20]"
            }`}
          >
            <Sparkles className={`w-4 h-4 shrink-0 ${activeTab === "input" ? "text-[#8ab4f8]" : ""}`} />
            {!isCollapsed && <span className="truncate">Playground</span>}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            title="Document Preview & LaTeX"
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeTab === "preview"
                ? "bg-[#282a2c] text-[#f2f2f2] font-semibold shadow-sm"
                : "text-[#8e918f] hover:text-[#e3e3e3] hover:bg-[#1e1f20]"
            }`}
          >
            <FileCheck2 className={`w-4 h-4 shrink-0 ${activeTab === "preview" ? "text-[#8ab4f8]" : ""}`} />
            {!isCollapsed && <span className="truncate">Documents & LaTeX</span>}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("kanban")}
            title="Kanban Application Tracker"
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeTab === "kanban"
                ? "bg-[#282a2c] text-[#f2f2f2] font-semibold shadow-sm"
                : "text-[#8e918f] hover:text-[#e3e3e3] hover:bg-[#1e1f20]"
            }`}
          >
            <Kanban className={`w-4 h-4 shrink-0 ${activeTab === "kanban" ? "text-[#8ab4f8]" : ""}`} />
            {!isCollapsed && <span className="truncate">Kanban Tracker</span>}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("emails")}
            title="Email Scanner"
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeTab === "emails"
                ? "bg-[#282a2c] text-[#f2f2f2] font-semibold shadow-sm"
                : "text-[#8e918f] hover:text-[#e3e3e3] hover:bg-[#1e1f20]"
            }`}
          >
            <Mail className={`w-4 h-4 shrink-0 ${activeTab === "emails" ? "text-[#8ab4f8]" : ""}`} />
            {!isCollapsed && <span className="truncate">Email Scanner</span>}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            title="Master Profile & Candidate YAML"
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeTab === "profile"
                ? "bg-[#282a2c] text-[#f2f2f2] font-semibold shadow-sm"
                : "text-[#8e918f] hover:text-[#e3e3e3] hover:bg-[#1e1f20]"
            }`}
          >
            <User className={`w-4 h-4 shrink-0 ${activeTab === "profile" ? "text-[#8ab4f8]" : ""}`} />
            {!isCollapsed && <span className="truncate">Master Profile</span>}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            title="Settings & Model Config"
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeTab === "settings"
                ? "bg-[#282a2c] text-[#f2f2f2] font-semibold shadow-sm"
                : "text-[#8e918f] hover:text-[#e3e3e3] hover:bg-[#1e1f20]"
            }`}
          >
            <Settings className={`w-4 h-4 shrink-0 ${activeTab === "settings" ? "text-[#8ab4f8]" : ""}`} />
            {!isCollapsed && <span className="truncate">Settings</span>}
          </button>

          {currentUser?.role === "admin" && (
            <button
              type="button"
              onClick={onOpenAdmin}
              title="Administrator Console"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors cursor-pointer"
            >
              <Shield className="w-4 h-4 shrink-0 text-amber-400" />
              {!isCollapsed && <span className="truncate">Admin Console</span>}
            </button>
          )}
        </nav>
      </div>

      {/* Bottom Footer Actions & User Card */}
      <div className="p-2 border-t border-[#282a2c]/60 bg-[#101012] overflow-hidden">
        {/* Bottom Icon strip */}
        {!isCollapsed ? (
          <div className="flex items-center justify-between px-1 mb-2">
            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              title="Model & Run Settings"
              className="p-1.5 rounded-lg text-[#8e918f] hover:text-[#e3e3e3] hover:bg-[#282a2c] transition-colors cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onOpenSettingsDrawer}
              title="Open Run Settings Inspector"
              className="p-1.5 rounded-lg text-[#8e918f] hover:text-[#e3e3e3] hover:bg-[#282a2c] transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              title="API Keys & Providers"
              className="p-1.5 rounded-lg text-[#8e918f] hover:text-[#e3e3e3] hover:bg-[#282a2c] transition-colors cursor-pointer"
            >
              <Key className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-[#8e918f] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 mb-2">
            <button
              type="button"
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-[#8e918f] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* User Avatar & Email Capsule */}
        <div
          className={`flex items-center gap-2.5 p-1.5 rounded-xl bg-[#1e1f20] border border-[#282a2c] ${
            isCollapsed ? "justify-center" : ""
          }`}
        >
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white uppercase shrink-0">
            {currentUser?.username?.[0] || "U"}
          </div>

          {!isCollapsed && (
            <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
              <span className="text-[11px] font-semibold text-[#f2f2f2] truncate">
                {currentUser?.username || "Candidate"}
              </span>
              <span className="text-[9px] text-[#8e918f] truncate font-mono">
                {currentUser?.username || "User"}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
