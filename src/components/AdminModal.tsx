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
} from "lucide-react";
import { AdminUserSummary } from "../types";

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

export function AdminModal({ isOpen, onClose, token }: AdminModalProps) {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    setIsLoading(true);
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
      setIsLoading(false);
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--background)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                Administrator User Management
                <span className="text-[10px] uppercase font-mono bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded">
                  RBAC Console
                </span>
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Manage homelab accounts, access roles, and isolated user directories.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-3 bg-[var(--error)]/10 border border-[var(--error)]/30 rounded-xl flex items-center gap-2.5 text-xs text-[var(--text-primary)]">
              <AlertCircle className="w-4 h-4 text-[var(--error)] shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-[var(--success)]/10 border border-[var(--success)]/30 rounded-xl flex items-center gap-2.5 text-xs text-[var(--text-primary)]">
              <CheckCircle2 className="w-4 h-4 text-[var(--success)] shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
              <Users className="w-4 h-4 text-[var(--accent)]" />
              <span>Registered Homelab Users ({users.length})</span>
            </div>
            {!isCreatingUser && (
              <button
                type="button"
                onClick={() => setIsCreatingUser(true)}
                className="bg-[var(--accent)] hover:opacity-90 text-white text-xs font-medium px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create New User</span>
              </button>
            )}
          </div>

          {/* Create User Sub-Form */}
          {isCreatingUser && (
            <form
              onSubmit={handleCreateUser}
              className="bg-[var(--background)] border border-[var(--border)] p-4 rounded-xl space-y-3"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-[var(--accent)]" />
                  New Account Provisioning
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreatingUser(false)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. johndoe"
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Temporary Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Role Privilege</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as "user" | "admin")}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="user">Standard User</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="bg-[var(--success)] hover:opacity-90 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Create & Save Account
                </button>
              </div>
            </form>
          )}

          {/* Reset Password Sub-Form */}
          {resetTargetUser && (
            <form
              onSubmit={handleResetPassword}
              className="bg-[var(--background)] border border-amber-500/30 p-4 rounded-xl space-y-3"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-500" />
                  Reset Password for '{resetTargetUser.username}'
                </span>
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
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
                  placeholder="Enter new temporary password (min 6 chars)"
                  className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Confirm Reset
                </button>
              </div>
            </form>
          )}

          {/* Users Table */}
          <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)]">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">Loading accounts...</div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">No users found.</div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[var(--background)] border-b border-[var(--border)] text-[var(--text-primary)] font-semibold">
                    <th className="py-2.5 px-3.5">Username</th>
                    <th className="py-2.5 px-3.5">Role</th>
                    <th className="py-2.5 px-3.5">Active AI Provider</th>
                    <th className="py-2.5 px-3.5">Candidate Profile</th>
                    <th className="py-2.5 px-3.5">Saved Jobs</th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-[var(--text-secondary)]">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="py-3 px-3.5 font-medium text-[var(--text-primary)] flex items-center gap-2">
                        <span>{u.username}</span>
                        {u.role === "admin" && (
                          <span className="text-[9px] uppercase tracking-wider font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded">
                            Admin
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-[var(--text-muted)] capitalize">{u.role}</td>
                      <td className="py-3 px-3.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--accent)] bg-[var(--accent-subtle)] border border-[var(--border)] px-2 py-0.5 rounded">
                          <Cpu className="w-3 h-3" />
                          {u.provider || "gemini"} ({u.ai_model || "3.6-flash"})
                        </span>
                      </td>
                      <td className="py-3 px-3.5">
                        {u.hasProfile ? (
                          <span className="inline-flex items-center gap-1 text-[var(--success)] text-[11px]">
                            <FileCheck className="w-3.5 h-3.5" />
                            Configured
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)] text-[11px]">Default Seed</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        <span className="inline-flex items-center gap-1 text-[var(--text-secondary)] text-[11px]">
                          <Briefcase className="w-3 h-3 text-[var(--text-muted)]" />
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
                          className="p-1.5 rounded bg-[var(--background)] hover:bg-amber-500/10 hover:text-amber-500 text-[var(--text-muted)] border border-[var(--border)] transition-colors cursor-pointer"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u)}
                          title="Delete User"
                          className="p-1.5 rounded bg-[var(--background)] hover:bg-[var(--error)]/10 hover:text-[var(--error)] text-[var(--text-muted)] border border-[var(--border)] transition-colors cursor-pointer"
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

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[var(--background)] border-t border-[var(--border)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] text-xs font-medium transition-colors cursor-pointer"
          >
            Close Console
          </button>
        </div>
      </div>
    </div>
  );
}
