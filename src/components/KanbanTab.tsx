import React, { useState } from "react";
import {
  Search,
  Plus,
  Trash2,
  ExternalLink,
  Calendar,
  Filter,
  FileText,
  Building2,
  Briefcase,
  Link as LinkIcon,
  Kanban,
  Clock,
  CheckCircle2,
  Mail,
  Sparkles,
  Info,
  ChevronRight,
  Send,
  UserCheck,
  X,
} from "lucide-react";
import { ApplicationRecord, ApplicationStatus } from "../types";

interface KanbanTabProps {
  applications: ApplicationRecord[];
  onStatusChange: (id: string, newStatus: ApplicationStatus) => void;
  onDeleteApplication: (id: string) => void;
  onAddApplication: (app: Partial<ApplicationRecord>) => void;
  onSelectApplication: (app: ApplicationRecord) => void;
}

const COLUMNS: { id: ApplicationStatus; label: string; dotColor: string; badgeBg: string }[] = [
  { id: "scraped", label: "Saved Jobs", dotColor: "bg-slate-400", badgeBg: "bg-slate-500/10 text-slate-400" },
  { id: "tailored", label: "AI Tailored", dotColor: "bg-[var(--accent)]", badgeBg: "bg-[var(--accent-subtle)] text-[var(--accent)]" },
  { id: "applied", label: "Applied", dotColor: "bg-amber-400", badgeBg: "bg-amber-500/10 text-amber-400" },
  { id: "active", label: "Interviewing", dotColor: "bg-emerald-400", badgeBg: "bg-emerald-500/10 text-emerald-400" },
  { id: "closed", label: "Archived", dotColor: "bg-rose-400", badgeBg: "bg-rose-500/10 text-rose-400" },
];

