"use client";

import type { VisualAttributes, VisualCandidate } from "../lib/visual-attributes";

type PhotoAnalysisPanelProps = {
  analysis: VisualAttributes | null;
  error?: string;
  issue?: "mismatch" | "ambiguous" | null;
  selectedItem: string;
  suggestedItem?: string | null;
  isBusy?: boolean;
  onChangeCategory?: () => void;
  onKeepCategory?: () => void;
  onSelectCandidate?: (candidate: VisualCandidate) => void;
  onConfirmSelectedObject?: () => void;
  onRetry?: () => void;
  onContinueWithoutAnalysis?: () => void;
};

export default function PhotoAnalysisPanel({
  analysis,
  error,
  issue,
  selectedItem,
  suggestedItem,
  isBusy,
  onChangeCategory,
  onKeepCategory,
  onSelectCandidate,
  onConfirmSelectedObject,
  onRetry,
  onContinueWithoutAnalysis,
}: PhotoAnalysisPanelProps) {
  if (error) {
    return (
      <section className="photoAnalysisPanel photoAnalysisError" aria-live="polite">
        <strong>Photo analysis wasn’t completed</strong>
        <p>{error}</p>
        <div className="photoAnalysisActions">
          <button type="button" onClick={onRetry} disabled={isBusy}>Retry analysis</button>
          <button type="button" onClick={onContinueWithoutAnalysis} disabled={isBusy}>Continue with selected details</button>
        </div>
      </section>
    );
  }

  if (!analysis) return null;

  const confidenceLabels = [
    `Item: ${analysis.itemType || "Unknown"} (${analysis.confidence.itemType} confidence)`,
    `Color: ${analysis.primaryColor || "Unknown"} (${analysis.confidence.primaryColor} confidence)`,
    `Brand: ${analysis.brand || "Unknown"} (${analysis.confidence.brand} confidence)`,
    `Model: ${analysis.model || "Unknown"} (${analysis.confidence.model} confidence)`,
    `Type: ${analysis.styleType || "Unknown"} (${analysis.confidence.styleType} confidence)`,
    analysis.surroundings.slice(0, 1).map((value) => `Scene: ${value} (${analysis.confidence.surroundings} confidence)`)[0],
  ].filter(Boolean);

  return (
    <section className={`photoAnalysisPanel${issue ? " photoAnalysisWarning" : ""}`} aria-live="polite">
      <strong>{issue === "ambiguous" ? "Which item are you reporting?" : issue === "mismatch" ? "Check the selected item" : "Analysis completed"}</strong>
      {issue && (
        <p>
          {issue === "ambiguous"
            ? "The photo contains more than one possible item, and the intended one isn’t clear. Choose the item you’re reporting."
            : `The photo appears to show ${suggestedItem || analysis.itemType}, but you selected ${selectedItem}. Choose whether to correct the category or keep your selection.`}
        </p>
      )}
      {!issue && confidenceLabels.length > 0 && <p className="photoAnalysisDetails">{confidenceLabels.join(" · ")}</p>}
      {issue === "ambiguous" && (
        <div className="photoAnalysisActions photoCandidateActions">
          {analysis.candidateItems.map((candidate, index) => (
            <button type="button" key={`${candidate.label}-${index}`} onClick={() => onSelectCandidate?.(candidate)}>
              I’m reporting: {candidate.label}
            </button>
          ))}
          {analysis.candidateItems.length === 0 && (
            <button type="button" onClick={onConfirmSelectedObject}>I’m reporting the selected {selectedItem}</button>
          )}
        </div>
      )}
      {issue === "mismatch" && (
        <div className="photoAnalysisActions">
          <button type="button" onClick={onChangeCategory}>Change category to {suggestedItem || analysis.itemType}</button>
          <button type="button" onClick={onKeepCategory}>Keep {selectedItem}</button>
        </div>
      )}
    </section>
  );
}
