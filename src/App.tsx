import React, { useState, useEffect } from "react";
import { Navbar, TabType } from "./components/Navbar";
import { StudioSidebar } from "./components/StudioSidebar";
import { RunSettingsDrawer } from "./components/RunSettingsDrawer";
import { LoginPage } from "./components/LoginPage";
import { AdminModal } from "./components/AdminModal";
import { InputTab } from "./components/InputTab";
import { PreviewTab } from "./components/PreviewTab";
import { KanbanTab } from "./components/KanbanTab";
import { ProfileTab } from "./components/ProfileTab";
import { SettingsTab } from "./components/SettingsTab";
import { EmailScannerTab } from "./components/EmailScannerTab";
import {
  User as UserType,
  ApplicationRecord,
  ApplicationStatus,
  PipelineResults,
  AppSettingsData,
  ThemePreset,
} from "./types";
import { getStoredTheme, applyTheme } from "./theme";
import { Code2, Copy, Check, X } from "lucide-react";

export function App() {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("autoapply_token"));
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [activeTab, setActiveTab] = useState<TabType>("input");
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const [isGetCodeModalOpen, setIsGetCodeModalOpen] = useState(false);
  const [isCopiedCode, setIsCopiedCode] = useState(false);

  // AI & Generation Runtime Settings
  const [pipelineResults, setPipelineResults] = useState<PipelineResults | null>(null);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [activeModel, setActiveModel] = useState<string>("gemini-3.6-flash");
  const [activeProvider, setActiveProvider] = useState<string>("gemini");
  const [currentTheme, setCurrentTheme] = useState<ThemePreset>(() => getStoredTheme());

  const [temperature, setTemperature] = useState(0.2);
  const [thinkingLevel, setThinkingLevel] = useState<"High" | "Medium" | "Low" | "None">("High");
  const [structuredOutputs, setStructuredOutputs] = useState(true);
  const [webScraperGrounding, setWebScraperGrounding] = useState(true);
  const [emailAutoSync, setEmailAutoSync] = useState(true);
  const [systemPrompt, setSystemPrompt] = useState(
    "Strict 3-pass ATS alignment, German DIN 5008 Type B and English LaTeX generation without hallucinating candidate details."
  );

  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    if (token) {
      verifySession(token);
    } else {
      setIsAuthChecking(false);
    }
  }, [token]);

  const verifySession = async (authToken: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        await Promise.all([fetchUserSettings(authToken), fetchApplications(authToken)]);
      } else {
        localStorage.removeItem("autoapply_token");
        setToken(null);
        setCurrentUser(null);
      }
    } catch {
      localStorage.removeItem("autoapply_token");
      setToken(null);
      setCurrentUser(null);
    } finally {
      setIsAuthChecking(false);
    }
  };

  const fetchUserSettings = async (authToken: string) => {
    try {
      const res = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data: AppSettingsData = await res.json();
        if (data.ai_model) setActiveModel(data.ai_model);
        if (data.provider) setActiveProvider(data.provider);
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  };

  const fetchApplications = async (authToken?: string) => {
    const t = authToken || token;
    if (!t) return;
    try {
      const res = await fetch("/api/tracker", {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      if (data.applications) {
        setApplications(data.applications);
      }
    } catch (e) {
      console.error("Failed to fetch applications:", e);
    }
  };

  const handleLoginSuccess = (user: UserType, authToken: string) => {
    setToken(authToken);
    setCurrentUser(user);
    fetchUserSettings(authToken);
    fetchApplications(authToken);
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    localStorage.removeItem("autoapply_token");
    setToken(null);
    setCurrentUser(null);
  };

  const handlePipelineComplete = (results: PipelineResults) => {
    setPipelineResults(results);
    setActiveTab("preview");
    if (token) fetchApplications(token);
  };

  const handleSaveToTracker = async (data: PipelineResults) => {
    if (!token) return;
    try {
      const jobAnalysis = data.job_analysis || data.pass_1?.job_analysis;
      const res = await fetch("/api/tracker", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          company: jobAnalysis?.company || data.job_metadata?.company || "Target Company",
          role: jobAnalysis?.title || data.job_metadata?.title || "Target Role",
          url: data.job_metadata?.url || "",
          status: "tailored",
          gaps: data.gaps,
          pass_data: data,
          notes: `Tailored with ${activeProvider.toUpperCase()} (${data.language === "de" ? "German" : "English"}).`,
        }),
      });
      if (res.ok) {
        await fetchApplications(token);
        setActiveTab("kanban");
      }
    } catch (e) {
      console.error("Failed to save application to tracker:", e);
    }
  };

  const handleStatusChange = async (id: string, newStatus: ApplicationStatus) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/tracker/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setApplications((prev) =>
          prev.map((app) => (app.id === id ? { ...app, status: newStatus } : app))
        );
      }
    } catch (e) {
      console.error("Failed to update status:", e);
    }
  };

  const handleDeleteApplication = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/tracker/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setApplications((prev) => prev.filter((app) => app.id !== id));
      }
    } catch (e) {
      console.error("Failed to delete application:", e);
    }
  };

  const handleAddApplication = async (appData: Partial<ApplicationRecord>) => {
    if (!token) return;
    try {
      const res = await fetch("/api/tracker", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(appData),
      });
      if (res.ok) {
        await fetchApplications(token);
      }
    } catch (e) {
      console.error("Failed to add application:", e);
    }
  };

  const handleRegeneratePass = async (passNum: 2 | 3) => {
    if (!pipelineResults?.pass_1 || !token) return;
    setIsRegenerating(true);
    try {
      const endpoint = passNum === 2 ? "/api/ai/generate-cv" : "/api/ai/generate-cover";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pass_1_analysis: pipelineResults.pass_1,
          language: pipelineResults.language || "en",
        }),
      });
      const data = await res.json();
      if (passNum === 2) {
        setPipelineResults((prev) => (prev ? { ...prev, pass_2: data } : null));
      } else {
        setPipelineResults((prev) => (prev ? { ...prev, pass_3: data } : null));
      }
    } catch (e) {
      console.error("Regenerate failed:", e);
    } finally {
      setIsRegenerating(false);
    }
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#131314] flex items-center justify-center text-[#8e918f] text-xs font-mono">
        <span className="inline-block w-5 h-5 border-2 border-[#8ab4f8] border-t-transparent rounded-full animate-spin mr-2.5" />
        Connecting to AutoApply Studio...
      </div>
    );
  }

  if (!currentUser || !token) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#131314] text-[#e3e3e3] flex flex-col font-sans selection:bg-[#8ab4f8]/30 selection:text-[#f2f2f2] transition-colors duration-200">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        activeModel={activeModel}
        activeProvider={activeProvider}
        currentTheme={currentTheme}
        onThemeChange={setCurrentTheme}
        onOpenAdmin={() => setIsAdminModalOpen(true)}
        onLogout={handleLogout}
        onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        onToggleSettingsDrawer={() => setIsSettingsDrawerOpen((prev) => !prev)}
      />

      {/* Main Studio Shell: Left Sidebar + Main Viewport + Right Inspector */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Google AI Studio Sidebar */}
        <StudioSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentUser={currentUser}
          activeModel={activeModel}
          activeProvider={activeProvider}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          onOpenAdmin={() => setIsAdminModalOpen(true)}
          onLogout={handleLogout}
          onOpenSettingsDrawer={() => setIsSettingsDrawerOpen(true)}
          emailEnabled={emailAutoSync}
        />

        {/* Central Dynamic Content Area */}
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 custom-scrollbar">
          {activeTab === "input" && (
            <InputTab
              onPipelineComplete={handlePipelineComplete}
              isRunningPipeline={isRunningPipeline}
              setIsRunningPipeline={setIsRunningPipeline}
              activeModel={activeModel}
              activeProvider={activeProvider}
              token={token}
              onOpenEmailScanner={() => setActiveTab("emails")}
              onOpenLaTeXPreview={() => setActiveTab("preview")}
              onOpenSettingsDrawer={() => setIsSettingsDrawerOpen(true)}
            />
          )}

          {activeTab === "preview" && (
            <PreviewTab
              pipelineData={pipelineResults}
              onSaveToTracker={handleSaveToTracker}
              onRegeneratePass={handleRegeneratePass}
              isRegenerating={isRegenerating}
              token={token}
            />
          )}

          {activeTab === "kanban" && (
            <KanbanTab
              applications={applications}
              onStatusChange={handleStatusChange}
              onDeleteApplication={handleDeleteApplication}
              onAddApplication={handleAddApplication}
              onSelectApplication={(app) => {
                if (app.pass_data) {
                  setPipelineResults(app.pass_data);
                  setActiveTab("preview");
                }
              }}
            />
          )}

          {activeTab === "emails" && (
            <EmailScannerTab
              token={token}
              onRefreshApplications={(updatedApps) => {
                if (updatedApps) {
                  setApplications(updatedApps);
                } else {
                  fetchApplications(token);
                }
              }}
              applications={applications}
            />
          )}

          {activeTab === "profile" && <ProfileTab token={token} />}

          {activeTab === "settings" && (
            <SettingsTab
              token={token}
              currentTheme={currentTheme}
              onThemeChange={setCurrentTheme}
              isAdmin={currentUser.role === "admin"}
              onOpenAdminModal={() => setIsAdminModalOpen(true)}
              onSettingsSaved={(newModel, newProvider) => {
                setActiveModel(newModel);
                setActiveProvider(newProvider);
              }}
            />
          )}
        </main>

        {/* Right Run Settings Inspector Drawer */}
        <RunSettingsDrawer
          isOpen={isSettingsDrawerOpen}
          onClose={() => setIsSettingsDrawerOpen(false)}
          activeModel={activeModel}
          activeProvider={activeProvider}
          temperature={temperature}
          onTemperatureChange={setTemperature}
          thinkingLevel={thinkingLevel}
          onThinkingLevelChange={setThinkingLevel}
          structuredOutputs={structuredOutputs}
          onToggleStructuredOutputs={() => setStructuredOutputs(!structuredOutputs)}
          webScraperGrounding={webScraperGrounding}
          onToggleWebScraperGrounding={() => setWebScraperGrounding(!webScraperGrounding)}
          emailAutoSync={emailAutoSync}
          onToggleEmailAutoSync={() => setEmailAutoSync(!emailAutoSync)}
          onOpenGetCodeModal={() => setIsGetCodeModalOpen(true)}
          systemPrompt={systemPrompt}
          onSystemPromptChange={setSystemPrompt}
        />
      </div>

      {/* Admin User Management Modal */}
      {currentUser.role === "admin" && (
        <AdminModal
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          token={token}
        />
      )}

      {/* &lt;&gt; Get Code Modal */}
      {isGetCodeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#1e1f20] border border-[#282a2c] rounded-2xl p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#8ab4f8]" />
                <h3 className="text-sm font-semibold text-[#f2f2f2]">
                  Get Code & Pipeline API Schema
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGetCodeModalOpen(false)}
                className="text-[#8e918f] hover:text-[#e3e3e3]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#8e918f] font-mono">
                  TypeScript / cURL API Call:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const code = `curl -X POST http://localhost:3000/api/ai/run-pipeline \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${token}" \\
  -d '{
    "job_url": "https://example.com/job",
    "language": "en"
  }'`;
                    navigator.clipboard.writeText(code);
                    setIsCopiedCode(true);
                    setTimeout(() => setIsCopiedCode(false), 2000);
                  }}
                  className="flex items-center gap-1 text-[11px] font-medium text-[#8ab4f8] hover:underline cursor-pointer"
                >
                  {isCopiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{isCopiedCode ? "Copied!" : "Copy cURL"}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-[#131314] border border-[#282a2c] text-xs font-mono text-[#8ab4f8] overflow-x-auto leading-relaxed">
{`curl -X POST http://localhost:3000/api/ai/run-pipeline \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${token ? token.substring(0, 15) + "..." : "YOUR_TOKEN"}" \\
  -d '{
    "job_description": "We are seeking a Senior Engineer...",
    "job_url": "https://linkedin.com/jobs/view/...",
    "language": "en"
  }'`}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsGetCodeModalOpen(false)}
                className="px-4 py-1.5 rounded-xl text-xs font-medium bg-[#282a2c] text-[#f2f2f2] hover:bg-[#323438] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Studio Compact Footer */}
      <footer className="border-t border-[#282a2c] py-2 px-4 text-xs text-[#8e918f] bg-[#101012] transition-colors">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>AutoApply Studio</span>
            <span className="text-[#37393b]">•</span>
            <span className="text-[11px]">LaTeX DIN 5008 & 3-Pass Engine</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span>Account: <strong className="text-[#f2f2f2]">{currentUser.username}</strong></span>
            <span className="text-[#37393b]">•</span>
            <span className="text-emerald-400">Status: Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
