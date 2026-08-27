import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import yaml from "yaml";
import { createServer as createViteServer } from "vite";
import {
  initializeAdminUser,
  getAllUsers,
  saveUsers,
  hashPassword,
  verifyPassword,
  createSession,
  invalidateSession,
  authMiddleware,
  adminOnlyMiddleware,
  AuthenticatedRequest,
  getUserDataDir,
  StoredUser,
} from "./server/auth.js";
import {
  executeUniversalLLM,
  testProviderConnection,
  UserLLMSettings,
} from "./server/llm.js";
import {
  buildFullCVTex,
  buildFullCoverTex,
  compileLaTeX,
} from "./server/latex.js";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// Initialize base admin
initializeAdminUser();

// Available models catalog with provider mapping
const AVAILABLE_MODELS = [
  // Google Gemini
  { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash (Recommended)", tier: "Ultra Fast / High Accuracy", provider: "gemini" },
  { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash", tier: "Advanced Reasoning", provider: "gemini" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", tier: "High Speed", provider: "gemini" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", tier: "Deep Context / Large Documents", provider: "gemini" },
  
  // NVIDIA NIM Open APIs
  { id: "nvidia/nemotron-4-340b-instruct", name: "NVIDIA Nemotron-4 340B", tier: "Free Tier / Super Computing", provider: "nvidia", defaultBaseUrl: "https://integrate.api.nvidia.com/v1" },
  { id: "meta/llama-3.3-70b-instruct", name: "Meta LLaMA 3.3 70B (NVIDIA NIM)", tier: "Free Tier / High Speed", provider: "nvidia", defaultBaseUrl: "https://integrate.api.nvidia.com/v1" },
  { id: "deepseek-ai/deepseek-r1", name: "DeepSeek R1 (NVIDIA NIM)", tier: "Free Tier / Deep Reasoning", provider: "nvidia", defaultBaseUrl: "https://integrate.api.nvidia.com/v1" },
  { id: "mistralai/mixtral-8x22b-instruct", name: "Mistral 8x22B (NVIDIA NIM)", tier: "Free Tier / Multilingual", provider: "nvidia", defaultBaseUrl: "https://integrate.api.nvidia.com/v1" },

  // Groq Cloud
  { id: "llama-3.3-70b-versatile", name: "Groq LLaMA 3.3 70B", tier: "Ultra Fast (500+ tok/s)", provider: "groq", defaultBaseUrl: "https://api.groq.com/openai/v1" },
  { id: "mixtral-8x7b-32768", name: "Groq Mixtral 8x7B", tier: "Ultra Fast", provider: "groq", defaultBaseUrl: "https://api.groq.com/openai/v1" },

  // Ollama & Custom
  { id: "nemotron", name: "Local Ollama: Nemotron", tier: "Self-Hosted Local Host", provider: "ollama", defaultBaseUrl: "http://localhost:11434/v1" },
  { id: "llama3.3", name: "Local Ollama: LLaMA 3.3", tier: "Self-Hosted Local Host", provider: "ollama", defaultBaseUrl: "http://localhost:11434/v1" },
  { id: "custom", name: "Custom OpenAI-Compatible Model", tier: "Custom Server / OpenRouter", provider: "custom" },
];

const DEFAULT_USER_SETTINGS = {
  provider: "gemini",
  ai_model: "gemini-3.6-flash",
  base_url: "",
  api_key: "",
  temperature: 0.2,
  cv_max_words: 450,
  cover_max_words: 280,
  latex_compiler: "pdflatex",
  auto_save_kanban: true,
};

// Helper: load user settings
function getUserSettings(userId: string) {
  const userDir = getUserDataDir(userId);
  const settingsFile = path.join(userDir, "settings.json");
  if (fs.existsSync(settingsFile)) {
    try {
      return { ...DEFAULT_USER_SETTINGS, ...JSON.parse(fs.readFileSync(settingsFile, "utf-8")) };
    } catch {
      return { ...DEFAULT_USER_SETTINGS };
    }
  }
  return { ...DEFAULT_USER_SETTINGS };
}

// Helper: save user settings
function saveUserSettings(userId: string, updates: any) {
  const userDir = getUserDataDir(userId);
  const current = getUserSettings(userId);
  const updated = { ...current, ...updates };
  fs.writeFileSync(path.join(userDir, "settings.json"), JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}

// Helper: get user profile YAML
function getUserProfileYaml(userId: string): string {
  const userDir = getUserDataDir(userId);
  const profileFile = path.join(userDir, "master_profile.yaml");
  if (fs.existsSync(profileFile)) {
    return fs.readFileSync(profileFile, "utf-8");
  }
  return "";
}

// Helper: get user applications
function getUserTracker(userId: string): any[] {
  const userDir = getUserDataDir(userId);
  const trackerFile = path.join(userDir, "tracker_data.json");
  if (fs.existsSync(trackerFile)) {
    try {
      return JSON.parse(fs.readFileSync(trackerFile, "utf-8"));
    } catch {
      return [];
    }
  }
  return [];
}

function saveUserTracker(userId: string, apps: any[]) {
  const userDir = getUserDataDir(userId);
  fs.writeFileSync(path.join(userDir, "tracker_data.json"), JSON.stringify(apps, null, 2), "utf-8");
}

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

app.post("/api/auth/login", (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const users = getAllUsers();
  const user = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());

  if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  // Update last login
  user.lastLogin = new Date().toISOString();
  saveUsers(users);

  const session = createSession(user);

  res.json({
    token: session.token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    },
  });
});

app.get("/api/auth/me", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const userSession = req.user!;
  const users = getAllUsers();
  const user = users.find((u) => u.id === userSession.userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    },
  });
});

