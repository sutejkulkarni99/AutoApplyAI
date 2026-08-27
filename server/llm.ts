import { GoogleGenAI } from "@google/genai";

export type AIProvider = "gemini" | "nvidia" | "groq" | "ollama" | "openai" | "custom";

export interface UserLLMSettings {
  provider: AIProvider;
  ai_model: string;
  api_key?: string;
  base_url?: string;
  temperature?: number;
}

export interface UniversalLLMOptions {
  prompt: string;
  systemInstruction?: string;
  settings: UserLLMSettings;
  jsonMode?: boolean;
}

// Clean and repair JSON output across diverse model types
export function extractAndParseJSON<T = any>(text: string): T {
  let cleaned = text.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }

  // Find outermost JSON object or array if extra prose exists
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");

  if (firstBrace !== -1 && lastBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  } else if (firstBracket !== -1 && lastBracket !== -1) {
    cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (err: any) {
    // Attempt lenient cleanup: remove trailing commas before closing braces
    const lenient = cleaned
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]");
    try {
      return JSON.parse(lenient);
    } catch {
      throw new Error(`Failed to parse JSON response from LLM: ${err?.message || "SyntaxError"}\nRaw output:\n${text.slice(0, 500)}...`);
    }
  }
}

// Universal LLM Invoker
export async function executeUniversalLLM(options: UniversalLLMOptions): Promise<{ text: string; data?: any }> {
  const { prompt, systemInstruction, settings, jsonMode = true } = options;
  const provider = settings.provider || "gemini";
  const model = settings.ai_model || (provider === "gemini" ? "gemini-3.6-flash" : "nvidia/nemotron-4-340b-instruct");
  const temperature = settings.temperature ?? 0.2;

  // 1. Google Gemini Native Provider
  if (provider === "gemini") {
    const apiKey =
      settings.api_key?.trim() ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_AI_STUDIO_API_KEY ||
      "";

    if (!apiKey) {
      throw new Error("No Google AI Studio API key provided. Please configure it in Settings (⚙️).");
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const config: any = {
      temperature,
    };
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }
    if (jsonMode) {
      config.responseMimeType = "application/json";
    }

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config,
    });

    const responseText = response.text || "";
    if (jsonMode) {
      const data = extractAndParseJSON(responseText);
      return { text: responseText, data };
    }
    return { text: responseText };
  }

  // 2. OpenAI-Compatible Providers (NVIDIA NIM, Groq, Ollama, Custom)
  let baseUrl = settings.base_url?.trim();
  let apiKey = settings.api_key?.trim() || "";

  if (provider === "nvidia") {
    baseUrl = baseUrl || "https://integrate.api.nvidia.com/v1";
    if (!apiKey) {
      apiKey = process.env.NVIDIA_API_KEY || "";
    }
  } else if (provider === "groq") {
    baseUrl = baseUrl || "https://api.groq.com/openai/v1";
    if (!apiKey) {
      apiKey = process.env.GROQ_API_KEY || "";
    }
  } else if (provider === "ollama") {
    baseUrl = baseUrl || "http://localhost:11434/v1";
    apiKey = apiKey || "ollama"; // Ollama does not require key by default
  } else {
    // Custom / OpenAI
    baseUrl = baseUrl || "https://api.openai.com/v1";
  }

  // Strip trailing slashes
  baseUrl = baseUrl.replace(/\/+$/, "");
  const endpoint = `${baseUrl}/chat/completions`;

  const messages: any[] = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  
  let formattedPrompt = prompt;
  if (jsonMode) {
    formattedPrompt += "\n\nCRITICAL: Respond ONLY with valid, parseable JSON matching the requested schema. Do NOT include markdown code fences or conversational prose.";
  }
  messages.push({ role: "user", content: formattedPrompt });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const payload: any = {
    model,
    messages,
    temperature,
  };

  // Support response_format if compatible
  if (jsonMode && (provider === "groq" || provider === "openai")) {
    payload.response_format = { type: "json_object" };
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    let parsedErr = errorText;
    try {
      const errJson = JSON.parse(errorText);
      parsedErr = errJson.error?.message || errJson.message || errorText;
    } catch {}
    throw new Error(`[${provider.toUpperCase()}] API Error (${res.status}): ${parsedErr}`);
  }

  const jsonResponse: any = await res.json();
  const choice = jsonResponse.choices?.[0];
  const responseText = choice?.message?.content || "";

  if (!responseText) {
    throw new Error(`Empty response received from ${provider} model '${model}'.`);
  }

  if (jsonMode) {
    const data = extractAndParseJSON(responseText);
    return { text: responseText, data };
  }

  return { text: responseText };
}

// Test Connection Helper
export async function testProviderConnection(settings: UserLLMSettings): Promise<{
  success: boolean;
  latencyMs: number;
  provider: string;
  model: string;
  response: string;
}> {
  const startTime = Date.now();
  const testPrompt = "Ping! Return a JSON object: {\"status\": \"ok\", \"message\": \"Connection successful\"}";

  const result = await executeUniversalLLM({
    prompt: testPrompt,
    systemInstruction: "You are a test ping service. Return valid JSON only.",
    settings,
    jsonMode: true,
  });

  const latencyMs = Date.now() - startTime;
  const statusMessage = result.data?.message || result.data?.status || "Connected successfully";

  return {
    success: true,
    latencyMs,
    provider: settings.provider,
    model: settings.ai_model,
    response: statusMessage,
  };
}
