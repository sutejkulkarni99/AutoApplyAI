import React, { useState, useEffect } from "react";
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
  Layers,
  Globe2,
  FileDown,
  PackageCheck,
  Play,
  ExternalLink,
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

  // Editable TeX sources
  const [texCv, setTexCv] = useState<string>("");
  const [texCover, setTexCover] = useState<string>("");

  // Compiled PDF Object URLs
  const [pdfCvUrl, setPdfCvUrl] = useState<string | null>(null);
  const [pdfCoverUrl, setPdfCoverUrl] = useState<string | null>(null);
  const [compileStatusMsg, setCompileStatusMsg] = useState<string | null>(null);

  // Sync state when pipelineData updates
  useEffect(() => {
    if (pipelineData) {
      const initialCv = pipelineData.compiled_cv_tex || "";
      const initialCover = pipelineData.compiled_cover_tex || "";
      setTexCv(initialCv);
      setTexCover(initialCover);

      // Auto compile CV & Cover on initial load
      if (initialCv) compileLaTeXDoc("cv", initialCv);
      if (initialCover) compileLaTeXDoc("cover", initialCover);
    }
  }, [pipelineData]);

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

  const currentTex = activeDoc === "cv" ? texCv : texCover;
  const setCurrentTex = (val: string) => {
    if (activeDoc === "cv") setTexCv(val);
    else setTexCover(val);
  };

  const currentPdfUrl = activeDoc === "cv" ? pdfCvUrl : pdfCoverUrl;

  // Server-side LaTeX compilation runner
  const compileLaTeXDoc = async (docType: "cv" | "cover", sourceTexOverride?: string) => {
    const texToCompile = sourceTexOverride ?? (docType === "cv" ? texCv : texCover);
    if (!texToCompile || !texToCompile.trim()) return;

    setIsCompilingPdf(true);
    setCompileError(null);
    setCompileStatusMsg("Compiling LaTeX to PDF via Server...");

    const prefix = docType === "cv" ? (isGerman ? "Lebenslauf" : "CV") : (isGerman ? "Anschreiben" : "Cover_Letter");
    const filename = `${prefix}_${company.replace(/\s+/g, "_")}`;

    try {
      const res = await fetch("/api/latex/compile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latex_source: texToCompile,
          filename,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "PDF compilation failed");
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      if (docType === "cv") {
        if (pdfCvUrl) URL.revokeObjectURL(pdfCvUrl);
        setPdfCvUrl(objectUrl);
      } else {
        if (pdfCoverUrl) URL.revokeObjectURL(pdfCoverUrl);
        setPdfCoverUrl(objectUrl);
      }

      setCompileStatusMsg("PDF compiled successfully!");
      setTimeout(() => setCompileStatusMsg(null), 3000);
    } catch (err: any) {
      console.error("PDF Compile Error:", err);
      setCompileError(err.message || "Compilation failed. Check LaTeX syntax.");
    } finally {
      setIsCompilingPdf(false);
    }
  };

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
    if (currentPdfUrl) {
      const prefix = activeDoc === "cv" ? (isGerman ? "Lebenslauf" : "CV") : (isGerman ? "Anschreiben" : "Cover_Letter");
      const filename = `${prefix}_${company.replace(/\s+/g, "_")}.pdf`;
      const a = document.createElement("a");
      a.href = currentPdfUrl;
      a.download = filename;
      a.click();
    } else {
      await compileLaTeXDoc(activeDoc);
    }
  };

  const handleDownloadBoth = async () => {
    handleDownloadTex();
    await handleDownloadPdf();
  };

  const handleKeyDownTex = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      compileLaTeXDoc(activeDoc);
    }
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

      {compileStatusMsg && (
        <div className="p-2.5 bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-xl text-[var(--text-primary)] text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0" />
          <span>{compileStatusMsg}</span>
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
            <span>{isGerman ? "Lebenslauf (DIN A4)" : "Curriculum Vitae (CV)"}</span>
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
            <span>{isGerman ? "Anschreiben (DIN 5008)" : "Cover Letter"}</span>
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
              <span className="hidden sm:inline">Split Workspace</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("rendered")}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === "rendered"
                  ? "bg-[var(--surface)] text-[var(--accent)] font-semibold shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              title="Full PDF Preview"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PDF Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("latex")}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === "latex"
                  ? "bg-[var(--surface)] text-[var(--accent)] font-semibold shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              title="LaTeX Source Code Editor"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">TeX Code</span>
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
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{isCompilingPdf ? "Compiling..." : "Download PDF"}</span>
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
      <div className="min-h-[640px]">
        {viewMode === "split" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {/* Left: Editable LaTeX Code Editor */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-sm flex flex-col space-y-3">
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] border-b border-[var(--border)] pb-2.5">
                <span className="font-mono flex items-center gap-1.5 text-[var(--text-primary)] font-semibold">
                  <Code2 className="w-4 h-4 text-[var(--accent)]" />
                  Editable LaTeX Source ({activeDoc.toUpperCase()})
                </span>
                <button
                  type="button"
                  onClick={() => compileLaTeXDoc(activeDoc)}
                  disabled={isCompilingPdf}
                  className="bg-[var(--accent)] hover:opacity-90 text-white font-medium text-xs px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                  title="Recompile edited LaTeX source code to updated PDF (Ctrl+Enter)"
                >
                  {isCompilingPdf ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3 fill-current" />
                  )}
                  <span>Compile PDF</span>
                </button>
              </div>

              <textarea
                value={currentTex}
                onChange={(e) => setCurrentTex(e.target.value)}
                onKeyDown={handleKeyDownTex}
                rows={28}
                placeholder="Type or paste custom LaTeX code here... Press Ctrl+Enter to compile"
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl p-4 font-mono text-[11px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] leading-relaxed resize-y"
              />
              <div className="text-[10px] text-[var(--text-muted)] font-mono flex items-center justify-between px-1">
                <span>Tip: Edit TeX directly above and press <strong>Ctrl+Enter</strong> or click <strong>Compile PDF</strong></span>
                <span>{currentTex.split("\n").length} lines</span>
              </div>
            </div>

            {/* Right: Actual Compiled PDF Preview Frame */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-sm flex flex-col space-y-3">
              <div className="flex items-center justify-between text-xs border-b border-[var(--border)] pb-2.5">
                <span className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                  <FileText className="w-4 h-4 text-[var(--accent)]" />
                  Accurate Compiled PDF Preview
                </span>
                {currentPdfUrl && (
                  <a
                    href={currentPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[var(--accent)] hover:underline flex items-center gap-1 font-medium"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open PDF in New Tab</span>
                  </a>
                )}
              </div>

              {currentPdfUrl ? (
                <iframe
                  src={`${currentPdfUrl}#toolbar=1&navpanes=0&view=FitH`}
                  className="w-full h-[640px] rounded-xl border border-[var(--border)] shadow-sm bg-slate-800"
                  title="Compiled Document PDF Preview"
                />
              ) : (
                <div className="h-[640px] flex flex-col items-center justify-center p-8 bg-[var(--background)] rounded-xl border border-dashed border-[var(--border)] text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-[var(--accent)] animate-spin" />
                  <p className="text-xs text-[var(--text-primary)] font-medium">
                    Compiling LaTeX to high-resolution PDF...
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] max-w-xs">
                    Please wait a moment while the server compiles your document.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : viewMode === "latex" ? (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-[var(--border)] pb-2.5">
              <span className="font-mono font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[var(--accent)]" />
                LaTeX Source Editor ({activeDoc.toUpperCase()})
              </span>
              <button
                type="button"
                onClick={() => compileLaTeXDoc(activeDoc)}
                disabled={isCompilingPdf}
                className="bg-[var(--accent)] hover:opacity-90 text-white font-medium text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
              >
                {isCompilingPdf ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>Compile PDF (Ctrl+Enter)</span>
              </button>
            </div>
            <textarea
              value={currentTex}
              onChange={(e) => setCurrentTex(e.target.value)}
              onKeyDown={handleKeyDownTex}
              rows={28}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl p-4 font-mono text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] leading-relaxed"
            />
          </div>
        ) : (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-[var(--border)] pb-2.5">
              <span className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Eye className="w-4 h-4 text-[var(--accent)]" />
                Full Page Compiled PDF Viewer
              </span>
              {currentPdfUrl && (
                <a
                  href={currentPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-[var(--accent)] hover:underline flex items-center gap-1 font-medium"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open PDF in New Tab</span>
                </a>
              )}
            </div>
            {currentPdfUrl ? (
              <iframe
                src={`${currentPdfUrl}#toolbar=1&navpanes=0&view=FitH`}
                className="w-full h-[750px] rounded-xl border border-[var(--border)] shadow-sm bg-slate-800"
                title="Full Screen PDF View"
              />
            ) : (
              <div className="h-[600px] flex flex-col items-center justify-center p-8 bg-[var(--background)] rounded-xl border border-dashed border-[var(--border)] text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-[var(--accent)] animate-spin" />
                <p className="text-xs text-[var(--text-primary)] font-medium">
                  Compiling LaTeX to PDF...
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

