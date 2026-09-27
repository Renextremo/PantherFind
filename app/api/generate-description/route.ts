import { NextResponse } from "next/server";

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
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "AI description is not configured." },
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
    !body.location?.trim() ||
    !body.image?.startsWith("data:image/")
  ) {
    return NextResponse.json(
      { error: "Item, photo, campus, and location are required." },
      { status: 400 }
    );
  }

  if (body.image.length > 12_000_000) {
    return NextResponse.json(
      { error: "Photo is too large to describe." },
      { status: 413 }
    );
  }

  const details = [body.color, body.brand, body.itemDetail]
    .filter(Boolean)
    .join(" ");
  const reportType = body.reportType === "found" ? "found" : "lost";
  const itemDetails = [details, body.item].filter(Boolean).join(" ");

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
        max_output_tokens: 120,
        instructions:
          "Write a short, factual lost-and-found listing description in 1-2 sentences. Use the image only for visible item traits. Do not guess a brand, exact model, or details that cannot be seen. Include the provided item and campus location naturally. Do not say the item is currently at that location; say it was lost or found there according to the report type.",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Report type: ${reportType}. Item: ${itemDetails}. Campus: ${body.campus}. Location: ${body.location}. Describe this item for the report without inventing details.`,
              },
              { type: "input_image", image_url: body.image, detail: "low" },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "AI description could not be generated." },
        { status: 502 }
      );
    }

    const result = await response.json();
    const description = (result.output || [])
      .flatMap((output: { content?: Array<{ type?: string; text?: string }> }) =>
        output.content || []
      )
      .filter((content: { type?: string }) => content.type === "output_text")
      .map((content: { text?: string }) => content.text || "")
      .join(" ")
      .trim();

    if (!description) {
      return NextResponse.json(
        { error: "AI returned an empty description." },
        { status: 502 }
      );
    }

    return NextResponse.json({ description });
  } catch {
    return NextResponse.json(
      { error: "AI description could not be generated." },
      { status: 502 }
    );
  }
}
