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
  Globe,
  Mail,
  Zap,
  Code2,
  Sliders,
  CheckCircle2,
  Flame,
  Check,
  X,
  Play,
  Terminal,
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
  onOpenEmailScanner?: () => void;
  onOpenLaTeXPreview?: () => void;
  onOpenSettingsDrawer?: () => void;
}

export function InputTab({
  onPipelineComplete,
  isRunningPipeline,
  setIsRunningPipeline,
  activeModel,
  activeProvider,
  token,
  onOpenEmailScanner,
  onOpenLaTeXPreview,
  onOpenSettingsDrawer,
}: InputTabProps) {
  const [jobDescription, setJobDescription] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [language, setLanguage] = useState<DocumentLanguage>("en");
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [activeCategoryPill, setActiveCategoryPill] = useState("all");
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);

  const [scrapeSuccessInfo, setScrapeSuccessInfo] = useState<{
    detectedLang?: string;
    source?: string;
  } | null>(null);

  const handleFetchJobFromUrl = async () => {
    if (!jobUrl || !jobUrl.trim()) {
      setError("Please enter a Job Posting URL first.");
      return;
    }

    setError(null);
    setScrapeSuccessInfo(null);
    setIsFetchingUrl(true);

    try {
      const response = await fetch("/api/fetch-job", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: jobUrl, language }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch job posting from URL.");
      }

      if (data.job_description) {
        setJobDescription(data.job_description);
      }
      if (data.title) {
        setTitle(data.title);
      }
      if (data.company) {
        setCompany(data.company);
      }

      setScrapeSuccessInfo({
        detectedLang: data.detected_language === "de" ? "German" : "English",
        source: data.source,
      });
    } catch (err: any) {
      setError(err.message || "Failed to scrape job content from URL. Please copy & paste manually.");
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleRunPipeline = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!jobDescription.trim() || jobDescription.trim().length < 20) {
      setError("Please paste a complete job description (minimum 20 characters) or scrape from URL.");
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

      // Auto-save to tracker
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleRunPipeline();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12">
      {/* Top Header */}
      <div className="space-y-1 pt-1">
        <h1 className="text-xl sm:text-2xl font-semibold text-[#f2f2f2] tracking-tight">
          Application Playground
        </h1>
        <p className="text-xs text-[#8e918f]">
          Provide a job posting URL or paste requirements to generate tailored LaTeX documents.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-[#e3e3e3] flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-semibold text-red-400">Error:</strong> {error}
          </div>
        </div>
      )}

      {/* Scrape Success Alert */}
      {scrapeSuccessInfo && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-[#e3e3e3] flex items-start gap-3">
          <Globe className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-0.5">
            <div className="font-semibold text-emerald-400 flex items-center gap-2">
              <span>Job Posting Extracted</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#1e1f20] border border-[#282a2c] font-mono text-[#8e918f]">
                {scrapeSuccessInfo.detectedLang}
              </span>
            </div>
            <p className="text-[11px] text-[#8e918f]">
              Target output language: <strong>{language === "de" ? "German" : "English"}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Pipeline Progress Indicator */}
      {isRunningPipeline && (
        <div className="p-4 rounded-xl bg-[#1e1f20] border border-[#8ab4f8]/50 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-[#8ab4f8] animate-spin" />
              <span className="text-xs font-semibold text-[#f2f2f2]">
                Processing Application Pipeline
              </span>
            </div>
            <span className="text-xs font-mono text-[#8ab4f8]">
              Step {currentStep} of 3
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <div
              className={`p-2 rounded-lg border transition-all ${
                currentStep >= 1
                  ? "bg-blue-500/10 border-[#8ab4f8] text-[#f2f2f2] font-semibold"
                  : "bg-[#131314] border-[#282a2c] text-[#8e918f]"
              }`}
            >
              1. Gap Analysis
            </div>
            <div
              className={`p-2 rounded-lg border transition-all ${
                currentStep >= 2
                  ? "bg-blue-500/10 border-[#8ab4f8] text-[#f2f2f2] font-semibold"
                  : "bg-[#131314] border-[#282a2c] text-[#8e918f]"
              }`}
            >
              2. CV Tailoring
            </div>
            <div
              className={`p-2 rounded-lg border transition-all ${
                currentStep >= 3
                  ? "bg-blue-500/10 border-[#8ab4f8] text-[#f2f2f2] font-semibold"
                  : "bg-[#131314] border-[#282a2c] text-[#8e918f]"
              }`}
            >
              3. Cover Letter
            </div>
          </div>
        </div>
      )}

      {/* Main Interactive AI Studio Prompt Capsule / Workspace */}
      <form
        onSubmit={handleRunPipeline}
        className="rounded-3xl bg-[#1e1f20] border border-[#282a2c] p-4 sm:p-5 space-y-4 shadow-2xl transition-all focus-within:border-[#8ab4f8]/60 relative"
      >
        {/* Quick URL Scraper & Metadata Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pb-2 border-b border-[#282a2c]">
          <div className="flex-1 relative">
            <LinkIcon className="w-3.5 h-3.5 text-[#8e918f] absolute left-3 top-3" />
            <input
              type="url"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="Paste Job URL (LinkedIn, StepStone, Indeed, Company Site)..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#131314] border border-[#282a2c] text-xs text-[#e3e3e3] placeholder-[#5f6368] focus:outline-none focus:border-[#8ab4f8] transition-colors"
            />
          </div>

          <button
            type="button"
            onClick={handleFetchJobFromUrl}
            disabled={isFetchingUrl || !jobUrl.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#282a2c] hover:bg-[#323438] text-xs font-medium text-[#f2f2f2] border border-[#3a3d40] transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            {isFetchingUrl ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#8ab4f8]" />
                <span>Scraping URL...</span>
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5 text-[#8ab4f8]" />
                <span>Fetch Job Posting</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
            className="px-3 py-2 rounded-xl text-xs text-[#8e918f] hover:text-[#e3e3e3] hover:bg-[#282a2c] transition-colors cursor-pointer whitespace-nowrap"
          >
            {isMetadataExpanded ? "Hide Metadata" : "+ Company & Role"}
          </button>
        </div>

        {/* Expandable Optional Metadata */}
        {isMetadataExpanded && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-in fade-in duration-150">
            <div>
              <label className="text-[11px] font-medium text-[#c4c7c5] block mb-1">
                Target Company (Optional)
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. BMW Group, Stripe, SAP"
                className="w-full px-3 py-1.5 rounded-xl bg-[#131314] border border-[#282a2c] text-xs text-[#e3e3e3] focus:outline-none focus:border-[#8ab4f8]"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#c4c7c5] block mb-1">
                Target Role / Job Title (Optional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Full Stack Engineer"
                className="w-full px-3 py-1.5 rounded-xl bg-[#131314] border border-[#282a2c] text-xs text-[#e3e3e3] focus:outline-none focus:border-[#8ab4f8]"
              />
            </div>
          </div>
        )}

        {/* Textarea: Prompt / Job Description */}
        <div className="space-y-1.5">
          <textarea
            rows={8}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste job description requirements or scrape above to generate tailored CV and cover letter..."
            className="w-full bg-transparent text-xs text-[#e3e3e3] placeholder-[#5f6368] leading-relaxed focus:outline-none font-mono resize-y border-none"
          />
        </div>

        {/* Prompt Capsule Bottom Controls & Active Chips */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-[#282a2c]">
          {/* Active Chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Grounding Chip */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-[#282a2c] text-[#8ab4f8] border border-[#3a3d40]">
              <Globe className="w-3 h-3 text-[#8ab4f8]" />
              <span>Web Grounding</span>
            </span>

            {/* Language Switcher */}
            <LanguageToggle
              selectedLanguage={language}
              onChange={setLanguage}
              disabled={isRunningPipeline}
            />

            {/* Character counter */}
            <span className="text-[10px] font-mono text-[#8e918f]">
              {jobDescription.length} chars
            </span>
          </div>

          {/* Action Button: Run Ctrl ↵ */}
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onOpenSettingsDrawer}
              className="p-2 rounded-xl text-[#8e918f] hover:text-[#e3e3e3] hover:bg-[#282a2c] transition-colors cursor-pointer"
              title="Run settings inspector"
            >
              <Sliders className="w-4 h-4" />
            </button>

            <button
              type="submit"
              disabled={isRunningPipeline || !jobDescription.trim()}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold shadow-lg transition-all cursor-pointer ${
                isRunningPipeline || !jobDescription.trim()
                  ? "bg-[#282a2c] text-[#8e918f] border border-[#37393b] cursor-not-allowed opacity-60"
                  : "bg-gradient-to-r from-[#4285f4] via-[#5b95f5] to-[#7aa9f7] hover:opacity-95 text-[#101012] border border-[#8ab4f8]/40 active:scale-[0.98]"
              }`}
            >
              {isRunningPipeline ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Tailoring Pipeline...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Tailor Application</span>
                  <span className="text-[10px] font-mono opacity-70 px-1 py-0.2 rounded bg-black/20">
                    Ctrl ↵
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
