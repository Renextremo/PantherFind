import { NextResponse } from "next/server";
import { geminiErrorResponse, generateGeminiContent } from "../../lib/gemini-api";

export const runtime = "nodejs";

type DescriptionRequest = {
  reportType?: "lost" | "found";
  item?: string;
  brand?: string;
  itemDetail?: string;
  color?: string;
  campus?: string;
  location?: string;
  image?: string;
  visualAttributes?: {
    itemType?: string | null;
    primaryColor?: string | null;
    secondaryColors?: string[];
    brand?: string | null;
    model?: string | null;
    shape?: string | null;
    physicalCharacteristics?: string[];
    distinctiveFeatures?: string[];
    surroundings?: string[];
  } | null;
};

function visualSummary(attributes: DescriptionRequest["visualAttributes"]) {
  if (!attributes) return "No structured photo analysis is available.";
  const strings = (values?: string[]) => Array.isArray(values) ? values.filter((value) => typeof value === "string").slice(0, 5) : [];
  return JSON.stringify({
    itemType: attributes.itemType?.slice(0, 100) || null,
    primaryColor: attributes.primaryColor?.slice(0, 100) || null,
    secondaryColors: strings(attributes.secondaryColors),
    brand: attributes.brand?.slice(0, 100) || null,
    model: attributes.model?.slice(0, 100) || null,
    shape: attributes.shape?.slice(0, 160) || null,
    physicalCharacteristics: strings(attributes.physicalCharacteristics),
    distinctiveFeatures: strings(attributes.distinctiveFeatures),
    surroundings: strings(attributes.surroundings),
  });
}

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Gemini description generation is not configured. Add GEMINI_API_KEY to the server environment." },
      { status: 503 }
    );
  }

  let body: DescriptionRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (
    !body.item?.trim() ||
    !body.campus?.trim() ||
    !body.image?.startsWith("data:image/")
  ) {
    return NextResponse.json(
      { error: "Item, photo, and campus are required." },
      { status: 400 }
    );
  }

  if (body.image.length > 12_000_000) {
    return NextResponse.json(
      { error: "Photo is too large to describe." },
      { status: 413 }
    );
  }

  const imageParts = body.image.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([a-z\d+/]+=*)$/i);
  if (!imageParts) return NextResponse.json({ error: "A supported photo is required." }, { status: 400 });

  const reportType = body.reportType === "found" ? "found" : "lost";

  try {
    const description = await generateGeminiContent({
      maxOutputTokens: 220,
      temperature: 0.2,
      parts: [
        { text: `Inspect the image yourself and write a concise, factual description of the pictured item in 1-2 sentences. Use the structured visual analysis as supporting evidence, but when it is missing or conflicts with clearly visible image evidence, describe what is actually pictured. If the photo shows a different object from the student's selected item (for example, headphones instead of a phone), do not put the incorrect selected label in the description. Do not alter the student's saved report fields. Mention the visible item's type and primary color when recognizable; mention brand/model only when a logo, text, or identifying feature clearly supports it. Add distinctive visible features when useful. Include the student's reported campus and location when provided, but never claim the photo proves where it was taken. A place visible in the photo may be mentioned only when directly identified by readable signage or an unmistakable landmark; do not infer an exact location from generic surroundings. Do not invent details.\n\nReport type: ${reportType}. Student-selected item: ${body.item}. Student-entered item details: ${[body.itemDetail, body.color, body.brand].filter(Boolean).join(", ") || "none"}. Structured visual analysis: ${visualSummary(body.visualAttributes)}. Reported campus: ${body.campus}. Reported location: ${body.location?.trim() || "not provided"}. Make the description match the pictured object, while preserving the report fields outside this generated description.` },
        { inlineData: { mimeType: imageParts[1], data: imageParts[2] } },
      ],
    });

    if (!description) {
      return NextResponse.json(
        { error: "AI returned an empty description." },
        { status: 502 }
      );
    }

    return NextResponse.json({ description });
  } catch (error) {
    const failure = geminiErrorResponse(error, "Gemini description could not be generated.");
    return NextResponse.json({ error: failure.error, retryAfterSeconds: failure.retryAfterSeconds }, { status: failure.status });
  }
}
