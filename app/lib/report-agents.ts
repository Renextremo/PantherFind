import {
  INBOX_STORAGE_KEY,
  InboxNotification,
  saveInboxNotifications,
} from "./inbox";
import type { VisualAttributes } from "./visual-attributes";

type ReportRecord = {
  id: string;
  reportType: string;
  item: string;
  description?: string;
  brand?: string;
  itemDetail?: string;
  color?: string;
  visualAttributes?: VisualAttributes | null;
  photoReview?: { outcome?: string; selectedItem?: string } | null;
  campus?: string;
  location?: string;
  incidentDate?: string;
  status?: string;
  matchedReportId?: string;
  [key: string]: unknown;
};

type MatchResult = {
  reportId: string;
  matchLevel: "Strong Match" | "Possible Match" | "Weak Match";
  rationale: string;
};

async function postJson<T>(url: string, body: unknown): Promise<T | null> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function toMatchInput(report: ReportRecord) {
  return {
    id: report.id,
    type: report.reportType,
    item: report.item,
    description: report.description || "",
    brand: report.brand || "",
    itemDetail: report.itemDetail || "",
    color: report.color || "",
    campus: report.campus || "",
    location: report.location || "",
    date: report.incidentDate || "",
    visualAttributes: report.photoReview?.outcome === "kept" ? null : report.visualAttributes || null,
  };
}

