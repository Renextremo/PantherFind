import {
  INBOX_STORAGE_KEY,
  InboxNotification,
  saveInboxNotifications,
} from "./inbox";

type ReportRecord = {
  id: string;
  reportType: string;
  item: string;
  description?: string;
  brand?: string;
  itemDetail?: string;
  color?: string;
  campus?: string;
  location?: string;
  incidentDate?: string;
  status?: string;
  matchedReportId?: string;
  [key: string]: unknown;
};

type MatchResult = {
  reportId: string;
  confidence: number;
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
    color: report.color || "",
    campus: report.campus || "",
    location: report.location || "",
    date: report.incidentDate || "",
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

    // This fallback compares report text only. It never reads or sends an image.
    const confidence = Math.min(
      1,
      itemScore * 0.52 + descriptionScore * 0.38 + (sameLocation ? 0.12 : 0) + (sameCampus ? 0.08 : 0)
    );
    if (confidence < 0.6 || (itemScore < 0.25 && descriptionScore < 0.35)) return [];

    return [{
      reportId: candidate.id,
      confidence,
      rationale: sameLocation
        ? "The item descriptions and reported location are similar."
        : "The item names and descriptions contain similar details.",
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
    if (!candidate || match.confidence < 0.6) continue;

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
      title: "Possible item match",
      message: `${currentItem} may match ${otherItem} near ${candidate.location || report.location || "campus"}. ${match.rationale}`,
      reportId: report.id,
      matchedReportId: candidate.id,
      createdAt: now,
      status: "pending",
      confidence: match.confidence,
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
  for (const match of [...aiMatches, ...localMatches]) {
    const current = bestMatches.get(match.reportId);
    if (!current || match.confidence > current.confidence) bestMatches.set(match.reportId, match);
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
