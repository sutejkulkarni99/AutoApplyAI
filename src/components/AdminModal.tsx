import React, { useState, useEffect } from "react";
import {
  Shield,
  UserPlus,
  Key,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Users,
  Briefcase,
  FileCheck,
  Cpu,
  Terminal,
  Activity,
  RefreshCw,
  Clock,
  HardDrive,
  Filter,
} from "lucide-react";
import { AdminUserSummary, SystemLogEntry, SystemDiagnostics } from "../types";

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

export function AdminModal({ isOpen, onClose, token }: AdminModalProps) {
  const [activeAdminTab, setActiveAdminTab] = useState<"users" | "logs" | "diagnostics">("users");

  // Users state
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New user form state
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");

  // Reset password state
  const [resetTargetUser, setResetTargetUser] = useState<AdminUserSummary | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState("");

  // Logs state
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logSourceFilter, setLogSourceFilter] = useState<string>("all");
  const [logLevelFilter, setLogLevelFilter] = useState<string>("all");
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(false);

  // Diagnostics state
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (activeAdminTab === "users") {
        fetchUsers();
      } else if (activeAdminTab === "logs") {
        fetchLogs();
      } else if (activeAdminTab === "diagnostics") {
        fetchDiagnostics();
      }
    }
  }, [isOpen, activeAdminTab]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isOpen && activeAdminTab === "logs" && autoRefreshLogs) {
      interval = setInterval(() => {
        fetchLogs(true);
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, activeAdminTab, autoRefreshLogs, logSourceFilter, logLevelFilter]);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load user list");
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchLogs = async (silent = false) => {
    if (!silent) setIsLoadingLogs(true);
    try {
      const params = new URLSearchParams();
      if (logSourceFilter !== "all") params.append("source", logSourceFilter);
      if (logLevelFilter !== "all") params.append("level", logLevelFilter);

      const res = await fetch(`/api/admin/system-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.logs) {
        setLogs(data.logs);
      }
    } catch (err: any) {
      console.error("Failed to fetch logs:", err);
    } finally {
      if (!silent) setIsLoadingLogs(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm("Are you sure you want to clear in-memory system logs?")) return;
    try {
      const res = await fetch("/api/admin/system-logs/clear", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setLogs([]);
        setSuccess("System logs cleared.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to clear logs");
    }
  };

  const fetchDiagnostics = async () => {
    setIsLoadingDiagnostics(true);
    try {
      const res = await fetch("/api/admin/system-diagnostics", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.diagnostics) {
        setDiagnostics(data.diagnostics);
      }
    } catch (err: any) {
      console.error("Failed to fetch diagnostics:", err);
    } finally {
      setIsLoadingDiagnostics(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: newRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");

      setSuccess(`User '${newUsername}' created successfully.`);
      setNewUsername("");
      setNewPassword("");
      setNewRole("user");
      setIsCreatingUser(false);
      await fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;

    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/admin/users/${resetTargetUser.id}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword: resetPasswordVal }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");

      setSuccess(`Password for '${resetTargetUser.username}' updated.`);
      setResetTargetUser(null);
      setResetPasswordVal("");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (user: AdminUserSummary) => {
    if (!confirm(`Are you sure you want to delete user '${user.username}' and all their stored files?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user");

      setSuccess(`User '${user.username}' removed.`);
      await fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#1e1f20] border border-[#282a2c] text-[#e3e3e3] rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#282a2c] flex items-center justify-between bg-[#131314]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#f2f2f2] flex items-center gap-2">
                Administration Console
              </h2>
              <p className="text-[11px] text-[#8e918f]">
                Homelab user management, system debug logs, and server diagnostics.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8e918f] hover:text-[#f2f2f2] p-1.5 rounded-lg hover:bg-[#282a2c] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 py-2 bg-[#18191a] border-b border-[#282a2c] flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveAdminTab("users")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeAdminTab === "users"
                ? "bg-[#282a2c] text-[#f2f2f2] border border-[#3a3d40]"
                : "text-[#8e918f] hover:text-[#e3e3e3] hover:bg-[#1e1f20]"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Users & Access ({users.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveAdminTab("logs")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeAdminTab === "logs"
                ? "bg-[#282a2c] text-[#f2f2f2] border border-[#3a3d40]"
                : "text-[#8e918f] hover:text-[#e3e3e3] hover:bg-[#1e1f20]"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>System Logs & Debugger</span>
            {logs.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/20 text-[#8ab4f8]">
                {logs.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveAdminTab("diagnostics")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeAdminTab === "diagnostics"
                ? "bg-[#282a2c] text-[#f2f2f2] border border-[#3a3d40]"
                : "text-[#8e918f] hover:text-[#e3e3e3] hover:bg-[#1e1f20]"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Diagnostics</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          {error && (
            <div className="p-3 bg-red-950/30 border border-red-800/50 rounded-xl flex items-center gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-950/30 border border-emerald-800/50 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* TAB 1: USERS */}
          {activeAdminTab === "users" && (
            <div className="space-y-4">
              {/* Action Bar */}
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-[#8e918f] uppercase tracking-wider">
                  Registered Accounts
                </div>
                {!isCreatingUser && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingUser(true)}
                    className="bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#131314] text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Create User</span>
                  </button>
                )}
              </div>

              {/* Create User Sub-Form */}
              {isCreatingUser && (
                <form
                  onSubmit={handleCreateUser}
                  className="bg-[#131314] border border-[#282a2c] p-4 rounded-xl space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-[#282a2c] pb-2">
                    <span className="text-xs font-semibold text-[#f2f2f2] flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5 text-[#8ab4f8]" />
                      New Account Provisioning
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingUser(false)}
                      className="text-xs text-[#8e918f] hover:text-[#f2f2f2] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-[#8e918f] mb-1">Username</label>
                      <input
                        type="text"
                        required
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="e.g. candidate"
                        className="w-full bg-[#1e1f20] border border-[#282a2c] rounded-lg px-3 py-1.5 text-xs text-[#e3e3e3] placeholder-[#5f6368] focus:outline-none focus:border-[#8ab4f8]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-[#8e918f] mb-1">Password</label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full bg-[#1e1f20] border border-[#282a2c] rounded-lg px-3 py-1.5 text-xs text-[#e3e3e3] placeholder-[#5f6368] focus:outline-none focus:border-[#8ab4f8]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-[#8e918f] mb-1">Role</label>
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as "user" | "admin")}
                        className="w-full bg-[#1e1f20] border border-[#282a2c] rounded-lg px-3 py-1.5 text-xs text-[#e3e3e3] focus:outline-none focus:border-[#8ab4f8]"
                      >
                        <option value="user">Standard User</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#131314] text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      Save Account
                    </button>
                  </div>
                </form>
              )}

              {/* Reset Password Sub-Form */}
              {resetTargetUser && (
                <form
                  onSubmit={handleResetPassword}
                  className="bg-[#131314] border border-amber-500/30 p-4 rounded-xl space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-[#282a2c] pb-2">
                    <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      Reset Password for '{resetTargetUser.username}'
                    </span>
                    <button
                      type="button"
                      onClick={() => setResetTargetUser(null)}
                      className="text-xs text-[#8e918f] hover:text-[#f2f2f2] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="password"
                      required
                      value={resetPasswordVal}
                      onChange={(e) => setResetPasswordVal(e.target.value)}
                      placeholder="Enter new password (min 6 chars)"
                      className="flex-1 bg-[#1e1f20] border border-[#282a2c] rounded-lg px-3 py-1.5 text-xs text-[#e3e3e3] placeholder-[#5f6368] focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="submit"
                      className="bg-amber-500 hover:bg-amber-400 text-[#131314] text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      Confirm Reset
                    </button>
                  </div>
                </form>
              )}

              {/* Users Table */}
              <div className="border border-[#282a2c] rounded-xl overflow-hidden bg-[#131314]">
                {isLoadingUsers ? (
                  <div className="p-8 text-center text-xs text-[#8e918f]">Loading accounts...</div>
                ) : users.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#8e918f]">No users found.</div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#18191a] border-b border-[#282a2c] text-[#f2f2f2] font-semibold">
                        <th className="py-2.5 px-3.5">Username</th>
                        <th className="py-2.5 px-3.5">Role</th>
                        <th className="py-2.5 px-3.5">AI Provider</th>
                        <th className="py-2.5 px-3.5">Profile</th>
                        <th className="py-2.5 px-3.5">Saved Jobs</th>
                        <th className="py-2.5 px-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#282a2c] text-[#c4c7c5]">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-[#1e1f20] transition-colors">
                          <td className="py-3 px-3.5 font-medium text-[#f2f2f2] flex items-center gap-2">
                            <span>{u.username}</span>
                            {u.role === "admin" && (
                              <span className="text-[9px] uppercase font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded">
                                Admin
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-[#8e918f] capitalize">{u.role}</td>
                          <td className="py-3 px-3.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#8ab4f8] bg-[#1e1f20] border border-[#282a2c] px-2 py-0.5 rounded">
                              <Cpu className="w-3 h-3" />
                              {u.provider || "gemini"} ({u.ai_model || "gemini-2.5-flash"})
                            </span>
                          </td>
                          <td className="py-3 px-3.5">
                            {u.hasProfile ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px]">
                                <FileCheck className="w-3.5 h-3.5" />
                                Configured
                              </span>
                            ) : (
                              <span className="text-[#8e918f] text-[11px]">Default Seed</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5">
                            <span className="inline-flex items-center gap-1 text-[#c4c7c5] text-[11px]">
                              <Briefcase className="w-3 h-3 text-[#8e918f]" />
                              {u.applicationCount}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right space-x-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setResetTargetUser(u);
                                setResetPasswordVal("");
                              }}
                              title="Reset Password"
                              className="p-1.5 rounded bg-[#1e1f20] hover:bg-amber-500/10 hover:text-amber-400 text-[#8e918f] border border-[#282a2c] transition-colors cursor-pointer"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              title="Delete User"
                              className="p-1.5 rounded bg-[#1e1f20] hover:bg-red-500/10 hover:text-red-400 text-[#8e918f] border border-[#282a2c] transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SYSTEM LOGS & DEBUGGER */}
          {activeAdminTab === "logs" && (
            <div className="space-y-3">
              {/* Controls bar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-[#282a2c]">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Source Filter */}
                  <div className="flex items-center gap-1.5 text-xs text-[#8e918f]">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Source:</span>
                    <select
                      value={logSourceFilter}
                      onChange={(e) => setLogSourceFilter(e.target.value)}
                      className="bg-[#131314] border border-[#282a2c] rounded-lg px-2 py-1 text-xs text-[#e3e3e3] focus:outline-none focus:border-[#8ab4f8]"
                    >
                      <option value="all">All Sources</option>
                      <option value="pipeline">Pipeline</option>
                      <option value="scraper">Job Scraper</option>
                      <option value="latex">LaTeX Engine</option>
                      <option value="auth">Authentication</option>
                      <option value="email">Email Scanner</option>
                      <option value="system">System Core</option>
                    </select>
                  </div>

                  {/* Level Filter */}
                  <div className="flex items-center gap-1.5 text-xs text-[#8e918f]">
                    <span>Level:</span>
                    <select
                      value={logLevelFilter}
                      onChange={(e) => setLogLevelFilter(e.target.value)}
                      className="bg-[#131314] border border-[#282a2c] rounded-lg px-2 py-1 text-xs text-[#e3e3e3] focus:outline-none focus:border-[#8ab4f8]"
                    >
                      <option value="all">All Levels</option>
                      <option value="info">Info</option>
                      <option value="warn">Warn</option>
                      <option value="error">Error</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-[#8e918f] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRefreshLogs}
                      onChange={(e) => setAutoRefreshLogs(e.target.checked)}
                      className="rounded accent-[#8ab4f8]"
                    />
                    <span>Live Auto-Refresh (3s)</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => fetchLogs()}
                    disabled={isLoadingLogs}
                    className="p-1.5 rounded-lg bg-[#131314] border border-[#282a2c] text-[#8e918f] hover:text-[#e3e3e3] hover:bg-[#282a2c] transition-colors cursor-pointer"
                    title="Refresh logs now"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? "animate-spin text-[#8ab4f8]" : ""}`} />
                  </button>

                  <button
                    type="button"
                    onClick={handleClearLogs}
                    className="text-xs px-2.5 py-1 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 hover:bg-red-900/50 transition-colors cursor-pointer"
                  >
                    Clear Logs
                  </button>
                </div>
              </div>

              {/* Logs Console Stream */}
              <div className="bg-[#131314] border border-[#282a2c] rounded-xl font-mono text-xs overflow-hidden">
                <div className="p-2.5 border-b border-[#282a2c] bg-[#18191a] flex items-center justify-between text-[#8e918f] text-[11px]">
                  <span>System Event Stream ({logs.length} entries)</span>
                  <span>In-Memory Ring Buffer</span>
                </div>

                <div className="max-h-96 overflow-y-auto divide-y divide-[#282a2c]/60 p-1 custom-scrollbar">
                  {logs.length === 0 ? (
                    <div className="p-8 text-center text-[#5f6368]">
                      No logs recorded yet for this session.
                    </div>
                  ) : (
                    logs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2 hover:bg-[#1e1f20]/60 transition-colors text-[11px] space-y-1"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[#5f6368] text-[10px]">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>

                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold ${
                              log.level === "error"
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : log.level === "warn"
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                : "bg-blue-500/10 text-[#8ab4f8] border border-blue-500/20"
                            }`}
                          >
                            {log.level}
                          </span>

                          <span className="text-[#8e918f] bg-[#1e1f20] px-1.5 py-0.2 rounded text-[10px]">
                            [{log.source}]
                          </span>

                          {log.durationMs !== undefined && (
                            <span className="text-emerald-400 text-[10px]">
                              {log.durationMs}ms
                            </span>
                          )}

                          <span className="text-[#e3e3e3] font-sans flex-1">
                            {log.message}
                          </span>
                        </div>

                        {log.details && Object.keys(log.details).length > 0 && (
                          <pre className="text-[10px] text-[#8e918f] bg-[#0c0d0e] p-1.5 rounded border border-[#282a2c] overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SERVER DIAGNOSTICS */}
          {activeAdminTab === "diagnostics" && (
            <div className="space-y-4">
              {isLoadingDiagnostics ? (
                <div className="p-8 text-center text-xs text-[#8e918f]">Loading server diagnostics...</div>
              ) : diagnostics ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-[#131314] border border-[#282a2c] space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#f2f2f2]">
                      <Clock className="w-4 h-4 text-[#8ab4f8]" />
                      <span>Runtime Uptime</span>
                    </div>
                    <div className="text-xl font-mono font-bold text-[#8ab4f8]">
                      {Math.floor(diagnostics.uptimeSeconds / 60)}m {Math.floor(diagnostics.uptimeSeconds % 60)}s
                    </div>
                    <p className="text-[11px] text-[#8e918f]">
                      Node Environment: <span className="font-mono text-[#e3e3e3]">{diagnostics.nodeVersion}</span> ({diagnostics.environment})
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#131314] border border-[#282a2c] space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#f2f2f2]">
                      <HardDrive className="w-4 h-4 text-purple-400" />
                      <span>Memory Footprint (RSS)</span>
                    </div>
                    <div className="text-xl font-mono font-bold text-purple-300">
                      {diagnostics.memoryUsageMb.rss} MB
                    </div>
                    <p className="text-[11px] text-[#8e918f]">
                      Heap Used: <span className="font-mono text-[#e3e3e3]">{diagnostics.memoryUsageMb.heapUsed} MB</span> / {diagnostics.memoryUsageMb.heapTotal} MB
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#131314] border border-[#282a2c] space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#f2f2f2]">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span>Total Homelab Users</span>
                    </div>
                    <div className="text-xl font-mono font-bold text-emerald-300">
                      {diagnostics.totalUsers}
                    </div>
                    <p className="text-[11px] text-[#8e918f]">
                      Isolated user home directories mapped under <span className="font-mono text-[#e3e3e3]">/data</span>
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-[#131314] border border-[#282a2c] space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#f2f2f2]">
                      <Briefcase className="w-4 h-4 text-amber-400" />
                      <span>Saved Applications</span>
                    </div>
                    <div className="text-xl font-mono font-bold text-amber-300">
                      {diagnostics.totalApplications}
                    </div>
                    <p className="text-[11px] text-[#8e918f]">
                      Tracked across all user Kanban boards.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-[#8e918f]">
                  No diagnostics available.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#131314] border-t border-[#282a2c] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#282a2c] hover:bg-[#323438] text-[#f2f2f2] border border-[#3a3d40] text-xs font-semibold transition-colors cursor-pointer"
          >
            Close Console
          </button>
        </div>
      </div>
    </div>
  );
}