app.post("/api/auth/logout", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  if (req.user) {
    invalidateSession(req.user.token);
  }
  res.json({ message: "Logged out successfully." });
});

app.post("/api/auth/change-password", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }

  const users = getAllUsers();
  const user = users.find((u) => u.id === req.user!.userId);

  if (!user || !verifyPassword(currentPassword, user.passwordHash, user.salt)) {
    return res.status(400).json({ error: "Current password is incorrect." });
  }

  const { hash, salt } = hashPassword(newPassword);
  user.passwordHash = hash;
  user.salt = salt;
  saveUsers(users);

  res.json({ message: "Password updated successfully." });
});

// ==========================================
// ADMIN USER MANAGEMENT ROUTES
// ==========================================

app.get("/api/admin/users", authMiddleware, adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const users = getAllUsers();
  const userList = users.map((u) => {
    const tracker = getUserTracker(u.id);
    const hasProfile = fs.existsSync(path.join(getUserDataDir(u.id), "master_profile.yaml"));
    const settings = getUserSettings(u.id);

    return {
      id: u.id,
      username: u.username,
      role: u.role,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin,
      hasProfile,
      applicationCount: tracker.length,
      provider: settings.provider,
      ai_model: settings.ai_model,
    };
  });

  res.json({ users: userList });
});

