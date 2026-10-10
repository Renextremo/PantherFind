const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export class GeminiApiError extends Error {
  status: number;
  retryAfterSeconds?: number;

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = "GeminiApiError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type GenerateOptions = {
  parts: GeminiPart[];
  maxOutputTokens: number;
  responseMimeType?: "application/json";
  temperature?: number;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
};

function retryDelay(response: Response, details: unknown): number | undefined {
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return Math.ceil(header);
  if (details && typeof details === "object") {
    const detailsArray = (details as { error?: { details?: unknown[] } }).error?.details;
    for (const entry of detailsArray || []) {
      if (!entry || typeof entry !== "object") continue;
      const delay = (entry as { retryDelay?: unknown }).retryDelay;
      if (typeof delay === "string") {
        const seconds = Number.parseFloat(delay);
        if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);
      }
    }
  }
  return undefined;
}

function friendlyError(response: Response, details: unknown, model: string, retryAfterSeconds?: number): string {
  const error = details && typeof details === "object"
    ? (details as { error?: { status?: string; message?: string } }).error
    : undefined;
  const code = error?.status || "";
  const providerMessage = error?.message || "";
  if (response.status === 429 || code === "RESOURCE_EXHAUSTED") {
    return retryAfterSeconds
      ? `Gemini is temporarily rate-limited. Try again in about ${retryAfterSeconds} seconds.`
      : "Gemini's free-tier quota may be exhausted. Check this project's limits in Google AI Studio and retry after they reset.";
  }
  if (/API_KEY_INVALID|invalid api key/i.test(`${code} ${providerMessage}`) || response.status === 401) {
    return "Gemini rejected the server API key. Check GEMINI_API_KEY in the server environment.";
  }
  if (/api key not valid|valid api key/i.test(providerMessage)) {
    return "Gemini rejected GEMINI_API_KEY. Create or copy a valid Gemini API key from Google AI Studio, update the server environment, and restart PantherFind.";
  }
  if (response.status === 403 || code === "PERMISSION_DENIED") {
    return "Gemini denied this request. Check that the API key and Gemini API are enabled for the Google AI Studio project.";
  }
  if (response.status === 404 || code === "NOT_FOUND") {
    return `Gemini model ${model} is unavailable for this API key or project.`;
  }
  if (response.status >= 500) return "Gemini is temporarily unavailable. Please try again shortly.";
  if (response.status === 400 && providerMessage) return `Gemini rejected the request: ${providerMessage.slice(0, 240)}`;
  return "Gemini could not process this request. Check the report details and try again.";
}

export async function generateGeminiContent(options: GenerateOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiApiError("Gemini is not configured. Add GEMINI_API_KEY to the server environment.", 503);
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  let response: Response;
  try {
    response = await fetch(`${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: options.parts }],
        generationConfig: {
          temperature: options.temperature ?? 0.2,
          maxOutputTokens: options.maxOutputTokens,
          ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
        },
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new GeminiApiError("Gemini took too long to respond. Please retry.", 504);
    }
    throw new GeminiApiError("Gemini could not be reached. Check the server connection, then retry.", 503);
  }

  const payload = await response.json().catch(() => null) as GeminiResponse & {
    error?: { status?: string; message?: string; details?: unknown[] };
  } | null;
  if (!response.ok) {
    const delay = retryDelay(response, payload);
    const message = friendlyError(response, payload, model, delay);
    const providerMessage = payload?.error?.message?.slice(0, 400).replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted]");
    console.error("PantherFind Gemini request failed", JSON.stringify({
      status: response.status,
      providerStatus: payload?.error?.status,
      message: providerMessage,
      retryAfterSeconds: delay,
    }));
    throw new GeminiApiError(message, response.status === 429 ? 429 : response.status >= 500 ? 503 : 502, delay);
  }

  const candidate = payload?.candidates?.[0];
  const output = candidate?.content?.parts?.map((part) => part.text || "").join("").trim();
  if (!output) {
    if (candidate?.finishReason === "SAFETY" || payload?.promptFeedback?.blockReason) {
      throw new GeminiApiError("Gemini could not analyze this content. Try a different photo or description.", 422);
    }
    throw new GeminiApiError("Gemini returned an empty response. Please retry.", 502);
  }
  return output;
}

export function geminiErrorResponse(error: unknown, fallback: string) {
  if (error instanceof GeminiApiError) {
    return { error: error.message, status: error.status, retryAfterSeconds: error.retryAfterSeconds };
  }
  console.error("PantherFind Gemini route error", error);
  return { error: fallback, status: 502 };
}
