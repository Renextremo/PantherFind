"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  INBOX_STORAGE_KEY,
  INBOX_UPDATED_EVENT,
  InboxNotification,
  saveInboxNotifications,
} from "../lib/inbox";
import { scanStoredReportMatches } from "../lib/report-agents";
import { notifyReportsUpdated, REPORTS_UPDATED_EVENT } from "../lib/report-storage";

type InboxReport = {
  id: string;
  reportType?: string;
  item?: string;
  campus?: string;
  location?: string;
  caseNumber?: string;
  status?: string;
  matchedReportId?: string;
  matchConfirmedAt?: string;
  matchReceipt?: {
    confirmedAt: string;
    foundReportId: string;
    campus?: string;
    location?: string;
    caseNumber?: string;
  };
};

export default function InboxDrawer() {
  const [inboxOpen, setInboxOpen] = useState(false);
  const [topPosition, setTopPosition] = useState(175);
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [reports, setReports] = useState<InboxReport[]>([]);
  const [toast, setToast] = useState<InboxNotification | null>(null);
  const [resolutionError, setResolutionError] = useState("");
  const notificationCount = notifications.filter((item) => !item.seen).length;
  const router = useRouter();
  const pathname = usePathname();
  const isHomeScreen = pathname === "/";
  const matchToast = toast?.type === "possible-match" ? toast : null;
  const previousNotificationIds = useRef<Set<string> | null>(null);
  const allowToastRef = useRef(false);

  const isDragging = useRef(false);
  const didDrag = useRef(false);
  const startMouseY = useRef(0);
  const startTop = useRef(175);

  useEffect(() => {
    function centerDrawer() {
      const mobile = window.innerWidth <= 760;
      const drawerHeight = Math.max(
        mobile ? 150 : 165,
        Math.min(460, window.innerHeight - (mobile ? 32 : 190))
      );
      setTopPosition(Math.min(
        window.innerHeight - drawerHeight - 10,
        Math.max(10, (window.innerHeight - drawerHeight) / 2)
      ));
    }
    centerDrawer();
    window.addEventListener("resize", centerDrawer);
    return () => window.removeEventListener("resize", centerDrawer);
  }, []);

  useEffect(() => {
    function restoreConfirmedMatches() {
      try {
        const reportsValue = JSON.parse(localStorage.getItem("pantherFindReports") || "[]");
        const notificationsValue = JSON.parse(localStorage.getItem(INBOX_STORAGE_KEY) || "[]");
        if (!Array.isArray(reportsValue) || !Array.isArray(notificationsValue)) return;
        let changed = false;
        const updatedReports = reportsValue.map((report: InboxReport) => {
          const notification = (notificationsValue as InboxNotification[]).find((item) =>
            item.status === "confirmed" && [item.reportId, item.matchedReportId].includes(report.id)
          );
          if (!notification) return report;
          const pairIds = [notification.reportId, notification.matchedReportId];
          const found = reportsValue.find((candidate: InboxReport) =>
            pairIds.includes(candidate.id) && candidate.reportType === "found"
          );
          if (!found) return report;
          const receipt = report.matchReceipt || {
            confirmedAt: notification.resolvedAt || "",
            foundReportId: found.id,
            campus: found.campus,
            location: found.location,
            caseNumber: found.caseNumber,
          };
          const matchedReportId = report.id === notification.reportId
            ? notification.matchedReportId
            : notification.reportId;
          if (report.status === "Closed" && report.matchReceipt) return report;
          if (report.status === "Match Found" && report.matchReceipt && report.matchedReportId === matchedReportId) return report;
          changed = true;
          return {
            ...report,
            status: report.status === "Closed" ? "Closed" : "Match Found",
            matchedReportId,
            matchConfirmedAt: notification.resolvedAt || report.matchConfirmedAt,
            matchReceipt: receipt,
          };
        });
        if (changed) {
          localStorage.setItem("pantherFindReports", JSON.stringify(updatedReports));
          notifyReportsUpdated();
        }
      } catch {
        // Existing browser data is best-effort; never block the inbox.
      }
    }

    function loadNotifications() {
      let nextNotifications: InboxNotification[] = [];
      try {
        const saved = localStorage.getItem(INBOX_STORAGE_KEY);
        const parsed = saved ? JSON.parse(saved) : [];
        nextNotifications = Array.isArray(parsed) ? parsed : [];
        const previousIds = previousNotificationIds.current;
        const newest = previousIds && nextNotifications.find((item) =>
          !previousIds.has(item.id) && item.status !== "declined"
        );
        if (
          allowToastRef.current &&
          newest?.type === "possible-match" &&
          window.location.pathname !== "/"
        ) {
          setToast(newest);
        }
        previousNotificationIds.current = new Set(nextNotifications.map((item) => item.id));
        setNotifications(nextNotifications);
      } catch {
        setNotifications([]);
      }
      try {
        const savedReports = localStorage.getItem("pantherFindReports");
        const parsedReports = savedReports ? JSON.parse(savedReports) : [];
        setReports(Array.isArray(parsedReports) ? parsedReports : []);
      } catch {
        setReports([]);
      }
    }

    restoreConfirmedMatches();
    loadNotifications();
    // Treat stored and startup-scanned matches as existing inbox state. Only
    // messages arriving after the initial scan should raise a toast.
    void scanStoredReportMatches().finally(() => {
      loadNotifications();
      allowToastRef.current = true;
    });
    window.addEventListener("storage", loadNotifications);
    window.addEventListener(REPORTS_UPDATED_EVENT, loadNotifications);
    window.addEventListener(INBOX_UPDATED_EVENT, loadNotifications);
    return () => {
      window.removeEventListener("storage", loadNotifications);
      window.removeEventListener(REPORTS_UPDATED_EVENT, loadNotifications);
      window.removeEventListener(INBOX_UPDATED_EVENT, loadNotifications);
    };
  }, []);

  useEffect(() => {
    if (!isHomeScreen) setInboxOpen(false);
    if (!isHomeScreen) return;
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("inbox")) {
      setInboxOpen(true);
      router.replace("/");
    }
  }, [isHomeScreen, pathname, router]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 6500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function openToastInbox() {
    setToast(null);
    setInboxOpen(true);
    if (pathname !== "/") router.push("/?inbox=1");
    else router.replace("/");
  }

  function openNotification(notification: InboxNotification) {
    markNotificationSeen(notification.id);
    setInboxOpen(false);
    const foundReport = reports.find((report) =>
      report.reportType === "found" &&
      [notification.reportId, notification.matchedReportId].includes(report.id)
    );
    router.push(`/reports/${encodeURIComponent(foundReport?.id || notification.matchedReportId)}`);
  }

  function markNotificationSeen(notificationId: string) {
    const updated = notifications.map((item) => item.id === notificationId ? { ...item, seen: true } : item);
    saveInboxNotifications(updated);
  }

  function deleteNotification(notificationId: string) {
    saveInboxNotifications(notifications.filter((item) => item.id !== notificationId));
  }

  function openMatchItem(reportId: string, notification?: InboxNotification) {
    if (notification) markNotificationSeen(notification.id);
    setInboxOpen(false);
    router.push(`/reports/${encodeURIComponent(reportId)}`);
    router.refresh();
  }

  function updateNotification(notification: InboxNotification, status: "confirmed" | "declined") {
    const resolvedAt = new Date().toISOString();
    if (status === "confirmed") {
      const pairIds = new Set([notification.reportId, notification.matchedReportId]);
      let currentReports = reports;
      try {
        const savedReports = JSON.parse(localStorage.getItem("pantherFindReports") || "[]");
        if (Array.isArray(savedReports)) currentReports = savedReports;
      } catch {
        // Use the reports already loaded in the inbox if storage is malformed.
      }
      const pair = currentReports.filter((report) => pairIds.has(report.id));
      const foundReport = pair.find((report) => report.reportType === "found");
      if (pair.length !== 2 || !foundReport) {
        setResolutionError("We couldn’t verify both reports in this match, so it hasn’t been confirmed.");
        return;
      }
      const receipt = {
        confirmedAt: resolvedAt,
        foundReportId: foundReport.id,
        campus: foundReport?.campus,
        location: foundReport?.location,
        caseNumber: foundReport?.caseNumber,
      };
      const updatedReports = currentReports.map((report) => pairIds.has(report.id)
        ? { ...report, status: "Match Found", matchedReportId: report.id === notification.reportId
          ? notification.matchedReportId : notification.reportId, matchConfirmedAt: resolvedAt, matchReceipt: receipt }
        : report);
      try {
        localStorage.setItem("pantherFindReports", JSON.stringify(updatedReports));
        setReports(updatedReports);
        notifyReportsUpdated();
      } catch {
        setResolutionError("The match could not be saved. Please check browser storage and retry.");
        return;
      }
      const resolved = { ...notification, status, resolvedAt, seen: true };
      saveInboxNotifications(notifications.map((item) => item.id === notification.id ? resolved : item));
      setResolutionError("");
      openMatchItem(receipt.foundReportId);
      return;
    }

    const resolved = { ...notification, status, resolvedAt, seen: true };
    saveInboxNotifications(notifications.map((item) => item.id === notification.id ? resolved : item));
    setResolutionError("");
  }

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    isDragging.current = true;
    didDrag.current = false;
    startMouseY.current = event.clientY;
    startTop.current = topPosition;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!isDragging.current) return;
    const movementY = event.clientY - startMouseY.current;
    if (Math.abs(movementY) > 5) didDrag.current = true;

    const minimumTop = 10;
    const panelHeight = Math.min(460, window.innerHeight - (window.innerWidth <= 760 ? 32 : 190));
    const maximumTop = window.innerHeight - panelHeight - 10;
    const newTop = Math.min(maximumTop, Math.max(minimumTop, startTop.current + movementY));
    setTopPosition(newTop);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    isDragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleInboxClick() {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    setInboxOpen((current) => !current);
  }

  return (
    <>
    {!isHomeScreen && matchToast && (
      <button type="button" className="inboxMatchToast" onClick={openToastInbox}>
        <span className="inboxMessageIconCircle"><img src="/images/reports-blue.png" alt="" className="inboxMessageIcon" /></span>
        <span className="inboxMessageText">
          <span className="notificationNewLabel">New</span>
          <strong>New message in your inbox</strong>
          <span>{matchToast.title}</span>
        </span>
      </button>
    )}
    {isHomeScreen && <div
      className={inboxOpen ? "inboxDrawer inboxDrawerOpen" : "inboxDrawer"}
      style={{ top: `${topPosition}px` }}
    >
      <button
        type="button"
        className="inboxTab"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleInboxClick}
        aria-label={inboxOpen ? "Close inbox" : "Open inbox"}
        aria-expanded={inboxOpen}
      >
        <div className="inboxIconWrapper">
          <img src="/images/inbox.png" alt="" className="inboxIcon" draggable="false" />
          {notificationCount > 0 && (
            <span className="inboxNotificationBubble" aria-label={`${notificationCount} unread messages`}>
              {notificationCount}
            </span>
          )}
        </div>
        <span className="inboxTabText">Inbox</span>
      </button>

      <div className={notifications.length === 0 ? "inboxPanel inboxPanelEmpty" : "inboxPanel"}>
        {resolutionError && <p className="inboxResolutionError" role="alert">{resolutionError}</p>}
        {notifications.length === 0 ? (
          <div className="inboxEmptyState">No notifications yet</div>
        ) : (
          notifications.map((notification) => (
            <div className={`inboxMessage ${notification.seen ? "inboxMessageSeen" : "inboxMessageNew"}`} key={notification.id}>
              <div className="inboxMessageIconCircle">
                <img src="/images/reports-blue.png" alt="" draggable="false" className="inboxMessageIcon" />
              </div>
              <div className="inboxMessageText">
                <span className={notification.seen ? "notificationSeenLabel" : "notificationNewLabel"}>
                  {notification.seen ? "Seen" : "New"}
                </span>
                <h3>{notification.title}</h3>
                <p>{notification.message}</p>
                {(notification.status ?? "pending") === "pending" ? (
                  <div className="matchDecisionButtons">
                    <button type="button" className="matchConfirmButton" onClick={() => updateNotification(notification, "confirmed")}>Confirm match</button>
                    <button type="button" className="matchDeclineButton" onClick={() => updateNotification(notification, "declined")}>Decline</button>
                    <button type="button" className="inboxReportLink" onClick={() => openNotification(notification)}>View found report</button>
                  </div>
                ) : (
                  <div className="matchResolution">
                    <strong className="matchResolvedLabel">
                      {notification.status === "confirmed" ? "Match confirmed" : "Match declined"}
                    </strong>
                    <p className="matchResolutionMessage">
                      {notification.status === "confirmed"
                        ? "Your match receipt is saved in My Reports."
                        : "This possible match has been dismissed."}
                    </p>
                    {notification.status === "confirmed" && (
                      <button type="button" className="inboxReportLink" onClick={() => openMatchItem(reports.find((report) => report.id === notification.reportId && report.reportType === "found")?.id || notification.matchedReportId, notification)}>
                        View report and receipt
                      </button>
                    )}
                    {notification.status === "declined" && (
                      <button type="button" className="inboxReportLink" onClick={() => deleteNotification(notification.id)}>
                        Delete notification
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>}
    </>
  );
}