app.post("/api/admin/users", authMiddleware, adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { username, password, role } = req.body;

  if (!username || !password || password.length < 6) {
    return res.status(400).json({ error: "Username and a minimum 6-character password are required." });
  }

  const validRole = role === "admin" ? "admin" : "user";
  const users = getAllUsers();

  if (users.some((u) => u.username.toLowerCase() === username.trim().toLowerCase())) {
    return res.status(400).json({ error: `Username '${username}' already exists.` });
  }

  const { hash, salt } = hashPassword(password);
  const newUser: StoredUser = {
    id: `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
    username: username.trim(),
    passwordHash: hash,
    salt,
    role: validRole,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);

  // Initialize directory
  getUserDataDir(newUser.id);

  res.json({
    message: `User '${newUser.username}' created successfully with role '${validRole}'.`,
    user: {
      id: newUser.id,
      username: newUser.username,
      role: newUser.role,
      createdAt: newUser.createdAt,
    },
  });
});

app.post("/api/admin/users/:id/reset-password", authMiddleware, adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }

  const users = getAllUsers();
  const user = users.find((u) => u.id === id);

  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  const { hash, salt } = hashPassword(newPassword);
  user.passwordHash = hash;
  user.salt = salt;
  saveUsers(users);

  res.json({ message: `Password for '${user.username}' was reset successfully.` });
});

app.delete("/api/admin/users/:id", authMiddleware, adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  if (id === req.user!.userId) {
    return res.status(400).json({ error: "You cannot delete your own account while logged in." });
  }

  let users = getAllUsers();
  const user = users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  users = users.filter((u) => u.id !== id);
  saveUsers(users);

  // Clean up directory
  try {
    const userDir = getUserDataDir(id);
    if (fs.existsSync(userDir)) {
      fs.rmSync(userDir, { recursive: true, force: true });
    }
  } catch (e) {
    console.warn("Could not remove user directory:", e);
  }

  res.json({ message: `User '${user.username}' deleted successfully.` });
});

// ==========================================
// USER SETTINGS & AI PROVIDER CONFIGURATION
// ==========================================

app.get("/api/settings", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const settings = getUserSettings(req.user!.userId);
  const maskedKey = settings.api_key
    ? settings.api_key.length > 8
      ? `${settings.api_key.slice(0, 4)}...${settings.api_key.slice(-4)}`
      : "••••••••"
    : "";

  const hasEnvKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_STUDIO_API_KEY);

  res.json({
    provider: settings.provider,
    ai_model: settings.ai_model,
    base_url: settings.base_url || "",
    api_key_masked: maskedKey,
    has_custom_key: !!settings.api_key,
    has_env_key: hasEnvKey,
    temperature: settings.temperature,
    cv_max_words: settings.cv_max_words,
    cover_max_words: settings.cover_max_words,
    latex_compiler: settings.latex_compiler,
    auto_save_kanban: settings.auto_save_kanban,
    available_models: AVAILABLE_MODELS,
    user_id: req.user!.userId,
  });
});

app.post("/api/settings", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { provider, ai_model, base_url, api_key, temperature, cv_max_words, cover_max_words } = req.body;

  const updates: any = {};
  if (provider) updates.provider = provider;
  if (ai_model) updates.ai_model = ai_model;
  if (base_url !== undefined) updates.base_url = base_url;
  if (api_key !== undefined) updates.api_key = api_key;
  if (typeof temperature === "number") updates.temperature = temperature;
  if (typeof cv_max_words === "number") updates.cv_max_words = cv_max_words;
  if (typeof cover_max_words === "number") updates.cover_max_words = cover_max_words;

  const saved = saveUserSettings(userId, updates);
  res.json({ message: "Settings saved successfully", settings: saved });
});

app.post("/api/settings/test-connection", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const currentSettings = getUserSettings(userId);
  const draftSettings = { ...currentSettings, ...req.body };

  const testConfig: UserLLMSettings = {
    provider: draftSettings.provider || "gemini",
    ai_model: draftSettings.ai_model || "gemini-3.6-flash",
    base_url: draftSettings.base_url,
    api_key: draftSettings.api_key || currentSettings.api_key,
    temperature: 0.1,
  };

  try {
    const result = await testProviderConnection(testConfig);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      provider: testConfig.provider,
      model: testConfig.ai_model,
      error: error.message || "Failed to establish connection with AI provider",
    });
  }
});

// ==========================================
// USER PROFILE MANAGEMENT & YAML UPLOAD
// ==========================================

app.get("/api/profile", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const rawYaml = getUserProfileYaml(userId);

  let parsed = null;
  let parseError = null;

  if (rawYaml) {
    try {
      parsed = yaml.parse(rawYaml);
    } catch (e: any) {
      parseError = e.message;
    }
  }

  res.json({
    raw_yaml: rawYaml,
    parsed_profile: parsed,
    error: parseError,
  });
});

app.post("/api/profile", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { raw_yaml } = req.body;

  if (!raw_yaml || typeof raw_yaml !== "string") {
    return res.status(400).json({ error: "YAML content string is required." });
  }

  try {
    const parsed = yaml.parse(raw_yaml);
    const userDir = getUserDataDir(userId);
    fs.writeFileSync(path.join(userDir, "master_profile.yaml"), raw_yaml, "utf-8");

    res.json({
      message: "Profile updated and validated successfully.",
      parsed_profile: parsed,
    });
  } catch (e: any) {
    return res.status(400).json({
      error: `YAML Validation Error: ${e.message}`,
    });
  }
});

// ==========================================
// UNIVERSAL 3-PASS AI PIPELINE ROUTES
// ==========================================

const SYSTEM_RULES = `You are an elite, zero-hallucination German & International Career Specialist and LaTeX Typesetting Architect.
Your core principles:
1. TRUTH IN GROUNDING: ONLY use experiences, projects, dates, degrees, and skills that exist in the candidate's master profile. Never fabricate or extrapolate.
2. 2-PAGE STRICT CEILING FOR CV: The CV MUST fit perfectly within 2 pages (max 450 words total body).
3. 1-PAGE STRICT CEILING FOR COVER LETTER: The Cover Letter MUST fit on a single page (250-280 words).
4. HONEST GAP ANALYSIS: Explicitly identify missing requirements so the user knows where they stand.`;

// Pass 1: Analyze & Match Job Description
app.post("/api/ai/pass-1-analyze", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { job_description, job_url, company, title, language = "en" } = req.body;

  if (!job_description || job_description.trim().length < 20) {
    return res.status(400).json({ error: "Please provide a valid job description." });
  }

  const profileYaml = getUserProfileYaml(userId);
  if (!profileYaml) {
    return res.status(400).json({ error: "Candidate profile not found. Please upload or configure your master_profile.yaml in Profile (👤)." });
  }

  const userSettings = getUserSettings(userId);
  const isGerman = language === "de";

  const prompt = `Analyze this Job Description against the Candidate's Master Profile.
TARGET LANGUAGE FOR OUTPUT: ${isGerman ? "GERMAN (Deutsch - professional business German DIN 5008 standard tone)" : "ENGLISH"}.

CANDIDATE MASTER PROFILE (Ground Truth):
${profileYaml}

TARGET JOB METADATA:
Company: ${company || "Unknown"}
Title: ${title || "Unknown"}
URL: ${job_url || ""}

JOB DESCRIPTION:
${job_description}

TASK:
1. Extract Job Analysis: exact role title, target company, must_have technical requirements, nice_to_have requirements, tone.
2. Select optimal Content Plan: pick matching skills, prioritize experience entries, decide on projects.
3. Perform honest Gap Analysis: list missing skills and requirements truthfully (${isGerman ? "in German" : "in English"}).
4. Estimate output lengths (cv_words ~400, cover_words ~260).

Return valid JSON with schema:
{
  "job_analysis": {
    "title": string,
    "company": string,
    "must_have": [string],
    "nice_to_have": [string],
    "tone": "formal" | "technical" | "casual"
  },
  "content_plan": {
    "summary_variant": string,
    "dynamic_header_title": string,
    "selected_skills": [{"name": string, "category": string}],
    "selected_experience": [{"company": string, "title": string, "selected_bullets": [number], "priority": number}],
    "education_entries": [number],
    "include_projects": boolean,
    "certifications_to_include": [number]
  },
  "gaps": {
    "missing_skills": [string],
    "missing_requirements": [string],
    "strategy": string
  },
  "estimated_length": {
    "cv_words": number,
    "cover_words": number
  }
}`;

  try {
    const result = await executeUniversalLLM({
      prompt,
      systemInstruction: SYSTEM_RULES,
      settings: userSettings,
      jsonMode: true,
    });

    res.json(result.data);
  } catch (error: any) {
    res.status(500).json({ error: `Pass 1 Analysis Failed: ${error.message}` });
  }
});

// Pass 2: Generate Tailored 2-Page CV Sections
app.post("/api/ai/generate-cv", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { pass_1_analysis, language = "en" } = req.body;

  if (!pass_1_analysis) {
    return res.status(400).json({ error: "Pass 1 analysis is required." });
  }

  const profileYaml = getUserProfileYaml(userId);
  const userSettings = getUserSettings(userId);
  const isGerman = language === "de";

  const prompt = `Generate tailored LaTeX content sections for a 2-PAGE CURRICULUM VITAE (${isGerman ? "LEBENSLAUF auf Deutsch" : "CV in English"}) based on this plan.

TARGET LANGUAGE: ${isGerman ? "GERMAN (Deutsch - professional German career terminology, e.g., 'Berufserfahrung', 'Kenntnisse & Fähigkeiten', 'Ausbildung')" : "ENGLISH"}.

CANDIDATE MASTER PROFILE (Ground Truth):
${profileYaml}

PASS 1 MATCH PLAN:
${JSON.stringify(pass_1_analysis, null, 2)}

STRICT REQUIREMENTS:
- Output valid LaTeX formatting for each section (escape &, %, $, #, _, {, }).
- ${isGerman ? "Translate/Adapt section bullet points and role highlights into pristine, natural business German while preserving exact factual numbers, metrics, and tools from the profile." : "Keep in pristine English."}
- STRICT LENGTH: Keep total CV body under ${userSettings.cv_max_words || 450} words to ensure it strictly renders onto 2 pages.
- Highlight candidate's exact achievements matching the target job without hallucinating new ones.

Return valid JSON with schema:
{
  "dynamic_header_title": string,
  "professional_summary": string,
  "skills_section": string,
  "experience_sections": string,
  "education_section": string,
  "projects_section": string,
  "languages_section": string
}`;

  try {
    const result = await executeUniversalLLM({
      prompt,
      systemInstruction: SYSTEM_RULES,
      settings: userSettings,
      jsonMode: true,
    });

    res.json(result.data);
  } catch (error: any) {
    res.status(500).json({ error: `Pass 2 CV Generation Failed: ${error.message}` });
  }
});

// Pass 3: Generate Tailored 1-Page Cover Letter
app.post("/api/ai/generate-cover", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { pass_1_analysis, language = "en" } = req.body;

  if (!pass_1_analysis) {
    return res.status(400).json({ error: "Pass 1 analysis is required." });
  }

  const profileYaml = getUserProfileYaml(userId);
  const userSettings = getUserSettings(userId);
  const isGerman = language === "de";

  const prompt = `Write a persuasive, highly tailored, 1-PAGE COVER LETTER (${isGerman ? "ANSCHREIBEN auf Deutsch nach DIN 5008 Standard" : "Cover Letter in English"}) based on the analysis.

TARGET LANGUAGE: ${isGerman ? "GERMAN (Deutsch - professional formal salutation 'Sehr geehrte Damen und Herren,' or specific contact name, 'Mit freundlichen Grüßen' closing, natural German business eloquence)" : "ENGLISH"}.

CANDIDATE MASTER PROFILE:
${profileYaml}

PASS 1 ANALYSIS:
${JSON.stringify(pass_1_analysis, null, 2)}

STRICT REQUIREMENTS:
- Strict length: 240-280 words maximum (must fit comfortably on 1 printed page).
- 3 distinct body paragraphs:
  1. Hook & Passion for the specific company and role.
  2. Proof of Impact: directly citing 1-2 verified achievements from profile matching must-haves.
  3. Alignment with company mission and forward-looking contribution.
- Professional closing and salutation.

Return valid JSON with schema:
{
  "recipient_company": string,
  "recipient_location": string,
  "subject_line": string,
  "salutation": string,
  "body_paragraph_1": string,
  "body_paragraph_2": string,
  "body_paragraph_3": string,
  "closing": string
}`;

  try {
    const result = await executeUniversalLLM({
      prompt,
      systemInstruction: SYSTEM_RULES,
      settings: userSettings,
      jsonMode: true,
    });

    res.json(result.data);
  } catch (error: any) {
    res.status(500).json({ error: `Pass 3 Cover Letter Failed: ${error.message}` });
  }
});

// Run Full Pipeline In One Request
app.post("/api/ai/run-pipeline", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { job_description, job_url, company, title, language = "en" } = req.body;

  const profileYaml = getUserProfileYaml(userId);
  if (!profileYaml) {
    return res.status(400).json({ error: "Please configure your master_profile.yaml in Profile (👤)." });
  }

  const userSettings = getUserSettings(userId);
  const isGerman = language === "de";
  let parsedProfile: any = {};
  try {
    parsedProfile = yaml.parse(profileYaml);
  } catch {}

  try {
    // Pass 1
    const p1Prompt = `Analyze this Job Description against the Candidate's Master Profile:\nTARGET LANGUAGE: ${isGerman ? "GERMAN" : "ENGLISH"}\n\nPROFILE:\n${profileYaml}\n\nJOB METADATA:\nCompany: ${company || "Target Company"}\nTitle: ${title || "Target Role"}\nURL: ${job_url || ""}\n\nJOB DESCRIPTION:\n${job_description}\n\nReturn valid JSON: {"job_analysis": {"title": string, "company": string, "must_have": [string], "nice_to_have": [string], "tone": string}, "content_plan": {"summary_variant": string, "dynamic_header_title": string, "selected_skills": [{"name": string, "category": string}], "selected_experience": [{"company": string, "title": string, "selected_bullets": [number], "priority": number}], "education_entries": [number], "include_projects": boolean, "certifications_to_include": [number]}, "gaps": {"missing_skills": [string], "missing_requirements": [string], "strategy": string}, "estimated_length": {"cv_words": number, "cover_words": number}}`;
    
    const p1Res = await executeUniversalLLM({
      prompt: p1Prompt,
      systemInstruction: SYSTEM_RULES,
      settings: userSettings,
      jsonMode: true,
    });
    const pass1 = p1Res.data;

    // Pass 2
    const p2Prompt = `Generate tailored LaTeX content sections for a 2-PAGE CURRICULUM VITAE (${isGerman ? "Lebenslauf auf Deutsch" : "CV in English"}) based on this plan.\nTARGET LANGUAGE: ${isGerman ? "GERMAN (Deutsch)" : "ENGLISH"}\n\nPROFILE:\n${profileYaml}\n\nPLAN:\n${JSON.stringify(pass1, null, 2)}\n\nStrict length: max 450 words total.\n\nReturn valid JSON: {"dynamic_header_title": string, "professional_summary": string, "skills_section": string, "experience_sections": string, "education_section": string, "projects_section": string, "languages_section": string}`;
    const p2Res = await executeUniversalLLM({
      prompt: p2Prompt,
      systemInstruction: SYSTEM_RULES,
      settings: userSettings,
      jsonMode: true,
    });
    const pass2 = p2Res.data;

    // Pass 3
    const p3Prompt = `Write a persuasive, highly tailored, 1-PAGE COVER LETTER (${isGerman ? "Anschreiben auf Deutsch" : "Cover Letter in English"}, 240-280 words).\nTARGET LANGUAGE: ${isGerman ? "GERMAN" : "ENGLISH"}\n\nPROFILE:\n${profileYaml}\n\nPLAN:\n${JSON.stringify(pass1, null, 2)}\n\nReturn valid JSON: {"recipient_company": string, "recipient_location": string, "subject_line": string, "salutation": string, "body_paragraph_1": string, "body_paragraph_2": string, "body_paragraph_3": string, "closing": string}`;
    const p3Res = await executeUniversalLLM({
      prompt: p3Prompt,
      systemInstruction: SYSTEM_RULES,
      settings: userSettings,
      jsonMode: true,
    });
    const pass3 = p3Res.data;

    const fullCvTex = buildFullCVTex(parsedProfile?.personal, pass1, pass2, isGerman ? "de" : "en");
    const fullCoverTex = buildFullCoverTex(parsedProfile?.personal, pass1, pass3, isGerman ? "de" : "en");

    const fullResult = {
      pass_1: pass1,
      pass_2: pass2,
      pass_3: pass3,
      gaps: pass1?.gaps,
      job_analysis: pass1?.job_analysis,
      job_metadata: {
        url: job_url,
        company: company || pass1?.job_analysis?.company,
        title: title || pass1?.job_analysis?.title,
        raw_jd: job_description,
      },
      compiled_cv_tex: fullCvTex,
      compiled_cover_tex: fullCoverTex,
      language: isGerman ? "de" : "en",
    };

    // Auto-save to tracker if enabled
    if (userSettings.auto_save_kanban) {
      const tracker = getUserTracker(userId);
      const newApp = {
        id: `app_${Date.now().toString(36)}`,
        url: job_url || "",
        company: pass1?.job_analysis?.company || company || "Target Company",
        role: pass1?.job_analysis?.title || title || "Target Role",
        source: "AI Pipeline",
        date_scraped: new Date().toISOString().split("T")[0],
        status: "tailored",
        gaps: pass1?.gaps,
        pass_data: fullResult,
        notes: `Tailored with ${userSettings.provider.toUpperCase()} (${userSettings.ai_model}) [${isGerman ? "German/DE" : "English/EN"}].`,
      };
      tracker.unshift(newApp);
      saveUserTracker(userId, tracker);
    }

    res.json(fullResult);
  } catch (error: any) {
    res.status(500).json({ error: `AI Pipeline Execution Failed: ${error.message}` });
  }
});

