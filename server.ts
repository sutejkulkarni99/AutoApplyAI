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
import {
  testImapHandshake,
  fetchHistoricalEmails,
  classifyRecruiterEmailRuleBased,
  ImapAccountConfig,
} from "./server/imap.js";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// Initialize base admin
initializeAdminUser();

// ==========================================
// SYSTEM AUDIT & DIAGNOSTIC LOGGING BUFFER
// ==========================================
export interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  category: "llm" | "latex" | "scraper" | "email" | "auth" | "system";
  message: string;
  durationMs?: number;
  details?: any;
}

const MAX_LOG_ENTRIES = 300;
const systemLogs: SystemLogEntry[] = [];

export function addSystemLog(
  category: SystemLogEntry["category"],
  level: SystemLogEntry["level"],
  message: string,
  details?: any,
  durationMs?: number
) {
  const entry: SystemLogEntry = {
    id: `log_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    durationMs,
    details: details ? (typeof details === "string" ? details : JSON.parse(JSON.stringify(details))) : undefined,
  };

  systemLogs.unshift(entry);
  if (systemLogs.length > MAX_LOG_ENTRIES) {
    systemLogs.pop();
  }

  // Console output
  const prefix = `[${entry.category.toUpperCase()}] [${entry.level.toUpperCase()}]`;
  if (level === "error") {
    console.error(prefix, message, details || "");
  } else if (level === "warn") {
    console.warn(prefix, message, details || "");
  } else {
    console.log(prefix, message);
  }
}

// Initial system boot log
addSystemLog("system", "info", "AutoApply server engine initialized", {
  port: PORT,
  nodeEnv: process.env.NODE_ENV || "development",
  platform: process.platform,
});

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

// Helper: get user email settings
function getUserEmailSettings(userId: string) {
  const userDir = getUserDataDir(userId);
  const emailFile = path.join(userDir, "email_settings.json");
  const defaultSettings = {
    enabled: false,
    autoMoveKanban: false,
    syncIntervalMinutes: 15,
    lastGlobalSync: new Date().toISOString(),
    accounts: [],
    logs: [],
  };

  if (fs.existsSync(emailFile)) {
    try {
      const saved = JSON.parse(fs.readFileSync(emailFile, "utf-8"));
      return { ...defaultSettings, ...saved };
    } catch {
      return defaultSettings;
    }
  }
  return defaultSettings;
}

function saveUserEmailSettings(userId: string, data: any) {
  const userDir = getUserDataDir(userId);
  fs.writeFileSync(path.join(userDir, "email_settings.json"), JSON.stringify(data, null, 2), "utf-8");
}

// ==========================================
// KANBAN APPLICATION TRACKER ROUTES
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
  addSystemLog("auth", "info", `User '${user.username}' logged in successfully`, {
    role: user.role,
    userId: user.id,
  });

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

  addSystemLog("auth", "info", `User '${user.username}' deleted by admin`, { deletedUserId: id, admin: req.user!.username });
  res.json({ message: `User '${user.username}' deleted successfully.` });
});

// ==========================================
// SYSTEM AUDIT & DIAGNOSTIC LOGS ENDPOINTS
// ==========================================

app.get("/api/admin/system-logs", authMiddleware, adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { category, level, search, limit = 100 } = req.query;

  let filtered = [...systemLogs];

  if (category && typeof category === "string" && category !== "all") {
    filtered = filtered.filter((l) => l.category === category);
  }

  if (level && typeof level === "string" && level !== "all") {
    filtered = filtered.filter((l) => l.level === level);
  }

  if (search && typeof search === "string") {
    const term = search.toLowerCase();
    filtered = filtered.filter(
      (l) =>
        l.message.toLowerCase().includes(term) ||
        (l.details && JSON.stringify(l.details).toLowerCase().includes(term))
    );
  }

  const maxItems = Math.min(Number(limit) || 100, 300);
  res.json({
    logs: filtered.slice(0, maxItems),
    total: systemLogs.length,
    filteredCount: filtered.length,
  });
});

app.post("/api/admin/system-logs/clear", authMiddleware, adminOnlyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const previousCount = systemLogs.length;
  systemLogs.length = 0;
  addSystemLog("system", "info", "System diagnostic logs cleared by administrator", {
    admin: req.user!.username,
    clearedCount: previousCount,
  });
  res.json({ message: "System logs cleared successfully.", previousCount });
});

app.get("/api/admin/system-diagnostics", authMiddleware, adminOnlyMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const users = getAllUsers();
  const memory = process.memoryUsage();
  
  res.json({
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    platform: process.platform,
    environment: process.env.NODE_ENV || "development",
    memoryUsage: {
      rssMb: (memory.rss / 1024 / 1024).toFixed(1),
      heapTotalMb: (memory.heapTotal / 1024 / 1024).toFixed(1),
      heapUsedMb: (memory.heapUsed / 1024 / 1024).toFixed(1),
    },
    metrics: {
      totalUsers: users.length,
      adminUsers: users.filter((u) => u.role === "admin").length,
      logCount: systemLogs.length,
    },
  });
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
// JOB URL WEB SCRAPER ENDPOINT (AGGRESSIVE BILINGUAL)
// ==========================================

app.post("/api/fetch-job", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  let { url, language = "en" } = req.body;
  if (!url || typeof url !== "string" || !url.trim()) {
    return res.status(400).json({ error: "Job posting URL is required." });
  }

  url = url.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  try {
    let rawContent = "";
    let extractedTitle = "";
    let extractedCompany = "";
    let fetchSource = "none";
    let jsonLdFound = false;

    // Helper: Extract JSON-LD JobPosting schema if present
    const parseJsonLd = (htmlText: string) => {
      try {
        const jsonLdMatches = htmlText.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
        if (jsonLdMatches) {
          for (const match of jsonLdMatches) {
            const cleanJsonStr = match.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim();
            try {
              const data = JSON.parse(cleanJsonStr);
              const items = Array.isArray(data) ? data : [data, ...(data["@graph"] || [])];
              for (const item of items) {
                if (item && (item["@type"] === "JobPosting" || item["@type"]?.includes("JobPosting"))) {
                  if (item.title) extractedTitle = item.title;
                  if (item.hiringOrganization?.name) extractedCompany = item.hiringOrganization.name;
                  if (item.description) {
                    jsonLdFound = true;
                    return item.description;
                  }
                }
              }
            } catch {
              // Ignore single JSON-LD block syntax errors
            }
          }
        }
      } catch {
        // Ignore regex failures
      }
      return null;
    };

    // TIER 1: Direct Fetch with browser headers & JSON-LD / HTML parsing
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      const directRes = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "de-DE,de;q=0.9,en-US,en;q=0.8,de-AT,de-CH",
          "Cache-Control": "no-cache",
          "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124"',
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (directRes.ok) {
        const html = await directRes.text();
        const jsonLdDesc = parseJsonLd(html);
        if (jsonLdDesc) {
          rawContent = jsonLdDesc;
          fetchSource = "direct_json_ld";
        } else if (html && html.length > 300) {
          rawContent = html;
          fetchSource = "direct_html";
        }
      }
    } catch (e) {
      console.warn("Direct fetch failed or timed out:", e);
    }

    // TIER 2: Jina AI Reader API fallback (Translates complex pages into markdown)
    if (!rawContent || rawContent.length < 150) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
        const jinaRes = await fetch(jinaUrl, {
          method: "GET",
          headers: {
            "Accept": "text/plain, text/markdown, */*",
            "X-No-Cache": "true",
            "X-Target-Selector": "main, article, .job-description, #job-details, .description, .posting-requirements, .job-posting, [data-automation='jobDescription'], .job-details-content",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept-Language": "de-DE,de;q=0.9,en-US,en;q=0.8",
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (jinaRes.ok) {
          const jinaText = await jinaRes.text();
          if (jinaText && jinaText.length > 100) {
            rawContent = jinaText;
            fetchSource = "jina_reader";
          }
        }
      } catch (jinaErr) {
        console.warn("Jina reader fallback error:", jinaErr);
      }
    }

    // TIER 3: CORS Proxy Fallback if blocked or empty
    if (!rawContent || rawContent.length < 100) {
      try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const proxyRes = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (proxyRes.ok) {
          const proxyHtml = await proxyRes.text();
          const jsonLdDesc = parseJsonLd(proxyHtml);
          if (jsonLdDesc) {
            rawContent = jsonLdDesc;
            fetchSource = "proxy_json_ld";
          } else if (proxyHtml.length > 200) {
            rawContent = proxyHtml;
            fetchSource = "cors_proxy";
          }
        }
      } catch (proxyErr) {
        console.warn("CORS proxy error:", proxyErr);
      }
    }

    if (!rawContent || rawContent.length < 30) {
      return res.status(400).json({
        error: "Could not extract content from the URL. The job board may require login or block automated scrapers. Please copy and paste the job description text manually.",
      });
    }

    // TIER 4: LLM BILINGUAL CONTENT PARSING & CLEANUP
    const userId = req.user!.userId;
    const userSettings = getUserSettings(userId);

    // Initial HTML clean-up if rawContent is raw HTML
    let cleanedText = rawContent;
    if (rawContent.includes("<") && rawContent.includes(">")) {
      cleanedText = rawContent
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "")
        .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, "")
        .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "")
        .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "")
        .replace(/<(?:p|div|br|li|h[1-6])[^>]*>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n/g, "\n\n")
        .trim();
    }

    let finalTitle = extractedTitle;
    let finalCompany = extractedCompany;
    let formattedJobDesc = cleanedText;
    let detectedLanguage = "en";

    // Call Universal LLM to clean up the scraped job text, detect language, and format responsibilities & requirements
    try {
      const isGermanUI = language === "de";
      const extractionPrompt = `You are a high-speed German & English recruitment scraper parser.
Target URL: ${url}
Title hint: ${extractedTitle || "None"}
Company hint: ${extractedCompany || "None"}
User UI Language Preference: ${isGermanUI ? "German (Deutsch)" : "English"}

Raw Scraped Text (first 4000 chars):
${cleanedText.slice(0, 4000)}

INSTRUCTIONS:
1. Extract the exact Job Title (e.g. "Senior Backend Engineer" or "Senior Softwareentwickler").
2. Extract the exact Company Name (e.g. "BMW Group", "Siemens").
3. Detect primary language of the job posting ('de' for German, 'en' for English).
4. Format a comprehensive, clean, structured Job Description in Markdown.
   - Include: About the Role, Key Responsibilities, Requirements & Tech Stack, Qualifications, Language Requirements.
   - Strip out website navigation links, cookie consent prompts, login screens, or unrelated footer copy.
   - Retain all technical skills, years of experience, tools, frameworks, and requirements verbatim.

Return JSON:
{
  "title": string,
  "company": string,
  "detected_language": "de" | "en",
  "job_description": string
}`;

      const aiParse = await executeUniversalLLM({
        prompt: extractionPrompt,
        systemInstruction: "You are an expert recruitment parser extracting job postings accurately in English or German.",
        settings: userSettings,
        jsonMode: true,
      });

      if (aiParse.data) {
        if (aiParse.data.title && aiParse.data.title !== "Unknown") {
          finalTitle = aiParse.data.title;
        }
        if (aiParse.data.company && aiParse.data.company !== "Unknown") {
          finalCompany = aiParse.data.company;
        }
        if (aiParse.data.detected_language) {
          detectedLanguage = aiParse.data.detected_language;
        }
        if (aiParse.data.job_description && aiParse.data.job_description.length > 50) {
          formattedJobDesc = aiParse.data.job_description;
        }
      }
    } catch (llmErr) {
      console.warn("LLM job text formatting failed, using raw cleaned text:", llmErr);
    }

    addSystemLog("scraper", "info", `Successfully fetched job posting: ${finalTitle || "Job"} at ${finalCompany || "Company"}`, {
      url,
      source: fetchSource,
      detectedLanguage,
      descLength: formattedJobDesc.length,
    });

    res.json({
      success: true,
      url,
      title: finalTitle || "",
      company: finalCompany || "",
      job_description: formattedJobDesc,
      detected_language: detectedLanguage,
      source: fetchSource,
    });
  } catch (err: any) {
    console.error("Error scraping job URL:", err);
    addSystemLog("scraper", "error", `Failed to scrape job posting from ${url}: ${err.message}`, { url, error: err.message });
    res.status(500).json({
      error: `Failed to scrape job posting (${err.message || "Network Error"}). Please copy & paste the job description manually.`,
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
    const startTime = Date.now();
    addSystemLog("llm", "info", `Starting 3-pass application tailoring for ${company || "Target Role"}`, {
      provider: userSettings.provider,
      model: userSettings.ai_model,
      language: isGerman ? "de" : "en",
    });

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

    const duration = Date.now() - startTime;
    addSystemLog("llm", "info", `Completed 3-pass tailoring in ${duration}ms`, {
      provider: userSettings.provider,
      model: userSettings.ai_model,
      durationMs: duration,
      gapsCount: pass1?.gaps?.missing_skills?.length || 0,
    }, duration);

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
    addSystemLog("llm", "error", `Pipeline failed: ${error.message}`, { error: error.message });
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

  const startTime = Date.now();
  const result = await compileLaTeX(latex_source, filename);
  const duration = Date.now() - startTime;

  if (result.success && result.pdfBuffer) {
    addSystemLog("latex", "info", `Compiled PDF successfully (${filename}.pdf) in ${duration}ms`, {
      filename,
      sizeBytes: result.pdfBuffer.length,
      durationMs: duration,
    }, duration);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
    return res.send(result.pdfBuffer);
  }

  addSystemLog("latex", "warn", `LaTeX compilation error: ${result.error || "Engine error"}`, {
    filename,
    error: result.error,
    logSnippet: result.log ? result.log.slice(0, 300) : undefined,
  }, duration);

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
// EMAIL INTEGRATION & AUTOMATED KANBAN SCANNER
// ==========================================

app.get("/api/emails/settings", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const settings = getUserEmailSettings(userId);

  // Clean legacy false positive logs (e.g. job alerts, banking, promotional, otp, security)
  const sanitizedLogs = (settings.logs || []).filter((log: any) => {
    const text = `${log.company} ${log.subject} ${log.fromEmail} ${log.fromName} ${log.snippet}`.toLowerCase();
    const isExcluded =
      /job\s*alert|daily\s*jobs|job\s*recommendations|jobagent|stepstone|indeed\s*alerts|glassdoor\s*alerts|hdfc|icici|sbi|axisbank|kotak|citibank|chase\b|bankofamerica|wellsfargo|barclays|hsbc|paypal|stripe\s*billing|paytm|phonepe|razorpay|cred\b|amex|mastercard|visa\b|credit\s*card|debit\s*card|statement|transaction|amazon\b|flipkart|swiggy|zomato|uber\b|netflix|spotify|otp\b|one\s*time\s*password|verification\s*code|security\s*alert|verify\s*your\s*new\s*device|new\s*login|nse_alerts|funds\/securities|rakhi\s*sale|essential\s*reads|mint\b/i.test(
        text
      );
    return !isExcluded;
  });

  if (sanitizedLogs.length !== (settings.logs || []).length) {
    settings.logs = sanitizedLogs;
    saveUserEmailSettings(userId, settings);
  }

  // Mask account passwords before sending to frontend
  const safeAccounts = (settings.accounts || []).map((acc: any) => ({
    ...acc,
    hasPassword: Boolean(acc.password && acc.password.length > 0),
    password: "",
  }));
  res.json({
    ...settings,
    accounts: safeAccounts,
  });
});

app.post("/api/emails/clear-logs", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const settings = getUserEmailSettings(userId);
  settings.logs = [];
  settings.lastBackScanSummary = undefined;
  saveUserEmailSettings(userId, settings);
  
  const safeAccounts = (settings.accounts || []).map((acc: any) => ({
    ...acc,
    hasPassword: Boolean(acc.password && acc.password.length > 0),
    password: "",
  }));

  res.json({
    message: "Activity audit log cleared.",
    settings: {
      ...settings,
      accounts: safeAccounts,
    },
  });
});

app.delete("/api/emails/logs/:logId", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { logId } = req.params;
  const settings = getUserEmailSettings(userId);
  
  settings.logs = (settings.logs || []).filter((l: any) => l.id !== logId);
  saveUserEmailSettings(userId, settings);

  res.json({
    message: "Log entry removed.",
    logs: settings.logs,
  });
});

app.post("/api/emails/settings", authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const current = getUserEmailSettings(userId);

  // Preserve existing passwords if new accounts payload omits or sends empty password
  const mergedAccounts = (req.body.accounts || []).map((newAcc: any) => {
    const existing = (current.accounts || []).find((a: any) => a.id === newAcc.id);
    return {
      ...newAcc,
      password: newAcc.password ? newAcc.password : existing?.password || "",
    };
  });

  const updated = {
    ...current,
    ...req.body,
    accounts: mergedAccounts,
  };
  saveUserEmailSettings(userId, updated);

  const safeAccounts = updated.accounts.map((acc: any) => ({
    ...acc,
    hasPassword: Boolean(acc.password && acc.password.length > 0),
    password: "",
  }));

  res.json({
    ...updated,
    accounts: safeAccounts,
  });
});

// Test real IMAP server handshake and credentials
app.post("/api/emails/test-connection", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { id, email, provider, imapHost, imapPort, username, password } = req.body;
  const current = getUserEmailSettings(userId);
  const existingAcc = (current.accounts || []).find((a: any) => a.id === id);

  const accountConfig: ImapAccountConfig = {
    id: id || "temp_test",
    email: email || existingAcc?.email || "",
    label: req.body.label || existingAcc?.label || "Inbox",
    provider: provider || existingAcc?.provider || "gmail_oauth",
    status: "connected",
    imapHost: imapHost !== undefined ? imapHost : existingAcc?.imapHost,
    imapPort: imapPort ? Number(imapPort) : existingAcc?.imapPort || 993,
    username: username || existingAcc?.username || email,
    password: password || existingAcc?.password || "",
  };

  const result = await testImapHandshake(accountConfig);
  addSystemLog("email", result.success ? "info" : "warn", `IMAP Test: ${result.message}`, {
    email: accountConfig.email,
    host: result.host,
  });

  res.json(result);
});

// Helper to extract fallback company name if missing from classification
function extractFallbackCompanyFromEmail(email: any): string {
  if (email.fromName) {
    const clean = email.fromName
      .replace(/["']/g, "")
      .replace(/\s*(P&O Talent|Talent Acquisition|Recruiting Team|Talent Team|Careers|Recruiting|Karriere|Hiring Team|Team|GmbH|AG|Inc\.?|LLC|Pvt Ltd|HR Team)\b.*$/gi, "")
      .trim();
    if (clean.length >= 2 && !/^(linkedin|stepstone|indeed|noreply|no-reply|notification|notifications|google|support|system|jobs|recruitment|talent)$/i.test(clean)) {
      return clean;
    }
  }
  if (email.fromEmail && email.fromEmail.includes("@")) {
    const dom = email.fromEmail.split("@")[1];
    if (dom && !/gmail|outlook|yahoo|linkedin|hotmail|greenhouse|lever|workday|ashby|smartrecruiters|personio|join|teamtailor|bamboohr|icims|taleo|stepstone|indeed|jobvite|bullhorn/i.test(dom)) {
      const rDom = dom.split(".")[0];
      if (rDom && rDom.length >= 2) {
        return rDom.charAt(0).toUpperCase() + rDom.slice(1);
      }
    }
  }
  if (email.subject) {
    const subAt = email.subject.match(/(?:at|bei|to|for)\s+([A-Za-z0-9\s&.-]{2,30})/i);
    if (subAt && subAt[1] && !/^(linkedin|stepstone|indeed|job|careers)$/i.test(subAt[1].trim())) {
      return subAt[1].trim().split(" - ")[0].split(" | ")[0].trim();
    }
  }
  return "Recruiter Application";
}

// Helper to deduplicate scanned email logs across multiple scans
function deduplicateEmailLogs(newLogs: any[], existingLogs: any[]): any[] {
  const seen = new Set<string>();
  const combined = [...newLogs, ...existingLogs];
  const result: any[] = [];
  for (const item of combined) {
    if (!item) continue;
    const dateStr = item.date ? new Date(item.date).toISOString().split("T")[0] : "";
    const cleanSub = (item.subject || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanFrom = (item.fromEmail || "").toLowerCase().trim();
    const key = `${item.accountId || ""}_${cleanFrom}_${dateStr}_${cleanSub}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result.slice(0, 150);
}

// Deep Historical Back-Scan (Up to 1 year, 6 months, 3 months, 30 days, 7 days, or custom date range)
app.post("/api/emails/backscan", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const {
    accountId,
    timeframe = "30d",
    startDate,
    endDate,
    autoMoveKanban = true,
    dryRun = false,
    maxResults = 250,
  } = req.body;

  const emailSettings = getUserEmailSettings(userId);
  const applications = getUserTracker(userId);
  const startTime = Date.now();

  let targetAccounts = emailSettings.accounts || [];
  if (accountId && accountId !== "all") {
    targetAccounts = targetAccounts.filter((a: any) => a.id === accountId);
  }

  if (targetAccounts.length === 0) {
    return res.status(400).json({
      error: "No configured email accounts found to scan. Add an email account with App Password in Settings.",
    });
  }

  // Calculate timeframe bounds
  const now = new Date();
  let sinceDate = new Date();
  let beforeDate: Date | undefined = undefined;
  let timeframeDescription = "Past 30 Days";

  if (timeframe === "7d") {
    sinceDate = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    timeframeDescription = "Past 7 Days";
  } else if (timeframe === "30d") {
    sinceDate = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    timeframeDescription = "Past 30 Days";
  } else if (timeframe === "90d") {
    sinceDate = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
    timeframeDescription = "Past 3 Months";
  } else if (timeframe === "180d") {
    sinceDate = new Date(now.getTime() - 180 * 24 * 3600 * 1000);
    timeframeDescription = "Past 6 Months";
  } else if (timeframe === "365d") {
    sinceDate = new Date(now.getTime() - 365 * 24 * 3600 * 1000);
    timeframeDescription = "Past 1 Year";
  } else if (timeframe === "custom" && startDate) {
    sinceDate = new Date(startDate);
    if (endDate) beforeDate = new Date(endDate);
    timeframeDescription = `Custom (${sinceDate.toLocaleDateString()} - ${beforeDate ? beforeDate.toLocaleDateString() : "Now"})`;
  }

  let totalScanned = 0;
  let matchedRecruiterEmails = 0;
  let cardsUpdated = 0;
  const errors: string[] = [];
  const generatedLogs: any[] = [];

  for (const account of targetAccounts) {
    if (!account.password) {
      errors.push(`Account ${account.email} has no password configured.`);
      continue;
    }

    const fetchRes = await fetchHistoricalEmails(account, {
      sinceDate,
      beforeDate,
      maxResults,
    });

    if (!fetchRes.success) {
      errors.push(`${account.email}: ${fetchRes.error}`);
      continue;
    }

    totalScanned += fetchRes.emails.length;

    // Tracked company representations
    const trackedList = applications.map((a) => ({
      id: a.id,
      company: a.company,
      role: a.role,
      status: a.status,
    }));

    // Process each email chronologically (oldest to newest)
    for (const email of fetchRes.emails) {
      const classification = classifyRecruiterEmailRuleBased(email, trackedList);

      if (!classification.isCandidateRelated && classification.outcome === "other") {
        continue; // Skip non-candidate emails completely
      }

      matchedRecruiterEmails++;

      // Match or find application in tracker using clean company normalization
      const compName = classification.matchedCompany || extractFallbackCompanyFromEmail(email);
      const cNorm = compName.toLowerCase().replace(/[^a-z0-9]/g, "");

      let matchedApp = null;
      if (classification.matchedApplicationId) {
        matchedApp = applications.find((a) => a.id === classification.matchedApplicationId);
      }
      if (!matchedApp && cNorm.length >= 2) {
        matchedApp = applications.find((a) => {
          if (!a.company) return false;
          const aNorm = a.company.toLowerCase().replace(/[^a-z0-9]/g, "");
          return aNorm === cNorm;
        });
      }

      let targetStatus: "scraped" | "tailored" | "applied" | "active" | "closed" = "applied";
      if (classification.outcome === "offer" || classification.outcome === "interview" || classification.outcome === "assessment") {
        targetStatus = "active";
      } else if (classification.outcome === "rejection") {
        targetStatus = "closed";
      } else if (classification.outcome === "acknowledgement") {
        targetStatus = "applied";
      }

      let actionTaken: "created_card" | "moved_kanban" | "synced_feedback" | "logged_only" | "no_match" = "no_match";
      let previousStatus = undefined;
      const emailDateFormatted = email.date ? new Date(email.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

      if (matchedApp) {
        previousStatus = matchedApp.status;
        const statusChanged = matchedApp.status !== targetStatus;
        if (!dryRun && autoMoveKanban) {
          if (statusChanged) {
            matchedApp.status = targetStatus;
          }
          matchedApp.email_synced_at = new Date().toISOString();
          matchedApp.last_email_feedback = `[${classification.outcome.toUpperCase()}] ${email.subject} (${new Date(email.date).toLocaleDateString()})`;
          if (!matchedApp.date_applied) {
            matchedApp.date_applied = emailDateFormatted;
          }
          matchedApp.notes = `${matchedApp.notes ? matchedApp.notes + "\n" : ""}⚡ ${statusChanged ? `Status moved to ${targetStatus.toUpperCase()}` : "Feedback synced"} via Back-Scan (${classification.outcome}): "${email.subject}" (${new Date(email.date).toLocaleDateString()})`;
          actionTaken = statusChanged ? "moved_kanban" : "synced_feedback";
          cardsUpdated++;
        } else {
          actionTaken = "logged_only";
        }
      } else {
        // Auto-create new application card in Kanban for unmatched candidate email
        if (!dryRun) {
          const newApp = {
            id: `app_auto_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
            company: compName,
            role: classification.role || "Applied Position",
            status: targetStatus,
            source: email.fromEmail.includes("linkedin") ? "LinkedIn Easy Apply" : "Email Confirmation",
            date_scraped: emailDateFormatted,
            date_applied: emailDateFormatted,
            notes: `⚡ Auto-detected & created from application email: "${email.subject}" (${new Date(email.date).toLocaleDateString()})`,
            last_email_feedback: `[${classification.outcome.toUpperCase()}] ${email.subject}`,
            email_synced_at: new Date().toISOString(),
          };
          applications.unshift(newApp);
          matchedApp = newApp;
          actionTaken = "created_card";
          cardsUpdated++;

          trackedList.push({
            id: newApp.id,
            company: newApp.company,
            role: newApp.role,
            status: newApp.status,
          });
        } else {
          actionTaken = "logged_only";
        }
      }

      const logItem = {
        id: `log_bs_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
        accountId: account.id,
        accountEmail: account.email,
        fromEmail: email.fromEmail,
        fromName: email.fromName,
        subject: email.subject,
        date: email.date,
        snippet: email.snippet,
        matchedApplicationId: matchedApp?.id,
        company: classification.matchedCompany || matchedApp?.company || "Recruiter",
        role: classification.role || matchedApp?.role || "Position",
        detectedOutcome: classification.outcome,
        previousStatus,
        newStatus: targetStatus,
        aiConfidence: classification.confidence,
        analysisExplanation: classification.explanation,
        processedAt: new Date().toISOString(),
        actionTaken,
      };

      generatedLogs.unshift(logItem);
    }

    account.lastSync = new Date().toISOString();
  }

  if (!dryRun) {
    saveUserTracker(userId, applications);
  }

  const backScanSummary = {
    totalScanned,
    matchedRecruiterEmails,
    cardsUpdated,
    timeframeDescription,
    dryRun,
    dateRange: {
      from: sinceDate.toISOString(),
      to: (beforeDate || now).toISOString(),
    },
    errors,
  };

  emailSettings.lastGlobalSync = new Date().toISOString();
  emailSettings.lastBackScanSummary = backScanSummary;
  emailSettings.logs = deduplicateEmailLogs(generatedLogs, emailSettings.logs || []);
  saveUserEmailSettings(userId, emailSettings);

  const durationMs = Date.now() - startTime;
  addSystemLog("email", "info", `Historical Back-Scan finished in ${durationMs}ms: Scanned ${totalScanned} messages, matched ${matchedRecruiterEmails} recruiter emails, updated ${cardsUpdated} cards.`, {
    timeframeDescription,
    dryRun,
    errors,
  });

  res.json({
    summary: backScanSummary,
    emailSettings,
    applications,
  });
});

// Quick regular check (scans past 7 days)
app.post("/api/emails/sync", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const emailSettings = getUserEmailSettings(userId);
  const applications = getUserTracker(userId);

  const connectedAccounts = (emailSettings.accounts || []).filter((a: any) => a.password && a.password.length > 0);

  if (connectedAccounts.length === 0) {
    return res.json({
      message: "No email accounts with configured passwords. Configure your App Password in Settings.",
      emailSettings,
      applications,
    });
  }

  // Quick scan past 7 days
  const sinceDate = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  let totalNewLogs = 0;
  let cardsMoved = 0;
  const newLogs: any[] = [];

  for (const account of connectedAccounts) {
    const fetchRes = await fetchHistoricalEmails(account, { sinceDate, maxResults: 50 });
    if (!fetchRes.success) continue;

    const trackedList = applications.map((a) => ({
      id: a.id,
      company: a.company,
      role: a.role,
      status: a.status,
    }));

    for (const email of fetchRes.emails) {
      // Check if already logged
      const alreadyLogged = (emailSettings.logs || []).some((l: any) => l.subject === email.subject && l.fromEmail === email.fromEmail);
      if (alreadyLogged) continue;

      const classification = classifyRecruiterEmailRuleBased(email, trackedList);
      if (!classification.isCandidateRelated && classification.outcome === "other") continue;

      const compName = classification.matchedCompany || extractFallbackCompanyFromEmail(email);
      const cNorm = compName.toLowerCase().replace(/[^a-z0-9]/g, "");

      let matchedApp = null;
      if (classification.matchedApplicationId) {
        matchedApp = applications.find((a) => a.id === classification.matchedApplicationId);
      }
      if (!matchedApp && cNorm.length >= 2) {
        matchedApp = applications.find((a) => {
          if (!a.company) return false;
          const aNorm = a.company.toLowerCase().replace(/[^a-z0-9]/g, "");
          return aNorm === cNorm;
        });
      }

      let targetStatus: "scraped" | "tailored" | "applied" | "active" | "closed" = "applied";
      if (classification.outcome === "offer" || classification.outcome === "interview" || classification.outcome === "assessment") {
        targetStatus = "active";
      } else if (classification.outcome === "rejection") {
        targetStatus = "closed";
      } else if (classification.outcome === "acknowledgement") {
        targetStatus = "applied";
      }

      let actionTaken: "created_card" | "moved_kanban" | "synced_feedback" | "logged_only" | "no_match" = "no_match";
      let previousStatus = undefined;
      const emailDateFormatted = email.date ? new Date(email.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

      if (matchedApp) {
        previousStatus = matchedApp.status;
        const statusChanged = matchedApp.status !== targetStatus;
        if (emailSettings.autoMoveKanban && emailSettings.enabled) {
          if (statusChanged) {
            matchedApp.status = targetStatus;
          }
          matchedApp.email_synced_at = new Date().toISOString();
          matchedApp.last_email_feedback = `[${classification.outcome.toUpperCase()}] ${email.subject}`;
          if (!matchedApp.date_applied) {
            matchedApp.date_applied = emailDateFormatted;
          }
          actionTaken = statusChanged ? "moved_kanban" : "synced_feedback";
          cardsMoved++;
        } else {
          actionTaken = "logged_only";
        }
      } else {
        if (emailSettings.enabled) {
          const newApp = {
            id: `app_auto_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
            company: compName,
            role: classification.role || "Applied Position",
            status: targetStatus,
            source: email.fromEmail.includes("linkedin") ? "LinkedIn Easy Apply" : "Email Confirmation",
            date_scraped: emailDateFormatted,
            date_applied: emailDateFormatted,
            notes: `⚡ Auto-detected & created from application email: "${email.subject}" (${new Date(email.date).toLocaleDateString()})`,
            last_email_feedback: `[${classification.outcome.toUpperCase()}] ${email.subject}`,
            email_synced_at: new Date().toISOString(),
          };
          applications.unshift(newApp);
          matchedApp = newApp;
          actionTaken = "created_card";
          cardsMoved++;

          trackedList.push({
            id: newApp.id,
            company: newApp.company,
            role: newApp.role,
            status: newApp.status,
          });
        } else {
          actionTaken = "logged_only";
        }
      }

      const logItem = {
        id: `log_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
        accountId: account.id,
        accountEmail: account.email,
        fromEmail: email.fromEmail,
        fromName: email.fromName,
        subject: email.subject,
        date: email.date,
        snippet: email.snippet,
        matchedApplicationId: matchedApp?.id,
        company: classification.matchedCompany || matchedApp?.company || "Recruiter",
        role: classification.role || matchedApp?.role || "Position",
        detectedOutcome: classification.outcome,
        previousStatus,
        newStatus: targetStatus,
        aiConfidence: classification.confidence,
        analysisExplanation: classification.explanation,
        processedAt: new Date().toISOString(),
        actionTaken,
      };

      newLogs.unshift(logItem);
      totalNewLogs++;
    }

    account.lastSync = new Date().toISOString();
  }

  saveUserTracker(userId, applications);

  emailSettings.lastGlobalSync = new Date().toISOString();
  emailSettings.logs = deduplicateEmailLogs(newLogs, emailSettings.logs || []);
  saveUserEmailSettings(userId, emailSettings);

  res.json({
    message: `Sync completed. Found ${totalNewLogs} recruiter updates, updated ${cardsMoved} Kanban cards.`,
    emailSettings,
    applications,
  });
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
