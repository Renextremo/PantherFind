type DescriptionInput = {
  reportType: "lost" | "found";
  item: string;
  brand?: string;
  itemDetail?: string;
  color?: string;
  campus: string;
  location: string;
  image: string;
};

export async function generateReportDescription(
  input: DescriptionInput
): Promise<string> {
  try {
    const response = await fetch("/api/generate-description", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (response.ok) {
      const result = (await response.json()) as { description?: string };
      if (result.description?.trim()) return result.description.trim();
    }
  } catch {
    // The local description below keeps reporting available if AI is offline.
  }

  const itemName = [input.color, input.brand, input.itemDetail, input.item]
    .filter(Boolean)
    .join(" ");
  const action = input.reportType === "lost" ? "lost" : "found";

  const photoNote = input.image ? " See the attached photo for the item’s appearance." : "";
  return `${itemName} ${action} at ${input.location}, ${input.campus}.${photoNote}`;
}
