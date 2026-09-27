import { NextResponse } from "next/server";

export const runtime = "nodejs";

type AnalyzePhotoRequest = {
  item?: string;
  description?: string;
  campus?: string;
  location?: string;
  image?: string;
};

type PhotoAnalysis = {
  visibleColor?: string;
  visibleTraits: string[];
  locationClues: string[];
  itemConsistent: boolean | null;
  summary: string;
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Photo analysis is not configured." }, { status: 503 });
  }

  let body: AnalyzePhotoRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (
    !body.item?.trim() ||
    !body.campus?.trim() ||
    !body.location?.trim() ||
    !body.image?.startsWith("data:image/")
  ) {
    return NextResponse.json(
      { error: "Item, photo, campus, and location are required." },
      { status: 400 }
    );
  }
  if (body.image.length > 12_000_000) {
    return NextResponse.json({ error: "Photo is too large to analyze." }, { status: 413 });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
        store: false,
        max_output_tokens: 220,
        instructions:
          'Review a lost-and-found report photo. Return only valid JSON with keys: visibleColor (string or null if unclear), visibleTraits (array of strings), locationClues (array of strings), itemConsistent (true, false, or null if unclear), summary (string). Report only details clearly visible in the photo. Do not infer a campus, building, exact location, brand, identity, or item characteristics from context alone. Location clues must describe visible environmental features, never claim an actual location. Compare the pictured object to the provided item and description; set itemConsistent to null when ambiguous. Never invent missing details.',
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Reported item: ${body.item.trim()}\nUser-provided campus: ${body.campus.trim()}\nUser-provided location: ${body.location.trim()}\nUser-provided description: ${body.description?.trim() || "(none)"}\nAnalyze the photo. Treat campus and location as report context only; do not claim the photo proves where it was taken.`,
              },
              { type: "input_image", image_url: body.image, detail: "low" },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Photo analysis failed." }, { status: 502 });
    }

    const result = await response.json();
    const text = (result.output || [])
      .flatMap((output: { content?: Array<{ type?: string; text?: string }> }) => output.content || [])
      .filter((content: { type?: string }) => content.type === "output_text")
      .map((content: { text?: string }) => content.text || "")
      .join("")
      .trim();
    const analysis = JSON.parse(text) as PhotoAnalysis;

    if (
      (analysis.visibleColor !== undefined && typeof analysis.visibleColor !== "string") ||
      !Array.isArray(analysis.visibleTraits) ||
      !Array.isArray(analysis.locationClues) ||
      (analysis.itemConsistent !== true && analysis.itemConsistent !== false && analysis.itemConsistent !== null) ||
      typeof analysis.summary !== "string"
    ) {
      throw new Error("Unexpected photo analysis format");
    }

    return NextResponse.json({ analysis });
  } catch {
    return NextResponse.json({ error: "Photo analysis failed." }, { status: 502 });
  }
}
