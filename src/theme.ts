import { ThemePreset, ThemeConfig } from "./types";

export const THEME_CONFIGS: ThemeConfig[] = [
  {
    id: "google-ai-studio" as any,
    name: "Google AI Studio",
    mode: "dark",
    description: "Authentic Google AI Studio dark workspace with multi-color sparkle accents, high contrast typography, and obsidian panels.",
    previewBg: "#131314",
    previewCard: "#1e1f20",
    previewAccent: "#8ab4f8",
  },
  {
    id: "zinc-dark",
    name: "Zinc Graphite Pro",
    mode: "dark",
    description: "Neutral zinc-based low-contrast dark theme. Zero eye-strain with refined indigo accents.",
    previewBg: "#09090b",
    previewCard: "#18181b",
    previewAccent: "#6366f1",
  },
  {
    id: "slate-light",
    name: "Clean Slate Light",
    mode: "light",
    description: "Crisp neutral light theme with pure white surfaces, soft slate borders, and cobalt blue accents.",
    previewBg: "#f8fafc",
    previewCard: "#ffffff",
    previewAccent: "#2563eb",
  },
  {
    id: "obsidian-dark",
    name: "Slate Obsidian",
    mode: "dark",
    description: "Vercel and Linear inspired minimalist pitch-dark aesthetic with vibrant blue accents.",
    previewBg: "#0a0a0a",
    previewCard: "#171717",
    previewAccent: "#3b82f6",
  },
  {
    id: "warm-paper",
    name: "Warm Paper",
    mode: "light",
    description: "Notion and Craft styled editorial warm linen palette with distinguished deep navy accents.",
    previewBg: "#faf9f7",
    previewCard: "#ffffff",
    previewAccent: "#1e3a8a",
  },
];

const THEME_STORAGE_KEY = "autoapply_theme_preset";

export function getStoredTheme(): ThemePreset {
  if (typeof window === "undefined") return "google-ai-studio" as any;
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemePreset | null;
  if (stored && THEME_CONFIGS.some((t) => t.id === stored)) {
    return stored;
  }
  return "google-ai-studio" as any;
}

export function applyTheme(themeId: ThemePreset) {
  if (typeof document === "undefined") return;
  const config = THEME_CONFIGS.find((t) => t.id === themeId) || THEME_CONFIGS[0];
  
  const root = document.documentElement;
  root.setAttribute("data-theme", config.id);
  
  if (config.mode === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else {
    root.classList.add("light");
    root.classList.remove("dark");
  }
  
  localStorage.setItem(THEME_STORAGE_KEY, config.id);
}
