export interface User {
  id: string;
  username: string;
  role: "admin" | "user";
  createdAt: string;
  lastLogin?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export type AIProvider = "gemini" | "nvidia" | "groq" | "ollama" | "openai" | "custom";

export interface ModelOption {
  id: string;
  name: string;
  tier: string;
  provider: AIProvider;
  defaultBaseUrl?: string;
}

export interface AppSettingsData {
  provider: AIProvider;
  ai_model: string;
  base_url?: string;
  api_key_masked: string;
  has_custom_key: boolean;
  has_env_key: boolean;
  temperature: number;
  cv_max_words: number;
  cover_max_words: number;
  latex_compiler: string;
  auto_save_kanban: boolean;
  available_models: ModelOption[];
  data_dir?: string;
  user_id?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  latencyMs?: number;
  model?: string;
  provider?: string;
  response?: string;
  message?: string;
  error?: string;
}

export interface AdminUserSummary {
  id: string;
  username: string;
  role: "admin" | "user";
  createdAt: string;
  lastLogin?: string;
  hasProfile: boolean;
  applicationCount: number;
  provider?: string;
  ai_model?: string;
}

export interface PersonalInfo {
  name: string;
  title: string;
  email: string;
  phone: string;
  address: string;
  linkedin: string;
  portfolio: string;
  photo_path?: string;
}

export interface SkillItem {
  name: string;
  level: string;
  years: number;
  category: string;
}

export interface ExperienceItem {
  company: string;
  title: string;
  dates: string;
  location: string;
  bullets: string[];
  skills_used: string[];
  highlights?: string;
}

export interface EducationItem {
  school: string;
  degree: string;
  dates: string;
  details: string[];
}

export interface ProjectItem {
  name: string;
  dates: string;
  bullets: string[];
}

export interface MasterProfile {
  personal: PersonalInfo;
  summary: {
    technical: string;
    leadership: string;
    general: string;
  };
  skills: SkillItem[];
  experience: ExperienceItem[];
  education: EducationItem[];
  projects: ProjectItem[];
  certifications: { name: string; issuer: string; year: string }[];
  languages: { language: string; proficiency: string }[];
  cover_letter_snippets?: Record<string, string>;
}

export interface JobAnalysis {
  title: string;
  company: string;
  must_have: string[];
  nice_to_have: string[];
  tone: "formal" | "casual" | "technical" | "creative";
}

export interface ContentPlan {
  summary_variant: string;
  dynamic_header_title: string;
  selected_skills: { name: string; category: string }[];
  selected_experience: {
    company: string;
    title: string;
    selected_bullets: number[];
    priority: number;
  }[];
  education_entries: number[];
  include_projects: boolean;
  certifications_to_include: number[];
}

export interface GapAnalysis {
  missing_skills?: string[];
  missing_requirements?: string[];
  strategy?: string;
}

export interface Pass1Result {
  job_analysis: JobAnalysis;
  content_plan: ContentPlan;
  gaps: GapAnalysis;
  estimated_length: {
    cv_words: number;
    cover_words: number;
  };
}

export interface Pass2Result {
  dynamic_header_title: string;
  professional_summary: string;
  skills_section: string;
  experience_sections: string;
  education_section: string;
  projects_section?: string;
  languages_section?: string;
}

export interface Pass3Result {
  recipient_company: string;
  recipient_location: string;
  subject_line: string;
  salutation: string;
  body_paragraph_1: string;
  body_paragraph_2: string;
  body_paragraph_3: string;
  closing: string;
}

export interface PipelineResults {
  pass_1?: Pass1Result;
  pass_2?: Pass2Result;
  pass_3?: Pass3Result;
  gaps?: GapAnalysis;
  job_analysis?: JobAnalysis;
  job_metadata?: {
    url?: string;
    company?: string;
    title?: string;
    raw_jd?: string;
  };
  compiled_cv_tex?: string;
  compiled_cover_tex?: string;
  language?: "en" | "de";
}

export type DocumentLanguage = "en" | "de";

export interface LanguageOption {
  code: DocumentLanguage;
  label: string;
  nativeLabel: string;
  flag: string;
  description: string;
}

export type ThemeMode = "dark" | "light";

export type ThemePreset =
  | "google-ai-studio"
  | "zinc-dark"
  | "slate-light"
  | "obsidian-dark"
  | "warm-paper"
  | "vscode-slate"
  | "nordic-frost"
  | "obsidian"
  | "tokyo-storm"
  | "clean-studio";

export interface ThemeConfig {
  id: ThemePreset;
  name: string;
  mode: ThemeMode;
  description: string;
  previewBg: string;
  previewCard: string;
  previewAccent: string;
}

export type ApplicationStatus = "scraped" | "tailored" | "applied" | "active" | "closed";

export interface ApplicationRecord {
  id: string;
  url: string;
  company: string;
  role: string;
  source: string;
  date_scraped: string;
  date_applied?: string;
  status: ApplicationStatus;
  notes?: string;
  gaps?: GapAnalysis;
  pass_data?: PipelineResults;
  email_synced_at?: string;
  last_email_feedback?: string;
}

export type EmailProviderType = "gmail_oauth" | "imap" | "forwarding" | "simulated";

export interface EmailAccountConfig {
  id: string;
  email: string;
  label: string;
  provider: EmailProviderType;
  status: "connected" | "disconnected" | "syncing" | "error";
  lastSync?: string;
  imapHost?: string;
  imapPort?: number;
  username?: string;
  password?: string;
  hasPassword?: boolean;
}

export type DetectedEmailOutcome =
  | "interview"
  | "assessment"
  | "rejection"
  | "acknowledgement"
  | "offer"
  | "other";

export interface EmailFeedbackLog {
  id: string;
  accountId: string;
  accountEmail: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  date: string;
  snippet: string;
  matchedApplicationId?: string;
  company: string;
  role: string;
  detectedOutcome: DetectedEmailOutcome;
  previousStatus?: ApplicationStatus;
  newStatus: ApplicationStatus;
  aiConfidence: number;
  analysisExplanation: string;
  processedAt: string;
  actionTaken: "created_card" | "moved_kanban" | "synced_feedback" | "logged_only" | "no_match";
}

export type BackScanTimeframe = "7d" | "30d" | "90d" | "180d" | "365d" | "custom";

export interface BackScanRequest {
  accountId?: string;
  timeframe: BackScanTimeframe;
  startDate?: string;
  endDate?: string;
  autoMoveKanban?: boolean;
  dryRun?: boolean;
  maxResults?: number;
}

export interface BackScanSummary {
  totalScanned: number;
  matchedRecruiterEmails: number;
  cardsUpdated: number;
  timeframeDescription: string;
  dryRun: boolean;
  dateRange: { from: string; to: string };
  errors: string[];
}

export interface EmailSettingsData {
  enabled: boolean;
  autoMoveKanban: boolean;
  syncIntervalMinutes: number;
  accounts: EmailAccountConfig[];
  logs: EmailFeedbackLog[];
  lastGlobalSync?: string;
  lastBackScanSummary?: BackScanSummary;
}

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  source: "pipeline" | "scraper" | "latex" | "auth" | "email" | "system";
  level: "info" | "warn" | "error";
  message: string;
  username?: string;
  durationMs?: number;
  details?: Record<string, any>;
}

export interface SystemDiagnostics {
  uptimeSeconds: number;
  memoryUsageMb: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  totalUsers: number;
  totalApplications: number;
  nodeVersion: string;
  environment: string;
}