export function KanbanTab({
  applications,
  onStatusChange,
  onDeleteApplication,
  onAddApplication,
  onSelectApplication,
}: KanbanTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCardDetail, setSelectedCardDetail] = useState<ApplicationRecord | null>(null);

  // New Application Form State
  const [newCompany, setNewCompany] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newDateApplied, setNewDateApplied] = useState(new Date().toISOString().split("T")[0]);
  const [newStatus, setNewStatus] = useState<ApplicationStatus>("applied");

  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      app.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (app.notes && app.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === "all" || app.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleCreateApplication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany || !newRole) return;
    onAddApplication({
      company: newCompany,
      role: newRole,
      url: newUrl,
      status: newStatus,
      date_scraped: new Date().toISOString().split("T")[0],
      date_applied: newDateApplied || new Date().toISOString().split("T")[0],
      notes: `Manually added to board on ${new Date().toLocaleDateString()}`,
    });
    setNewCompany("");
    setNewRole("");
    setNewUrl("");
    setNewDateApplied(new Date().toISOString().split("T")[0]);
    setIsAddModalOpen(false);
  };

  const calculateDaysSince = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "1 day ago";
      return `${diffDays} days ago`;
    } catch {
      return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Controls & Analytics */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)]">
                <Kanban className="w-4 h-4" />
              </span>
              <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                Application Pipeline & Timeline
              </h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
              Track dates, view application timelines, and auto-sync status updates from recruiter emails. Click any tile to inspect full timeline & details.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="bg-[var(--accent)] hover:opacity-90 text-white font-medium text-xs px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Application</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-4 pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search companies, job roles, or email feedback..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl pl-9 pr-4 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[var(--background)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
            >
              <option value="all">All Stages ({applications.length})</option>
              {COLUMNS.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.label} ({applications.filter((a) => a.status === col.id).length})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {COLUMNS.map((column) => {
          const colApps = filteredApps.filter((app) => app.status === column.id);

          return (
            <div
              key={column.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3 flex flex-col min-h-[500px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-2 py-1.5 mb-2 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${column.dotColor}`} />
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{column.label}</span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--background)] text-[var(--text-muted)]">
                  {colApps.length}
                </span>
              </div>

              {/* Application Cards List */}
              <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[600px] p-1">
                {colApps.length === 0 ? (
                  <div className="h-32 border-2 border-dashed border-[var(--border)] rounded-xl flex items-center justify-center text-[11px] text-[var(--text-muted)] text-center p-3">
                    No applications
                  </div>
                ) : (
                  colApps.map((app) => {
                    const daysAgo = calculateDaysSince(app.date_applied || app.date_scraped);
                    return (
                      <div
                        key={app.id}
                        className="bg-[var(--background)] hover:bg-[var(--surface-hover)] border border-[var(--border)] hover:border-[var(--accent)] rounded-xl p-3.5 shadow-xs transition-all space-y-2.5 cursor-pointer group relative"
                        onClick={() => setSelectedCardDetail(app)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5 pr-4">
                            <h4 className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition line-clamp-1">
                              {app.company}
                            </h4>
                            <p className="text-[11px] text-[var(--text-secondary)] line-clamp-1">{app.role}</p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteApplication(app.id);
                            }}
                            className="text-[var(--text-muted)] hover:text-rose-400 p-1 rounded transition opacity-0 group-hover:opacity-100"
                            title="Delete Card"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Timeline & Date Applied Badge */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          {app.date_applied ? (
                            <span className="flex items-center gap-1 font-mono font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                              <Calendar className="w-3 h-3 text-emerald-400" />
                              Applied: {app.date_applied}
                            </span>
                          ) : app.date_scraped ? (
                            <span className="flex items-center gap-1 font-mono text-[var(--text-muted)] bg-[var(--surface)] px-2 py-0.5 rounded-md">
                              <Clock className="w-3 h-3" />
                              Added: {app.date_scraped}
                            </span>
                          ) : null}

                          {daysAgo && (
                            <span className="text-[9px] text-[var(--text-muted)] font-mono">
                              ({daysAgo})
                            </span>
                          )}
                        </div>

                        {/* Email Feedback Snippet (if synced from inbox) */}
                        {app.last_email_feedback && (
                          <div className="text-[10px] text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg p-1.5 flex items-start gap-1.5">
                            <Mail className="w-3 h-3 text-[var(--accent)] shrink-0 mt-0.5" />
                            <span className="line-clamp-1 italic">{app.last_email_feedback}</span>
                          </div>
                        )}

                        {/* Metadata tags */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                          {app.source && (
                            <span className="text-[9px] bg-[var(--surface)] border border-[var(--border)] px-1.5 py-0.5 rounded text-[var(--text-muted)]">
                              {app.source}
                            </span>
                          )}
                          {app.pass_data && (
                            <span className="flex items-center gap-1 text-[var(--accent)] font-medium bg-[var(--accent-subtle)] px-1.5 py-0.5 rounded font-mono text-[9px]">
                              <FileText className="w-2.5 h-2.5" /> LaTeX
                            </span>
                          )}
                        </div>

                        {/* Status Selector Dropdown inside card */}
                        <div
                          className="pt-2 border-t border-[var(--border)] flex items-center justify-between"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <select
                            value={app.status}
                            onChange={(e) => onStatusChange(app.id, e.target.value as ApplicationStatus)}
                            className="bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] text-[10px] rounded-lg px-2 py-1 font-medium focus:outline-none cursor-pointer"
                          >
                            {COLUMNS.map((c) => (
                              <option key={c.id} value={c.id}>
                                → {c.label}
                              </option>
                            ))}
                          </select>

                          <div className="flex items-center gap-1">
                            {app.pass_data && (
                              <button
                                type="button"
                                onClick={() => onSelectApplication(app)}
                                className="text-[var(--accent)] hover:underline text-[10px] font-medium flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[var(--accent-subtle)]"
                                title="Open LaTeX Preview"
                              >
                                View PDF
                              </button>
                            )}

                            {app.url && (
                              <a
                                href={app.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"
                                title="Open Job Posting"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Card Details & Complete Timeline View */}
      {selectedCardDetail && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-xl p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-start justify-between border-b border-[var(--border)] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)]">
                    <Building2 className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-[var(--text-primary)]">
                      {selectedCardDetail.company}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] font-medium">
                      {selectedCardDetail.role}
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCardDetail(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Status Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl p-2.5">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase tracking-wider font-semibold">Current Stage</span>
                <span className="text-xs font-bold text-[var(--accent)] capitalize">
                  {selectedCardDetail.status}
                </span>
              </div>

              <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl p-2.5">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase tracking-wider font-semibold">Date Applied</span>
                <span className="text-xs font-bold text-emerald-400 font-mono">
                  {selectedCardDetail.date_applied || selectedCardDetail.date_scraped || "Not recorded"}
                </span>
              </div>

              <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl p-2.5">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase tracking-wider font-semibold">Timeline</span>
                <span className="text-xs font-bold text-[var(--text-primary)] font-mono">
                  {calculateDaysSince(selectedCardDetail.date_applied || selectedCardDetail.date_scraped) || "Active"}
                </span>
              </div>

              <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl p-2.5">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase tracking-wider font-semibold">Source</span>
                <span className="text-xs font-bold text-[var(--text-primary)] line-clamp-1">
                  {selectedCardDetail.source || "Direct Apply"}
                </span>
              </div>
            </div>

            {/* Application Timeline Section */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
                Application Timeline & History
              </h4>
              <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl p-3.5 space-y-3 font-mono text-xs">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <div>
                    <p className="font-semibold">Application Submitted / Registered</p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {selectedCardDetail.date_applied || selectedCardDetail.date_scraped} via {selectedCardDetail.source || "Email"}
                    </p>
                  </div>
                </div>

                {selectedCardDetail.email_synced_at && (
                  <div className="flex items-center gap-2 text-[var(--accent)]">
                    <Mail className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="font-semibold">Inbox Communication Sync</p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Latest sync at {new Date(selectedCardDetail.email_synced_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}

                {selectedCardDetail.last_email_feedback && (
                  <div className="p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[11px] text-[var(--text-secondary)] font-sans">
                    <span className="font-semibold text-[var(--accent)] block font-mono text-[10px] mb-0.5">LATEST RECRUITER FEEDBACK:</span>
                    {selectedCardDetail.last_email_feedback}
                  </div>
                )}
              </div>
            </div>

            {/* Notes & Logs */}
            {selectedCardDetail.notes && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Activity Log & Notes
                </h4>
                <div className="bg-[var(--background)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--text-secondary)] whitespace-pre-line leading-relaxed max-h-36 overflow-y-auto">
                  {selectedCardDetail.notes}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
              <div className="flex items-center gap-2">
                {selectedCardDetail.url && (
                  <a
                    href={selectedCardDetail.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl text-xs bg-[var(--background)] border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--accent)] flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Posting
                  </a>
                )}
                {selectedCardDetail.pass_data && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectApplication(selectedCardDetail);
                      setSelectedCardDetail(null);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs bg-[var(--accent)] text-white font-medium hover:opacity-90 flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Open Documents
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedCardDetail(null)}
                className="px-4 py-1.5 rounded-xl text-xs bg-[var(--background)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Job Manually */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Plus className="w-4 h-4 text-[var(--accent)]" />
                Add Application to Pipeline Board
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateApplication} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="e.g. Siemens, Stripe, BMW"
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Role / Title *
                </label>
                <input
                  type="text"
                  required
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="e.g. Senior Software Engineer"
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  Date Applied *
                </label>
                <input
                  type="date"
                  required
                  value={newDateApplied}
                  onChange={(e) => setNewDateApplied(e.target.value)}
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Job URL (Optional)
                </label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  Pipeline Stage
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as ApplicationStatus)}
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none cursor-pointer"
                >
                  {COLUMNS.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs bg-[var(--accent)] hover:opacity-90 text-white font-semibold cursor-pointer shadow-sm"
                >
                  Save Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