function readInbox(): InboxNotification[] {
  try {
    const saved = localStorage.getItem(INBOX_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word && ![
      "the", "a", "an", "item", "other", "lost", "found", "was", "is",
      "near", "at", "on", "in", "this", "photo", "appears", "show",
      "reported", "possible", "match", "with", "and", "from", "my",
    ].includes(word));
}

function textSimilarity(first: string, second: string): number {
  const firstWords = new Set(words(first));
  const secondWords = new Set(words(second));
  if (!firstWords.size || !secondWords.size) return 0;
  const overlap = [...firstWords].filter((word) => secondWords.has(word)).length;
  return overlap / new Set([...firstWords, ...secondWords]).size;
}

function localTextMatches(report: ReportRecord, candidates: ReportRecord[]): MatchResult[] {
  return candidates.flatMap((candidate) => {
    if (candidate.reportType === report.reportType || candidate.status === "Match Found" || candidate.status === "Closed" || candidate.matchedReportId) return [];

    const firstVisual = report.visualAttributes;
    const otherVisual = candidate.visualAttributes;
    const firstType = [report.itemDetail, firstVisual?.itemType].filter(Boolean).join(" ").toLowerCase();
    const otherType = [candidate.itemDetail, otherVisual?.itemType].filter(Boolean).join(" ").toLowerCase();
    const firstBrand = (firstVisual?.brand || report.brand || "").trim().toLowerCase();
    const otherBrand = (otherVisual?.brand || candidate.brand || "").trim().toLowerCase();
    const hasBrandConflict = firstBrand && otherBrand && firstBrand !== otherBrand;
    const hasTypeConflict = firstType && otherType && textSimilarity(firstType, otherType) === 0 && firstType !== "other" && otherType !== "other";
    if (hasBrandConflict || hasTypeConflict) return [];

    const itemScore = textSimilarity(
      [report.item, report.itemDetail, report.brand, report.color].filter(Boolean).join(" "),
      [candidate.item, candidate.itemDetail, candidate.brand, candidate.color].filter(Boolean).join(" ")
    );
    const descriptionScore = textSimilarity(
      report.description || "",
      candidate.description || ""
    );
    const sameLocation = !!report.location && !!candidate.location &&
      report.location.toLowerCase() === candidate.location.toLowerCase();
    const sameCampus = !!report.campus && !!candidate.campus &&
      report.campus.toLowerCase() === candidate.campus.toLowerCase();
    const colorsA = [report.color, firstVisual?.primaryColor, ...(firstVisual?.secondaryColors || [])].filter(Boolean).map((value) => String(value).toLowerCase());
    const colorsB = [candidate.color, otherVisual?.primaryColor, ...(otherVisual?.secondaryColors || [])].filter(Boolean).map((value) => String(value).toLowerCase());
    const sharedColor = colorsA.find((color) => colorsB.some((other) => color === other || color.includes(other) || other.includes(color)));
    const modelsMatch = !!firstVisual?.model && !!otherVisual?.model && firstVisual.model.toLowerCase() === otherVisual.model.toLowerCase();
    const sharedFeatures = [
      ...(firstVisual?.distinctiveFeatures || []),
      ...(firstVisual?.physicalCharacteristics || []),
    ].filter((feature) => [
      ...(otherVisual?.distinctiveFeatures || []),
      ...(otherVisual?.physicalCharacteristics || []),
    ].some((other) => textSimilarity(feature, other) >= 0.35));
    const sameBrand = !!firstBrand && firstBrand === otherBrand;

    // Local fallback uses stored visual labels and text, never the raw image.
    const score = Math.min(
      1,
      itemScore * 0.40 + descriptionScore * 0.28 + (sameLocation ? 0.10 : 0) + (sameCampus ? 0.08 : 0) +
      (sameBrand ? 0.16 : 0) + (sharedColor ? 0.11 : 0) + (modelsMatch ? 0.20 : 0) + Math.min(0.15, sharedFeatures.length * 0.06)
    );
    if (score < 0.48 || (itemScore < 0.2 && descriptionScore < 0.25 && !sameBrand && !sharedColor && !sharedFeatures.length)) return [];

    const support = [
      sameBrand ? `the same visible or reported brand (${firstVisual?.brand || report.brand})` : "",
      modelsMatch ? `the same visible model (${firstVisual?.model})` : "",
      sharedColor ? `similar ${sharedColor} color` : "",
      sharedFeatures.length ? `similar appearance (${sharedFeatures.slice(0, 2).join(", ")})` : "",
      itemScore >= 0.25 || descriptionScore >= 0.3 ? "matching item and description details" : "",
      sameCampus ? `the same reported campus (${report.campus})` : "",
      sameLocation ? `the same reported location (${report.location})` : "",
    ].filter(Boolean);

    return [{
      reportId: candidate.id,
      matchLevel: score >= 0.76 && (sameBrand || modelsMatch || sharedFeatures.length > 0) ? "Strong Match" : "Possible Match",
      rationale: `${support.length ? `Supporting details include ${support.join("; ")}.` : "The item names and descriptions contain similar details."}${report.incidentDate && candidate.incidentDate ? " Dates are available for student review." : " Date information is incomplete."}`,
    }];
  });
}

function addMatchNotifications(
  report: ReportRecord,
  candidates: ReportRecord[],
  matches: MatchResult[]
) {
  const notifications = readInbox();
  const now = new Date().toISOString();

  for (const match of matches) {
    const candidate = candidates.find((item) => item.id === match.reportId);
    if (!candidate || match.matchLevel === "Weak Match") continue;

    const pairKey = [report.id, candidate.id].sort().join(":");
    const currentItem = [report.color, report.brand, report.itemDetail, report.item]
      .filter(Boolean)
      .join(" ");
    const otherItem = [candidate.color, candidate.brand, candidate.itemDetail, candidate.item]
      .filter(Boolean)
      .join(" ");
    const notificationId = `match-${pairKey}`;
    if (notifications.some((item) => item.id === notificationId)) continue;

    notifications.unshift({
      id: notificationId,
      type: "possible-match",
      title: match.matchLevel,
      message: `${currentItem} may match ${otherItem}. ${match.rationale}`,
      reportId: report.id,
      matchedReportId: candidate.id,
      createdAt: now,
      status: "pending",
      rationale: match.rationale,
    });
  }

  saveInboxNotifications(notifications.slice(0, 100));
}

async function reviewDescription(report: ReportRecord) {
  return postJson<{ review?: unknown }>("/api/agents/check-description", {
    item: report.item,
    description: report.description || "",
    brand: report.brand,
    itemDetail: report.itemDetail,
    color: report.color,
  });
}

async function matchReport(report: ReportRecord, candidates: ReportRecord[]) {
  const result = await postJson<{ matches?: MatchResult[] }>(
    "/api/agents/match-reports",
    {
      report: toMatchInput(report),
      candidates: candidates.slice(0, 12).map(toMatchInput),
    }
  );

  const aiMatches = Array.isArray(result?.matches) ? result.matches : [];
  const localMatches = localTextMatches(report, candidates);
  const bestMatches = new Map<string, MatchResult>();
  const levelRank = { "Strong Match": 3, "Possible Match": 2, "Weak Match": 1 };
  for (const match of [...aiMatches, ...localMatches]) {
    const current = bestMatches.get(match.reportId);
    if (!current || levelRank[match.matchLevel] > levelRank[current.matchLevel]) bestMatches.set(match.reportId, match);
  }
  addMatchNotifications(report, candidates, [...bestMatches.values()]);
}

/** Reviews a new report and compares text fields against existing opposite-type reports. */
export async function runReportAgents(report: ReportRecord, priorReports: ReportRecord[]) {
  const descriptionResult = await reviewDescription(report);
  const reviewedReport: ReportRecord = {
    ...report,
    agentReview: {
      description: descriptionResult?.review || null,
      reviewedAt: new Date().toISOString(),
    },
  };

  try {
    const reports = JSON.parse(localStorage.getItem("pantherFindReports") || "[]");
    if (Array.isArray(reports)) {
      localStorage.setItem(
        "pantherFindReports",
        JSON.stringify(reports.map((entry: ReportRecord) =>
          entry.id === report.id ? reviewedReport : entry
        ))
      );
    }
  } catch {
    // The report is already saved; review notes are optional metadata.
  }

  const candidates = priorReports.filter(
    (entry) => entry.reportType !== report.reportType && entry.status !== "Match Found" && entry.status !== "Closed" && !entry.matchedReportId
  );
  if (candidates.length) await matchReport(reviewedReport, candidates);
}

/** Checks older reports in this browser, including reports saved before matching was added. */
export async function scanStoredReportMatches() {
  const scanKey = "pantherFindLastTextMatchScan";
  try {
    const lastScan = Number(localStorage.getItem(scanKey) || 0);
    if (Date.now() - lastScan < 10 * 60 * 1000) return;

    const saved = localStorage.getItem("pantherFindReports");
    const parsed = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed) || parsed.length < 2) {
      localStorage.setItem(scanKey, String(Date.now()));
      return;
    }

    const recent = (parsed as ReportRecord[]).slice(0, 24);
    const activeReports = recent.filter((report) => report.status !== "Match Found" && report.status !== "Closed" && !report.matchedReportId);
    const lostReports = activeReports.filter((report) => report.reportType === "lost");
    const foundReports = activeReports.filter((report) => report.reportType === "found");

    for (const report of lostReports) {
      addMatchNotifications(report, foundReports, localTextMatches(report, foundReports));
    }

    await Promise.all(lostReports.slice(0, 5).map((report) =>
      matchReport(report, foundReports)
    ));
    localStorage.setItem(scanKey, String(Date.now()));
  } catch {
    // Existing-report scans are best effort and never block navigation.
  }
}
