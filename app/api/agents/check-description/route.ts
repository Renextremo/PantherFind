import { NextResponse } from "next/server";

export const runtime = "nodejs";

type DescriptionCheckRequest = {
  description?: string;
  item?: string;
  brand?: string;
  itemDetail?: string;
  color?: string;
};

type CheckResult = {
  review: {
    summary: string;
    suggestedDescription?: string;
    concerns: string[];
  };
};

const MAX_TEXT_LENGTH = 2_000;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Description checking is not configured." },
      { status: 503 }
    );
  }

  let body: DescriptionCheckRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const description = body.description?.trim();
  if (!description) {
    return NextResponse.json(
      { error: "A report description is required." },
      { status: 400 }
    );
  }

  const fields = [
    description,
    body.item,
    body.brand,
    body.itemDetail,
    body.color,
  ];
  if (fields.some((value) => value && value.length > MAX_TEXT_LENGTH)) {
    return NextResponse.json(
      { error: "A text field is too long." },
      { status: 413 }
    );
  }

  const knownDetails = {
    item: body.item?.trim() || "",
    brand: body.brand?.trim() || "",
    itemDetail: body.itemDetail?.trim() || "",
    color: body.color?.trim() || "",
  };

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-6-luna",
        store: false,
        max_output_tokens: 220,
        instructions:
          'Review a lost-and-found report description for clarity and factual support. Use only the supplied description and item fields; do not infer missing facts or invent item traits. Return JSON with exactly one top-level key, review, whose value has exactly: summary (one short review sentence), suggestedDescription (optional concise corrected description, only when a useful clarity correction or removal of an unsupported claim is needed), concerns (array of at most 2 short strings). Preserve the user’s meaning. Flag material claims not supported by the supplied fields, but do not decide item ownership or identity. If there are no concerns, return an empty concerns array.',
        input: `Report fields: ${JSON.stringify(knownDetails)}\nDescription to check: ${description}`,
        text: { format: { type: "json_object" } },
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Description checking is temporarily unavailable." },
        { status: 502 }
      );
    }

    const result = await response.json();
    const output = (result.output || [])
      .flatMap((item: { content?: Array<{ type?: string; text?: string }> }) =>
        item.content || []
      )
      .find((content: { type?: string }) => content.type === "output_text")
      ?.text;

    if (!output) throw new Error("Empty model response");

    const parsed = JSON.parse(output) as Partial<CheckResult>;
    const review = parsed.review;
    if (!review || typeof review.summary !== "string" || !review.summary.trim()) {
      throw new Error("Invalid model response");
    }

    const concerns = Array.isArray(review.concerns)
      ? review.concerns
          .filter((note): note is string => typeof note === "string")
          .slice(0, 2)
          .map((note) => note.slice(0, 180))
      : [];
    const suggestedDescription =
      typeof review.suggestedDescription === "string" &&
      review.suggestedDescription.trim()
        ? review.suggestedDescription.trim().slice(0, MAX_TEXT_LENGTH)
        : undefined;

    return NextResponse.json({
      review: {
        summary: review.summary.trim().slice(0, 240),
        ...(suggestedDescription ? { suggestedDescription } : {}),
        concerns,
      },
    } satisfies CheckResult);
  } catch {
    return NextResponse.json(
      { error: "Description checking is temporarily unavailable." },
      { status: 502 }
    );
  }
}
