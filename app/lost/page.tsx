"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Cropper from "react-easy-crop";
import DashboardLayout from "../Components/DashboardLayout";
import { generateReportDescription } from "../lib/report-description";
import { runReportAgents } from "../lib/report-agents";
import { saveReportsWithQuotaFallback } from "../lib/report-storage";
import {
  analyzeReportPhoto,
  canonicalItemCategory,
  categoryLabel,
  categoryOptionForForm,
  PhotoReviewDecision,
  VisualAttributes,
  VisualCandidate,
} from "../lib/visual-attributes";
import PhotoAnalysisPanel from "../Components/PhotoAnalysisPanel";

type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const itemNames: Record<string, string> = {
  phone: "Phone",
  laptop: "Laptop",
  tablet: "Tablet",
  "headphones-earphones": "Headphones / Earphones",
  charger: "Charger",
  bag: "Bag",
  wallet: "Wallet",
  keys: "Keys",
  sweater: "Sweater",
  "water-bottle": "Water Bottle",
  other: "Other",
};

const campusNames: Record<string, string> = {
  mmc: "Modesto A. Maidique Campus (MMC)",
  bbc: "Biscayne Bay Campus (BBC)",
  "engineering-center": "Engineering Center (EC)",
  i75: "FIU at I-75",
  brickell: "FIU Downtown on Brickell",
  other: "Other FIU Location",
};

