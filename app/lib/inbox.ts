export type InboxNotification = {
  id: string;
  type: "possible-match";
  title: string;
  message: string;
  reportId: string;
  matchedReportId: string;
  createdAt: string;
  status?: "pending" | "confirmed" | "declined";
  confidence?: number;
  rationale?: string;
  resolvedAt?: string;
  seen?: boolean;
};

export const INBOX_STORAGE_KEY = "pantherFindNotifications";
export const INBOX_UPDATED_EVENT = "pantherfind:inbox-updated";

export function saveInboxNotifications(notifications: InboxNotification[]) {
  try {
    localStorage.setItem(INBOX_STORAGE_KEY, JSON.stringify(notifications));
    window.dispatchEvent(new Event(INBOX_UPDATED_EVENT));
  } catch {
    // A full browser store should not prevent a report from being submitted.
  }
}
