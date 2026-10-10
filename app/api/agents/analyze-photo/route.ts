import { NextResponse } from "next/server";
import { DEFAULT_GEMINI_MODEL, geminiErrorResponse, generateGeminiContent } from "../../../lib/gemini-api";

export const runtime = "nodejs";

type PhotoAnalysis = {
  itemType: string | null;
  primaryColor: string | null;
  secondaryColors: string[];
  brand: string | null;
  model: string | null;
  styleType: string | null;
  shape: string | null;
  physicalCharacteristics: string[];
  distinctiveFeatures: string[];
  surroundings: string[];
  confidence: {
    itemType: "high" | "medium" | "low";
    primaryColor: "high" | "medium" | "low";
    brand: "high" | "medium" | "low";
    model: "high" | "medium" | "low";
    styleType: "high" | "medium" | "low";
    surroundings: "high" | "medium" | "low";
  };
  mainObjectClear: boolean;
  candidateItems: Array<{
    label: string;
    itemType: string | null;
    primaryColor: string | null;
    brand: string | null;
    styleType: string | null;
  }>;
};

const MAX_IMAGE_CHARS = 8_500_000;
const MAX_TEXT = 500;

function boundedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().slice(0, MAX_TEXT);
  return !clean || clean.toLowerCase() === "unknown" ? null : clean;
}

function stringList(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 180))
    .filter(Boolean)
    .slice(0, limit);
}

function confidence(value: unknown): "high" | "medium" | "low" {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "Photo analysis is not configured. Add GEMINI_API_KEY to the server environment." }, { status: 503 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_IMAGE_CHARS + 20_000) {
    return NextResponse.json({ error: "Photo is too large to analyze." }, { status: 413 });
  }

  let body: { item?: unknown; description?: unknown; image?: unknown };
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_IMAGE_CHARS + 20_000) {
      return NextResponse.json({ error: "Photo is too large to analyze." }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const image = typeof body.image === "string" ? body.image : "";
  if (image.length > MAX_IMAGE_CHARS) return NextResponse.json({ error: "Photo is too large to analyze." }, { status: 413 });
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,[a-z\d+/]+=*$/i.test(image)) {
    return NextResponse.json({ error: "A supported image is required." }, { status: 400 });
  }
  const item = typeof body.item === "string" ? body.item.trim().slice(0, MAX_TEXT) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 1200) : "";
  if (!item) return NextResponse.json({ error: "An item description is required." }, { status: 400 });

  try {
    const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
    const imageParts = image.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([a-z\d+/]+=*)$/i);
    if (!imageParts) return NextResponse.json({ error: "A supported photo is required." }, { status: 400 });
    const outputText = await generateGeminiContent({
      maxOutputTokens: 750,
      responseMimeType: "application/json",
      temperature: 0.1,
      parts: [
        { text: `Analyze the actual input image, not the student's category. Identify the main intended item using its visible shape, parts, and visual design. If one item is clearly centered/isolated or otherwise singled out, set mainObjectClear=true. If several plausible reported items are equally prominent and intent cannot be determined, set mainObjectClear=false and return up to four candidateItems with labels and their own visible attributes so the student can choose. Return ONLY JSON with keys itemType, primaryColor, secondaryColors, brand, model, styleType, shape, physicalCharacteristics, distinctiveFeatures, surroundings, confidence, mainObjectClear, candidateItems. confidence must contain itemType, primaryColor, brand, model, styleType, surroundings, each exactly high, medium, or low. Use high only for clear direct evidence, medium for likely but not certain, and low for unknown/ambiguous; use null for unknown single values and [] for unknown lists. Identify a brand only when a logo or identifying text is clearly readable in the image; otherwise brand=null and confidence.brand=low. Identify a model only when visible text or an unmistakable identifier supports it. Identify useful item style/type such as over-ear, in-ear, bifold, backpack, or USB-C only when visible. Describe physical details, patterns, stickers, scratches, accessories, and other distinctive appearance. Include surroundings and place text only when directly supported by readable signage or an unmistakable visible landmark; state what is visible and do not infer an exact geographic location, campus, or building from generic context. Never guess.\n\nStudent-selected item label (context only; it may be wrong): ${item}\nStudent description (context only): ${description || "(none)"}\nAnalyze the visible image independently of the selected label. Return the structured result as JSON.` },
        { inlineData: { mimeType: imageParts[1], data: imageParts[2] } },
      ],
    });
    const parsed = JSON.parse(outputText) as Record<string, unknown>;
    const confidenceValue = parsed.confidence && typeof parsed.confidence === "object"
      ? parsed.confidence as Record<string, unknown>
      : {};
    const confidenceFields = {
      itemType: confidence(confidenceValue.itemType),
      primaryColor: confidence(confidenceValue.primaryColor),
      brand: confidence(confidenceValue.brand),
      model: confidence(confidenceValue.model),
      styleType: confidence(confidenceValue.styleType),
      surroundings: confidence(confidenceValue.surroundings),
    };
    const candidateItems = Array.isArray(parsed.candidateItems)
      ? parsed.candidateItems.slice(0, 4).flatMap((candidate) => {
          if (!candidate || typeof candidate !== "object") return [];
          const entry = candidate as Record<string, unknown>;
          const label = boundedString(entry.label);
          if (!label) return [];
          return [{
            label,
            itemType: boundedString(entry.itemType),
            primaryColor: boundedString(entry.primaryColor),
            brand: boundedString(entry.brand),
            styleType: boundedString(entry.styleType),
          }];
        })
      : [];
    const analysis: PhotoAnalysis = {
      itemType: confidenceFields.itemType === "low" ? null : boundedString(parsed.itemType),
      primaryColor: confidenceFields.primaryColor === "low" ? null : boundedString(parsed.primaryColor),
      secondaryColors: stringList(parsed.secondaryColors, 5),
      brand: confidenceFields.brand === "high" ? boundedString(parsed.brand) : null,
      model: confidenceFields.model === "high" ? boundedString(parsed.model) : null,
      styleType: confidenceFields.styleType === "low" ? null : boundedString(parsed.styleType),
      shape: boundedString(parsed.shape),
      physicalCharacteristics: stringList(parsed.physicalCharacteristics),
      distinctiveFeatures: stringList(parsed.distinctiveFeatures),
      surroundings: confidenceFields.surroundings === "low" ? [] : stringList(parsed.surroundings, 5),
      confidence: confidenceFields,
      mainObjectClear: parsed.mainObjectClear === true,
      candidateItems,
    };
    console.info("PantherFind photo analysis completed", { model, inputImageBytes: Math.floor(image.length * 0.75), itemType: analysis.itemType });
    return NextResponse.json({ analysis, analyzed: true, model });
  } catch (error) {
    const failure = geminiErrorResponse(error, "Photo analysis failed. Please try again.");
    return NextResponse.json({ error: failure.error, retryAfterSeconds: failure.retryAfterSeconds }, { status: failure.status });
  }
}