export default function LostPage() {
  const router = useRouter();

  const [itemType, setItemType] = useState("");
  const [campus, setCampus] = useState("");
  const [location, setLocation] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoAnalysis, setPhotoAnalysis] = useState<VisualAttributes | null>(null);
  const [photoAnalysisImage, setPhotoAnalysisImage] = useState<string | null>(null);
  const [photoAnalysisModel, setPhotoAnalysisModel] = useState("");
  const [photoAnalysisError, setPhotoAnalysisError] = useState("");
  const [photoReviewIssue, setPhotoReviewIssue] = useState<"mismatch" | "ambiguous" | null>(null);
  const [photoReviewDecision, setPhotoReviewDecision] = useState<(PhotoReviewDecision & { image: string }) | null>(null);

  const [image, setImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] =
    useState<string | null>(null);

  const [crop, setCrop] = useState({
    x: 0,
    y: 0,
  });

  const [zoom, setZoom] = useState(1);

  const [croppedArea, setCroppedArea] =
    useState<CropArea | null>(null);

  const usesBrand = [
    "phone",
    "laptop",
    "tablet",
    "headphones-earphones",
    "water-bottle",
  ].includes(itemType);

  const usesType = [
    "charger",
    "bag",
    "wallet",
    "keys",
    "sweater",
  ].includes(itemType);

  const createCroppedImage = () => {
    if (!image || !croppedArea) return;

    const photo = new Image();
    photo.src = image;

    photo.onload = () => {
      const canvas =
        document.createElement("canvas");

      const context =
        canvas.getContext("2d");

      if (!context) return;

      const scale = Math.min(
        1,
        720 / Math.max(croppedArea.width, croppedArea.height)
      );
      canvas.width = Math.max(1, Math.round(croppedArea.width * scale));
      canvas.height = Math.max(1, Math.round(croppedArea.height * scale));

      context.drawImage(
        photo,
        croppedArea.x,
        croppedArea.y,
        croppedArea.width,
        croppedArea.height,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const finishedImage =
        canvas.toDataURL("image/jpeg", 0.68);

      setCroppedImage(
        finishedImage
      );
      setPhotoAnalysis(null);
      setPhotoAnalysisImage(null);
      setPhotoAnalysisModel("");
      setPhotoAnalysisError("");
      setPhotoReviewIssue(null);
      setPhotoReviewDecision(null);

      setImage(null);
      setZoom(1);

      setCrop({
        x: 0,
        y: 0,
      });
    };
  };

  const cancelCrop = () => {
    setImage(null);
    setZoom(1);

    setCrop({
      x: 0,
      y: 0,
    });

    setCroppedArea(null);
  };

  function chooseDetectedCategory() {
    if (!photoAnalysis || !croppedImage) return;
    const category = canonicalItemCategory(photoAnalysis.itemType);
    if (!category) return;
    const option = categoryOptionForForm(category, "lost");
    if (!option) return;
    setItemType(option);
    setPhotoReviewDecision({
      image: croppedImage,
      outcome: "corrected",
      detectedItemType: photoAnalysis.itemType,
      selectedItem: itemNames[option] || option,
      confirmedAt: new Date().toISOString(),
    });
    setPhotoReviewIssue(null);
    setFormError("");
  }

  function keepSelectedCategory() {
    if (!photoAnalysis || !croppedImage) return;
    const selectedItem = itemNames[itemType] || itemType;
    setPhotoReviewDecision({
      image: croppedImage,
      outcome: "kept",
      detectedItemType: photoAnalysis.itemType,
      selectedItem,
      confirmedAt: new Date().toISOString(),
    });
    setPhotoReviewIssue(null);
    setFormError("");
  }

  function selectPhotoCandidate(candidate: VisualCandidate) {
    if (!photoAnalysis || !croppedImage) return;
    const category = canonicalItemCategory(candidate.itemType || candidate.label) || "other";
    const option = categoryOptionForForm(category, "lost") || "other";
    const selectedItem = itemNames[option] || option;
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
    setItemType(option);
    setPhotoReviewDecision({
      image: croppedImage,
      outcome: "selected-object",
      detectedItemType: selectedAnalysis.itemType,
      selectedItem,
      selectedObject: candidate.label,
      confirmedAt: new Date().toISOString(),
    });
    setPhotoReviewIssue(null);
    setFormError("");
  }

  function confirmSelectedObject() {
    if (!photoAnalysis || !croppedImage) return;
    const selectedItem = itemNames[itemType] || itemType;
    setPhotoAnalysis({ ...photoAnalysis, mainObjectClear: true, candidateItems: [] });
    setPhotoReviewDecision({
      image: croppedImage,
      outcome: "manual-object-selection",
      detectedItemType: photoAnalysis.itemType,
      selectedItem,
      confirmedAt: new Date().toISOString(),
    });
    setPhotoReviewIssue(null);
    setFormError("");
  }

  async function submitReport(skipPhotoAnalysis = false) {
  const brandElement =
    document.getElementById(
      "brand"
    ) as HTMLSelectElement | null;

  const typeElement =
    document.getElementById(
      "type"
    ) as HTMLSelectElement | null;

  const colorElement =
    document.getElementById(
      "color"
    ) as HTMLSelectElement | null;

  const dateElement =
    document.getElementById(
      "dateLost"
    ) as HTMLInputElement | null;

  const descriptionElement =
    document.getElementById(
      "description"
    ) as HTMLTextAreaElement | null;

  const otherLocationElement =
    document.getElementById(
      "otherLocation"
    ) as HTMLInputElement | null;

  const selectedLocation =
    campus === "other"
      ? otherLocationElement?.value.trim() || ""
      : location;

  if (!itemType || !colorElement?.value || !campus) {
    setFormError("Please select an item, color, and campus to submit your report.");
    return;
  }

  setFormError("");
  setIsSubmitting(true);

  const itemName = itemNames[itemType] || itemType || "Item";
  const brand = brandElement?.value ? brandElement.selectedOptions[0]?.text || "" : "";
  const itemDetail = typeElement?.value ? typeElement.selectedOptions[0]?.text || "" : "";
  const color = colorElement?.value ? colorElement.selectedOptions[0]?.text || "" : "";
  const campusName = campusNames[campus] || campus || "FIU Campus";
  const enteredDescription = descriptionElement?.value.trim() || "";
  let visualAttributes: VisualAttributes | null = null;
  let photoReview: PhotoReviewDecision | null = null;

  if (!croppedImage) {
    visualAttributes = null;
    photoReview = null;
  } else if (skipPhotoAnalysis) {
    photoReview = {
      outcome: "analysis-unavailable-manual",
      detectedItemType: null,
      selectedItem: itemName,
      confirmedAt: new Date().toISOString(),
    };
  } else {
    const analysisResult = photoAnalysisImage === croppedImage && photoAnalysis
      ? { ok: true as const, analysis: photoAnalysis, model: photoAnalysisModel }
      : await analyzeReportPhoto(croppedImage, itemName, enteredDescription);
    if (!analysisResult.ok) {
      setPhotoAnalysisError(analysisResult.error);
      setPhotoReviewIssue(null);
      setIsSubmitting(false);
      return;
    }
    visualAttributes = analysisResult.analysis;
    setPhotoAnalysis(visualAttributes);
    setPhotoAnalysisImage(croppedImage);
    setPhotoAnalysisModel(analysisResult.model);
    setPhotoAnalysisError("");

    const savedDecision = photoReviewDecision?.image === croppedImage && photoReviewDecision.selectedItem === itemName
      ? photoReviewDecision
      : null;
    if (!visualAttributes.mainObjectClear && savedDecision?.outcome !== "selected-object" && savedDecision?.outcome !== "manual-object-selection") {
      setPhotoReviewIssue("ambiguous");
      setIsSubmitting(false);
      return;
    }
    const detectedCategory = canonicalItemCategory(visualAttributes.itemType);
    const selectedCategory = canonicalItemCategory(itemName);
    const acknowledgedMismatch = savedDecision && ["corrected", "kept", "selected-object"].includes(savedDecision.outcome);
    if (detectedCategory && selectedCategory && detectedCategory !== selectedCategory && visualAttributes.confidence.itemType !== "low" && !acknowledgedMismatch) {
      setPhotoReviewIssue("mismatch");
      setIsSubmitting(false);
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
      selectedItem: itemName,
      confirmedAt: new Date().toISOString(),
    };
    setPhotoReviewIssue(null);
  }


  /* ------------------------------------------
     GET EXISTING REPORTS
     ------------------------------------------ */

  let existingReports: any[] = [];

  const savedReports =
    localStorage.getItem(
      "pantherFindReports"
    );

  if (savedReports) {
    try {
      existingReports =
        JSON.parse(savedReports);
    } catch {
      existingReports = [];
    }
  }


  /* ------------------------------------------
     CAMPUS CODE
     ------------------------------------------ */

  const campusCodes:
    Record<string, string> = {
      mmc: "MMC",
      bbc: "BBC",
      "engineering-center": "EC",
      i75: "I75",
      brickell: "DB",
      other: "FIU",
    };

  const campusCode =
    campusCodes[campus] ||
    "FIU";


  /* ------------------------------------------
     UNIQUE CASE NUMBER
     ------------------------------------------ */

  let caseNumber = "";

  do {
    const randomNumber =
      Math.floor(
        100000 +
        Math.random() * 900000
      );

    caseNumber =
      `${campusCode}-${randomNumber}`;

  } while (
    existingReports.some(
      (report) =>
        report.caseNumber.split("-").pop() === caseNumber.split("-").pop()
    )
  );


  /* ------------------------------------------
     CREATE REPORT
     ------------------------------------------ */

  const manualDescription = [color, brand, itemDetail, itemName].filter(Boolean).join(" ");
  const description = enteredDescription || (!croppedImage || skipPhotoAnalysis || photoReview?.outcome === "kept"
    ? `${manualDescription} lost${selectedLocation ? ` near ${selectedLocation}` : ""} at ${campusName}.`
    : await generateReportDescription({
    reportType: "lost",
    item: itemName,
    brand,
    itemDetail,
    color,
    campus: campusName,
    location: selectedLocation,
    image: croppedImage || "",
    visualAttributes,
  }));

  const report = {
    id:
      crypto.randomUUID(),

    caseNumber,

    confirmation:
      caseNumber,

    reportType:
      "lost",

    item: itemName,

    brand,

    itemDetail,

    color,

    campus: campusName,

    campusCode,

    location: selectedLocation,

    incidentDate:
      dateElement?.value ||
      "",

    description,

    visualAttributes,

    photoReview,

    image:
      croppedImage || "",

    status:
      "Submitted",

    submittedAt:
      new Date().toISOString(),
  };


  /* ------------------------------------------
     ADD NEW REPORT FIRST
     ------------------------------------------ */

  const updatedReports = [
    report,
    ...existingReports,
  ];


  /* ------------------------------------------
     SAVE REPORT HISTORY
     ------------------------------------------ */

  try {
    saveReportsWithQuotaFallback(updatedReports, report.id);
  } catch {
    setIsSubmitting(false);
    setFormError("Your browser storage is full. Clear some site data or remove older reports, then try again.");
    return;
  }

  await runReportAgents(report, existingReports);


  /* ------------------------------------------
     SAVE CURRENT REPORT FOR
     REPORT SUBMITTED SCREEN
     ------------------------------------------ */

  sessionStorage.setItem(
    "pantherFindSubmittedReport",
    JSON.stringify(report)
  );


  /* ------------------------------------------
     GO TO CONFIRMATION SCREEN
     ------------------------------------------ */

  router.push(
    "/submitted"
  );

  setIsSubmitting(false);
}
  return (
    <>
      <div
        className={
          image
            ? "pageLocked"
            : ""
        }
      ></div>

      <DashboardLayout activePage="lost">

        <div className="lostForm">

          <h1>
            Report a Lost Item
          </h1>

          <h2>
            Tell us about the Item
          </h2>


          {/* ITEM */}

          <div className="formField">

            <label htmlFor="item">
              Item <span className="requiredMark" aria-hidden="true">*</span>
            </label>

            <select
              id="item"
              required
              value={itemType}
              onChange={(event) => {
                setItemType(
                  event.target.value
                );
                setPhotoReviewDecision(null);
                setPhotoReviewIssue(null);
              }}
            >
              <option value="">
                Select Item
              </option>

              <option value="phone">
                Phone
              </option>

              <option value="laptop">
                Laptop
              </option>

              <option value="tablet">
                Tablet
              </option>

              <option value="headphones-earphones">
                Headphones / Earphones
              </option>

              <option value="charger">
                Charger
              </option>

              <option value="bag">
                Bag
              </option>

              <option value="wallet">
                Wallet
              </option>

              <option value="keys">
                Keys
              </option>

              <option value="sweater">
                Sweater
              </option>

              <option value="water-bottle">
                Water Bottle
              </option>

              <option value="other">
                Other
              </option>
            </select>

          </div>


          {/* BRAND */}

          {usesBrand && (

            <div className="formField">

              <label htmlFor="brand">
                Brand
              </label>

              <select id="brand">

                <option value="">
                  Select Brand
                </option>


                {itemType === "phone" && (
                  <>
                    <option value="apple">
                      Apple
                    </option>

                    <option value="samsung">
                      Samsung
                    </option>

                    <option value="google">
                      Google
                    </option>

                    <option value="motorola">
                      Motorola
                    </option>

                    <option value="oneplus">
                      OnePlus
                    </option>
                  </>
                )}


                {itemType === "laptop" && (
                  <>
                    <option value="apple">
                      Apple
                    </option>

                    <option value="dell">
                      Dell
                    </option>

                    <option value="hp">
                      HP
                    </option>

                    <option value="lenovo">
                      Lenovo
                    </option>

                    <option value="asus">
                      ASUS
                    </option>

                    <option value="acer">
                      Acer
                    </option>

                    <option value="microsoft">
                      Microsoft
                    </option>
                  </>
                )}


                {itemType === "tablet" && (
                  <>
                    <option value="apple">
                      Apple
                    </option>

                    <option value="samsung">
                      Samsung
                    </option>

                    <option value="microsoft">
                      Microsoft
                    </option>

                    <option value="amazon">
                      Amazon
                    </option>

                    <option value="lenovo">
                      Lenovo
                    </option>
                  </>
                )}


                {itemType ===
                  "headphones-earphones" && (
                  <>
                    <option value="apple">
                      Apple
                    </option>

                    <option value="beats">
                      Beats
                    </option>

                    <option value="sony">
                      Sony
                    </option>

                    <option value="bose">
                      Bose
                    </option>

                    <option value="jbl">
                      JBL
                    </option>

                    <option value="samsung">
                      Samsung
                    </option>
                  </>
                )}


                {itemType ===
                  "water-bottle" && (
                  <>
                    <option value="stanley">
                      Stanley
                    </option>

                    <option value="owala">
                      Owala
                    </option>

                    <option value="hydro-flask">
                      Hydro Flask
                    </option>

                    <option value="yeti">
                      YETI
                    </option>

                    <option value="contigo">
                      Contigo
                    </option>
                  </>
                )}

                <option value="other">
                  Other
                </option>

              </select>

            </div>
          )}


          {/* TYPE */}

          {usesType && (

            <div className="formField">

              <label htmlFor="type">
                Type
              </label>

              <select id="type">

                <option value="">
                  Select Type
                </option>


                {itemType === "charger" && (
                  <>
                    <option value="phone-charger">
                      Phone Charger
                    </option>

                    <option value="laptop-charger">
                      Laptop Charger
                    </option>

                    <option value="usb-c">
                      USB-C Charger
                    </option>

                    <option value="lightning">
                      Lightning Charger
                    </option>

                    <option value="micro-usb">
                      Micro-USB Charger
                    </option>
                  </>
                )}


                {itemType === "bag" && (
                  <>
                    <option value="backpack">
                      Backpack
                    </option>

                    <option value="handbag">
                      Handbag
                    </option>

                    <option value="tote">
                      Tote Bag
                    </option>

                    <option value="duffel">
                      Duffel Bag
                    </option>

                    <option value="laptop-bag">
                      Laptop Bag
                    </option>
                  </>
                )}


                {itemType === "wallet" && (
                  <>
                    <option value="bifold">
                      Bifold
                    </option>

                    <option value="trifold">
                      Trifold
                    </option>

                    <option value="card-holder">
                      Card Holder
                    </option>
                  </>
                )}


                {itemType === "keys" && (
                  <>
                    <option value="car-keys">
                      Car
                    </option>

                    <option value="house-keys">
                      House
                    </option>

                    <option value="dorm-keys">
                      Dorm
                    </option>

                    <option value="office-keys">
                      Office
                    </option>
                  </>
                )}


                {itemType === "sweater" && (
                  <>
                    <option value="hoodie">
                      Hoodie
                    </option>

                    <option value="sweatshirt">
                      Sweatshirt
                    </option>

                    <option value="jacket">
                      Jacket
                    </option>

                    <option value="sweater">
                      Sweater
                    </option>

                    <option value="cardigan">
                      Cardigan
                    </option>
                  </>
                )}

                <option value="other">
                  Other
                </option>

              </select>

            </div>
          )}


          {/* COLOR */}

          <div className="formField">

            <label htmlFor="color">
              Color <span className="requiredMark" aria-hidden="true">*</span>
            </label>

            <select id="color" required onChange={() => setFormError("")}>

              <option value="">
                Select Color
              </option>

              <option value="black">
                Black
              </option>

              <option value="white">
                White
              </option>

              <option value="gray-silver">
                Gray / Silver
              </option>

              <option value="red">
                Red
              </option>

              <option value="orange">
                Orange
              </option>

              <option value="yellow">
                Yellow
              </option>

              <option value="cream">
                Cream
              </option>

              <option value="brown">
                Brown
              </option>

              <option value="green">
                Green
              </option>

              <option value="blue">
                Blue
              </option>

              <option value="purple">
                Purple
              </option>

              <option value="pink">
                Pink
              </option>

              <option value="multicolor">
                Multicolor
              </option>

              <option value="other">
                Other
              </option>

            </select>

          </div>


          {/* CAMPUS */}

          <div className="formField">

            <label htmlFor="campus">
              Campus <span className="requiredMark" aria-hidden="true">*</span>
            </label>

            <select
              id="campus"
              required
              value={campus}
              onChange={(event) => {
                setCampus(
                  event.target.value
                );

                setLocation("");
              }}
            >

              <option value="">
                Select Campus
              </option>

              <option value="mmc">
                Modesto A. Maidique Campus (MMC)
              </option>

              <option value="bbc">
                Biscayne Bay Campus (BBC)
              </option>

              <option value="engineering-center">
                Engineering Center (EC)
              </option>

              <option value="i75">
                FIU at I-75
              </option>

              <option value="brickell">
                FIU Downtown on Brickell
              </option>

              <option value="other">
                Other FIU Location
              </option>

            </select>

          </div>


          {/* MMC LOCATION */}

          {campus === "mmc" && (

            <div className="formField">

              <label htmlFor="mmcLocation">
                Location
              </label>

              <select
                id="mmcLocation"
                value={location}
                onChange={(event) =>
                  setLocation(
                    event.target.value
                  )
                }
              >

                <option value="">
                  Select Location
                </option>

                <option value="Green Library (GL)">
                  Green Library (GL)
                </option>

                <option value="Graham Center (GC)">
                  Graham Center (GC)
                </option>

                <option value="School of International & Public Affairs (SIPA)">
                  School of International & Public Affairs (SIPA)
                </option>

                <option value="College of Business">
                  College of Business
                </option>

                <option value="Wellness & Recreation Center">
                  Wellness & Recreation Center
                </option>

                <option value="Student Academic Success Center (SASC)">
                  Student Academic Success Center (SASC)
                </option>

                <option value="Stocker AstroScience Center">
                  Stocker AstroScience Center
                </option>

                <option value="Ocean Bank Convocation Center">
                  Ocean Bank Convocation Center
                </option>

                <option value="Student Housing">
                  Student Housing
                </option>

                <option value="Parking Garage">
                  Parking Garage
                </option>

                <option value="Parking Lot">
                  Parking Lot
                </option>

                <option value="Outdoor Area">
                  Outdoor Area
                </option>

                <option value="Other">
                  Other
                </option>

              </select>

            </div>
          )}


          {/* BBC LOCATION */}

          {campus === "bbc" && (

            <div className="formField">

              <label htmlFor="bbcLocation">
                Location
              </label>

              <select
                id="bbcLocation"
                value={location}
                onChange={(event) =>
                  setLocation(
                    event.target.value
                  )
                }
              >

                <option value="">
                  Select Location
                </option>

                <option value="Wolfe University Center">
                  Wolfe University Center
                </option>

                <option value="Glenn Hubert Library">
                  Glenn Hubert Library
                </option>

                <option value="Academic One">
                  Academic One
                </option>

                <option value="Academic Two">
                  Academic Two
                </option>

                <option value="Marine Science Building">
                  Marine Science Building
                </option>

                <option value="Student Housing">
                  Student Housing
                </option>

                <option value="Parking Area">
                  Parking Area
                </option>

                <option value="Outdoor Area">
                  Outdoor Area
                </option>

                <option value="Other">
                  Other
                </option>

              </select>

            </div>
          )}


          {/* ENGINEERING CENTER LOCATION */}

          {campus ===
            "engineering-center" && (

            <div className="formField">

              <label htmlFor="ecLocation">
                Location
              </label>

              <select
                id="ecLocation"
                value={location}
                onChange={(event) =>
                  setLocation(
                    event.target.value
                  )
                }
              >

                <option value="">
                  Select Location
                </option>

                <option value="Main Building">
                  Main Building
                </option>

                <option value="Classroom">
                  Classroom
                </option>

                <option value="Student Area">
                  Student Area
                </option>

                <option value="Parking Lot">
                  Parking Lot
                </option>

                <option value="Outdoor Area">
                  Outdoor Area
                </option>

                <option value="Other">
                  Other
                </option>

              </select>

            </div>
          )}


          {/* I-75 LOCATION */}

          {campus === "i75" && (

            <div className="formField">

              <label htmlFor="i75Location">
                Location
              </label>

              <select
                id="i75Location"
                value={location}
                onChange={(event) =>
                  setLocation(
                    event.target.value
                  )
                }
              >

                <option value="">
                  Select Location
                </option>

                <option value="Main Building">
                  Main Building
                </option>

                <option value="Classroom">
                  Classroom
                </option>

                <option value="Student Area">
                  Student Area
                </option>

                <option value="Parking Lot">
                  Parking Lot
                </option>

                <option value="Outdoor Area">
                  Outdoor Area
                </option>

                <option value="Other">
                  Other
                </option>

              </select>

            </div>
          )}


          {/* BRICKELL LOCATION */}

          {campus === "brickell" && (

            <div className="formField">

              <label htmlFor="brickellLocation">
                Location
              </label>

              <select
                id="brickellLocation"
                value={location}
                onChange={(event) =>
                  setLocation(
                    event.target.value
                  )
                }
              >

                <option value="">
                  Select Location
                </option>

                <option value="Main Building">
                  Main Building
                </option>

                <option value="Classroom">
                  Classroom
                </option>

                <option value="Student Area">
                  Student Area
                </option>

                <option value="Lobby">
                  Lobby
                </option>

                <option value="Parking Area">
                  Parking Area
                </option>

                <option value="Other">
                  Other
                </option>

              </select>

            </div>
          )}


          {/* OTHER LOCATION */}

          {campus === "other" && (

            <div className="formField">

              <label htmlFor="otherLocation">
                Location
              </label>

              <input
                id="otherLocation"
                type="text"
                placeholder="Enter FIU location"
              />

            </div>
          )}


          {/* DATE */}

          <div className="formField">

            <label htmlFor="dateLost">
              Date Lost
            </label>

            <input
              id="dateLost"
              type="date"
            />

          </div>


          {/* PHOTO */}

          <div className="formField photoField">

            <label>
              Photo <span className="optionalLabel">(optional)</span>
            </label>

            <label className="photoUpload">

              {croppedImage ? (

                <img
                  src={croppedImage}
                  alt="Selected item"
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
                    Add a photo if you have one; it can help identify the item
                  </span>
                </>

              )}

              <input
                type="file"
                accept="image/*"
                className="hiddenPhotoInput"
                onChange={(event) => {
                  const file =
                    event.target.files?.[0];

                  if (file) {
                    setCroppedImage(null);
                    setPhotoAnalysis(null);
                    setPhotoAnalysisImage(null);
                    setPhotoAnalysisModel("");
                    setPhotoAnalysisError("");
                    setPhotoReviewIssue(null);
                    setPhotoReviewDecision(null);
                    setImage(
                      URL.createObjectURL(
                        file
                      )
                    );
                  }

                  event.target.value =
                    "";
                }}
              />

            </label>

          </div>

          <PhotoAnalysisPanel
            analysis={photoAnalysis}
            error={photoAnalysisError}
            issue={photoReviewIssue}
            selectedItem={itemNames[itemType] || itemType}
            suggestedItem={photoAnalysis?.itemType ? categoryLabel(canonicalItemCategory(photoAnalysis.itemType) || photoAnalysis.itemType) : null}
            isBusy={isSubmitting}
            onChangeCategory={chooseDetectedCategory}
            onKeepCategory={keepSelectedCategory}
            onSelectCandidate={selectPhotoCandidate}
            onConfirmSelectedObject={confirmSelectedObject}
            onRetry={() => void submitReport()}
            onContinueWithoutAnalysis={() => void submitReport(true)}
          />


          {/* DESCRIPTION */}

          <div className="formField">

            <label htmlFor="description">
              Description
            </label>

            <textarea
              id="description"
              className="descriptionField"
              placeholder="Optional. Add details, or leave blank and AI will draft a description from the item details and photo."
            />

          </div>


          {/* SUBMIT */}

          {formError && (
            <p className="formError" role="alert">{formError}</p>
          )}

          <button
            type="button"
            className="submitReportButton"
            onClick={() => void submitReport()}
            disabled={isSubmitting}
          >
              {isSubmitting ? "Reviewing report…" : "Submit Report"}
          </button>

        </div>

      </DashboardLayout>


      {/* PHOTO CROPPER */}

      {image && (

        <div className="cropBackdrop">

          <div className="cropOverlay">

            <Cropper
              image={image}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(
                _,
                croppedAreaPixels
              ) =>
                setCroppedArea(
                  croppedAreaPixels
                )
              }
              showGrid={false}
            />

            <div className="cropButtons">

              <button
                type="button"
                onClick={cancelCrop}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  createCroppedImage
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
