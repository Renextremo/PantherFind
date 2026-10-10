import { NextResponse } from "next/server";
import { geminiErrorResponse, generateGeminiContent } from "../../../lib/gemini-api";

export const runtime = "nodejs";

type Report = {
  id?: string;
  type?: "lost" | "found";
  item?: string;
  description?: string;
  brand?: string;
  itemDetail?: string;
  color?: string;
  campus?: string;
  location?: string;
  date?: string;
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
  };
};

type Match = { reportId: string; matchLevel: "Strong Match" | "Possible Match" | "Weak Match"; rationale: string };

function boundedList(value: unknown, max = 8): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.slice(0, 180)).slice(0, max)
    : [];
}

function cleanReport(report: Report) {
  return {
    id: report.id!.slice(0, 160),
    type: report.type,
    item: report.item?.slice(0, 300) || "",
    description: report.description?.slice(0, 1200) || "",
    brand: report.brand?.slice(0, 200) || "",
    itemDetail: report.itemDetail?.slice(0, 200) || "",
    color: report.color?.slice(0, 100) || "",
    campus: report.campus?.slice(0, 200) || "",
    location: report.location?.slice(0, 300) || "",
    date: report.date?.slice(0, 80) || "",
    visualAttributes: report.visualAttributes ? {
      itemType: report.visualAttributes.itemType?.slice(0, 100) || null,
      primaryColor: report.visualAttributes.primaryColor?.slice(0, 100) || null,
      secondaryColors: boundedList(report.visualAttributes.secondaryColors, 5),
      brand: report.visualAttributes.brand?.slice(0, 100) || null,
      model: report.visualAttributes.model?.slice(0, 100) || null,
      shape: report.visualAttributes.shape?.slice(0, 180) || null,
      physicalCharacteristics: boundedList(report.visualAttributes.physicalCharacteristics),
      distinctiveFeatures: boundedList(report.visualAttributes.distinctiveFeatures),
      surroundings: boundedList(report.visualAttributes.surroundings, 5),
    } : null,
  };
}

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Gemini matching is not configured. Add GEMINI_API_KEY to the server environment." }, { status: 503 });
  }

  let body: { report?: Report; candidates?: Report[] };
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 300_000) return NextResponse.json({ error: "Match request is too large." }, { status: 413 });
    const rawBody = await request.text();
    if (rawBody.length > 300_000) return NextResponse.json({ error: "Match request is too large." }, { status: 413 });
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const report = body.report;
  if (!report || typeof report.id !== "string" || !report.id || typeof report.item !== "string" || !report.item.trim() || !["lost", "found"].includes(report.type || "")) {
    return NextResponse.json({ error: "A report ID, item, and valid lost/found type are required." }, { status: 400 });
  }
  if (!Array.isArray(body.candidates) || body.candidates.length > 30) {
    return NextResponse.json({ error: "Candidates must be an array of at most 30 reports." }, { status: 400 });
  }

  const oppositeType = report.type === "lost" ? "found" : "lost";
  const candidates = body.candidates
    .filter((candidate) => candidate && candidate.type === oppositeType && typeof candidate.id === "string" && candidate.id && candidate.id !== report.id && typeof candidate.item === "string" && candidate.item.trim())
    .slice(0, 30)
    .map(cleanReport);
  if (!candidates.length) return NextResponse.json({ matches: [] });

  try {
    const inputContent = [
      `Incoming report: ${JSON.stringify(cleanReport(report))}`,
      ...candidates.map((candidate, index) => `Candidate ${index + 1}: ${JSON.stringify(candidate)}`),
    ].join("\n");
    const rawText = await generateGeminiContent({
      maxOutputTokens: 900,
      responseMimeType: "application/json",
      temperature: 0.1,
      parts: [{ text: `Compare the lost report with each opposite-type candidate. Use the student-provided item/category, brand/model, color, description, reported campus/location, and lost/found dates, plus the supplied visualAttributes extracted from each uploaded photo. Treat visual details as uncertain clues; null/missing values are not mismatches. Consider strong contradictions such as clearly different item categories or clearly identified brands. Surroundings are generic context and must never establish a precise location. Do not infer ownership or recommend automatic confirmation. Return only JSON: {"matches":[{"reportId":string,"matchLevel":"Strong Match"|"Possible Match"|"Weak Match","rationale":string}]}. Never provide numeric confidence or percentages. Explain concrete supporting evidence and any notable uncertainty. Use candidate IDs exactly as supplied. Include only candidates with at least some plausible supporting evidence.\n\n${inputContent}`}],
    });
    const parsed = JSON.parse(rawText) as { matches?: Match[] };
    const allowedIds = new Set(candidates.map((candidate) => candidate.id));
    const matches = Array.isArray(parsed.matches)
      ? parsed.matches.filter((match) => match && allowedIds.has(match.reportId) && ["Strong Match", "Possible Match", "Weak Match"].includes(match.matchLevel))
          .map((match) => ({
            reportId: match.reportId,
            matchLevel: match.matchLevel,
            rationale: String(match.rationale || "Reports share some item details.").slice(0, 500),
          }))
          .sort((a, b) => ["Strong Match", "Possible Match", "Weak Match"].indexOf(a.matchLevel) - ["Strong Match", "Possible Match", "Weak Match"].indexOf(b.matchLevel))
      : [];
    return NextResponse.json({ matches });
  } catch (error) {
    const failure = geminiErrorResponse(error, "Gemini matching could not be completed.");
    return NextResponse.json({ error: failure.error, retryAfterSeconds: failure.retryAfterSeconds }, { status: failure.status });
  }
}
