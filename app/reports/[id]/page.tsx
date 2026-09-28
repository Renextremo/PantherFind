"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import DashboardLayout from "../../Components/DashboardLayout";
import { REPORTS_UPDATED_EVENT } from "../../lib/report-storage";
import { FIU_LOST_FOUND_URL, getPickupContacts } from "../../lib/pickup-guidance";
import { INBOX_STORAGE_KEY, INBOX_UPDATED_EVENT, InboxNotification, saveInboxNotifications } from "../../lib/inbox";
import { notifyReportsUpdated } from "../../lib/report-storage";


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

  updatedAt?: string;

  status:
    | "Submitted"
    | "Match Found"
    | "Closed";

  matchedReportId?: string;
  matchConfirmedAt?: string;
  matchReceipt?: {
    confirmedAt: string;
    foundReportId: string;
    campus?: string;
    location?: string;
    caseNumber?: string;
  };

  isDemo?: boolean;

  agentReview?: {
    description?: {
      summary?: string;
      suggestedDescription?: string;
      concerns?: string[];
    } | null;
    reviewedAt?: string;
  };
};


/*
  DEFAULT DEMO REPORTS

  These are sample reports used to demonstrate
  how PantherFind works. They are not stored
  in localStorage.
*/

const demoReports: Report[] = [

  {
    id: "demo-1",

    reportType:
      "found",

    item:
      "Headphones / Earphones",

    brand:
      "Sony",

    color:
      "Blue",

    campus:
      "Modesto A. Maidique Campus (MMC)",

    campusCode:
      "MMC",

    location:
      "Green Library",

    incidentDate:
      "2026-09-18",

    description:
      "Blue Sony headphones found inside the Green Library near a study area. The headphones were left unattended on a table.",

    image:
      "/headphones.jpg",

    caseNumber:
      "MMC-1842",

    confirmation:
      "MMC-1842",

    submittedAt:
      "2026-09-18T14:30:00",

    status:
      "Submitted",

    isDemo:
      true,
  },


  {
    id: "demo-2",

    reportType:
      "lost",

    item:
      "Water Bottle",

    brand:
      "Owala",

    color:
      "Yellow",

    campus:
      "Modesto A. Maidique Campus (MMC)",

    campusCode:
      "MMC",

    location:
      "Wellness and Recreation Center",

    incidentDate:
      "2026-09-16",

    description:
      "Yellow Owala water bottle lost at the Wellness and Recreation Center. It may have been left near the workout or seating area.",

    image:
      "/waterbottle.jpeg",

    caseNumber:
      "MMC-5621",

    confirmation:
      "MMC-5621",

    submittedAt:
      "2026-09-16T16:15:00",

    status:
      "Submitted",

    isDemo:
      true,
  },


  {
    id: "demo-3",

    reportType:
      "found",

    item:
      "Keys",

    itemDetail:
      "Dorm",

    color:
      "Other",

    campus:
      "Modesto A. Maidique Campus (MMC)",

    campusCode:
      "MMC",

    location:
      "Charles E. Perry",

    incidentDate:
      "2026-09-14",

    description:
      "Dorm key found near Charles E. Perry with a distinctive keychain attached. The key was found in a common area.",

    image:
      "/keychain.png",

    caseNumber:
      "MMC-7314",

    confirmation:
      "MMC-7314",

    submittedAt:
      "2026-09-14T12:45:00",

    status:
      "Submitted",

    isDemo:
      true,
  },


  {
    id: "demo-4",

    reportType:
      "lost",

    item:
      "Bag",

    itemDetail:
      "Backpack",

    color:
      "Yellow",

    campus:
      "Modesto A. Maidique Campus (MMC)",

    campusCode:
      "MMC",

    location:
      "Graham Center",

    incidentDate:
      "2026-09-13",

    description:
      "Yellow backpack lost inside the Graham Center. It may have been left near one of the seating or study areas.",

    image:
      "/backpack.jpg",

    caseNumber:
      "MMC-4096",

    confirmation:
      "MMC-4096",

    submittedAt:
      "2026-09-13T17:20:00",

    status:
      "Submitted",

    isDemo:
      true,
  },

];