// ==========================================
// LATEX & PDF COMPILATION & EXPORT ROUTES
// ==========================================

app.post("/api/latex/generate-full", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { type, pass_1, pass_2, pass_3, language = "en" } = req.body;
  const profileYaml = getUserProfileYaml(userId);
  let parsedProfile: any = {};
  try {
    parsedProfile = yaml.parse(profileYaml);
  } catch {}

  const isGerman = language === "de";

  if (type === "cover") {
    const tex = buildFullCoverTex(parsedProfile?.personal, pass_1, pass_3, isGerman ? "de" : "en");
    return res.json({ tex });
  } else {
    const tex = buildFullCVTex(parsedProfile?.personal, pass_1, pass_2, isGerman ? "de" : "en");
    return res.json({ tex });
  }
});

app.post("/api/latex/compile", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { latex_source, filename = "document" } = req.body;

  if (!latex_source) {
    return res.status(400).json({ error: "LaTeX source code is required." });
  }

  const result = await compileLaTeX(latex_source, filename);

  if (result.success && result.pdfBuffer) {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
    return res.send(result.pdfBuffer);
  }

  res.status(422).json({
    success: false,
    error: result.error || "Compilation failed",
    log: result.log,
  });
});

// ==========================================
// KANBAN APPLICATION TRACKER ROUTES
// ==========================================

app.get("/api/tracker", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const applications = getUserTracker(userId);
  res.json({ applications });
});

app.post("/api/tracker", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const newApp = {
    id: `app_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 5)}`,
    date_scraped: new Date().toISOString().split("T")[0],
    source: "Manual",
    status: "tailored",
    ...req.body,
  };

  const applications = getUserTracker(userId);
  applications.unshift(newApp);
  saveUserTracker(userId, applications);

  res.json({ application: newApp });
});

app.patch("/api/tracker/:id", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { id } = req.params;
  const applications = getUserTracker(userId);
  const idx = applications.findIndex((a) => a.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: "Application record not found." });
  }

  applications[idx] = { ...applications[idx], ...req.body };
  saveUserTracker(userId, applications);

  res.json({ application: applications[idx] });
});

app.delete("/api/tracker/:id", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { id } = req.params;
  let applications = getUserTracker(userId);
  applications = applications.filter((a) => a.id !== id);
  saveUserTracker(userId, applications);

  res.json({ message: "Application deleted successfully." });
});

// ==========================================
// VITE SPA MIDDLEWARE / PRODUCTION STATIC
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[AutoApply Server] Running at http://localhost:${PORT}`);
  });
}

startServer();
