"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import DashboardLayout from "../Components/DashboardLayout";
import { notifyReportsUpdated, REPORTS_UPDATED_EVENT } from "../lib/report-storage";
import { FIU_LOST_FOUND_URL, getPickupContacts } from "../lib/pickup-guidance";
import { INBOX_STORAGE_KEY, InboxNotification, saveInboxNotifications } from "../lib/inbox";


type FilterType =
  | "all"
  | "lost"
  | "found";


type Report = {
  id: string;

  reportType:
    | "lost"
    | "found";

  item: string;

  brand?: string;

  itemDetail?: string;

  color?: string;

  campus?: string;

  campusCode?: string;

  location: string;

  incidentDate: string;

  description?: string;

  image: string;

  caseNumber: string;

  confirmation?: string;

  submittedAt: string;

  status:
    | "Submitted"
    | "Match Found"
    | "Closed";
  matchedReportId?: string;
  resolvedAt?: string;
  matchReceipt?: {
    confirmedAt: string;
    foundReportId: string;
    campus?: string;
    location?: string;
    caseNumber?: string;
  };
  matchConfirmedAt?: string;
};


export default function ReportsPage() {

  const router =
    useRouter();


  const [
    reports,
    setReports,
  ] = useState<Report[]>([]);


  const [
    filter,
    setFilter,
  ] = useState<FilterType>(
    "all"
  );


  const [
    sortNewest,
    setSortNewest,
  ] = useState(true);


  /*
    LOAD REAL REPORTS
  */

  useEffect(() => {

    function loadReports() {

    const savedReports =
      localStorage.getItem(
        "pantherFindReports"
      );


    if (!savedReports) {

      setReports([]);

      return;
    }


    try {

      const parsedReports =
        JSON.parse(
          savedReports
        );


      if (
        Array.isArray(
          parsedReports
        )
      ) {

        setReports(
          parsedReports
        );

      } else {

        setReports([]);

      }


    } catch (error) {

      console.error(
        "Could not load reports:",
        error
      );


      setReports([]);

    }

    }

    loadReports();
    window.addEventListener("storage", loadReports);
    window.addEventListener(REPORTS_UPDATED_EVENT, loadReports);
    return () => {
      window.removeEventListener("storage", loadReports);
      window.removeEventListener(REPORTS_UPDATED_EVENT, loadReports);
    };

  }, []);


  /*
    FILTER AND SORT
  */

  const filteredReports =
    reports

      .filter((report) => {

        if (
          filter === "all"
        ) {

          return true;

        }


        return (
          report.reportType ===
          filter
        );

      })


      .sort((a, b) => {

        const aTime =
          new Date(
            a.submittedAt
          ).getTime();


        const bTime =
          new Date(
            b.submittedAt
          ).getTime();


        if (sortNewest) {

          return (
            bTime - aTime
          );

        }


        return (
          aTime - bTime
        );

      });


  /*
    FORMAT DATE
  */

  function formatDate(
    date: string
  ) {

    if (!date) {

      return "Date not provided";

    }


    const parsedDate =
      new Date(
        `${date}T00:00:00`
      );


    return (
      parsedDate.toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "numeric",
          year: "numeric",
        }
      )
    );

  }


  /*
    OPEN EDIT PAGE
  */

  function editReport(
    reportId: string
  ) {

    router.push(
      `/reports/${reportId}/edit`
    );

  }

  function markResolved(report: Report) {
    const itemName = [report.color, report.brand, report.itemDetail, report.item].filter(Boolean).join(" ");
    if (!window.confirm(`Mark ${itemName || "this matched item"} as resolved? Both reports in this match will leave active search.`)) return;
    const pairIds = new Set([report.id, report.matchedReportId].filter(Boolean) as string[]);
    const resolvedAt = new Date().toISOString();
    const updated = reports.map((entry) => pairIds.has(entry.id)
      ? { ...entry, status: "Closed" as const, resolvedAt }
      : entry);
    try {
      localStorage.setItem("pantherFindReports", JSON.stringify(updated));
      setReports(updated);
      notifyReportsUpdated();
    } catch {
      window.alert("Could not update this report. Check that your browser has available storage and try again.");
    }
  }

  function deleteClosedCase(report: Report) {
    if (report.status !== "Closed") return;
    const caseIds = new Set(
      reports
        .filter((entry) => entry.id === report.id || entry.id === report.matchedReportId || entry.matchedReportId === report.id)
        .map((entry) => entry.id)
    );
    const caseName = [report.color, report.brand, report.itemDetail, report.item].filter(Boolean).join(" ") || "this closed case";
    const confirmation = caseIds.size > 1
      ? `Delete ${caseName} and its matched report permanently?`
      : `Delete ${caseName} permanently?`;
    if (!window.confirm(confirmation)) return;

    const remaining = reports.filter((entry) => !caseIds.has(entry.id));
    try {
      localStorage.setItem("pantherFindReports", JSON.stringify(remaining));
      setReports(remaining);
      notifyReportsUpdated();
      try {
        const savedNotifications = JSON.parse(localStorage.getItem(INBOX_STORAGE_KEY) || "[]");
        if (Array.isArray(savedNotifications)) {
          saveInboxNotifications((savedNotifications as InboxNotification[]).filter((notification) =>
            !caseIds.has(notification.reportId) && !caseIds.has(notification.matchedReportId)
          ));
        }
        const lastSubmitted = JSON.parse(sessionStorage.getItem("pantherFindSubmittedReport") || "null");
        if (lastSubmitted?.id && caseIds.has(lastSubmitted.id)) sessionStorage.removeItem("pantherFindSubmittedReport");
      } catch {
        // The closed case is already removed; malformed optional cache data can be ignored.
      }
    } catch {
      window.alert("Could not delete this case. Check your browser storage and try again.");
    }
  }

  function getReceipt(report: Report) {
    if (report.matchReceipt) return report.matchReceipt;
    if (!report.matchedReportId) return null;
    const match = reports.find((entry) => entry.id === report.matchedReportId);
    const found = match?.reportType === "found" ? match : reports.find((entry) =>
      entry.reportType === "found" && entry.matchedReportId === report.id
    );
    if (!found) return null;
    return {
      confirmedAt: report.matchConfirmedAt || "",
      foundReportId: found.id,
      campus: found.campus,
      location: found.location,
      caseNumber: found.caseNumber,
    };
  }


  return (

    <DashboardLayout activePage="reports">

      <div className="reportsPage">


        {/* TITLE */}

        <div className="reportsHeading">

          <h1>
            My Reports
          </h1>


          <h2>
            Track the status of the items you’ve reported
          </h2>

        </div>


        {/* FILTERS */}

        <div className="reportsControls">

          <div className="reportsFilters">


            <button
              type="button"
              className={
                filter === "all"
                  ? "reportFilterButton active"
                  : "reportFilterButton"
              }
              onClick={() =>
                setFilter("all")
              }
            >
              All Items
            </button>


            <button
              type="button"
              className={
                filter === "lost"
                  ? "reportFilterButton active"
                  : "reportFilterButton"
              }
              onClick={() =>
                setFilter("lost")
              }
            >
              Lost Items
            </button>


            <button
              type="button"
              className={
                filter === "found"
                  ? "reportFilterButton active"
                  : "reportFilterButton"
              }
              onClick={() =>
                setFilter("found")
              }
            >
              Found Items
            </button>

          </div>


          {/* SORT */}

          <button
            type="button"
            className="reportsSortButton"
            onClick={() =>
              setSortNewest(
                !sortNewest
              )
            }
          >

            {sortNewest
              ? "Newest First"
              : "Oldest First"}


            <span>
              ⌄
            </span>

          </button>

        </div>


        {/* REPORTS */}

        <div className="reportsList">


          {/* NO REPORTS */}

          {filteredReports.length ===
            0 && (

            <div
              style={{
                width: "100%",
                padding:
                  "60px 20px",
                textAlign:
                  "center",
                boxSizing:
                  "border-box",
              }}
            >

              <h3
                style={{
                  margin:
                    "0 0 8px",
                  color:
                    "#10069f",
                  fontSize:
                    "22px",
                  fontFamily:
                    '"Quicksand", sans-serif',
                }}
              >
                No reports yet
              </h3>


              <p
                style={{
                  margin: 0,
                  color: "#555",
                  fontSize:
                    "15px",
                  fontFamily:
                    '"Quicksand", sans-serif',
                }}
              >

                {filter === "lost"

                  ? "You haven't submitted any lost item reports yet."

                  : filter === "found"

                  ? "You haven't submitted any found item reports yet."

                  : "Your lost and found reports will appear here."}

              </p>

            </div>

          )}


          {/* REPORT CARDS */}

          {filteredReports.map(
            (report) => (

              <div
                className="reportCard"
                key={
                  report.id
                }
              >


                {/* PHOTO */}

                <div className="reportCardPhoto">

                  {report.image ? (

                    <img
                      src={
                        report.image
                      }
                      alt={
                        report.item
                      }
                    />

                  ) : (

                    <div
                      style={{
                        width:
                          "100%",
                        height:
                          "100%",
                        display:
                          "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                        background:
                          "#d9dfe3",
                        fontSize:
                          "12px",
                        textAlign:
                          "center",
                      }}
                    >
                      No Photo
                    </div>

                  )}

                </div>


                {/* ITEM INFORMATION */}

                <div className="reportCardInfo">


                  <span
                    className={
                      report.reportType ===
                      "lost"

                        ? "reportTypeBadge lost"

                        : "reportTypeBadge found"
                    }
                  >

                    {report.reportType ===
                    "lost"

                      ? "Lost"

                      : "Found"}

                  </span>


                  <h3>
                    {report.item}
                  </h3>


                  <p>

                    {report.location ||
                      report.campus ||
                      "Location not provided"}

                  </p>


                  <p>

                    {formatDate(
                      report.incidentDate
                    )}

                  </p>


                  <p>

                    {report.caseNumber}

                  </p>

                </div>


                {/* STATUS */}

                <div className="reportCardStatus">


                  {report.status ===
                    "Submitted" && (

                    <>

                      <span className="statusBadge submitted">
                        Submitted
                      </span>


                      <p>
                        Your report has been submitted.
                        <br />
                        You’ll be notified if there’s a match.
                      </p>

                    </>

                  )}


                  {report.status ===
                    "Match Found" && (

                    <>

                      <span className="statusBadge match">
                        Match Found
                      </span>


                      <p>
                        This match was confirmed.
                        <br />
                        Your pickup receipt is below.
                      </p>

                    </>

                  )}


                  {report.status ===
                    "Closed" && (

                    <>

                      <span className="statusBadge closed">
                        Closed
                      </span>


                      <p>
                        This report is resolved and no longer appears in active search.
                      </p>

                    </>

                  )}

                </div>

                {/* ACTIONS */}

                <div className="reportCardActions">


                  <button
  type="button"
  className="reportDetailsButton"
  onClick={() =>
    router.push(
      `/reports/${report.id}`
    )
  }
>
  View Details
</button>


                  {report.status ===
                    "Submitted" && (

                    <button
                      type="button"
                      className="reportSecondaryButton"
                      onClick={() =>
                        editReport(
                          report.id
                        )
                      }
                    >
                      Edit Report
                    </button>

                  )}


                  {report.status ===
                    "Match Found" && (

                    <button
                      type="button"
                      className="reportSecondaryButton"
                      onClick={() => markResolved(report)}
                    >
                      Mark as Resolved
                    </button>

                  )}


                  {report.status ===
                    "Closed" && (

                    <button
                      type="button"
                      className="reportSecondaryButton"
                      onClick={() => deleteClosedCase(report)}
                    >
                      Delete Case
                    </button>

                  )}

                </div>

                {(report.matchReceipt || report.matchedReportId) && (() => {
                  const receipt = getReceipt(report);
                  if (!receipt) return null;
                  const contacts = getPickupContacts(receipt.campus, receipt.location);
                  return (
                    <section className="matchReceipt" aria-label="Match receipt">
                      <div className="matchReceiptHeader">
                        <span>Match receipt</span>
                        {receipt.confirmedAt && <time>{new Date(receipt.confirmedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time>}
                      </div>
                      <h4>Pickup details</h4>
                      <p><strong>Reported find location:</strong> {[receipt.campus, receipt.location].filter(Boolean).join(" · ") || "See the found report"}</p>
                      {receipt.caseNumber && <p><strong>Found report case:</strong> {receipt.caseNumber}</p>}
                      <p className="matchReceiptNote">Call first to confirm where the item is being held; this reported location may not be the pickup desk.</p>
                      <ul>{contacts.map((contact) => <li key={contact.name}><strong>{contact.name}</strong> · <a href={`tel:${contact.phone}`}>{contact.phone}</a></li>)}</ul>
                      <div className="matchReceiptActions">
                        <button type="button" onClick={() => router.push(`/reports/${receipt.foundReportId}`)}>View found report</button>
                        <a href={FIU_LOST_FOUND_URL} target="_blank" rel="noreferrer">FIU lost and found information</a>
                      </div>
                    </section>
                  );
                })()}


              </div>

            )
          )}

        </div>

      </div>

    </DashboardLayout>

  );
}
