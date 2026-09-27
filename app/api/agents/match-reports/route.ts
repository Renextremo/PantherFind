import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Report = {
  id?: string;
  type?: "lost" | "found";
  item?: string;
  description?: string;
  brand?: string;
  color?: string;
  campus?: string;
  location?: string;
  date?: string;
};

type Match = { reportId: string; confidence: number; rationale: string };

function cleanReport(report: Report) {
  return {
    id: report.id!.slice(0, 160),
    type: report.type,
    item: report.item?.slice(0, 300) || "",
    description: report.description?.slice(0, 1200) || "",
    brand: report.brand?.slice(0, 200) || "",
    color: report.color?.slice(0, 100) || "",
    campus: report.campus?.slice(0, 200) || "",
    location: report.location?.slice(0, 300) || "",
    date: report.date?.slice(0, 80) || "",
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI matching is not configured." }, { status: 503 });
  }

  let body: { report?: Report; candidates?: Report[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const report = body.report;
  if (!report || !report.id || !report.item?.trim() || !["lost", "found"].includes(report.type || "")) {
    return NextResponse.json({ error: "A report ID, item, and valid lost/found type are required." }, { status: 400 });
  }
  if (!Array.isArray(body.candidates) || body.candidates.length > 30) {
    return NextResponse.json({ error: "Candidates must be an array of at most 30 reports." }, { status: 400 });
  }

  const oppositeType = report.type === "lost" ? "found" : "lost";
  const candidates = body.candidates
    .filter((candidate) => candidate && candidate.type === oppositeType && candidate.id && candidate.id !== report.id && candidate.item?.trim())
    .slice(0, 30)
    .map(cleanReport);
  if (!candidates.length) return NextResponse.json({ matches: [] });

  try {
    const inputContent = [
      { type: "input_text", text: `Incoming report: ${JSON.stringify(cleanReport(report))}` },
      ...candidates.map((candidate, index) => ({
        type: "input_text",
        text: `Candidate ${index + 1}: ${JSON.stringify(candidate)}`,
      })),
    ];

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-6-luna",
        store: false,
        max_output_tokens: 900,
        instructions: "Compare one lost-and-found report with the opposite-type candidates using only the written item names, descriptions, color/brand fields, location, and date. Do not use or infer any details from photos. Report only plausible matches; do not force a match. Never treat generic similarity alone as strong evidence. Return JSON exactly as {\"matches\":[{\"reportId\":string,\"confidence\":number,\"rationale\":string}]}. Confidence is 0 to 1; include only matches with confidence at least 0.45. Use candidate IDs exactly as provided and keep rationale concise.",
        input: [{ role: "user", content: inputContent }],
        text: { format: { type: "json_object" } },
      }),
    });
    if (!response.ok) return NextResponse.json({ error: "AI matching could not be completed." }, { status: 502 });

    const result = await response.json();
    const rawText = (result.output || [])
      .flatMap((output: { content?: Array<{ type?: string; text?: string }> }) => output.content || [])
      .filter((content: { type?: string }) => content.type === "output_text")
      .map((content: { text?: string }) => content.text || "")
      .join("");
    const parsed = JSON.parse(rawText) as { matches?: Match[] };
    const allowedIds = new Set(candidates.map((candidate) => candidate.id));
    const matches = Array.isArray(parsed.matches)
      ? parsed.matches.filter((match) => match && allowedIds.has(match.reportId) && Number.isFinite(match.confidence) && match.confidence >= 0.45)
          .map((match) => ({
            reportId: match.reportId,
            confidence: Math.max(0, Math.min(1, match.confidence)),
            rationale: String(match.rationale || "Possible item match.").slice(0, 500),
          }))
          .sort((a, b) => b.confidence - a.confidence)
      : [];
    return NextResponse.json({ matches });
  } catch {
    return NextResponse.json({ error: "AI matching could not be completed." }, { status: 502 });
  }
}
