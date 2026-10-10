"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import Cropper, {
  Area,
} from "react-easy-crop";

import DashboardLayout from "../../../Components/DashboardLayout";
import { notifyReportsUpdated, saveReportsWithQuotaFallback } from "../../../lib/report-storage";
import { INBOX_STORAGE_KEY, InboxNotification, saveInboxNotifications } from "../../../lib/inbox";
import { analyzeReportPhoto, canonicalItemCategory, categoryLabel, categoryOptionForForm } from "../../../lib/visual-attributes";
import type { PhotoReviewDecision, VisualAttributes, VisualCandidate } from "../../../lib/visual-attributes";
import PhotoAnalysisPanel from "../../../Components/PhotoAnalysisPanel";


type Report = {
  id: string;

  caseNumber: string;

  confirmation?: string;

  reportType:
    | "lost"
    | "found";

  item: string;

  brand?: string;

  itemDetail?: string;

  color?: string;
  visualAttributes?: VisualAttributes | null;
  photoReview?: PhotoReviewDecision;

  campus?: string;

  campusCode?: string;

  location: string;

  incidentDate: string;

  description?: string;

  image: string;

  status:
    | "Submitted"
    | "Match Found"
    | "Closed";

  submittedAt: string;

  updatedAt?: string;
};


const itemOptions = [
  "Phone",
  "Laptop",
  "Tablet",
  "Headphones / Earphones",
  "Charger",
  "Bag",
  "Wallet",
  "Keys",
  "Sweater",
  "Water Bottle",
  "Other",
];


const colorOptions = [
  "Black",
  "White",
  "Gray / Silver",
  "Red",
  "Orange",
  "Yellow",
  "Cream",
  "Brown",
  "Green",
  "Blue",
  "Purple",
  "Pink",
  "Multicolor",
  "Other",
];


const campusLocations:
  Record<string, string[]> = {

  "Modesto A. Maidique Campus (MMC)": [
    "Green Library (GL)",
    "Graham Center (GC)",
    "School of International & Public Affairs (SIPA)",
    "College of Business",
    "Wellness & Recreation Center",
    "Student Academic Success Center (SASC)",
    "Stocker AstroScience Center",
    "Ocean Bank Convocation Center",
    "Student Housing",
    "Parking Garage",
    "Parking Lot",
    "Outdoor Area",
    "Other",
  ],

  "Biscayne Bay Campus (BBC)": [
    "Wolfe University Center",
    "Glenn Hubert Library",
    "Academic One",
    "Academic Two",
    "Marine Science Building",
    "Student Housing",
    "Parking Area",
    "Outdoor Area",
    "Other",
  ],

  "Engineering Center (EC)": [
    "Main Building",
    "Classroom",
    "Student Area",
    "Parking Lot",
    "Outdoor Area",
    "Other",
  ],

  "FIU at I-75": [
    "Main Building",
    "Classroom",
    "Student Area",
    "Parking Lot",
    "Outdoor Area",
    "Other",
  ],

  "FIU Downtown on Brickell": [
    "Main Building",
    "Classroom",
    "Lobby",
    "Other",
  ],

  "Other FIU Location": [
    "Other",
  ],
};


function needsBrand(
  item: string
) {
  return [
    "Phone",
    "Laptop",
    "Tablet",
    "Headphones / Earphones",
    "Water Bottle",
  ].includes(item);
}


function needsType(
  item: string
) {
  return [
    "Charger",
    "Bag",
    "Wallet",
    "Keys",
    "Sweater",
  ].includes(item);
}


function getBrandOptions(
  item: string
) {
  const options:
    Record<string, string[]> = {

    Phone: [
      "Apple",
      "Samsung",
      "Google",
      "Motorola",
      "OnePlus",
      "Other",
    ],

    Laptop: [
      "Apple",
      "Dell",
      "HP",
      "Lenovo",
      "ASUS",
      "Acer",
      "Microsoft",
      "Other",
    ],

    Tablet: [
      "Apple",
      "Samsung",
      "Microsoft",
      "Amazon",
      "Lenovo",
      "Other",
    ],

    "Headphones / Earphones": [
      "Apple",
      "Beats",
      "Sony",
      "Bose",
      "JBL",
      "Samsung",
      "Other",
    ],

    "Water Bottle": [
      "Stanley",
      "Owala",
      "Hydro Flask",
      "YETI",
      "Contigo",
      "Other",
    ],
  };

  return options[item] || [];
}


