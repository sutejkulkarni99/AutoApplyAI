import React, { useState } from "react";
import {
  X,
  Code2,
  Sliders,
  ChevronDown,
  ChevronUp,
  Cpu,
  Sparkles,
  Info,
  Check,
  Zap,
  Globe2,
  Mail,
  FileCode2,
  ShieldCheck,
} from "lucide-react";
import { AppSettingsData, AIProvider } from "../types";

interface RunSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeModel: string;
  activeProvider: string;
  temperature: number;
  onTemperatureChange: (temp: number) => void;
  thinkingLevel: "High" | "Medium" | "Low" | "None";
  onThinkingLevelChange: (level: "High" | "Medium" | "Low" | "None") => void;
  structuredOutputs: boolean;
  onToggleStructuredOutputs: () => void;
  webScraperGrounding: boolean;
  onToggleWebScraperGrounding: () => void;
  emailAutoSync: boolean;
  onToggleEmailAutoSync: () => void;
  onOpenGetCodeModal: () => void;
  systemPrompt: string;
  onSystemPromptChange: (text: string) => void;
}

export function RunSettingsDrawer({
  isOpen,
  onClose,
  activeModel,
  activeProvider,
  temperature,
  onTemperatureChange,
  thinkingLevel,
  onThinkingLevelChange,
  structuredOutputs,
  onToggleStructuredOutputs,
  webScraperGrounding,
  onToggleWebScraperGrounding,
  emailAutoSync,
  onToggleEmailAutoSync,
  onOpenGetCodeModal,
  systemPrompt,
  onSystemPromptChange,
}: RunSettingsDrawerProps) {
  const [isToolsExpanded, setIsToolsExpanded] = useState(true);
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(false);

  if (!isOpen) return null;

  return (
    <aside className="w-80 bg-[#131314] text-[#e3e3e3] border-l border-[#282a2c] flex flex-col h-full z-30 shrink-0 select-none overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Drawer Top Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#282a2c]">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#8ab4f8]" />
          <span className="text-xs font-semibold text-[#f2f2f2] tracking-tight">
            Run settings
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenGetCodeModal}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono text-[#8e918f] hover:text-[#e3e3e3] hover:bg-[#282a2c] transition-colors cursor-pointer"
            title="Get LaTeX / API Code"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>&lt;&gt; Get code</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#8e918f] hover:text-[#e3e3e3] hover:bg-[#282a2c] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar text-xs">
        {/* Model Card */}
        <div className="p-3.5 rounded-2xl bg-[#1e1f20] border border-[#282a2c]">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-sm text-[#f2f2f2] truncate">
              {activeModel}
            </span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-[#8ab4f8] border border-blue-500/20">
              {activeProvider}
            </span>
          </div>
          <p className="text-[11px] text-[#8e918f] leading-relaxed mt-1">
            Universal intelligent engine tailored for deep reasoning, ATS alignment, and DIN 5008 German & English LaTeX compilation.
          </p>
        </div>

        {/* System Instructions */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-[#c4c7c5]">
            System instructions
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => onSystemPromptChange(e.target.value)}
            placeholder="Optional tone and style instructions for LaTeX tailoring and ATS parsing..."
            rows={3}
            className="w-full px-3 py-2 rounded-xl bg-[#1e1f20] border border-[#282a2c] text-xs text-[#e3e3e3] placeholder-[#5f6368] focus:outline-none focus:border-[#8ab4f8] transition-colors resize-none leading-relaxed"
          />
        </div>

        {/* Temperature Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-[#c4c7c5]">Temperature</span>
            <span className="font-mono text-[#8ab4f8] font-semibold">{temperature.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.05"
            value={temperature}
            onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
            className="w-full accent-[#8ab4f8] cursor-pointer bg-[#282a2c] h-1.5 rounded-lg"
          />
        </div>

        {/* Thinking Level Dropdown */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-[#c4c7c5]">
            Thinking level
          </label>
          <div className="relative">
            <select
              value={thinkingLevel}
              onChange={(e) => onThinkingLevelChange(e.target.value as any)}
              className="w-full appearance-none px-3 py-2 rounded-xl bg-[#1e1f20] border border-[#282a2c] text-xs text-[#e3e3e3] focus:outline-none focus:border-[#8ab4f8] transition-colors cursor-pointer"
            >
              <option value="High">High (Deep ATS Synthesis & Gap Strategy)</option>
              <option value="Medium">Medium (Balanced Reasoning)</option>
              <option value="Low">Low (Ultra Fast)</option>
              <option value="None">None (Direct Generation)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#8e918f] absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>

        {/* Tools Section */}
        <div className="space-y-3 pt-2 border-t border-[#282a2c]">
          <button
            type="button"
            onClick={() => setIsToolsExpanded(!isToolsExpanded)}
            className="w-full flex items-center justify-between text-[11px] font-semibold text-[#c4c7c5] hover:text-[#f2f2f2] transition-colors cursor-pointer"
          >
            <span>Tools</span>
            {isToolsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {isToolsExpanded && (
            <div className="space-y-3 pl-0.5">
              {/* Structured outputs */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium text-[#e3e3e3]">Structured outputs</div>
                  <div className="text-[10px] text-[#8e918f]">Strict JSON schemas for 3-pass pipeline</div>
                </div>
                <button
                  type="button"
                  onClick={onToggleStructuredOutputs}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                    structuredOutputs ? "bg-[#8ab4f8]" : "bg-[#282a2c]"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      structuredOutputs ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Grounding with Web Search / Scraper */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium text-[#e3e3e3]">Live Job URL Grounding</div>
                  <div className="text-[10px] text-[#8e918f]">Direct scraping from LinkedIn & StepStone</div>
                </div>
                <button
                  type="button"
                  onClick={onToggleWebScraperGrounding}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                    webScraperGrounding ? "bg-[#8ab4f8]" : "bg-[#282a2c]"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      webScraperGrounding ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Email Auto-Sync & Kanban Move (Optional Feature!) */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-[#e3e3e3]">Email Scanner Sync</span>
                    <span className="text-[8px] font-mono px-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      Optional
                    </span>
                  </div>
                  <div className="text-[10px] text-[#8e918f]">Auto-move Kanban cards on interview/rejection</div>
                </div>
                <button
                  type="button"
                  onClick={onToggleEmailAutoSync}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                    emailAutoSync ? "bg-[#8ab4f8]" : "bg-[#282a2c]"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      emailAutoSync ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Advanced Settings Accordion */}
        <div className="pt-2 border-t border-[#282a2c]">
          <button
            type="button"
            onClick={() => setIsAdvancedExpanded(!isAdvancedExpanded)}
            className="w-full flex items-center justify-between text-[11px] font-semibold text-[#c4c7c5] hover:text-[#f2f2f2] transition-colors cursor-pointer"
          >
            <span>Advanced LaTeX Settings</span>
            {isAdvancedExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {isAdvancedExpanded && (
            <div className="mt-3 space-y-2.5 text-[11px] text-[#8e918f]">
              <div className="flex justify-between items-center py-1">
                <span>CV Max Words</span>
                <span className="font-mono text-[#e3e3e3]">450 words (2-page)</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span>Cover Letter Words</span>
                <span className="font-mono text-[#e3e3e3]">280 words (1-page)</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span>German Standard</span>
                <span className="font-mono text-[#e3e3e3]">DIN 5008 Type B</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
