import React, { useState, useEffect } from "react";
import {
  User,
  Upload,
  Save,
  CheckCircle2,
  AlertCircle,
  FileText,
  Briefcase,
  GraduationCap,
  Wrench,
  Code2,
} from "lucide-react";
import { MasterProfile } from "../types";

interface ProfileTabProps {
  token: string;
}

export function ProfileTab({ token }: ProfileTabProps) {
  const [yamlContent, setYamlContent] = useState("");
  const [parsedProfile, setParsedProfile] = useState<MasterProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"summary" | "editor">("summary");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load candidate profile");
      setYamlContent(data.raw_yaml || "");
      setParsedProfile(data.parsed_profile);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveYaml = async (contentToSave: string) => {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(null);

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ raw_yaml: contentToSave }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile");

      setSaveSuccess("Profile YAML validated and saved successfully.");
      setParsedProfile(data.parsed_profile);
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith(".yaml") && !file.name.endsWith(".yml") && !file.name.endsWith(".txt")) {
      setError("Please upload a valid .yaml or .yml file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        setYamlContent(text);
        handleSaveYaml(text);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)]">
                <User className="w-4 h-4" />
              </span>
              <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                Candidate Master Profile
              </h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
              Manage your experience, skills, and education used to generate application documents.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[var(--background)] p-1 rounded-xl border border-[var(--border)]">
            <button
              type="button"
              onClick={() => setActiveSubTab("summary")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === "summary"
                  ? "bg-[var(--accent)] text-white shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("editor")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === "editor"
                  ? "bg-[var(--accent)] text-white shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>YAML Editor</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-[var(--error)]/10 border border-[var(--error)]/30 rounded-xl flex items-start gap-3 text-[var(--text-primary)] text-xs shadow-sm">
          <AlertCircle className="w-4 h-4 text-[var(--error)] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block">YAML Validation Error</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 bg-[var(--success)]/10 border border-[var(--success)]/30 rounded-xl flex items-center gap-3 text-[var(--text-primary)] text-xs shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-[var(--success)] shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-20 text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          Loading Master Profile...
        </div>
      ) : activeSubTab === "summary" ? (
        /* Summary Cards View */
        <div className="space-y-6">
          {/* Personal Info Card */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <User className="w-4 h-4 text-[var(--accent)]" />
                Personal Details
              </h2>
              <button
                type="button"
                onClick={() => setActiveSubTab("editor")}
                className="text-xs text-[var(--accent)] hover:underline cursor-pointer font-medium"
              >
                Edit YAML
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-[var(--text-muted)] block">Full Name</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {parsedProfile?.personal?.name || "Not set"}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block">Email</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {parsedProfile?.personal?.email || "Not set"}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block">Phone</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {parsedProfile?.personal?.phone || "Not set"}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block">Location</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {parsedProfile?.personal?.location || "Not set"}
                </span>
              </div>
            </div>
          </div>

          {/* Work Experience */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[var(--accent)]" />
                Experience Pool ({parsedProfile?.experience?.length || 0} Positions)
              </h2>
            </div>

            <div className="space-y-4">
              {parsedProfile?.experience?.map((exp, idx) => (
                <div
                  key={idx}
                  className="bg-[var(--background)] border border-[var(--border)] rounded-xl p-4 space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="font-bold text-xs text-[var(--text-primary)]">
                      {exp.role} <span className="text-[var(--accent)]">@ {exp.company}</span>
                    </div>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      {exp.dates || `${exp.start_date || ""} - ${exp.end_date || "Present"}`}
                    </span>
                  </div>

                  {exp.bullets && exp.bullets.length > 0 && (
                    <ul className="list-disc list-inside text-xs text-[var(--text-secondary)] space-y-1 pl-1">
                      {exp.bullets.map((b, bIdx) => (
                        <li key={bIdx} className="leading-relaxed">
                          {typeof b === "string" ? b : (b as any).text}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Skills Grid */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
              <Wrench className="w-4 h-4 text-[var(--accent)]" />
              Categorized Skills Inventory
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {parsedProfile?.skills &&
                Object.entries(parsedProfile.skills).map(([category, items], idx) => (
                  <div
                    key={idx}
                    className="bg-[var(--background)] border border-[var(--border)] rounded-xl p-4 space-y-2"
                  >
                    <h3 className="text-xs font-bold text-[var(--accent)] capitalize">
                      {category.replace(/_/g, " ")}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.isArray(items) &&
                        items.map((skill, sIdx) => (
                          <span
                            key={sIdx}
                            className="bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] px-2.5 py-0.5 rounded-lg text-[11px] font-mono"
                          >
                            {typeof skill === "string" ? skill : (skill as any).name}
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Education */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
              <GraduationCap className="w-4 h-4 text-[var(--accent)]" />
              Education & Degrees
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {parsedProfile?.education?.map((edu, idx) => (
                <div
                  key={idx}
                  className="bg-[var(--background)] border border-[var(--border)] rounded-xl p-4 space-y-1"
                >
                  <h4 className="font-bold text-xs text-[var(--text-primary)]">{edu.degree}</h4>
                  <div className="text-xs text-[var(--text-secondary)]">{edu.institution}</div>
                  <div className="text-[11px] font-mono text-[var(--text-muted)]">{edu.year || edu.dates}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* YAML Raw Editor */
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
              isDragging
                ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
                : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]"
            }`}
          >
            <Upload className="w-8 h-8 text-[var(--accent)] mx-auto mb-2" />
            <p className="text-xs font-semibold text-[var(--text-primary)]">
              Drag & Drop your <code>master_profile.yaml</code> here
            </p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              or click below to browse from your filesystem
            </p>
            <input
              type="file"
              accept=".yaml,.yml,.txt"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              className="hidden"
              id="yaml-file-input"
            />
            <label
              htmlFor="yaml-file-input"
              className="inline-block mt-3 px-4 py-1.5 rounded-xl bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] text-xs font-medium cursor-pointer transition shadow-xs"
            >
              Browse Files
            </label>
          </div>

          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
              <span className="font-mono text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[var(--accent)]" />
                master_profile.yaml Source Editor
              </span>
              <button
                type="button"
                onClick={() => handleSaveYaml(yamlContent)}
                disabled={isSaving}
                className="px-4 py-1.5 rounded-xl bg-[var(--accent)] hover:opacity-90 text-white font-medium text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? "Validating & Saving..." : "Save YAML"}</span>
              </button>
            </div>

            <textarea
              value={yamlContent}
              onChange={(e) => setYamlContent(e.target.value)}
              rows={24}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl p-4 font-mono text-xs text-[var(--text-primary)] leading-relaxed focus:outline-none focus:border-[var(--accent)] resize-y"
            />
          </div>
        </div>
      )}
    </div>
  );
}
