import React, { useState } from "react";
import {
  Sparkles,
  Link as LinkIcon,
  Building2,
  Briefcase,
  AlertCircle,
  Cpu,
  Layers,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  RefreshCw,
  FileText,
} from "lucide-react";
import { PipelineResults, DocumentLanguage } from "../types";
import { LanguageToggle } from "./LanguageToggle";

interface InputTabProps {
  onPipelineComplete: (results: PipelineResults) => void;
  isRunningPipeline: boolean;
  setIsRunningPipeline: (running: boolean) => void;
  activeModel: string;
  activeProvider: string;
  token: string;
}

export function InputTab({
  onPipelineComplete,
  isRunningPipeline,
  setIsRunningPipeline,
  activeModel,
  activeProvider,
  token,
}: InputTabProps) {
  const [jobDescription, setJobDescription] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [language, setLanguage] = useState<DocumentLanguage>("en");
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);

  const handleRunPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobDescription.trim() || jobDescription.trim().length < 20) {
      setError("Please paste a complete job description (minimum 20 characters).");
      return;
    }

    setError(null);
    setIsRunningPipeline(true);
    setCurrentStep(1);

    try {
      // Step 1: Pass 1 Analysis
      setCurrentStep(1);
      const res1 = await fetch("/api/ai/pass-1-analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          job_description: jobDescription,
          job_url: jobUrl,
          company,
          title,
          language,
        }),
      });

      const pass1 = await res1.json();
      if (!res1.ok) throw new Error(pass1.error || "Pass 1 analysis failed");

      // Step 2: Pass 2 CV Generation
      setCurrentStep(2);
      const res2 = await fetch("/api/ai/generate-cv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pass_1_analysis: pass1, language }),
      });

      const pass2 = await res2.json();
      if (!res2.ok) throw new Error(pass2.error || "Pass 2 CV generation failed");

      // Step 3: Pass 3 Cover Letter
      setCurrentStep(3);
      const res3 = await fetch("/api/ai/generate-cover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pass_1_analysis: pass1, language }),
      });

      const pass3 = await res3.json();
      if (!res3.ok) throw new Error(pass3.error || "Pass 3 Cover Letter generation failed");

      // Fetch full assembled LaTeX sources
      const [cvTexRes, coverTexRes] = await Promise.all([
        fetch("/api/latex/generate-full", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ type: "cv", pass_1: pass1, pass_2: pass2, language }),
        }),
        fetch("/api/latex/generate-full", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ type: "cover", pass_1: pass1, pass_3: pass3, language }),
        }),
      ]);

      const cvTexData = await cvTexRes.json();
      const coverTexData = await coverTexRes.json();

      const fullResults: PipelineResults = {
        pass_1: pass1,
        pass_2: pass2,
        pass_3: pass3,
        gaps: pass1.gaps,
        job_analysis: pass1.job_analysis,
        job_metadata: {
          url: jobUrl,
          company: company || pass1.job_analysis?.company,
          title: title || pass1.job_analysis?.title,
          raw_jd: jobDescription,
        },
        compiled_cv_tex: cvTexData.tex,
        compiled_cover_tex: coverTexData.tex,
        language,
      };

      // Save to tracker automatically
      await fetch("/api/tracker", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          company: fullResults.job_metadata?.company || "Target Company",
          role: fullResults.job_metadata?.title || "Target Role",
          url: jobUrl,
          status: "tailored",
          gaps: fullResults.gaps,
          pass_data: fullResults,
          notes: `Generated with ${activeProvider.toUpperCase()} (${activeModel}) [${language === "de" ? "German" : "English"}].`,
        }),
      });

      setCurrentStep(4);
      onPipelineComplete(fullResults);
    } catch (err: any) {
      setError(err.message || "Failed to execute AI tailoring pipeline");
    } finally {
      setIsRunningPipeline(false);
      setCurrentStep(0);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-[var(--accent-subtle)] text-[var(--text-primary)]">
                <Sparkles className="w-4 h-4 text-[var(--accent)]" />
              </span>
              <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                Tailor Job Application
              </h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
              Generate tailored 2-page LaTeX CVs and 1-page Cover Letters in English or German.
            </p>
          </div>

          <div className="flex items-center gap-2.5 bg-[var(--background)] border border-[var(--border)] px-3.5 py-2 rounded-xl">
            <Cpu className="w-4 h-4 text-[var(--accent)]" />
            <div className="text-[11px] font-mono">
              <div className="text-[var(--text-muted)] uppercase text-[9px] font-semibold">Active Engine</div>
              <div className="font-semibold text-[var(--text-primary)] capitalize">
                {activeProvider} <span className="text-[var(--accent)]">({activeModel})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-[var(--error)]/10 border border-[var(--error)]/30 text-[var(--text-primary)] text-xs flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-[var(--error)] shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-semibold text-[var(--error)]">Pipeline Error:</strong> {error}
          </div>
        </div>
      )}

      {/* Pipeline Progress Indicator */}
      {isRunningPipeline && (
        <div className="bg-[var(--surface)] border border-[var(--accent)] rounded-2xl p-5 shadow-lg space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <RefreshCw className="w-4 h-4 text-[var(--accent)] animate-spin" />
              <span className="text-xs font-bold text-[var(--text-primary)]">
                Generating Application Documents...
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-[var(--accent)]">
              Step {currentStep} of 3
            </span>
          </div>

          {/* Progress track */}
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <div
              className={`p-2.5 rounded-xl border transition-all ${
                currentStep >= 1
                  ? "bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--text-primary)] font-semibold"
                  : "bg-[var(--background)] border-[var(--border)] text-[var(--text-muted)]"
              }`}
            >
              1. Job Gap Analysis
            </div>
            <div
              className={`p-2.5 rounded-xl border transition-all ${
                currentStep >= 2
                  ? "bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--text-primary)] font-semibold"
                  : "bg-[var(--background)] border-[var(--border)] text-[var(--text-muted)]"
              }`}
            >
              2. 2-Page CV Assembly
            </div>
            <div
              className={`p-2.5 rounded-xl border transition-all ${
                currentStep >= 3
                  ? "bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--text-primary)] font-semibold"
                  : "bg-[var(--background)] border-[var(--border)] text-[var(--text-muted)]"
              }`}
            >
              3. 1-Page Cover Letter
            </div>
          </div>
        </div>
      )}

      {/* Main Input Form */}
      <form onSubmit={handleRunPipeline} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-5">
        {/* Top Options: Metadata & Target Language */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                Target Company (Optional)
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. BMW Group, SAP, Stripe"
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[var(--accent)]" />
                Target Role / Job Title (Optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Full Stack Engineer"
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition"
              />
            </div>
          </div>

          <div className="space-y-3">
            {/* Language Selection Toggle */}
            <LanguageToggle
              selectedLanguage={language}
              onChange={setLanguage}
              disabled={isRunningPipeline}
            />

            <div>
              <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-[var(--accent)]" />
                Job Posting URL (Optional)
              </label>
              <input
                type="url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://linkedin.com/jobs/view/..."
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-3.5 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition"
              />
            </div>
          </div>
        </div>

        {/* Job Description Textarea */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Job Description & Requirements *</span>
            </label>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              {jobDescription.length} characters
            </span>
          </div>
          <textarea
            rows={11}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the full job posting, responsibilities, requirements, and tech stack here..."
            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl p-4 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] font-mono leading-relaxed focus:outline-none focus:border-[var(--accent)] transition resize-y"
          />
        </div>

        {/* Submission Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-[var(--border)]">
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
            <ShieldCheck className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <span>Content generated directly from your candidate master profile.</span>
          </div>

          <button
            type="submit"
            disabled={isRunningPipeline || !jobDescription.trim()}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isRunningPipeline || !jobDescription.trim()
                ? "bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-muted)] cursor-not-allowed opacity-80"
                : "bg-[var(--accent)] hover:opacity-95 text-white border border-[var(--accent)] shadow-sm active:scale-[0.98]"
            }`}
          >
            {isRunningPipeline ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating {language === "de" ? "German" : "English"} Documents...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Documents ({language === "de" ? "German 🇩🇪" : "English 🇬🇧"})</span>
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
