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
} from "lucide-react";
import { ApplicationRecord, ApplicationStatus } from "../types";

interface KanbanTabProps {
  applications: ApplicationRecord[];
  onStatusChange: (id: string, newStatus: ApplicationStatus) => void;
  onDeleteApplication: (id: string) => void;
  onAddApplication: (app: Partial<ApplicationRecord>) => void;
  onSelectApplication: (app: ApplicationRecord) => void;
}

const COLUMNS: { id: ApplicationStatus; label: string; dotColor: string }[] = [
  { id: "scraped", label: "Saved Jobs", dotColor: "bg-slate-400" },
  { id: "tailored", label: "AI Tailored", dotColor: "bg-[var(--accent)]" },
  { id: "applied", label: "Applied", dotColor: "bg-[var(--warning)]" },
  { id: "active", label: "Interviewing", dotColor: "bg-[var(--success)]" },
  { id: "closed", label: "Archived", dotColor: "bg-[var(--error)]" },
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

  // New Application Form State
  const [newCompany, setNewCompany] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newStatus, setNewStatus] = useState<ApplicationStatus>("scraped");

  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      app.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.role.toLowerCase().includes(searchTerm.toLowerCase());
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
    });
    setNewCompany("");
    setNewRole("");
    setNewUrl("");
    setIsAddModalOpen(false);
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
                Application Tracker
              </h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
              Organize, review generated LaTeX documents, and track pipeline status for every application.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="bg-[var(--accent)] hover:opacity-90 text-white font-medium text-xs px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Job</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="mt-4 pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search companies, roles, or skills..."
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
              className="bg-[var(--background)] border border-[var(--border)] text-[var(--text-primary)] text-xs rounded-xl px-3 py-2 focus:outline-none"
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
                  colApps.map((app) => (
                    <div
                      key={app.id}
                      className="bg-[var(--background)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl p-3 shadow-xs transition-all space-y-2 cursor-pointer group"
                      onClick={() => onSelectApplication(app)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
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
                          className="text-[var(--text-muted)] hover:text-[var(--error)] p-1 rounded transition opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Metadata tags */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--text-muted)] pt-1">
                        {app.date_scraped && (
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3" />
                            {app.date_scraped}
                          </span>
                        )}
                        {app.pass_data && (
                          <span className="flex items-center gap-1 text-[var(--accent)] font-medium bg-[var(--accent-subtle)] px-1.5 py-0.5 rounded font-mono">
                            <FileText className="w-3 h-3" /> LaTeX
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
                          className="bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] text-[10px] rounded-lg px-2 py-1 font-medium focus:outline-none"
                        >
                          {COLUMNS.map((c) => (
                            <option key={c.id} value={c.id}>
                              → {c.label}
                            </option>
                          ))}
                        </select>

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
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Add Job Manually */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Plus className="w-4 h-4 text-[var(--accent)]" />
                Add Job to Application Board
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm"
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
                  placeholder="e.g. Stripe, Siemens, BMW"
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
                  Initial Stage
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as ApplicationStatus)}
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
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