function getTypeOptions(
  item: string
) {
  const options:
    Record<string, string[]> = {

    Charger: [
      "Phone Charger",
      "Laptop Charger",
      "USB-C Charger",
      "Lightning Charger",
      "Micro-USB Charger",
      "Other",
    ],

    Bag: [
      "Backpack",
      "Handbag",
      "Tote Bag",
      "Duffel Bag",
      "Laptop Bag",
      "Other",
    ],

    Wallet: [
      "Bifold",
      "Trifold",
      "Card Holder",
      "Other",
    ],

    Keys: [
      "Car",
      "House",
      "Dorm",
      "Office",
      "Other",
    ],

    Sweater: [
      "Hoodie",
      "Sweatshirt",
      "Jacket",
      "Sweater",
      "Cardigan",
      "Other",
    ],
  };

  return options[item] || [];
}


function createImage(
  url: string
): Promise<HTMLImageElement> {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const image =
        new Image();

      image.addEventListener(
        "load",
        () =>
          resolve(image)
      );

      image.addEventListener(
        "error",
        reject
      );

      image.src = url;
    }
  );
}


async function getCroppedImage(
  imageSrc: string,
  pixelCrop: Area
) {

  const image =
    await createImage(
      imageSrc
    );

  const canvas =
    document.createElement(
      "canvas"
    );

  const context =
    canvas.getContext(
      "2d"
    );

  if (!context) {
    throw new Error(
      "Could not create canvas context."
    );
  }

  const scale = Math.min(
    1,
    720 / Math.max(pixelCrop.width, pixelCrop.height)
  );
  canvas.width = Math.max(1, Math.round(pixelCrop.width * scale));
  canvas.height = Math.max(1, Math.round(pixelCrop.height * scale));

  context.drawImage(
    image,

    pixelCrop.x,
    pixelCrop.y,

    pixelCrop.width,
    pixelCrop.height,

    0,
    0,

    canvas.width,
    canvas.height
  );

  return canvas.toDataURL(
    "image/jpeg",
    0.68
  );
}


