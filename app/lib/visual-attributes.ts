export type VisualConfidence = "high" | "medium" | "low";

export type VisualCandidate = {
  label: string;
  itemType: string | null;
  primaryColor: string | null;
  brand: string | null;
  styleType: string | null;
};

export type VisualAttributes = {
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
    itemType: VisualConfidence;
    primaryColor: VisualConfidence;
    brand: VisualConfidence;
    model: VisualConfidence;
    styleType: VisualConfidence;
    surroundings: VisualConfidence;
  };
  mainObjectClear: boolean;
  candidateItems: VisualCandidate[];
};

export type PhotoAnalysisResult =
  | { ok: true; analysis: VisualAttributes; model: string }
  | { ok: false; error: string };

export type PhotoReviewDecision = {
  outcome: "matched" | "corrected" | "kept" | "selected-object" | "manual-object-selection" | "analysis-unavailable-manual";
  detectedItemType: string | null;
  selectedItem: string;
  selectedObject?: string;
  confirmedAt: string;
};

export function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    phone: "Phone", laptop: "Laptop", tablet: "Tablet", headphones: "Headphones",
    charger: "Charger", bag: "Bag", wallet: "Wallet", keys: "Keys",
    sweater: "Sweater", "water-bottle": "Water Bottle", other: "Other item",
  };
  return labels[category] || category;
}

/** Maps the vision model's free-form label to one of PantherFind's report categories. */
export function canonicalItemCategory(value: string | null | undefined): string | null {
  const label = (value || "").toLowerCase();
  if (/headphone|earbud|earphone|headset/.test(label)) return "headphones";
  if (/smart\s*phone|cell\s*phone|mobile\s*phone|\bphone\b|\biphone\b/.test(label)) return "phone";
  if (/laptop|notebook computer/.test(label)) return "laptop";
  if (/tablet|ipad/.test(label)) return "tablet";
  if (/charger|charging cable|power adapter/.test(label)) return "charger";
  if (/backpack|handbag|tote|duffel|purse|\bbag\b/.test(label)) return "bag";
  if (/wallet|card holder/.test(label)) return "wallet";
  if (/keys|key ring|keychain/.test(label)) return "keys";
  if (/sweater|hoodie|jacket|coat|shirt|clothing/.test(label)) return "sweater";
  if (/water bottle|bottle|thermos|tumbler/.test(label)) return "water-bottle";
  if (/^other\b/.test(label)) return "other";
  return null;
}

export function categoryOptionForForm(category: string, reportType: "lost" | "found"): string | null {
  const foundOptions: Record<string, string> = {
    phone: "Phone", laptop: "Laptop", tablet: "Tablet", headphones: "Headphones / Earphones",
    charger: "Charger", bag: "Bag", wallet: "Wallet", keys: "Keys", sweater: "Sweater",
    "water-bottle": "Water Bottle", other: "Other",
  };
  const lostOptions: Record<string, string> = {
    phone: "phone", laptop: "laptop", tablet: "tablet", headphones: "headphones-earphones",
    charger: "charger", bag: "bag", wallet: "wallet", keys: "keys", sweater: "sweater",
    "water-bottle": "water-bottle", other: "other",
  };
  return (reportType === "lost" ? lostOptions : foundOptions)[category] || null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() && value.trim().toLowerCase() !== "unknown"
    ? value.trim().slice(0, 180)
    : null;
}

function listValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((part): part is string => typeof part === "string").map((part) => part.trim().slice(0, 180)).filter(Boolean).slice(0, 8)
    : [];
}

function confidenceValue(value: unknown): VisualConfidence {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}

function normalizeAnalysis(value: Record<string, unknown>): VisualAttributes {
  const rawConfidence = value.confidence && typeof value.confidence === "object"
    ? value.confidence as Record<string, unknown>
    : {};
  const confidence = {
    itemType: confidenceValue(rawConfidence.itemType),
    primaryColor: confidenceValue(rawConfidence.primaryColor),
    brand: confidenceValue(rawConfidence.brand),
    model: confidenceValue(rawConfidence.model),
    styleType: confidenceValue(rawConfidence.styleType),
    surroundings: confidenceValue(rawConfidence.surroundings),
  };
  const itemType = stringValue(value.itemType);
  const primaryColor = stringValue(value.primaryColor);
  const brand = stringValue(value.brand);
  const model = stringValue(value.model);
  const styleType = stringValue(value.styleType);
  const candidateItems = Array.isArray(value.candidateItems)
    ? value.candidateItems.slice(0, 4).flatMap((candidate) => {
        if (!candidate || typeof candidate !== "object") return [];
        const entry = candidate as Record<string, unknown>;
        const label = stringValue(entry.label);
        if (!label) return [];
        return [{
          label,
          itemType: stringValue(entry.itemType),
          primaryColor: stringValue(entry.primaryColor),
          brand: stringValue(entry.brand),
          styleType: stringValue(entry.styleType),
        }];
      })
    : [];

  return {
    itemType: confidence.itemType === "low" ? null : itemType,
    primaryColor: confidence.primaryColor === "low" ? null : primaryColor,
    secondaryColors: listValue(value.secondaryColors).slice(0, 5),
    brand: confidence.brand === "low" ? null : brand,
    model: confidence.model === "low" ? null : model,
    styleType: confidence.styleType === "low" ? null : styleType,
    shape: stringValue(value.shape),
    physicalCharacteristics: listValue(value.physicalCharacteristics),
    distinctiveFeatures: listValue(value.distinctiveFeatures),
    surroundings: confidence.surroundings === "low" ? [] : listValue(value.surroundings).slice(0, 5),
    confidence,
    mainObjectClear: value.mainObjectClear === true,
    candidateItems,
  };
}

/** Analyze the actual cropped upload. Errors remain explicit so the form can offer retry or manual continuation. */
export async function analyzeReportPhoto(
  image: string,
  item: string,
  description = ""
): Promise<PhotoAnalysisResult> {
  if (!image) return { ok: false, error: "Choose and crop a photo before analyzing it." };
  try {
    const response = await fetch("/api/agents/analyze-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image, item, description }),
      signal: AbortSignal.timeout(25_000),
    });
    const payload = await response.json() as { analysis?: unknown; error?: string; model?: string; analyzed?: boolean };
    if (!response.ok) return { ok: false, error: payload.error || `Photo analysis failed (HTTP ${response.status}).` };
    if (!payload.analyzed || !payload.analysis || typeof payload.analysis !== "object") {
      return { ok: false, error: "The photo analysis response was incomplete. Please retry or continue with your selected details." };
    }
    return {
      ok: true,
      analysis: normalizeAnalysis(payload.analysis as Record<string, unknown>),
      model: typeof payload.model === "string" ? payload.model : "configured vision model",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error && error.name === "TimeoutError"
        ? "Photo analysis took too long. Please retry or continue with your selected details."
        : "The photo could not be analyzed. Check your connection, then retry or continue with your selected details.",
    };
  }
}
