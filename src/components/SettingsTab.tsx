import React, { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  Cpu,
  Key,
  Lock,
  Save,
  CheckCircle2,
  AlertCircle,
  Zap,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Server,
  ShieldCheck,
  Palette,
} from "lucide-react";
import { AppSettingsData, ConnectionTestResult, AIProvider, ThemePreset } from "../types";
import { THEME_CONFIGS, applyTheme } from "../theme";

interface SettingsTabProps {
  token: string;
  onSettingsSaved: (newModel: string, newProvider: string) => void;
  currentTheme?: ThemePreset;
  onThemeChange?: (theme: ThemePreset) => void;
  isAdmin?: boolean;
  onOpenAdminModal?: () => void;
}

export function SettingsTab({
  token,
  onSettingsSaved,
  currentTheme = "zinc-dark",
  onThemeChange,
  isAdmin,
  onOpenAdminModal,
}: SettingsTabProps) {
  const [settings, setSettings] = useState<AppSettingsData | null>(null);
  const [provider, setProvider] = useState<AIProvider>("gemini");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3.6-flash");
  const [customModelId, setCustomModelId] = useState<string>("");
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [temperature, setTemperature] = useState<number>(0.2);
  const [cvMaxWords, setCvMaxWords] = useState<number>(450);
  const [coverMaxWords, setCoverMaxWords] = useState<number>(280);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<{ success?: string; error?: string } | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Loading & Testing state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: AppSettingsData = await res.json();
      if (!res.ok) throw new Error("Failed to load settings");

      setSettings(data);
      setProvider(data.provider || "gemini");
      setSelectedModel(data.ai_model || "gemini-3.6-flash");
      setBaseUrl(data.base_url || "");
      setTemperature(data.temperature ?? 0.2);
      setCvMaxWords(data.cv_max_words ?? 450);
      setCoverMaxWords(data.cover_max_words ?? 280);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProviderChange = (newProvider: AIProvider) => {
    setProvider(newProvider);
    setTestResult(null);

    if (newProvider === "gemini") {
      setSelectedModel("gemini-3.6-flash");
      setBaseUrl("");
    } else if (newProvider === "nvidia") {
      setSelectedModel("nvidia/nemotron-4-340b-instruct");
      setBaseUrl("https://integrate.api.nvidia.com/v1");
    } else if (newProvider === "groq") {
      setSelectedModel("llama-3.3-70b-versatile");
      setBaseUrl("https://api.groq.com/openai/v1");
    } else if (newProvider === "ollama") {
      setSelectedModel("nemotron");
      setBaseUrl("http://localhost:11434/v1");
    } else {
      setSelectedModel("custom");
      setBaseUrl("https://api.openai.com/v1");
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setError(null);

    const activeModelToTest = selectedModel === "custom" ? customModelId : selectedModel;

    try {
      const res = await fetch("/api/settings/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider,
          ai_model: activeModelToTest,
          base_url: baseUrl,
          api_key: apiKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Connection test failed");
      }

      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSaveSuccess(null);

    const activeModelToSave = selectedModel === "custom" ? customModelId : selectedModel;

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider,
          ai_model: activeModelToSave,
          base_url: baseUrl,
          api_key: apiKey || undefined,
          temperature,
          cv_max_words: cvMaxWords,
          cover_max_words: coverMaxWords,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");

      setSaveSuccess("Settings and provider configuration saved successfully.");
      onSettingsSaved(activeModelToSave, provider);
      await fetchSettings();
      setApiKey("");
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ error: "New passwords do not match." });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordStatus({ error: "New password must be at least 6 characters." });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Password change failed");

      setPasswordStatus({ success: "Password updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordStatus({ error: err.message });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)]">
                <SettingsIcon className="w-4 h-4" />
              </span>
              <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                Settings & AI Configuration
              </h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
              Configure your preferred LLM provider (Google Gemini, NVIDIA NIM, Groq, Ollama) and workspace preferences.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-[var(--background)] border border-[var(--border)] px-3 py-1.5 rounded-xl text-xs text-[var(--text-secondary)]">
            <ShieldCheck className="w-4 h-4 text-[var(--success)]" />
            <span>Per-User Isolated Storage</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-[var(--error)]/10 border border-[var(--error)]/30 rounded-xl flex items-start gap-3 text-[var(--text-primary)] text-xs shadow-sm">
          <AlertCircle className="w-4 h-4 text-[var(--error)] shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 bg-[var(--success)]/10 border border-[var(--success)]/30 rounded-xl flex items-center gap-3 text-[var(--text-primary)] text-xs shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-[var(--success)] shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Section: Visual Palettes */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
          <Palette className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Workspace Visual Palette
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {THEME_CONFIGS.map((t) => {
            const isSelected = currentTheme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  applyTheme(t.id);
                  if (onThemeChange) onThemeChange(t.id);
                }}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-24 ${
                  isSelected
                    ? "bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--text-primary)] shadow-sm"
                    : "bg-[var(--background)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-primary)]">{t.name}</span>
                  <div
                    className="w-4 h-4 rounded-full border shadow-xs"
                    style={{ backgroundColor: t.previewAccent, borderColor: t.previewBg }}
                  />
                </div>
                <div>
                  <span className="text-[9px] uppercase font-mono font-bold text-[var(--text-muted)] block">
                    {t.mode}
                  </span>
                  <p className="text-[10px] text-[var(--text-muted)] line-clamp-1 mt-0.5">{t.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Section 1: AI Provider Selection */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
            <Cpu className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              1. Select AI Provider Architecture
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {[
              { id: "gemini", label: "Google Gemini", desc: "Native GenAI SDK" },
              { id: "nvidia", label: "NVIDIA NIM", desc: "Nemotron / Open APIs" },
              { id: "groq", label: "Groq Cloud", desc: "Fast Cloud Inference" },
              { id: "ollama", label: "Local Ollama", desc: "Host / Port 11434" },
              { id: "custom", label: "OpenAI / Custom", desc: "Any Custom Endpoint" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleProviderChange(item.id as AIProvider)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  provider === item.id
                    ? "bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--text-primary)] shadow-sm font-semibold"
                    : "bg-[var(--background)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className="text-xs font-bold block">{item.label}</span>
                <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">{item.desc}</span>
              </button>
            ))}
          </div>

          {/* Model & Base URL Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                Active Model ID
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3.5 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              >
                {provider === "gemini" && (
                  <>
                    <option value="gemini-3.6-flash">gemini-3.6-flash</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                    <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                  </>
                )}
                {provider === "nvidia" && (
                  <>
                    <option value="nvidia/nemotron-4-340b-instruct">nvidia/nemotron-4-340b-instruct</option>
                    <option value="nvidia/nemotron-3-550b-instruct">nvidia/nemotron-3-550b-instruct</option>
                    <option value="meta/llama-3.1-405b-instruct">meta/llama-3.1-405b-instruct</option>
                    <option value="deepseek-ai/deepseek-r1">deepseek-ai/deepseek-r1</option>
                  </>
                )}
                {provider === "groq" && (
                  <>
                    <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
                    <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
                    <option value="gemma2-9b-it">gemma2-9b-it</option>
                  </>
                )}
                {provider === "ollama" && (
                  <>
                    <option value="nemotron">nemotron (Local)</option>
                    <option value="llama3.2">llama3.2 (Local)</option>
                    <option value="mistral">mistral (Local)</option>
                    <option value="qwen2.5-coder">qwen2.5-coder (Local)</option>
                  </>
                )}
                <option value="custom">Custom Model Identifier...</option>
              </select>

              {selectedModel === "custom" && (
                <input
                  type="text"
                  placeholder="Enter exact model ID (e.g. gpt-4o, llama-3.3-70b)"
                  value={customModelId}
                  onChange={(e) => setCustomModelId(e.target.value)}
                  className="w-full mt-2 bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)]"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                API Base Endpoint URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="Default endpoint URL"
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] font-mono focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>
        </div>

        {/* Section 2: API Keys & Verification */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
            <Key className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              2. Secret Credentials & Health Check
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                {provider.toUpperCase()} API Key (Encrypted Per-User)
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    settings?.has_custom_key || settings?.has_env_key
                      ? "•••••••••••••••• (API Key already configured. Leave blank to keep current)"
                      : "Paste your API key here (e.g. nvapi-... or AIzaSy...)"
                  }
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl pl-3.5 pr-10 py-2 text-xs text-[var(--text-primary)] font-mono placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="px-4 py-2 rounded-xl bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] text-xs font-medium flex items-center gap-2 transition cursor-pointer"
              >
                <Zap className={`w-3.5 h-3.5 ${isTesting ? "animate-spin text-[var(--accent)]" : "text-amber-400"}`} />
                <span>{isTesting ? "Testing LLM Connection..." : "Test Connection"}</span>
              </button>

              {testResult && (
                <div
                  className={`text-xs px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
                    testResult.success
                      ? "bg-[var(--success)]/10 text-[var(--text-primary)] border-[var(--success)]/30"
                      : "bg-[var(--error)]/10 text-[var(--text-primary)] border-[var(--error)]/30"
                  }`}
                >
                  {testResult.success ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" />
                      <span>{testResult.message} ({testResult.latencyMs}ms)</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-[var(--error)]" />
                      <span>{testResult.error}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Document Length & Constraints */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
            <SlidersHorizontal className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              3. LaTeX Document Envelopes & Strict Page Length
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                CV Max Words (Enforces 2-Page Bound)
              </label>
              <input
                type="number"
                value={cvMaxWords}
                onChange={(e) => setCvMaxWords(parseInt(e.target.value) || 450)}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Cover Letter Max Words (Enforces 1-Page Bound)
              </label>
              <input
                type="number"
                value={coverMaxWords}
                onChange={(e) => setCoverMaxWords(parseInt(e.target.value) || 280)}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Save Settings Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-[var(--accent)] hover:opacity-90 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Saving Configuration..." : "Save All Settings"}</span>
          </button>
        </div>
      </form>

      {/* Password Change Form */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
          <Lock className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Account Security & Password
          </span>
        </div>

        {passwordStatus && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              passwordStatus.success
                ? "bg-[var(--success)]/10 text-[var(--text-primary)] border-[var(--success)]/30"
                : "bg-[var(--error)]/10 text-[var(--text-primary)] border-[var(--error)]/30"
            }`}
          >
            {passwordStatus.success ? <CheckCircle2 className="w-4 h-4 text-[var(--success)]" /> : <AlertCircle className="w-4 h-4 text-[var(--error)]" />}
            <span>{passwordStatus.success || passwordStatus.error}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isChangingPassword}
              className="px-5 py-2 rounded-xl bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] text-xs font-medium cursor-pointer transition disabled:opacity-50"
            >
              {isChangingPassword ? "Updating Password..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>

      {/* Administrator & Debug Logs Quick Access (Only for Admin) */}
      {isAdmin && onOpenAdminModal && (
        <div className="bg-[#1e1f20] border border-amber-500/30 rounded-2xl p-6 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-semibold text-[#f2f2f2]">
                  Administrator Console & Hidden System Logs
                </h3>
              </div>
              <p className="text-xs text-[#8e918f]">
                Inspect real-time system event logs, manage homelab accounts, and view server performance metrics.
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenAdminModal}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#131314] text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap self-start sm:self-auto"
            >
              <Server className="w-3.5 h-3.5" />
              <span>Open Admin & Logs Console</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
