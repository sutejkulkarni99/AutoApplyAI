import React, { useState } from "react";
import {
  FileText,
  Download,
  Copy,
  Check,
  RefreshCw,
  BookmarkPlus,
  AlertTriangle,
  CheckCircle2,
  Code2,
  Eye,
  FileCode2,
  Sparkles,
  Layers,
  Globe2,
  FileDown,
  PackageCheck,
  ArrowRight,
} from "lucide-react";
import { PipelineResults } from "../types";

interface PreviewTabProps {
  pipelineData: PipelineResults | null;
  onSaveToTracker: (data: PipelineResults) => void;
  onRegeneratePass: (passNum: 2 | 3) => void;
  isRegenerating: boolean;
  token: string;
}

export function PreviewTab({
  pipelineData,
  onSaveToTracker,
  onRegeneratePass,
  isRegenerating,
  token,
}: PreviewTabProps) {
  const [activeDoc, setActiveDoc] = useState<"cv" | "cover">("cv");
  const [viewMode, setViewMode] = useState<"split" | "rendered" | "latex">("split");
  const [copied, setCopied] = useState(false);
  const [isCompilingPdf, setIsCompilingPdf] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);

  if (!pipelineData) {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] flex items-center justify-center mx-auto shadow-sm">
          <FileText className="w-7 h-7 text-[var(--accent)]" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">No Tailored Documents Yet</h2>
        <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
          Generate a LaTeX CV and Cover Letter from the <strong>Tailor Job</strong> tab to preview and export here.
        </p>
      </div>
    );
  }

  const { pass_1, pass_2, pass_3, gaps, job_analysis, job_metadata, language = "en" } = pipelineData;
  const company = job_analysis?.company || job_metadata?.company || "Company";
  const role = job_analysis?.title || job_metadata?.title || "Role";
  const isGerman = language === "de";

  // Calculate ATS match percentage
  const totalReqs = (job_analysis?.must_have?.length || 0) + (job_analysis?.nice_to_have?.length || 0);
  const missingCount = (gaps?.missing_skills?.length || 0) + (gaps?.missing_requirements?.length || 0);
  const matchedCount = Math.max(0, totalReqs - missingCount);
  const matchPct = totalReqs > 0 ? Math.round((matchedCount / totalReqs) * 100) : 94;

  // Active LaTeX source
  const currentTex = activeDoc === "cv" ? pipelineData.compiled_cv_tex || "" : pipelineData.compiled_cover_tex || "";

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentTex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTex = () => {
    const prefix = activeDoc === "cv" ? (isGerman ? "Lebenslauf" : "CV") : (isGerman ? "Anschreiben" : "Cover_Letter");
    const filename = `${prefix}_${company.replace(/\s+/g, "_")}.tex`;
    const blob = new Blob([currentTex], { type: "text/x-tex;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    setIsCompilingPdf(true);
    setCompileError(null);
    const prefix = activeDoc === "cv" ? (isGerman ? "Lebenslauf" : "CV") : (isGerman ? "Anschreiben" : "Cover_Letter");
    const filename = `${prefix}_${company.replace(/\s+/g, "_")}`;

    try {
      const res = await fetch("/api/latex/compile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latex_source: currentTex,
          filename,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "PDF compilation failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setCompileError(err.message || "Could not compile PDF. Downloading .tex source file instead.");
      handleDownloadTex();
    } finally {
      setIsCompilingPdf(false);
    }
  };

  const handleDownloadBoth = async () => {
    handleDownloadTex();
    await handleDownloadPdf();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Top ATS & Job Match Header */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-wider">
                Tailored Document Suite
              </span>
              <span className="text-[var(--text-muted)]">•</span>
              <span className="text-xs text-[var(--text-secondary)] font-medium">{company}</span>
              <span className="text-[var(--text-muted)]">•</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[var(--accent-subtle)] text-[var(--text-primary)] border border-[var(--border)]">
                <Globe2 className="w-3 h-3 text-[var(--accent)]" />
                {isGerman ? "German (Deutsch 🇩🇪)" : "English (UK/US 🇬🇧)"}
              </span>
            </div>
            <h1 className="text-lg font-bold text-[var(--text-primary)] mt-1">{role}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* ATS Score Meter */}
            <div className="bg-[var(--background)] border border-[var(--border)] px-4 py-2 rounded-xl flex items-center gap-3">
              <div className="relative w-10 h-10 flex items-center justify-center">
                <svg className="w-10 h-10 -rotate-90">
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    className="text-[var(--border)]"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="transparent"
                  />
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    className="text-[var(--success)] transition-all duration-700"
                    strokeWidth="3.5"
                    strokeDasharray={100}
                    strokeDashoffset={100 - matchPct}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                  />
                </svg>
                <span className="absolute text-[11px] font-bold text-[var(--text-primary)]">{matchPct}%</span>
              </div>
              <div className="text-left">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase tracking-wider font-semibold">
                  Job Match
                </span>
                <span className="text-xs text-[var(--success)] font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Profile Match
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSaveToTracker(pipelineData)}
              className="bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] text-xs font-medium px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <BookmarkPlus className="w-4 h-4 text-[var(--accent)]" />
              <span>Save to Tracker</span>
            </button>
          </div>
        </div>

        {/* Gap Analysis & Requirements Banner */}
        {gaps && ((gaps.missing_skills && gaps.missing_skills.length > 0) || (gaps.missing_requirements && gaps.missing_requirements.length > 0)) && (
          <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-start gap-3 text-xs bg-[var(--warning)]/10 p-3.5 rounded-xl border border-[var(--warning)]/30">
            <AlertTriangle className="w-4 h-4 text-[var(--warning)] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-[var(--warning)]">
                Requirements & Skill Alignment:
              </span>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {gaps.missing_skills?.map((skill, i) => (
                  <span key={i} className="bg-[var(--background)] text-[var(--text-primary)] border border-[var(--border)] px-2 py-0.5 rounded text-[10px] font-mono">
                    {skill}
                  </span>
                ))}
                {gaps.missing_requirements?.map((req, i) => (
                  <span key={i} className="bg-[var(--background)] text-[var(--text-primary)] border border-[var(--border)] px-2 py-0.5 rounded text-[10px]">
                    {req}
                  </span>
                ))}
              </div>
              {gaps.strategy && (
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                  <strong className="text-[var(--text-primary)]">Framing Strategy:</strong> {gaps.strategy}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {compileError && (
        <div className="p-3.5 bg-[var(--warning)]/10 border border-[var(--warning)]/40 rounded-xl text-[var(--text-primary)] text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[var(--warning)] shrink-0" />
            {compileError}
          </span>
          <button
            type="button"
            onClick={() => setCompileError(null)}
            className="text-[var(--warning)] hover:underline text-[11px] ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Document Controls Bar */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
        {/* Document Selector */}
        <div className="flex items-center bg-[var(--background)] p-1 rounded-xl border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setActiveDoc("cv")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              activeDoc === "cv"
                ? "bg-[var(--accent)] text-white shadow-sm font-semibold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isGerman ? "Lebenslauf (2 Seiten DIN)" : "Curriculum Vitae (2-Page)"}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveDoc("cover")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              activeDoc === "cover"
                ? "bg-[var(--accent)] text-white shadow-sm font-semibold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>{isGerman ? "Anschreiben (1 Seite DIN 5008)" : "Cover Letter (1-Page)"}</span>
          </button>
        </div>

        {/* View Mode & Export Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Modes */}
          <div className="flex items-center bg-[var(--background)] p-1 rounded-xl border border-[var(--border)]">
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === "split"
                  ? "bg-[var(--surface)] text-[var(--accent)] font-semibold shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              title="Side-by-Side Split Workspace"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("rendered")}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === "rendered"
                  ? "bg-[var(--surface)] text-[var(--accent)] font-semibold shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              title="Rendered Document View"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("latex")}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === "latex"
                  ? "bg-[var(--surface)] text-[var(--accent)] font-semibold shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              title="LaTeX Source Code"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">LaTeX</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyCode}
            className="bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] text-xs font-medium px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[var(--success)]" /> : <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          {/* Download .tex */}
          <button
            type="button"
            onClick={handleDownloadTex}
            className="bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] text-xs font-medium px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>.tex</span>
          </button>

          {/* Download PDF */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isCompilingPdf}
            className="bg-[var(--accent)] hover:opacity-90 text-white font-medium text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50 active:scale-95"
          >
            {isCompilingPdf ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{isCompilingPdf ? "Compiling PDF..." : "Download PDF"}</span>
          </button>

          {/* Download Both */}
          <button
            type="button"
            onClick={handleDownloadBoth}
            className="bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border)] font-medium text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Download both .tex and compiled .pdf"
          >
            <PackageCheck className="w-3.5 h-3.5 text-[var(--success)]" />
            <span>Both (.tex + .pdf)</span>
          </button>

          {/* Regenerate Pass */}
          <button
            type="button"
            onClick={() => onRegeneratePass(activeDoc === "cv" ? 2 : 3)}
            disabled={isRegenerating}
            title="Regenerate this specific document with AI"
            className="p-2 rounded-xl bg-[var(--background)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin text-[var(--accent)]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="min-h-[600px]">
        {viewMode === "split" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {/* Left: LaTeX Code Editor */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-sm flex flex-col">
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] border-b border-[var(--border)] pb-2.5 mb-3">
                <span className="font-mono flex items-center gap-1.5 text-[var(--text-primary)] font-semibold">
                  <Code2 className="w-4 h-4 text-[var(--accent)]" />
                  LaTeX Source Code ({activeDoc.toUpperCase()})
                </span>
                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                  {currentTex.split("\n").length} lines
                </span>
              </div>
              <textarea
                readOnly
                value={currentTex}
                rows={28}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl p-4 font-mono text-[11px] text-[var(--text-primary)] focus:outline-none leading-relaxed resize-y"
              />
            </div>

            {/* Right: Simulated A4 Document Sheet */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-sm flex flex-col">
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] border-b border-[var(--border)] pb-2.5 mb-3">
                <span className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                  <FileText className="w-4 h-4 text-[var(--accent)]" />
                  Simulated A4 Document Flow ({isGerman ? "DIN A4" : "A4 Standard"})
                </span>
                <span className="text-[11px] text-[var(--success)] font-mono font-medium">
                  {activeDoc === "cv" ? "Strict 2-Page Envelope" : "Strict 1-Page Envelope"}
                </span>
              </div>

              {/* Rendered White Sheet */}
              <div className="bg-white text-slate-900 rounded-xl p-8 shadow-sm space-y-6 font-serif border border-slate-200 overflow-y-auto max-h-[640px]">
                {activeDoc === "cv" ? (
                  <div className="space-y-5 text-sm leading-relaxed">
                    <div className="text-center border-b border-slate-300 pb-4">
                      <h1 className="text-2xl font-bold text-[#1b2a4a] tracking-tight">
                        Candidate Profile
                      </h1>
                      <p className="text-sm font-semibold text-[#2b547e] mt-0.5">
                        {pass_2?.dynamic_header_title || role}
                      </p>
                      <p className="text-xs text-slate-600 mt-1 font-sans">
                        Email: candidate@example.com • Tel: +49 • Germany
                      </p>
                    </div>

                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-[#1b2a4a] border-b border-slate-300 pb-1 font-sans">
                        {isGerman ? "Kurzprofil & Expertise" : "Professional Summary"}
                      </h2>
                      <p className="text-xs text-slate-700 mt-2 font-sans leading-normal">
                        {pass_2?.professional_summary || "Tailored professional profile summary."}
                      </p>
                    </div>

                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-[#1b2a4a] border-b border-slate-300 pb-1 font-sans">
                        {isGerman ? "Berufliche Erfahrung" : "Experience"}
                      </h2>
                      <div className="text-xs text-slate-700 mt-2 font-mono whitespace-pre-wrap leading-relaxed">
                        {pass_2?.experience_sections || "% Experience entries compiled"}
                      </div>
                    </div>

                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-[#1b2a4a] border-b border-slate-300 pb-1 font-sans">
                        {isGerman ? "Fachliche & Technische Kompetenzen" : "Technical & Core Skills"}
                      </h2>
                      <div className="text-xs text-slate-700 mt-2 font-mono whitespace-pre-wrap leading-relaxed">
                        {pass_2?.skills_section || "% Skills selected"}
                      </div>
                    </div>

                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-[#1b2a4a] border-b border-slate-300 pb-1 font-sans">
                        {isGerman ? "Ausbildung & Qualifikationen" : "Education & Qualifications"}
                      </h2>
                      <div className="text-xs text-slate-700 mt-2 font-mono whitespace-pre-wrap leading-relaxed">
                        {pass_2?.education_section || "% Education details"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 text-sm font-sans leading-relaxed text-slate-800">
                    <div className="border-b border-slate-200 pb-3">
                      <span className="font-bold text-[#1b2a4a] block text-base">Candidate Name</span>
                      <span className="text-xs text-slate-600">Munich, Germany • candidate@example.com</span>
                    </div>

                    <div className="text-xs space-y-0.5">
                      <p className="font-bold text-slate-900">{pass_3?.recipient_company || company}</p>
                      <p className="text-slate-600">{pass_3?.recipient_location || "Headquarters"}</p>
                    </div>

                    <div className="pt-2">
                      <p className="text-xs font-bold text-[#1b2a4a]">
                        {isGerman ? "Betreff:" : "Subject:"} {pass_3?.subject_line || `Application for ${role}`}
                      </p>
                    </div>

                    <p className="text-xs font-semibold">{pass_3?.salutation || (isGerman ? "Sehr geehrte Damen und Herren," : "Dear Hiring Manager,")}</p>

                    <p className="text-xs text-slate-700 leading-relaxed">{pass_3?.body_paragraph_1}</p>
                    <p className="text-xs text-slate-700 leading-relaxed">{pass_3?.body_paragraph_2}</p>
                    <p className="text-xs text-slate-700 leading-relaxed">{pass_3?.body_paragraph_3}</p>

                    <div className="pt-4">
                      <p className="text-xs text-slate-800 font-semibold">{pass_3?.closing || (isGerman ? "Mit freundlichen Grüßen," : "Sincerely,")}</p>
                      <p className="text-xs font-bold text-[#1b2a4a] mt-2">Candidate Name</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : viewMode === "latex" ? (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] border-b border-[var(--border)] pb-2">
              <span className="font-mono font-semibold text-[var(--text-primary)]">LaTeX Source Code ({activeDoc.toUpperCase()})</span>
              <span className="text-[11px] text-[var(--text-muted)]">Ready for pdflatex or Overleaf</span>
            </div>
            <textarea
              readOnly
              value={currentTex}
              rows={26}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl p-4 font-mono text-xs text-[var(--text-primary)] focus:outline-none leading-relaxed"
            />
          </div>
        ) : (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm flex justify-center">
            <div className="w-full max-w-3xl bg-white text-slate-900 rounded-xl p-10 shadow-lg space-y-6 font-serif border border-slate-200">
              {activeDoc === "cv" ? (
                <div className="space-y-5 text-sm leading-relaxed">
                  <div className="text-center border-b border-slate-300 pb-4">
                    <h1 className="text-2xl font-bold text-[#1b2a4a] tracking-tight">Candidate Profile</h1>
                    <p className="text-sm font-semibold text-[#2b547e] mt-0.5">{pass_2?.dynamic_header_title || role}</p>
                    <p className="text-xs text-slate-600 mt-1 font-sans">Email: candidate@example.com • Tel: +49 • Germany</p>
                  </div>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#1b2a4a] border-b border-slate-300 pb-1 font-sans">
                      {isGerman ? "Kurzprofil & Expertise" : "Professional Summary"}
                    </h2>
                    <p className="text-xs text-slate-700 mt-2 font-sans leading-normal">{pass_2?.professional_summary}</p>
                  </div>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#1b2a4a] border-b border-slate-300 pb-1 font-sans">
                      {isGerman ? "Berufliche Erfahrung" : "Experience"}
                    </h2>
                    <div className="text-xs text-slate-700 mt-2 font-mono whitespace-pre-wrap leading-relaxed">
                      {pass_2?.experience_sections}
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#1b2a4a] border-b border-slate-300 pb-1 font-sans">
                      {isGerman ? "Fachliche & Technische Kompetenzen" : "Technical & Core Skills"}
                    </h2>
                    <div className="text-xs text-slate-700 mt-2 font-mono whitespace-pre-wrap leading-relaxed">
                      {pass_2?.skills_section}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-sm font-sans leading-relaxed text-slate-800">
                  <div className="border-b border-slate-200 pb-3">
                    <span className="font-bold text-[#1b2a4a] block text-base">Candidate Name</span>
                    <span className="text-xs text-slate-600">Munich, Germany • candidate@example.com</span>
                  </div>
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-slate-900">{pass_3?.recipient_company || company}</p>
                    <p className="text-slate-600">{pass_3?.recipient_location || "Headquarters"}</p>
                  </div>
                  <div className="pt-2">
                    <p className="text-xs font-bold text-[#1b2a4a]">
                      {isGerman ? "Betreff:" : "Subject:"} {pass_3?.subject_line || `Application for ${role}`}
                    </p>
                  </div>
                  <p className="text-xs font-semibold">{pass_3?.salutation || (isGerman ? "Sehr geehrte Damen und Herren," : "Dear Hiring Manager,")}</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{pass_3?.body_paragraph_1}</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{pass_3?.body_paragraph_2}</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{pass_3?.body_paragraph_3}</p>
                  <div className="pt-4">
                    <p className="text-xs text-slate-800 font-semibold">{pass_3?.closing || (isGerman ? "Mit freundlichen Grüßen," : "Sincerely,")}</p>
                    <p className="text-xs font-bold text-[#1b2a4a] mt-2">Candidate Name</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