export default function EditReportPage() {

  const router =
    useRouter();

  const params =
    useParams();

  const reportId =
    params.id as string;


  const [
    report,
    setReport,
  ] =
    useState<Report | null>(
      null
    );


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    item,
    setItem,
  ] =
    useState("");


  const [
    brand,
    setBrand,
  ] =
    useState("");


  const [
    itemDetail,
    setItemDetail,
  ] =
    useState("");


  const [
    color,
    setColor,
  ] =
    useState("");


  const [
    campus,
    setCampus,
  ] =
    useState("");


  const [
    location,
    setLocation,
  ] =
    useState("");


  const [
    incidentDate,
    setIncidentDate,
  ] =
    useState("");


  const [
    description,
    setDescription,
  ] =
    useState("");


  const [
    croppedImage,
    setCroppedImage,
  ] =
    useState<string | null>(
      null
    );


  const [
    image,
    setImage,
  ] =
    useState<string | null>(
      null
    );


  const [
    crop,
    setCrop,
  ] =
    useState({
      x: 0,
      y: 0,
    });


  const [
    zoom,
    setZoom,
  ] =
    useState(1);


  const [
    croppedAreaPixels,
    setCroppedAreaPixels,
  ] =
    useState<Area | null>(
      null
    );

  const [photoChanged, setPhotoChanged] = useState(false);
  const [photoAnalysis, setPhotoAnalysis] = useState<VisualAttributes | null>(null);
  const [photoAnalysisImage, setPhotoAnalysisImage] = useState<string | null>(null);
  const [photoAnalysisModel, setPhotoAnalysisModel] = useState("");
  const [photoAnalysisError, setPhotoAnalysisError] = useState("");
  const [photoReviewIssue, setPhotoReviewIssue] = useState<"mismatch" | "ambiguous" | null>(null);
  const [photoReviewDecision, setPhotoReviewDecision] = useState<(PhotoReviewDecision & { image: string }) | null>(null);


  const [
    formError,
    setFormError,
  ] =
    useState("");


  /*
    LOAD REPORT
  */

  useEffect(() => {

    const savedReports =
      localStorage.getItem(
        "pantherFindReports"
      );


    if (!savedReports) {
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


      if (!foundReport) {
        setLoading(false);
        return;
      }


      setReport(
        foundReport
      );


      setItem(
        foundReport.item ||
        ""
      );


      setBrand(
        foundReport.brand ||
        ""
      );


      setItemDetail(
        foundReport.itemDetail ||
        ""
      );


      setColor(
        foundReport.color ||
        ""
      );


      setCampus(
        foundReport.campus ||
        ""
      );


      setLocation(
        foundReport.location ||
        ""
      );


      setIncidentDate(
        foundReport.incidentDate ||
        ""
      );


      setDescription(
        foundReport.description ||
        ""
      );


      setCroppedImage(
        foundReport.image ||
        null
      );
      setPhotoChanged(false);
      setPhotoAnalysis(foundReport.visualAttributes || null);
      setPhotoAnalysisImage(null);
      setPhotoReviewDecision(null);


    } catch (error) {

      console.error(
        "Could not load report:",
        error
      );

    }


    setLoading(false);

  }, [reportId]);


  /*
    CROPPER
  */

  const onCropComplete =
    useCallback(
      (
        _croppedArea: Area,
        croppedPixels: Area
      ) => {

        setCroppedAreaPixels(
          croppedPixels
        );

      },
      []
    );


  function handlePhotoChange(
    event:
      React.ChangeEvent<HTMLInputElement>
  ) {

    const file =
      event.target.files?.[0];


    if (!file) {
      return;
    }


    const imageUrl =
      URL.createObjectURL(
        file
      );


    setImage(
      imageUrl
    );
    setPhotoChanged(false);
    setPhotoAnalysis(null);
    setPhotoAnalysisImage(null);
    setPhotoAnalysisModel("");
    setPhotoAnalysisError("");
    setPhotoReviewIssue(null);
    setPhotoReviewDecision(null);


    setCrop({
      x: 0,
      y: 0,
    });


    setZoom(1);

    setFormError("");
  }


  async function finishCrop() {

    if (
      !image ||
      !croppedAreaPixels
    ) {
      return;
    }


    try {

      const finalImage =
        await getCroppedImage(
          image,
          croppedAreaPixels
        );


      setCroppedImage(
        finalImage
      );
      setPhotoChanged(true);
      setPhotoAnalysis(null);
      setPhotoAnalysisImage(null);
      setPhotoAnalysisModel("");
      setPhotoAnalysisError("");
      setPhotoReviewIssue(null);
      setPhotoReviewDecision(null);


      setImage(null);


    } catch (error) {

      console.error(
        "Could not crop image:",
        error
      );

    }
  }


  function cancelCrop() {
    setImage(null);
  }


  /*
    CHANGE ITEM
  */

  function changeItem(
    newItem: string
  ) {

    setItem(
      newItem
    );
    setPhotoReviewDecision(null);


    setBrand("");

    setItemDetail("");

    setFormError("");
  }

  function chooseDetectedCategory() {
    if (!photoAnalysis) return;
    const category = canonicalItemCategory(photoAnalysis.itemType);
    const option = category ? categoryOptionForForm(category, "found") : null;
    if (!option) return;
    setItem(option);
    setPhotoReviewDecision({
      image: croppedImage || "",
      outcome: "corrected",
      detectedItemType: photoAnalysis.itemType,
      selectedItem: option,
      confirmedAt: new Date().toISOString(),
    });
    setPhotoReviewIssue(null);
    setFormError("");
  }

  function keepSelectedCategory() {
    if (!photoAnalysis) return;
    setPhotoReviewDecision({
      image: croppedImage || "",
      outcome: "kept",
      detectedItemType: photoAnalysis.itemType,
      selectedItem: item,
      confirmedAt: new Date().toISOString(),
    });
    setPhotoReviewIssue(null);
    setFormError("");
  }

  function selectPhotoCandidate(candidate: VisualCandidate) {
    if (!photoAnalysis) return;
    const category = canonicalItemCategory(candidate.itemType || candidate.label) || "other";
    const option = categoryOptionForForm(category, "found") || "Other";
    const selectedAnalysis: VisualAttributes = {
      ...photoAnalysis,
      itemType: candidate.itemType || candidate.label,
      primaryColor: candidate.primaryColor || photoAnalysis.primaryColor,
      brand: candidate.brand || null,
      styleType: candidate.styleType || photoAnalysis.styleType,
      mainObjectClear: true,
      candidateItems: [],
      confidence: { ...photoAnalysis.confidence, itemType: "high" },
    };
    setPhotoAnalysis(selectedAnalysis);
    setItem(option);
    setPhotoReviewDecision({
      image: croppedImage || "",
      outcome: "selected-object",
      detectedItemType: selectedAnalysis.itemType,
      selectedItem: option,
      selectedObject: candidate.label,
      confirmedAt: new Date().toISOString(),
    });
    setPhotoReviewIssue(null);
    setFormError("");
  }

  function confirmSelectedObject() {
    if (!photoAnalysis) return;
    setPhotoAnalysis({ ...photoAnalysis, mainObjectClear: true, candidateItems: [] });
    setPhotoReviewDecision({
      image: croppedImage || "",
      outcome: "manual-object-selection",
      detectedItemType: photoAnalysis.itemType,
      selectedItem: item,
      confirmedAt: new Date().toISOString(),
    });
    setPhotoReviewIssue(null);
    setFormError("");
  }


  /*
    UPDATE REPORT
  */

  async function updateReport(skipPhotoAnalysis = false) {

    if (!report) {
      return;
    }

    try {
      const latestReports = JSON.parse(localStorage.getItem("pantherFindReports") || "[]") as Report[];
      const latestReport = latestReports.find((entry) => entry.id === report.id);
      if (!latestReport || latestReport.status !== "Submitted") {
        setFormError("This report has been matched or resolved, so it can no longer be edited.");
        setReport(latestReport || report);
        return;
      }
    } catch {
      setFormError("We could not verify this report’s status. Reload the page before editing.");
      return;
    }


    const missingItem =
      !item;


    const missingCampus =
      !campus;
    const missingPhoto =
      !croppedImage;


    if (
      missingItem ||
      missingCampus ||
      missingPhoto
    ) {

      setFormError(
        "Please add an item, campus, and photo before updating your report."
      );

      return;
    }

    let visualAttributes = report.visualAttributes || null;
    let photoReview = report.photoReview;
    if (photoChanged && !skipPhotoAnalysis) {
      const result = photoAnalysisImage === croppedImage && photoAnalysis
        ? { ok: true as const, analysis: photoAnalysis, model: photoAnalysisModel }
        : await analyzeReportPhoto(croppedImage, item, description);
      if (!result.ok) {
        setPhotoAnalysisError(result.error);
        setPhotoReviewIssue(null);
        return;
      }
      visualAttributes = result.analysis;
      setPhotoAnalysis(visualAttributes);
      setPhotoAnalysisImage(croppedImage);
      setPhotoAnalysisModel(result.model);
      setPhotoAnalysisError("");
    }

    if (skipPhotoAnalysis && photoChanged) {
      visualAttributes = null;
      photoReview = {
        outcome: "analysis-unavailable-manual",
        detectedItemType: null,
        selectedItem: item,
        confirmedAt: new Date().toISOString(),
      };
    } else if (visualAttributes) {
      const stateDecision = photoReviewDecision?.image === croppedImage && photoReviewDecision.selectedItem === item
        ? photoReviewDecision
        : null;
      const priorDecision = report.photoReview?.selectedItem === item ? report.photoReview : null;
      const savedDecision = stateDecision || priorDecision;
      if (!visualAttributes.mainObjectClear && savedDecision?.outcome !== "selected-object" && savedDecision?.outcome !== "manual-object-selection") {
        setPhotoReviewIssue("ambiguous");
        return;
      }
      const detectedCategory = canonicalItemCategory(visualAttributes.itemType);
      const selectedCategory = canonicalItemCategory(item);
      const acknowledgedMismatch = savedDecision && ["corrected", "kept", "selected-object"].includes(savedDecision.outcome);
      if (detectedCategory && selectedCategory && detectedCategory !== selectedCategory && visualAttributes.confidence.itemType !== "low" && !acknowledgedMismatch) {
        setPhotoReviewIssue("mismatch");
        return;
      }
      photoReview = savedDecision ? {
        outcome: savedDecision.outcome,
        detectedItemType: savedDecision.detectedItemType,
        selectedItem: savedDecision.selectedItem,
        selectedObject: savedDecision.selectedObject,
        confirmedAt: savedDecision.confirmedAt,
      } : {
        outcome: "matched",
        detectedItemType: visualAttributes.itemType,
        selectedItem: item,
        confirmedAt: new Date().toISOString(),
      };
      setPhotoReviewIssue(null);
    }


    const savedReports =
      localStorage.getItem(
        "pantherFindReports"
      );


    if (!savedReports) {
      return;
    }


    try {

      const reports:
        Report[] =
        JSON.parse(
          savedReports
        );


      const updatedReports =
        reports.map(
          (savedReport) => {

            if (
              savedReport.id !==
              report.id
            ) {
              return savedReport;
            }


            return {
              ...savedReport,

              item,

              brand:
                needsBrand(item)
                  ? brand
                  : "",

              itemDetail:
                needsType(item)
                  ? itemDetail
                  : "",

              color,

              campus,

              location,

              incidentDate,

              description:
                description.trim(),

              image:
                croppedImage || "",

              visualAttributes,

              photoReview,

              updatedAt:
                new Date().toISOString(),
            };

          }
        );


      saveReportsWithQuotaFallback(updatedReports, params.id as string);


      router.push(
        "/reports"
      );


    } catch (error) {

      console.error(
        "Could not update report:",
        error
      );


      setFormError(
        error instanceof DOMException && error.name === "QuotaExceededError"
          ? "Your browser storage is full. Clear some site data or remove older reports, then try again."
          : "Something went wrong while updating your report."
      );
    }
  }


  /*
    DELETE REPORT
  */

  function deleteReport() {

    if (!report) {
      return;
    }


    const shouldDelete =
      window.confirm(
        `Are you sure you want to delete report ${report.caseNumber}? This cannot be undone.`
      );


    if (!shouldDelete) {
      return;
    }


    const savedReports =
      localStorage.getItem(
        "pantherFindReports"
      );


    if (!savedReports) {
      return;
    }


    try {

      const reports:
        Report[] =
        JSON.parse(
          savedReports
        );


      const remainingReports =
        reports.filter(
          (savedReport) =>
            savedReport.id !==
            report.id
        );


      localStorage.setItem(
        "pantherFindReports",
        JSON.stringify(
          remainingReports
        )
      );
      notifyReportsUpdated();

      try {
        const savedNotifications = JSON.parse(localStorage.getItem(INBOX_STORAGE_KEY) || "[]");
        if (Array.isArray(savedNotifications)) {
          saveInboxNotifications((savedNotifications as InboxNotification[]).filter((notification) =>
            notification.reportId !== report.id && notification.matchedReportId !== report.id
          ));
        }
      } catch {
        // Deleting the report should succeed even if stale inbox data is malformed.
      }


      const submittedReport =
        sessionStorage.getItem(
          "pantherFindSubmittedReport"
        );


      if (submittedReport) {

        try {

          const parsedSubmitted =
            JSON.parse(
              submittedReport
            );


          if (
            parsedSubmitted.id ===
            report.id
          ) {

            sessionStorage.removeItem(
              "pantherFindSubmittedReport"
            );

          }

        } catch {
          // Nothing else needed.
        }

      }


      router.push(
        "/reports"
      );


    } catch (error) {

      console.error(
        "Could not delete report:",
        error
      );

    }
  }


  /*
    LOADING
  */

  if (loading) {

    return (

      <DashboardLayout activePage="reports">

        <div className="lostForm">

          <h1>
            Loading Report...
          </h1>

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

        <div className="lostForm">

          <h1>
            Report Not Found
          </h1>

          <h2>
            This report may have been deleted.
          </h2>


          <button
            type="button"
            className="submitReportButton"
            onClick={() =>
              router.push(
                "/reports"
              )
            }
          >
            Back to My Reports
          </button>

        </div>

      </DashboardLayout>

    );
  }

  if (report.status !== "Submitted") {
    return (
      <DashboardLayout activePage="reports">
        <div className="lostForm">
          <h1>Editing is locked</h1>
          <h2>This report is {report.status === "Match Found" ? "matched" : "resolved"}, so its details can’t be changed.</h2>
          <button type="button" className="submitReportButton" onClick={() => router.push(`/reports/${report.id}`)}>
            View Report
          </button>
          <button type="button" className="reportSecondaryButton" onClick={() => router.push("/reports")}>
            Back to My Reports
          </button>
        </div>
      </DashboardLayout>
    );
  }


  const isLost =
    report.reportType ===
    "lost";


  return (
    <>

      <div
        className={
          image
            ? "pageLocked"
            : ""
        }
      >

        <DashboardLayout activePage="reports">

          <div className="lostForm">


            {/* TITLE */}

            <h1>
              {isLost
                ? "Edit Lost Item Report"
                : "Edit Found Item Report"}
            </h1>


            <h2>
              Update your report information
            </h2>


            {/* ITEM */}

            <div className="formField">

              <label htmlFor="editItem">
                Item <span className="requiredMark" aria-hidden="true">*</span>
              </label>


              <select
                id="editItem"
                required
                value={item}
                onChange={(event) =>
                  changeItem(
                    event.target.value
                  )
                }
              >

                <option value="">
                  Select Item
                </option>


                {itemOptions.map(
                  (option) => (

                    <option
                      value={option}
                      key={option}
                    >
                      {option}
                    </option>

                  )
                )}

              </select>

            </div>


            {/* BRAND */}

            {needsBrand(item) && (

              <div className="formField">

                <label htmlFor="editBrand">
                  Brand
                </label>


                <select
                  id="editBrand"
                  value={brand}
                  onChange={(event) => {

                    setBrand(
                      event.target.value
                    );

                    setFormError("");

                  }}
                >

                  <option value="">
                    Select Brand
                  </option>


                  {getBrandOptions(
                    item
                  ).map(
                    (option) => (

                      <option
                        value={option}
                        key={option}
                      >
                        {option}
                      </option>

                    )
                  )}

                </select>

              </div>

            )}


            {/* TYPE */}

            {needsType(item) && (

              <div className="formField">

                <label htmlFor="editType">
                  Type
                </label>


                <select
                  id="editType"
                  value={
                    itemDetail
                  }
                  onChange={(event) => {

                    setItemDetail(
                      event.target.value
                    );

                    setFormError("");

                  }}
                >

                  <option value="">
                    Select Type
                  </option>


                  {getTypeOptions(
                    item
                  ).map(
                    (option) => (

                      <option
                        value={option}
                        key={option}
                      >
                        {option}
                      </option>

                    )
                  )}

                </select>

              </div>

            )}


            {/* COLOR */}

            <div className="formField">

              <label htmlFor="editColor">
                Color
              </label>


              <select
                id="editColor"
                value={color}
                onChange={(event) => {

                  setColor(
                    event.target.value
                  );

                  setFormError("");

                }}
              >

                <option value="">
                  Select Color
                </option>


                {colorOptions.map(
                  (option) => (

                    <option
                      value={option}
                      key={option}
                    >
                      {option}
                    </option>

                  )
                )}

              </select>

            </div>


            {/* CAMPUS */}

            <div className="formField">

              <label htmlFor="editCampus">
                Campus <span className="requiredMark" aria-hidden="true">*</span>
              </label>


              <select
                id="editCampus"
                required
                value={campus}
                onChange={(event) => {

                  setCampus(
                    event.target.value
                  );

                  setLocation("");

                  setFormError("");

                }}
              >

                <option value="">
                  Select Campus
                </option>


                {Object.keys(
                  campusLocations
                ).map(
                  (campusName) => (

                    <option
                      value={
                        campusName
                      }
                      key={
                        campusName
                      }
                    >
                      {campusName}
                    </option>

                  )
                )}

              </select>

            </div>


            {/* LOCATION */}

            {campus && (

              <div className="formField">

                <label htmlFor="editLocation">
                  Location
                </label>


                <select
                  id="editLocation"
                  value={location}
                  onChange={(event) => {

                    setLocation(
                      event.target.value
                    );

                    setFormError("");

                  }}
                >

                  <option value="">
                    Select Location
                  </option>


                  {(
                    campusLocations[
                      campus
                    ] || []
                  ).map(
                    (
                      locationName
                    ) => (

                      <option
                        value={
                          locationName
                        }
                        key={
                          locationName
                        }
                      >
                        {locationName}
                      </option>

                    )
                  )}

                </select>

              </div>

            )}


            {/* DATE */}

            <div className="formField">

              <label htmlFor="editDate">

                {isLost
                  ? "Date Lost (Approximate)"
                  : "Date Found (Approximate)"}

              </label>


              <input
                id="editDate"
                type="date"
                value={
                  incidentDate
                }
                onChange={(event) => {

                  setIncidentDate(
                    event.target.value
                  );

                  setFormError("");

                }}
              />

            </div>


            {/* PHOTO */}

            <div className="formField photoField">

              <label>
                Photo <span className="requiredMark" aria-hidden="true">*</span>
              </label>


              <label className="photoUpload">

                {croppedImage ? (

                  <img
                    src={
                      croppedImage
                    }
                    alt={
                      item ||
                      "Report photo"
                    }
                    className="uploadedPhoto"
                  />

                ) : (

                  <>

                    <img
                      src="/images/upload-photo.png"
                      alt=""
                      className="uploadPhotoIcon"
                    />

                    <span>
                      Upload a photo of the item or a reference
                    </span>

                  </>

                )}


                <input
                  type="file"
                  accept="image/*"
                  className="hiddenPhotoInput"
                  onChange={
                    handlePhotoChange
                  }
                />

              </label>

            </div>

            <PhotoAnalysisPanel
              analysis={photoAnalysis}
              error={photoAnalysisError}
              issue={photoReviewIssue}
              selectedItem={item}
              suggestedItem={photoAnalysis?.itemType ? categoryLabel(canonicalItemCategory(photoAnalysis.itemType) || photoAnalysis.itemType) : null}
              onChangeCategory={chooseDetectedCategory}
              onKeepCategory={keepSelectedCategory}
              onSelectCandidate={selectPhotoCandidate}
              onConfirmSelectedObject={confirmSelectedObject}
              onRetry={() => void updateReport()}
              onContinueWithoutAnalysis={() => void updateReport(true)}
            />


            {/* DESCRIPTION */}

            <div className="formField">

              <label htmlFor="editDescription">
                Description
              </label>


              <textarea
                id="editDescription"
                className="descriptionField"
                value={
                  description
                }
                placeholder="Add any details: stickers, initials, accessories, location details, etc."
                onChange={(event) => {

                  setDescription(
                    event.target.value
                  );

                  setFormError("");

                }}
              />

            </div>


            {/* ERROR */}

            {formError && (

              <p
                style={{
                  color:
                    "#c62828",
                  fontWeight:
                    600,
                  fontSize:
                    "14px",
                  margin:
                    "4px 0 12px -15px",
                }}
              >
                {formError}
              </p>

            )}


            {/* UPDATE */}

            <button
              type="button"
              className="submitReportButton"
              onClick={() => void updateReport()}
            >
              Update
            </button>


            {/* DELETE */}

            <button
              type="button"
              className="submitReportButton"
              onClick={
                deleteReport
              }
              style={{
                background:
                  "#c62828",
                color:
                  "white",
                marginTop:
                  "6px",
                transform: "translate(-30px, -8px)",
              }}
            >
              Delete Report
            </button>


          </div>

        </DashboardLayout>

      </div>


      {/* PHOTO CROPPER */}

      {image && (

        <div className="cropBackdrop">

          <div className="cropOverlay">

            <Cropper
              image={image}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={
                setCrop
              }
              onZoomChange={
                setZoom
              }
              onCropComplete={
                onCropComplete
              }
            />


            <div className="cropButtons">

              <button
                type="button"
                onClick={
                  cancelCrop
                }
              >
                Cancel
              </button>


              <button
                type="button"
                onClick={
                  finishCrop
                }
              >
                Done
              </button>

            </div>

          </div>

        </div>

      )}

    </>
  );
}
