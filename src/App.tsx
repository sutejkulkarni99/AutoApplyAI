import React, { useState, useEffect } from "react";
import { Navbar, TabType } from "./components/Navbar";
import { LoginPage } from "./components/LoginPage";
import { AdminModal } from "./components/AdminModal";
import { InputTab } from "./components/InputTab";
import { PreviewTab } from "./components/PreviewTab";
import { KanbanTab } from "./components/KanbanTab";
import { ProfileTab } from "./components/ProfileTab";
import { SettingsTab } from "./components/SettingsTab";
import {
  User as UserType,
  ApplicationRecord,
  ApplicationStatus,
  PipelineResults,
  AppSettingsData,
  ThemePreset,
} from "./types";
import { getStoredTheme, applyTheme } from "./theme";

export function App() {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("autoapply_token"));
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [activeTab, setActiveTab] = useState<TabType>("input");
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [pipelineResults, setPipelineResults] = useState<PipelineResults | null>(null);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [activeModel, setActiveModel] = useState<string>("gemini-3.6-flash");
  const [activeProvider, setActiveProvider] = useState<string>("gemini");
  const [currentTheme, setCurrentTheme] = useState<ThemePreset>(() => getStoredTheme());

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

  const fetchApplications = async (authToken: string) => {
    try {
      const res = await fetch("/api/tracker", {
        headers: { Authorization: `Bearer ${authToken}` },
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
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center text-[var(--text-muted)] text-xs">
        <span className="inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2.5" />
        Connecting to AutoApply Homelab...
      </div>
    );
  }

  if (!currentUser || !token) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-main)] flex flex-col font-sans selection:bg-blue-600 selection:text-white transition-colors duration-200">
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
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6">
        {activeTab === "input" && (
          <InputTab
            onPipelineComplete={handlePipelineComplete}
            isRunningPipeline={isRunningPipeline}
            setIsRunningPipeline={setIsRunningPipeline}
            activeModel={activeModel}
            activeProvider={activeProvider}
            token={token}
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

        {activeTab === "profile" && <ProfileTab token={token} />}

        {activeTab === "settings" && (
          <SettingsTab
            token={token}
            currentTheme={currentTheme}
            onThemeChange={setCurrentTheme}
            onSettingsSaved={(newModel, newProvider) => {
              setActiveModel(newModel);
              setActiveProvider(newProvider);
            }}
          />
        )}
      </main>

      {/* Admin User Management Modal */}
      {currentUser.role === "admin" && (
        <AdminModal
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          token={token}
        />
      )}

      {/* Clean Footer */}
      <footer className="border-t border-[var(--border-app)] py-3 px-6 text-xs text-[var(--text-dim)] bg-[var(--bg-card)] transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>AutoApply • LaTeX Application Suite</span>
            <span className="text-[var(--border-subtle)]">|</span>
            <span className="text-[var(--text-muted)] text-[11px]">
              Crafted by <span className="text-[var(--text-primary)] font-medium">Sutej Kulkarni</span>
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="text-[var(--text-muted)]">
              Account: <strong className="text-[var(--text-main)]">{currentUser.username}</strong>
            </span>
            <span className="text-[var(--border-subtle)]">|</span>
            <span className="text-[var(--text-secondary)] font-medium">EN 🇬🇧 & DE 🇩🇪</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