export default function ReportDetailsPage() {

  const params =
    useParams();


  const router =
    useRouter();


  const [
    report,
    setReport,
  ] = useState<Report | null>(
    null
  );


  const [
    loading,
    setLoading,
  ] = useState(true);

  const [matchNotifications, setMatchNotifications] = useState<InboxNotification[]>([]);


  /*
    LOAD REPORT
  */

  useEffect(() => {

    function loadReport() {

    const reportId =
      params.id as string;


    /*
      FIRST CHECK IF THIS IS
      ONE OF THE DEFAULT ITEMS
    */

    const demoReport =
      demoReports.find(
        (item) =>
          item.id ===
          reportId
      );


    if (demoReport) {

      setReport(
        demoReport
      );

      setLoading(
        false
      );

      return;

    }


    /*
      OTHERWISE LOOK FOR A
      REAL SUBMITTED REPORT
    */

    const savedReports =
      localStorage.getItem(
        "pantherFindReports"
      );


    if (!savedReports) {

      setReport(null);
      setLoading(false);

      return;

    }


    try {

      const reports:
        Report[] =
        JSON.parse(
          savedReports
        );


      const foundReport =
        reports.find(
          (savedReport) =>
            savedReport.id ===
            reportId
        );


      if (foundReport) {

        const matchedReport = foundReport.matchedReportId
          ? reports.find((candidate) => candidate.id === foundReport.matchedReportId)
          : reports.find((candidate) => candidate.matchedReportId === foundReport.id);
        const foundItem = foundReport.reportType === "found"
          ? foundReport
          : matchedReport?.reportType === "found" ? matchedReport : null;
        const reportWithReceipt = foundReport.matchReceipt || !foundItem
          ? foundReport
          : {
              ...foundReport,
              matchReceipt: {
                confirmedAt: foundReport.matchConfirmedAt || "",
                foundReportId: foundItem.id,
                campus: foundItem.campus,
                location: foundItem.location,
                caseNumber: foundItem.caseNumber,
              },
            };
        setReport(reportWithReceipt);

      } else {
        setReport(null);

      }


    } catch (error) {

      console.error(
        "Could not load report:",
        error
      );

    }


    setLoading(false);

    }

    loadReport();
    window.addEventListener("storage", loadReport);
    window.addEventListener(REPORTS_UPDATED_EVENT, loadReport);
    return () => {
      window.removeEventListener("storage", loadReport);
      window.removeEventListener(REPORTS_UPDATED_EVENT, loadReport);
    };

  }, [params.id]);

  useEffect(() => {
    function loadMatchNotifications() {
      try {
        const saved = JSON.parse(localStorage.getItem(INBOX_STORAGE_KEY) || "[]");
        setMatchNotifications(Array.isArray(saved)
          ? saved.filter((notification: InboxNotification) =>
              [notification.reportId, notification.matchedReportId].includes(params.id as string))
          : []);
      } catch {
        setMatchNotifications([]);
      }
    }
    loadMatchNotifications();
    window.addEventListener(INBOX_UPDATED_EVENT, loadMatchNotifications);
    window.addEventListener("storage", loadMatchNotifications);
    return () => {
      window.removeEventListener(INBOX_UPDATED_EVENT, loadMatchNotifications);
      window.removeEventListener("storage", loadMatchNotifications);
    };
  }, [params.id]);

  function resolveMatchFromDetails(notification: InboxNotification, status: "confirmed" | "declined") {
    const resolvedAt = new Date().toISOString();
    const resolvedNotification = { ...notification, status, resolvedAt, seen: true };
    let allNotifications: InboxNotification[] = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(INBOX_STORAGE_KEY) || "[]");
      if (Array.isArray(parsed)) allNotifications = parsed;
    } catch {
      allNotifications = matchNotifications;
    }
    const updatedNotifications = allNotifications.map((item) =>
      item.id === notification.id ? resolvedNotification : item
    );
    saveInboxNotifications(updatedNotifications);
    setMatchNotifications(updatedNotifications.filter((item) =>
      [item.reportId, item.matchedReportId].includes(params.id as string)
    ));

    if (status !== "confirmed") return;
    try {
      const reports: Report[] = JSON.parse(localStorage.getItem("pantherFindReports") || "[]");
      const reportIds = new Set([notification.reportId, notification.matchedReportId]);
      const foundReport = reports.find((item) => reportIds.has(item.id) && item.reportType === "found");
      if (!foundReport) return;
      const receipt = {
        confirmedAt: resolvedAt,
        foundReportId: foundReport.id,
        campus: foundReport.campus,
        location: foundReport.location,
        caseNumber: foundReport.caseNumber,
      };
      const updatedReports = reports.map((item) => reportIds.has(item.id)
        ? {
            ...item,
            status: "Match Found" as const,
            matchedReportId: item.id === notification.reportId ? notification.matchedReportId : notification.reportId,
            matchConfirmedAt: resolvedAt,
            matchReceipt: receipt,
          }
        : item);
      localStorage.setItem("pantherFindReports", JSON.stringify(updatedReports));
      notifyReportsUpdated();
    } catch {
      // Keep report details usable if saved browser data is unavailable.
    }
  }


  /*
    FORMAT INCIDENT DATE
  */

  function formatDate(
    date: string
  ) {

    if (!date) {

      return "Not provided";

    }


    const parsedDate =
      new Date(
        `${date}T00:00:00`
      );


    return (
      parsedDate.toLocaleDateString(
        "en-US",
        {
          month: "long",
          day: "numeric",
          year: "numeric",
        }
      )
    );

  }


  /*
    FORMAT SUBMITTED DATE
  */

  function formatSubmittedDate(
    date: string
  ) {

    if (!date) {

      return "Not provided";

    }


    const parsedDate =
      new Date(
        date
      );


    return (
      parsedDate.toLocaleDateString(
        "en-US",
        {
          month: "long",
          day: "numeric",
          year: "numeric",
        }
      )
    );

  }


  /*
    LOADING
  */

  if (loading) {

    return (

      <DashboardLayout activePage="reports">

        <div
          style={{
            marginLeft:
              "25px",

            fontFamily:
              '"Quicksand", sans-serif',
          }}
        >

          <p>
            Loading report...
          </p>

        </div>

      </DashboardLayout>

    );

  }


  /*
    REPORT NOT FOUND
  */

  if (!report) {

    return (

      <DashboardLayout activePage="reports">

        <div
          style={{
            marginLeft:
              "25px",

            fontFamily:
              '"Quicksand", sans-serif',
          }}
        >

          <h1
            style={{
              color:
                "#10069f",
            }}
          >
            Report Not Found
          </h1>


          <p>
            This report could not be found.
          </p>


          <button
            type="button"

            onClick={() =>
              router.push(
                "/reports"
              )
            }

            style={{
              marginTop:
                "15px",

              padding:
                "12px 24px",

              borderRadius:
                "12px",

              border:
                "2px solid #10069f",

              background:
                "white",

              color:
                "#10069f",

              fontWeight:
                700,

              fontSize:
                "17px",

              cursor:
                "pointer",
            }}
          >
            Back to My Reports
          </button>

        </div>

      </DashboardLayout>

    );

  }


  return (

    <DashboardLayout activePage="reports">

      <div
        style={{
          width:
            "calc(100% - 55px)",

          marginLeft:
            "25px",

          marginTop:
            "-15px",

          fontFamily:
            '"Quicksand", sans-serif',
        }}
      >


        {/* HEADING */}

        <div
          style={{
            marginBottom:
              "25px",
          }}
        >

          <h1
            style={{
              margin: 0,

              color:
                "#10069f",

              fontSize:
                "36px",

              lineHeight:
                1.1,
            }}
          >
            Report Details
          </h1>


          <h2
            style={{
              margin:
                "2px 0 0",

              color:
                "#ffcc00",

              fontSize:
                "25px",

              fontWeight:
                600,
            }}
          >
            {report.matchReceipt ? "Match confirmed · pickup receipt" : "View your submitted report"}
          </h2>

        </div>


        {matchNotifications.filter((notification) => (notification.status ?? "pending") === "pending").map((notification) => (
          <section key={notification.id} className="matchDetailsPrompt" aria-label="Possible item match">
            <div>
              <strong>{notification.title}</strong>
              <p>{notification.message}</p>
            </div>
            <div className="matchDecisionButtons">
              <button type="button" className="matchConfirmButton" onClick={() => resolveMatchFromDetails(notification, "confirmed")}>
                Confirm match
              </button>
              <button type="button" className="matchDeclineButton" onClick={() => resolveMatchFromDetails(notification, "declined")}>
                Decline
              </button>
            </div>
          </section>
        ))}


        {/* MAIN REPORT CARD */}

        <div
          style={{
            width:
              "100%",

            background:
              "#edf1f3",

            borderRadius:
              "20px",

            padding:
              "25px",

            boxSizing:
              "border-box",
          }}
        >


          {/* TOP SECTION */}

          <div
            style={{
              display:
                "flex",

              gap:
                "30px",

              alignItems:
                "flex-start",
            }}
          >


            {/* PHOTO */}

            <div
              style={{
                width:
                  "260px",

                minWidth:
                  "260px",

                height:
                  "260px",

                borderRadius:
                  "18px",

                overflow:
                  "hidden",

                background:
                  "#d9dfe3",
              }}
            >

              {report.image ? (

                <img
                  src={
                    report.image
                  }

                  alt={
                    report.item
                  }

                  style={{
                    width:
                      "100%",

                    height:
                      "100%",

                    objectFit:
                      "cover",

                    display:
                      "block",
                  }}
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

                    color:
                      "#555",
                  }}
                >
                  No Photo
                </div>

              )}

            </div>


            {/* BASIC INFORMATION */}

            <div
              style={{
                flex: 1,
              }}
            >


              {/* LOST / FOUND */}

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


              {/* ITEM */}

              <h2
                style={{
                  margin:
                    "14px 0 20px",

                  color:
                    "#111",

                  fontSize:
                    "28px",
                }}
              >
                {report.item}
              </h2>


              {/* STATUS */}

              <div
                style={{
                  marginBottom:
                    "22px",
                }}
              >

                <strong>
                  Status
                </strong>


                <div
                  style={{
                    marginTop:
                      "7px",
                  }}
                >

                  {report.status ===
                    "Submitted" && (

                    <span className="statusBadge submitted">
                      ◉ Submitted
                    </span>

                  )}


                  {report.status ===
                    "Match Found" && (

                    <span className="statusBadge match">
                      ✓ Match Found
                    </span>

                  )}


                  {report.status ===
                    "Closed" && (

                    <span className="statusBadge closed">
                      ✕ Closed
                    </span>

                  )}

                </div>

              </div>


              {/* CASE NUMBER */}

              <div
                style={{
                  marginBottom:
                    "18px",
                }}
              >

                <strong>
                  Case Number
                </strong>


                <p
                  style={{
                    margin:
                      "4px 0 0",
                  }}
                >
                  {report.caseNumber}
                </p>

              </div>


              {/* DATE SUBMITTED */}

              <div>

                <strong>
                  Date Submitted
                </strong>


                <p
                  style={{
                    margin:
                      "4px 0 0",
                  }}
                >
                  {formatSubmittedDate(
                    report.submittedAt
                  )}
                </p>

              </div>

            </div>

          </div>


          {report.matchReceipt && (() => {
            const receipt = report.matchReceipt;
            const contacts = getPickupContacts(receipt.campus, receipt.location);
            return (
              <section className="matchReceipt reportDetailReceipt" aria-label="Match receipt">
                <div className="matchReceiptHeader">
                  <span>Match receipt</span>
                  {receipt.confirmedAt && <time>{new Date(receipt.confirmedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time>}
                </div>
                <h4>Pickup details</h4>
                <p><strong>Reported find location:</strong> {[receipt.campus, receipt.location].filter(Boolean).join(" · ") || "See the found report"}</p>
                {receipt.caseNumber && <p><strong>Found report case:</strong> {receipt.caseNumber}</p>}
                <p className="matchReceiptNote">Call first to confirm where the item is being held. This reported location may not be the pickup desk.</p>
                <ul>{contacts.map((contact) => <li key={contact.name}><strong>{contact.name}</strong> · <a href={`tel:${contact.phone}`}>{contact.phone}</a></li>)}</ul>
                <div className="matchReceiptActions">
                  <a href={FIU_LOST_FOUND_URL} target="_blank" rel="noreferrer">FIU lost and found information</a>
                  <button type="button" onClick={() => router.push("/reports")}>Open My Reports</button>
                </div>
              </section>
            );
          })()}

          {/* DIVIDER */}

          <div
            style={{
              width:
                "100%",

              height:
                "2px",

              background:
                "#c7cdd1",

              margin:
                "28px 0",
            }}
          />


          {/* DETAILS */}

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "1fr 1fr",

              columnGap:
                "50px",

              rowGap:
                "25px",
            }}
          >


            {/* BRAND */}

            <div>

              <strong>
                Brand
              </strong>


              <p
                style={{
                  margin:
                    "5px 0 0",
                }}
              >
                {report.brand ||
                  "Not applicable"}
              </p>

            </div>


            {/* TYPE */}

            <div>

              <strong>
                Type
              </strong>


              <p
                style={{
                  margin:
                    "5px 0 0",
                }}
              >
                {report.itemDetail ||
                  "Not applicable"}
              </p>

            </div>


            {/* COLOR */}

            <div>

              <strong>
                Color
              </strong>


              <p
                style={{
                  margin:
                    "5px 0 0",
                }}
              >
                {report.color ||
                  "Not provided"}
              </p>

            </div>


            {/* CAMPUS */}

            <div>

              <strong>
                Campus
              </strong>


              <p
                style={{
                  margin:
                    "5px 0 0",
                }}
              >
                {report.campus ||
                  "Not provided"}
              </p>

            </div>


            {/* LOCATION */}

            <div>

              <strong>
                Location
              </strong>


              <p
                style={{
                  margin:
                    "5px 0 0",
                }}
              >
                {report.location ||
                  "Not provided"}
              </p>

            </div>


            {/* INCIDENT DATE */}

            <div>

              <strong>

                {report.reportType ===
                "lost"

                  ? "Date Lost"

                  : "Date Found"}

              </strong>


              <p
                style={{
                  margin:
                    "5px 0 0",
                }}
              >
                {formatDate(
                  report.incidentDate
                )}
              </p>

            </div>

          </div>


          {/* DESCRIPTION */}

          <div
            style={{
              marginTop:
                "30px",
            }}
          >

            <strong
              style={{
                display:
                  "block",

                marginBottom:
                  "8px",

                fontSize:
                  "17px",
              }}
            >
              Description
            </strong>


            <div
              style={{
                width:
                  "100%",

                minHeight:
                  "100px",

                padding:
                  "16px",

                background:
                  "white",

                border:
                  "1px solid #c7cdd1",

                borderRadius:
                  "14px",

                boxSizing:
                  "border-box",

                lineHeight:
                  1.5,

                whiteSpace:
                  "pre-wrap",
              }}
            >

              {report.description ||
                "No description provided."}

            </div>

          </div>

          {report.agentReview?.description && (
              <section
                aria-label="Automated report checks"
                style={{
                  marginTop: "20px",
                  padding: "16px",
                  borderRadius: "14px",
                  background: "#f4f6ff",
                  color: "#10069f",
                  fontFamily: '"Quicksand", sans-serif',
                }}
              >
                <strong>Automated checks</strong>
                {report.agentReview.description?.summary && (
                  <p>{report.agentReview.description.summary}</p>
                )}
                {report.agentReview.description?.concerns?.map((concern, index) => (
                  <p key={`description-concern-${index}`}>Description note: {concern}</p>
                ))}
                {report.agentReview.description?.suggestedDescription && (
                  <p>Suggested description: {report.agentReview.description.suggestedDescription}</p>
                )}
              </section>
          )}


          {/* BUTTONS */}

          <div
            style={{
              display:
                "flex",

              gap:
                "15px",

              marginTop:
                "30px",
            }}
          >

            <button
              type="button"

              onClick={() =>
                router.back()
              }

              style={{
                width:
                  "170px",

                height:
                  "48px",

                borderRadius:
                  "14px",

                background:
                  "white",

                color:
                  "#333",

                border:
                  "2px solid #333",

                fontWeight:
                  600,

                fontSize:
                  "17px",

                cursor:
                  "pointer",
              }}
            >
              Back
            </button>


            {/*
              ONLY REAL USER REPORTS
              CAN BE EDITED.

              DEFAULT DEMO ITEMS
              ARE READ-ONLY.
            */}

            {!report.isDemo && report.status === "Submitted" && (

              <button
                type="button"

                onClick={() =>
                  router.push(
                    `/reports/${report.id}/edit`
                  )
                }

                style={{
                  width:
                    "170px",

                  height:
                    "48px",

                  borderRadius:
                    "14px",

                  background:
                    "#10069f",

                  color:
                    "#ffcc00",

                  border:
                    "none",

                  fontWeight:
                    700,

                  fontSize:
                    "17px",

                  cursor:
                    "pointer",
                }}
              >
                Edit Report
              </button>

            )}
            {!report.isDemo && report.status !== "Submitted" && (
              <p style={{ maxWidth: "220px", color: "#4b4b59", fontSize: "14px", lineHeight: 1.4 }}>
                This report is {report.status === "Match Found" ? "matched" : "resolved"} and can no longer be edited.
              </p>
            )}

          </div>

        </div>

      </div>

    </DashboardLayout>

  );

}
