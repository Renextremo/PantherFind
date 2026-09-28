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


    setBrand("");

    setItemDetail("");

    setFormError("");
  }


  /*
    UPDATE REPORT
  */

  function updateReport() {

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


    const missingBrand =
      needsBrand(item) &&
      !brand;


    const missingType =
      needsType(item) &&
      !itemDetail;


    const missingColor =
      !color;


    const missingCampus =
      !campus;


    const missingLocation =
      !location;


    const missingDate =
      report.reportType === "found" && !incidentDate;


    const missingPhoto =
      report.reportType === "found" && !croppedImage;


    const missingDescription =
      !description.trim();


    if (
      missingItem ||
      missingBrand ||
      missingType ||
      missingColor ||
      missingCampus ||
      missingLocation ||
      missingDate ||
      missingPhoto ||
      missingDescription
    ) {

      setFormError(
        report.reportType === "found"
          ? "Please complete the required fields, including the found date and photo, before updating your report."
          : "Please complete the required fields before updating your report. A photo and date are optional for lost items."
      );

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
                Item
              </label>


              <select
                id="editItem"
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
                Campus
              </label>


              <select
                id="editCampus"
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
                  : <>Date Found (Approximate) <span className="requiredMark" aria-hidden="true">*</span></>}

              </label>


              <input
                id="editDate"
                type="date"
                required={!isLost}
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
                Photo {isLost ? <span className="optionalLabel">(Optional)</span> : <span className="requiredMark" aria-hidden="true">*</span>}
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
              onClick={
                updateReport
              }
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
