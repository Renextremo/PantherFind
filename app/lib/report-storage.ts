export type StoredReport = {
  id: string;
  image?: string;
  [key: string]: unknown;
};

export const REPORTS_UPDATED_EVENT = "pantherfind:reports-updated";

export function notifyReportsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(REPORTS_UPDATED_EVENT));
  }
}

export async function createCompactImage(
  source: string,
  maxDimension = 720,
  quality = 0.68
): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = source;
  });

  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the uploaded photo.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

/** Saves reports while preserving the newest report's photo if storage is tight. */
export function saveReportsWithQuotaFallback<T extends StoredReport>(
  reports: T[],
  keepPhotoForId?: string
): T[] {
  const key = "pantherFindReports";
  const compacted = reports.map((report) => ({ ...report }));
  const save = () => localStorage.setItem(key, JSON.stringify(compacted));

  try {
    save();
    notifyReportsUpdated();
    return compacted;
  } catch (initialError) {
    const initial = initialError as { name?: string; code?: number };
    if (initial.name !== "QuotaExceededError" && initial.code !== 22) {
      throw initialError;
    }
    let lastError: unknown = initialError;

    for (let index = compacted.length - 1; index >= 0; index -= 1) {
      const report = compacted[index];
      if (!report.image || report.id === keepPhotoForId) continue;

      report.image = "";
      try {
        save();
        notifyReportsUpdated();
        return compacted;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  }
}
