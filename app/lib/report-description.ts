import type { VisualAttributes } from "./visual-attributes";

type DescriptionInput = {
  reportType: "lost" | "found";
  item: string;
  brand?: string;
  itemDetail?: string;
  color?: string;
  campus: string;
  location: string;
  image: string;
  visualAttributes?: VisualAttributes | null;
};

export async function generateReportDescription(
  input: DescriptionInput
): Promise<string> {
  try {
    const response = await fetch("/api/generate-description", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(22_000),
    });

    if (response.ok) {
      const result = (await response.json()) as { description?: string };
      if (result.description?.trim()) return result.description.trim();
    }
  } catch {
    // The local description below keeps reporting available if AI is offline.
  }

  const visual = input.visualAttributes;
  const itemName = [
    visual?.primaryColor,
    visual?.brand,
    visual?.model,
    visual?.itemType || (input.image ? "item" : input.itemDetail || input.item),
  ]
    .filter(Boolean)
    .join(" ");
  const action = input.reportType === "lost" ? "lost" : "found";
  const visualDetails = [visual?.shape, ...(visual?.physicalCharacteristics || []), ...(visual?.distinctiveFeatures || [])]
    .filter(Boolean).slice(0, 3).join(", ");
  const place = [input.location, input.campus].filter(Boolean).join(", ");
  const photoNote = input.image ? " See the attached photo for the item’s appearance." : "";
  const scene = visual?.surroundings?.length ? ` The photo also shows ${visual.surroundings.slice(0, 2).join(" and ")}.` : "";
  return `${visual?.itemType ? "Photo shows " : ""}${itemName} ${action}${place ? ` at ${place}` : ""}${visualDetails ? `, with ${visualDetails}` : ""}.${scene}${photoNote}`;
}
