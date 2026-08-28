import React, { useState, useEffect } from "react";
import {
  Mail,
  RefreshCw,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  CheckCircle2,
  Inbox,
  Shield,
  Key,
  Server,
  Calendar,
  History,
  Play,
  Eye,
  Sliders,
  Filter,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  Info,
  Sparkles,
} from "lucide-react";
import {
  EmailSettingsData,
  EmailAccountConfig,
  EmailFeedbackLog,
  ApplicationRecord,
  BackScanTimeframe,
  BackScanSummary,
} from "../types";

interface EmailScannerTabProps {
  token: string;
  onRefreshApplications: (apps?: ApplicationRecord[]) => void;
  applications: ApplicationRecord[];
}

export function EmailScannerTab({
  token,
  onRefreshApplications,
  applications,
}: EmailScannerTabProps) {
  const [emailSettings, setEmailSettings] = useState<EmailSettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBackScanning, setIsBackScanning] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [activeModal, setActiveModal] = useState<"add_account" | "test_account" | null>(null);

  // Connection form state
  const [newEmail, setNewEmail] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newProvider, setNewProvider] = useState<"gmail_oauth" | "imap">("gmail_oauth");
  const [imapHost, setImapHost] = useState("imap.gmail.com");
  const [imapPort, setImapPort] = useState("993");
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Historical Back-Scan state
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [backScanTimeframe, setBackScanTimeframe] = useState<BackScanTimeframe>("30d");
  const [customStartDate, setCustomStartDate] = useState<string>(
    new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().split("T")[0]
  );
  const [customEndDate, setCustomEndDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [backScanAutoMove, setBackScanAutoMove] = useState<boolean>(true);
  const [backScanDryRun, setBackScanDryRun] = useState<boolean>(false);
  const [backScanSummary, setBackScanSummary] = useState<BackScanSummary | null>(null);

  // Filters for Audit Log
  const [logFilter, setLogFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    fetchEmailSettings();
  }, [token]);

  const fetchEmailSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/emails/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEmailSettings(data);
        if (data.lastBackScanSummary) {
          setBackScanSummary(data.lastBackScanSummary);
        }
      }
    } catch (e) {
      console.error("Failed to load email settings:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProviderChange = (provider: "gmail_oauth" | "imap") => {
    setNewProvider(provider);
    if (provider === "gmail_oauth") {
      setImapHost("imap.gmail.com");
      setImapPort("993");
      if (!newLabel) setNewLabel("Gmail Inbox");
    } else {
      setImapHost("outlook.office365.com");
      setImapPort("993");
      if (!newLabel) setNewLabel("Outlook / IMAP Inbox");
    }
  };

  const handleTestConnection = async () => {
    if (!newEmail.trim() || !newPassword.trim()) {
      setTestResult({ success: false, message: "Please enter both Email and App Password before testing." });
      return;
    }

    setIsTestingConn(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/emails/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newEmail.trim(),
          password: newPassword.trim(),
          imapHost: imapHost.trim() || undefined,
          imapPort: parseInt(imapPort, 10) || 993,
          provider: newProvider,
          label: newLabel.trim() || "Inbox",
        }),
      });

      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, message: `Handshake failed: ${err.message}` });
    } finally {
      setIsTestingConn(false);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailSettings || !newEmail.trim()) return;

    if (!newPassword.trim()) {
      alert("Please provide the App Password for this inbox.");
      return;
    }

    if (emailSettings.accounts.length >= 3) {
      alert("You can link up to 3 email accounts in this workspace.");
      return;
    }

    const newAcc: EmailAccountConfig = {
      id: `acc_${Date.now()}`,
      email: newEmail.trim(),
      label: newLabel.trim() || (newProvider === "gmail_oauth" ? "Gmail Inbox" : "Custom IMAP"),
      provider: newProvider,
      status: "connected",
      lastSync: new Date().toISOString(),
      imapHost: imapHost.trim() || undefined,
      imapPort: parseInt(imapPort, 10) || 993,
      password: newPassword.trim(),
      hasPassword: true,
    };

    const updated = {
      ...emailSettings,
      enabled: true,
      accounts: [...emailSettings.accounts, newAcc],
    };

    setEmailSettings(updated);
    setActiveModal(null);
    setNewEmail("");
    setNewPassword("");
    setNewLabel("");
    setTestResult(null);

    try {
      const res = await fetch("/api/emails/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        setSyncStatusMsg({ text: `Linked ${newAcc.email} successfully!`, type: "success" });
      }
    } catch (e) {
      console.error("Failed to save email account:", e);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!emailSettings) return;
    const updated = {
      ...emailSettings,
      accounts: emailSettings.accounts.filter((a) => a.id !== id),
    };
    setEmailSettings(updated);

    try {
      await fetch("/api/emails/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updated),
      });
      setSyncStatusMsg({ text: "Inbox account unlinked.", type: "info" });
    } catch (e) {
      console.error("Failed to remove email account:", e);
    }
  };

  const handleToggleAutoMove = async () => {
    if (!emailSettings) return;
    const updated = {
      ...emailSettings,
      autoMoveKanban: !emailSettings.autoMoveKanban,
    };
    setEmailSettings(updated);
    try {
      await fetch("/api/emails/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updated),
      });
    } catch (e) {
      console.error("Failed to update email settings:", e);
    }
  };

  const handleRunBackScan = async () => {
    if (!emailSettings?.accounts || emailSettings.accounts.length === 0) {
      alert("Please link an email account with an App Password first.");
      return;
    }

    setIsBackScanning(true);
    setSyncStatusMsg(null);

    try {
      const res = await fetch("/api/emails/backscan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accountId: selectedAccount,
          timeframe: backScanTimeframe,
          startDate: backScanTimeframe === "custom" ? customStartDate : undefined,
          endDate: backScanTimeframe === "custom" ? customEndDate : undefined,
          autoMoveKanban: backScanAutoMove,
          dryRun: backScanDryRun,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.emailSettings) {
          setEmailSettings(data.emailSettings);
        }
        if (data.summary) {
          setBackScanSummary(data.summary);
          setSyncStatusMsg({
            text: `Historical back-scan complete: Scanned ${data.summary.totalScanned} emails, found ${data.summary.matchedRecruiterEmails} recruiter communications, updated ${data.summary.cardsUpdated} Kanban cards.`,
            type: "success",
          });
        }
        if (data.applications) {
          onRefreshApplications(data.applications);
        } else {
          onRefreshApplications();
        }
      } else {
        const err = await res.json();
        setSyncStatusMsg({ text: err.error || "Failed to execute historical back-scan.", type: "error" });
      }
    } catch (e: any) {
      setSyncStatusMsg({ text: `Back-scan failed: ${e.message}`, type: "error" });
    } finally {
      setIsBackScanning(false);
    }
  };

  const handleQuickSync = async () => {
    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      const res = await fetch("/api/emails/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.emailSettings) {
          setEmailSettings(data.emailSettings);
        }
        setSyncStatusMsg({ text: data.message || "Inbox check completed.", type: "success" });
        if (data.applications) {
          onRefreshApplications(data.applications);
        } else {
          onRefreshApplications();
        }
      }
    } catch (e) {
      console.error("Sync error:", e);
      setSyncStatusMsg({ text: "Failed to connect to inbox servers.", type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  const [isClearingLogs, setIsClearingLogs] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const handleClearLogs = async () => {
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      setTimeout(() => setConfirmClearAll(false), 4000);
      return;
    }
    
    setIsClearingLogs(true);
    setConfirmClearAll(false);
    try {
      const res = await fetch("/api/emails/clear-logs", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (emailSettings) {
          setEmailSettings({ ...emailSettings, logs: [], lastBackScanSummary: undefined });
          setBackScanSummary(null);
        }
        setSyncStatusMsg({ text: "All activity audit logs cleared.", type: "info" });
      }
    } catch (e) {
      console.error("Failed to clear logs:", e);
      setSyncStatusMsg({ text: "Failed to clear activity logs.", type: "error" });
    } finally {
      setIsClearingLogs(false);
    }
  };

  const handleDeleteSingleLog = async (logId: string) => {
    try {
      const res = await fetch(`/api/emails/logs/${logId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        if (emailSettings) {
          const updatedLogs = (emailSettings.logs || []).filter((l) => l.id !== logId);
          setEmailSettings({ ...emailSettings, logs: updatedLogs });
        }
      }
    } catch (e) {
      console.error("Failed to delete log entry:", e);
    }
  };

  // Filtered audit logs
  const filteredLogs = (emailSettings?.logs || []).filter((log) => {
    const matchesOutcome = logFilter === "all" || log.detectedOutcome === logFilter;
    const matchesSearch =
      !searchQuery ||
      log.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.fromEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.fromName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesOutcome && matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="p-12 text-center text-xs text-[#8e918f]">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#8ab4f8]" />
        Loading Recruiter Email Scanner...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-5 rounded-2xl bg-[#1e1f20] border border-[#282a2c]">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-[#8ab4f8] border border-blue-500/20 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-[#f2f2f2] tracking-tight">
                Recruiter Email Sync & Deep Historical Back-Scanner
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/10 text-[#8ab4f8] border border-blue-500/20">
                Direct IMAP / 0 Tokens
              </span>
            </div>
            <p className="text-xs text-[#8e918f] mt-0.5">
              Connect your job-hunt inboxes securely to back-scan up to 1 year of recruiter emails (interviews, assessments, rejections) and replay statuses chronologically on your Kanban board.
            </p>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleQuickSync}
            disabled={isSyncing || (emailSettings?.accounts.length || 0) === 0}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#282a2c] hover:bg-[#323438] text-xs font-medium text-[#f2f2f2] border border-[#3a3d40] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#8ab4f8] ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Scanning Inbox..." : "Quick Sync (Past 7d)"}</span>
          </button>

          {(emailSettings?.accounts.length || 0) < 3 && (
            <button
              type="button"
              onClick={() => {
                setActiveModal("add_account");
                setTestResult(null);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#8ab4f8] hover:bg-[#a8c7fa] text-xs font-semibold text-[#131314] transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect Inbox Account</span>
            </button>
          )}
        </div>
      </div>

      {syncStatusMsg && (
        <div
          className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
            syncStatusMsg.type === "success"
              ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-300"
              : syncStatusMsg.type === "error"
              ? "bg-red-950/30 border-red-800/40 text-red-300"
              : "bg-blue-950/30 border-blue-800/40 text-blue-300"
          }`}
        >
          {syncStatusMsg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 leading-relaxed">{syncStatusMsg.text}</div>
          <button
            type="button"
            onClick={() => setSyncStatusMsg(null)}
            className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Configured Accounts & Deep Back-Scan Control Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (5 Cols): Configured Inboxes & Auto-Move Settings */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-[#1e1f20] border border-[#282a2c] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-[#f2f2f2] uppercase tracking-wider">
                  Configured Inboxes ({emailSettings?.accounts.length || 0} / 3)
                </h3>
                <p className="text-[11px] text-[#8e918f]">
                  Authenticated email accounts for recruiter scan
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {emailSettings?.accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="p-3.5 rounded-xl bg-[#131314] border border-[#282a2c] hover:border-[#37393b] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-[#8ab4f8] flex items-center justify-center font-mono text-xs font-bold">
                        @
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#f2f2f2]">{acc.email}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#282a2c] text-[#8e918f] border border-[#37393b]">
                            {acc.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-[#8e918f] mt-0.5">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>IMAP: {acc.imapHost || "imap.gmail.com"}:{acc.imapPort || 993}</span>
                          <span>•</span>
                          <span>{acc.hasPassword ? "Password Saved" : "No Password"}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteAccount(acc.id)}
                      className="p-1.5 rounded-lg text-[#8e918f] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Unlink this email account"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {(!emailSettings?.accounts || emailSettings.accounts.length === 0) && (
                <div className="p-8 text-center text-xs text-[#8e918f] bg-[#131314] rounded-xl border border-dashed border-[#282a2c] space-y-3">
                  <Inbox className="w-6 h-6 mx-auto text-[#5f6368]" />
                  <p className="font-medium text-[#c4c7c5]">No email inboxes configured</p>
                  <p className="text-[11px] text-[#8e918f] max-w-xs mx-auto">
                    Click "Connect Inbox Account" to link your job-hunt email (Gmail, Outlook, or IMAP).
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveModal("add_account")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#8ab4f8] text-[#131314] hover:bg-[#aecbfa] transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add First Inbox</span>
                  </button>
                </div>
              )}
            </div>

            {/* Kanban Card Auto-Advance Rules */}
            <div className="pt-2 border-t border-[#282a2c] space-y-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#131314] border border-[#282a2c]">
                <div>
                  <div className="text-xs font-semibold text-[#f2f2f2]">Auto-Advance Kanban Columns</div>
                  <div className="text-[10px] text-[#8e918f]">
                    Move to Active on Interview / Assessment, Closed on Rejection
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleAutoMove}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                    emailSettings?.autoMoveKanban ? "bg-[#8ab4f8]" : "bg-[#282a2c]"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      emailSettings?.autoMoveKanban ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (7 Cols): Deep Historical Back-Scanner Studio */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-2xl bg-[#1e1f20] border border-[#282a2c] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#8ab4f8]" />
                <h3 className="text-xs font-semibold text-[#f2f2f2] uppercase tracking-wider">
                  Deep Historical Back-Scanner (Up to 1 Year)
                </h3>
              </div>
              <span className="text-[11px] font-mono text-[#8ab4f8] bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                Custom Timeline
              </span>
            </div>

            <p className="text-xs text-[#8e918f]">
              Scan your past sent & received messages over custom timeframes to automatically reconcile and update your job application board with past interview invites and rejection notices.
            </p>

            {/* Timeframe selector pills */}
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-[#c4c7c5] block">
                Select Historical Time Window:
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { id: "7d", label: "7 Days" },
                  { id: "30d", label: "30 Days" },
                  { id: "90d", label: "3 Months" },
                  { id: "180d", label: "6 Months" },
                  { id: "365d", label: "1 Year" },
                  { id: "custom", label: "Custom Range" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setBackScanTimeframe(t.id as BackScanTimeframe)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer text-center ${
                      backScanTimeframe === t.id
                        ? "bg-[#8ab4f8]/15 border-[#8ab4f8] text-[#8ab4f8] font-semibold"
                        : "bg-[#131314] border-[#282a2c] text-[#8e918f] hover:text-[#f2f2f2] hover:bg-[#1a1b1c]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Pickers if 'custom' selected */}
            {backScanTimeframe === "custom" && (
              <div className="p-3.5 rounded-xl bg-[#131314] border border-[#282a2c] grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#8e918f] block mb-1">From Date (Start):</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#1e1f20] border border-[#282a2c] text-xs text-[#f2f2f2] focus:outline-none focus:border-[#8ab4f8]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#8e918f] block mb-1">To Date (End):</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#1e1f20] border border-[#282a2c] text-xs text-[#f2f2f2] focus:outline-none focus:border-[#8ab4f8]"
                  />
                </div>
              </div>
            )}

            {/* Target Account & Execution Flags */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-medium text-[#c4c7c5] block mb-1">
                  Target Account:
                </label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#131314] border border-[#282a2c] text-xs text-[#e3e3e3] focus:outline-none focus:border-[#8ab4f8]"
                >
                  <option value="all">All Linked Inboxes ({emailSettings?.accounts.length || 0})</option>
                  {emailSettings?.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.email} ({a.label})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-[#c4c7c5] block mb-1">
                  Execution Mode:
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <label className="flex items-center gap-1.5 text-xs text-[#8e918f] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={backScanDryRun}
                      onChange={(e) => setBackScanDryRun(e.target.checked)}
                      className="rounded border-[#3a3d40] text-[#8ab4f8] focus:ring-0"
                    />
                    <span>Dry Run (Preview Log Only)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Launch Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleRunBackScan}
                disabled={isBackScanning || (emailSettings?.accounts.length || 0) === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#8ab4f8] hover:bg-[#aecbfa] text-xs font-semibold text-[#131314] transition-colors cursor-pointer disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${isBackScanning ? "animate-spin" : ""}`} />
                <span>
                  {isBackScanning
                    ? "Searching Historical Inboxes & Classifying..."
                    : `Execute Historical Back-Scan (${backScanTimeframe.toUpperCase()})`}
                </span>
              </button>
            </div>

            {/* Executive Summary Card if Available */}
            {backScanSummary && (
              <div className="p-4 rounded-xl bg-[#131314] border border-[#282a2c] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#f2f2f2]">
                    Latest Back-Scan Results ({backScanSummary.timeframeDescription})
                  </span>
                  <span className="text-[10px] font-mono text-[#8e918f]">
                    {new Date(backScanSummary.dateRange.from).toLocaleDateString()} – {new Date(backScanSummary.dateRange.to).toLocaleDateString()}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-[#1e1f20] border border-[#282a2c]">
                    <div className="text-base font-bold text-[#f2f2f2]">{backScanSummary.totalScanned}</div>
                    <div className="text-[10px] text-[#8e918f]">Emails Scanned</div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#1e1f20] border border-[#282a2c]">
                    <div className="text-base font-bold text-[#8ab4f8]">{backScanSummary.matchedRecruiterEmails}</div>
                    <div className="text-[10px] text-[#8e918f]">Recruiter Matches</div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#1e1f20] border border-[#282a2c]">
                    <div className="text-base font-bold text-emerald-400">{backScanSummary.cardsUpdated}</div>
                    <div className="text-[10px] text-[#8e918f]">
                      {backScanSummary.dryRun ? "Cards Detected (Dry)" : "Cards Advanced"}
                    </div>
                  </div>
                </div>

                {backScanSummary.errors && backScanSummary.errors.length > 0 && (
                  <div className="text-[11px] text-amber-400 bg-amber-950/20 p-2 rounded-lg border border-amber-800/30">
                    Warning: {backScanSummary.errors.join("; ")}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recruiter Email Feedback Audit Log Table */}
      <div className="p-5 rounded-2xl bg-[#1e1f20] border border-[#282a2c] space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-[#f2f2f2] uppercase tracking-wider">
                Scanned Recruiter Feedback Activity Log ({filteredLogs.length})
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Non-AI Smart Filtered
              </span>
            </div>
            <p className="text-[11px] text-[#8e918f] mt-0.5">
              Strictly analyzing genuine recruiter correspondence & application receipts (e.g. Siemens, Greenhouse, Lever, Workday, Ashby, LinkedIn Easy Apply & InMail). Automated job alert digests, bank alerts, security OTPs, and promotional newsletters are automatically skipped.
            </p>
          </div>

          {/* Filters & Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Search company or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#131314] border border-[#282a2c] text-xs text-[#e3e3e3] placeholder-[#5f6368] focus:outline-none focus:border-[#8ab4f8]"
            />

            <select
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#131314] border border-[#282a2c] text-xs text-[#e3e3e3] focus:outline-none focus:border-[#8ab4f8]"
            >
              <option value="all">All Outcomes</option>
              <option value="interview">Interview Invitations</option>
              <option value="assessment">Technical Assessments</option>
              <option value="offer">Job Offers</option>
              <option value="rejection">Rejections</option>
              <option value="acknowledgement">Application Receipts</option>
            </select>

            {(emailSettings?.logs?.length || 0) > 0 && (
              <button
                type="button"
                onClick={handleClearLogs}
                disabled={isClearingLogs}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                  confirmClearAll
                    ? "bg-red-600 text-white border-red-500 shadow-lg shadow-red-500/20 animate-pulse"
                    : "text-[#8e918f] hover:text-red-400 hover:bg-red-500/10 border-[#282a2c]"
                }`}
                title={confirmClearAll ? "Click again to confirm clearing all logs" : "Clear all scanned activity logs"}
              >
                {isClearingLogs ? "Clearing..." : confirmClearAll ? "Confirm Clear All?" : "Clear All Logs"}
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto border border-[#282a2c] rounded-xl bg-[#131314]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#18191a] border-b border-[#282a2c] text-[#8e918f] text-[11px]">
                <th className="py-2.5 px-3.5">Date & Sender</th>
                <th className="py-2.5 px-3.5">Subject & Snippet</th>
                <th className="py-2.5 px-3.5">Detected Company</th>
                <th className="py-2.5 px-3.5">Classification</th>
                <th className="py-2.5 px-3.5">Action Taken</th>
                <th className="py-2.5 px-3.5 text-right">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#282a2c]/60">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#1e1f20] transition-colors group">
                  <td className="py-3 px-3.5 align-top whitespace-nowrap">
                    <div className="font-medium text-[#f2f2f2]">{log.fromName}</div>
                    <div className="text-[10px] text-[#8e918f] font-mono">{log.fromEmail}</div>
                    <div className="text-[9px] text-[#5f6368] mt-0.5">
                      {new Date(log.date).toLocaleDateString()} {new Date(log.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </td>

                  <td className="py-3 px-3.5 align-top max-w-sm">
                    <div className="font-medium text-[#f2f2f2] truncate">{log.subject}</div>
                    <p className="text-[11px] text-[#8e918f] line-clamp-2 mt-0.5">
                      {log.snippet}
                    </p>
                  </td>

                  <td className="py-3 px-3.5 align-top whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-lg bg-[#282a2c] text-[#f2f2f2] font-medium border border-[#37393b]">
                      {log.company}
                    </span>
                    <div className="text-[10px] text-[#8e918f] mt-1">{log.role}</div>
                  </td>

                  <td className="py-3 px-3.5 align-top whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        log.detectedOutcome === "interview"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : log.detectedOutcome === "offer"
                          ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          : log.detectedOutcome === "assessment"
                          ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                          : log.detectedOutcome === "rejection"
                          ? "bg-red-500/10 text-red-400 border border-red-500/20"
                          : "bg-blue-500/10 text-[#8ab4f8] border border-blue-500/20"
                      }`}
                    >
                      {log.detectedOutcome}
                    </span>
                    <div className="text-[10px] text-[#8e918f] mt-1">
                      {log.analysisExplanation}
                    </div>
                  </td>

                  <td className="py-3 px-3.5 align-top whitespace-nowrap">
                    {log.actionTaken === "created_card" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        Created on Board
                      </span>
                    ) : log.actionTaken === "moved_kanban" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-indigo-300 font-medium px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                        <Check className="w-3.5 h-3.5 text-indigo-400" />
                        Moved to {log.newStatus?.toUpperCase()}
                      </span>
                    ) : log.actionTaken === "synced_feedback" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-blue-300 font-medium px-2 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <Check className="w-3.5 h-3.5 text-blue-400" />
                        Synced to Board
                      </span>
                    ) : log.actionTaken === "logged_only" ? (
                      <span className="text-[11px] text-[#8e918f] px-2 py-0.5 rounded-lg bg-[#282a2c]">Logged Only</span>
                    ) : (
                      <span className="text-[11px] text-[#5f6368]">— No Match</span>
                    )}
                  </td>

                  <td className="py-3 px-3.5 align-top text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleDeleteSingleLog(log.id)}
                      className="p-1.5 rounded-lg text-[#8e918f] hover:text-red-400 hover:bg-red-500/10 opacity-70 group-hover:opacity-100 transition-all cursor-pointer"
                      title="Delete this listed email log entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#8e918f]">
                    No recruiter feedback emails detected for this filter. Run a historical back-scan above to populate data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Connect Real Inbox Account */}
      {activeModal === "add_account" && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#1e1f20] border border-[#282a2c] rounded-2xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-[#8ab4f8]" />
                <h3 className="text-sm font-semibold text-[#f2f2f2]">
                  Connect Email Account & App Password
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  setTestResult(null);
                }}
                className="text-[#8e918f] hover:text-[#f2f2f2] text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-blue-950/20 border border-blue-800/30 rounded-xl text-xs text-[#8ab4f8] flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                For Gmail: Generate a 16-character <strong>App Password</strong> in Google Account Security Settings (Security → 2-Step Verification → App Passwords). This allows secure read-only IMAP scanning.
              </div>
            </div>

            <form onSubmit={handleAddAccount} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-medium text-[#c4c7c5] block mb-1">
                  Mail Provider:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleProviderChange("gmail_oauth")}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer text-center ${
                      newProvider === "gmail_oauth"
                        ? "bg-[#8ab4f8]/15 border-[#8ab4f8] text-[#8ab4f8] font-semibold"
                        : "bg-[#131314] border-[#282a2c] text-[#8e918f]"
                    }`}
                  >
                    Google / Gmail (IMAP)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProviderChange("imap")}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer text-center ${
                      newProvider === "imap"
                        ? "bg-[#8ab4f8]/15 border-[#8ab4f8] text-[#8ab4f8] font-semibold"
                        : "bg-[#131314] border-[#282a2c] text-[#8e918f]"
                    }`}
                  >
                    Outlook / Custom IMAP
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-[#c4c7c5] block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. yourname@gmail.com"
                  className="w-full px-3 py-2 rounded-xl bg-[#131314] border border-[#282a2c] text-xs text-[#e3e3e3] placeholder-[#5f6368] focus:outline-none focus:border-[#8ab4f8]"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-[#c4c7c5] block mb-1">
                  App Password / Secret
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="16-character App Password (e.g. abcd efgh ijkl mnop)"
                  className="w-full px-3 py-2 rounded-xl bg-[#131314] border border-[#282a2c] text-xs text-[#e3e3e3] placeholder-[#5f6368] focus:outline-none focus:border-[#8ab4f8]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[11px] font-medium text-[#c4c7c5] block mb-1">
                    IMAP Host
                  </label>
                  <input
                    type="text"
                    value={imapHost}
                    onChange={(e) => setImapHost(e.target.value)}
                    placeholder="imap.gmail.com"
                    className="w-full px-3 py-2 rounded-xl bg-[#131314] border border-[#282a2c] text-xs text-[#e3e3e3] focus:outline-none focus:border-[#8ab4f8]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[#c4c7c5] block mb-1">
                    Port
                  </label>
                  <input
                    type="text"
                    value={imapPort}
                    onChange={(e) => setImapPort(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#131314] border border-[#282a2c] text-xs text-[#e3e3e3] focus:outline-none focus:border-[#8ab4f8]"
                  />
                </div>
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                    testResult.success
                      ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-300"
                      : "bg-red-950/30 border-red-800/40 text-red-300"
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="leading-relaxed">{testResult.message}</div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestingConn}
                  className="px-3 py-2 rounded-xl text-xs font-medium bg-[#282a2c] hover:bg-[#323438] text-[#f2f2f2] border border-[#3a3d40] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isTestingConn ? "Testing..." : "Test Connection"}
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(null);
                      setTestResult(null);
                    }}
                    className="px-3 py-2 rounded-xl text-xs text-[#8e918f] hover:bg-[#282a2c] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#8ab4f8] text-[#131314] hover:bg-[#aecbfa] transition-colors cursor-pointer"
                  >
                    Save & Authenticate
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
