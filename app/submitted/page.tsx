"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import DashboardLayout from "../Components/DashboardLayout";

type SubmittedReport = {
  reportType:
    | "lost"
    | "found";

  item: string;
  brand: string;
  itemDetail: string;
  color: string;
  campus: string;
  location: string;
  incidentDate: string;
  description: string;
  image: string;
  confirmation: string;
};

export default function SubmittedPage() {
  const router =
    useRouter();

  const [
    report,
    setReport,
  ] =
    useState<SubmittedReport | null>(
      null
    );

  useEffect(() => {
    const savedReport =
      sessionStorage.getItem(
        "pantherFindSubmittedReport"
      );

    if (!savedReport) {
      return;
    }

    try {
      setReport(
        JSON.parse(
          savedReport
        )
      );
    } catch (error) {
      console.error(
        "Could not load submitted report:",
        error
      );
    }
  }, []);


  function viewMyReport() {
    router.push(
      "/reports"
    );
  }


  function submitAnotherReport() {
    if (
      report?.reportType ===
      "found"
    ) {
      router.push(
        "/found"
      );

      return;
    }

    router.push(
      "/lost"
    );
  }


  const today =
    new Date();

  const dateSubmitted =
    today.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    );


  const activePage =
    report?.reportType ===
    "found"
      ? "found"
      : "lost";


  return (
    <DashboardLayout
      activePage={activePage}
    >

      <div className="submittedPage">

        <div className="submittedHeading">

          <h1>
            Report Submitted!
          </h1>

          <h2>
            We’ll notify you if a possible match is found
          </h2>

        </div>


        <div className="submittedSummary">

          <div className="submittedPhoto">

            {report?.image ? (

              <img
                src={
                  report.image
                }
                alt={
                  report.item
                }
              />

            ) : (

              <div className="submittedPhotoPlaceholder">
                No Photo
              </div>

            )}

          </div>


          <div className="submittedDivider" />


          <div className="submittedInformation">

            <div className="submittedRow">

              <span className="submittedLabel">
                Report Type
              </span>

              <strong>
                {report?.reportType ===
                "found"
                  ? "Found Item"
                  : "Lost Item"}
              </strong>

            </div>


            <div className="submittedRow">

              <span className="submittedLabel">
                Item
              </span>

              <strong>
                {report?.item ||
                  "Item"}
              </strong>

            </div>


            <div className="submittedRow">

              <span className="submittedLabel">
                Campus
              </span>

              <strong>
                {report?.location
                  ? `${report.location} — ${report.campus}`
                  : report?.campus ||
                    "FIU Campus"}
              </strong>

            </div>


            <div className="submittedRow">

              <span className="submittedLabel">
                Date Submitted
              </span>

              <strong>
                {
                  dateSubmitted
                }
              </strong>

            </div>


            <div className="submittedRow">

              <span className="submittedLabel">
                Confirmation
              </span>

              <strong>
                {report?.confirmation ||
                  "FIU-305"}
              </strong>

            </div>

          </div>

        </div>


        <div className="submittedButtons">

          <button
            type="button"
            className="viewReportButton"
            onClick={
              viewMyReport
            }
          >
            View My Report
          </button>


          <button
            type="button"
            className="anotherReportButton"
            onClick={
              submitAnotherReport
            }
          >

            Submit Another Report

          </button>

        </div>

      </div>

    </DashboardLayout>
  );
}
