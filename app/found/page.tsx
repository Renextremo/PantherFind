"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Cropper, { Area } from "react-easy-crop";
import DashboardLayout from "../Components/DashboardLayout";
import { generateReportDescription } from "../lib/report-description";
import { runReportAgents } from "../lib/report-agents";
import { saveReportsWithQuotaFallback } from "../lib/report-storage";


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


const campusLocations: Record<string, string[]> = {
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


function needsBrand(item: string) {
  return [
    "Phone",
    "Laptop",
    "Tablet",
    "Headphones / Earphones",
    "Water Bottle",
  ].includes(item);
}


function needsType(item: string) {
  return [
    "Charger",
    "Bag",
    "Wallet",
    "Keys",
    "Sweater",
  ].includes(item);
}


function createImage(
  url: string
): Promise<HTMLImageElement> {
  return new Promise(
    (resolve, reject) => {
      const image = new Image();

      image.addEventListener(
        "load",
        () => resolve(image)
      );

      image.addEventListener(
        "error",
        (error) => reject(error)
      );

      image.src = url;
    }
  );
}


async function getCroppedImage(
  imageSrc: string,
  pixelCrop: Area
): Promise<string> {
  const image =
    await createImage(imageSrc);

  const canvas =
    document.createElement(
      "canvas"
    );

  const context =
    canvas.getContext("2d");

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


export default function FoundPage() {
  const router =
    useRouter();

  const [item, setItem] =
    useState("");

  const [campus, setCampus] =
    useState("");

  const [
    location,
    setLocation,
  ] = useState("");

  const [
    image,
    setImage,
  ] = useState<string | null>(
    null
  );

  const [
    croppedImage,
    setCroppedImage,
  ] = useState<string | null>(
    null
  );

  const [crop, setCrop] =
    useState({
      x: 0,
      y: 0,
    });

  const [zoom, setZoom] =
    useState(1);

  const [
    croppedAreaPixels,
    setCroppedAreaPixels,
  ] = useState<Area | null>(
    null
  );

  const [
    formError,
    setFormError,
  ] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);


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

    if (!file) return;

    const imageUrl =
      URL.createObjectURL(
        file
      );

    setImage(imageUrl);
    setCroppedImage(null);
    setFormError("");

    setCrop({
      x: 0,
      y: 0,
    });

    setZoom(1);
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


  async function submitReport() {
    const brandElement =
      document.getElementById(
        "foundBrand"
      ) as HTMLSelectElement | null;

    const typeElement =
      document.getElementById(
        "foundType"
      ) as HTMLSelectElement | null;

    const colorElement =
      document.getElementById(
        "foundColor"
      ) as HTMLSelectElement | null;

    const dateElement =
      document.getElementById(
        "dateFound"
      ) as HTMLInputElement | null;

    const descriptionElement =
      document.getElementById(
        "foundDescription"
      ) as HTMLTextAreaElement | null;


    /*
      CHECK REQUIRED FIELDS
    */

    const missingItem =
      !item;

    const missingCampus =
      !campus;

    const missingLocation =
      !location;

    const missingDate =
      !dateElement?.value;

    const missingPhoto =
      !croppedImage;


    if (
      missingItem ||
      missingCampus ||
      missingLocation ||
      missingPhoto ||
      missingDate
    ) {
      setFormError(
        "Please add an item, photo, campus, location, and date found to submit your report."
      );

      return;
    }


    setFormError("");
    setIsSubmitting(true);


    /*
      GET EXISTING REPORTS
    */

    let existingReports: any[] = [];

    const savedReports =
      localStorage.getItem(
        "pantherFindReports"
      );


    if (savedReports) {
      try {
        existingReports =
          JSON.parse(
            savedReports
          );
      } catch {
        existingReports = [];
      }
    }


    /*
      CAMPUS CODE
    */

    const campusCodes:
      Record<string, string> = {
        "Modesto A. Maidique Campus (MMC)":
          "MMC",

        "Biscayne Bay Campus (BBC)":
          "BBC",

        "Engineering Center (EC)":
          "EC",

        "FIU at I-75":
          "I75",

        "FIU Downtown on Brickell":
          "DB",

        "Other FIU Location":
          "FIU",
      };


    const campusCode =
      campusCodes[campus] ||
      "FIU";


    /*
      GENERATE UNIQUE CASE NUMBER
    */

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


    /*
      CREATE REPORT
    */

    const brand = brandElement?.value ? brandElement.selectedOptions[0]?.text || "" : "";
    const itemDetail = typeElement?.value ? typeElement.selectedOptions[0]?.text || "" : "";
    const color = colorElement?.value ? colorElement.selectedOptions[0]?.text || "" : "";
    const description = descriptionElement?.value.trim() || await generateReportDescription({
      reportType: "found",
      item,
      brand,
      itemDetail,
      color,
      campus,
      location,
      image: croppedImage,
    });

    const report = {
      id:
        crypto.randomUUID(),

      caseNumber,

      confirmation:
        caseNumber,

      reportType:
        "found",

      item:
        item,

      brand,

      itemDetail,

      color,

      campus,

      campusCode,

      location,

      incidentDate:
        dateElement?.value ||
        "",

      description,

      image:
        croppedImage,

      status:
        "Submitted",

      submittedAt:
        new Date().toISOString(),
    };


    /*
      NEWEST REPORT GOES FIRST
    */

    const updatedReports = [
      report,
      ...existingReports,
    ];


    /*
      SAVE REPORT HISTORY
    */

    try {
      saveReportsWithQuotaFallback(updatedReports, report.id);
    } catch {
      setIsSubmitting(false);
      setFormError("Your browser storage is full. Clear some site data or remove older reports, then try again.");
      return;
    }

    await runReportAgents(report, existingReports);


    /*
      SAVE CURRENT REPORT FOR
      CONFIRMATION PAGE
    */

    sessionStorage.setItem(
      "pantherFindSubmittedReport",
      JSON.stringify(report)
    );


    /*
      GO TO SUBMITTED PAGE
    */

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
      >

        <DashboardLayout activePage="found">

          <div className="lostForm">

            <h1>
              Report a Found Item
            </h1>

            <h2>
              Tell us about the Item
            </h2>


            {/* ITEM */}

            <div className="formField">

              <label htmlFor="foundItem">
                Item <span className="requiredMark" aria-hidden="true">*</span>
              </label>

              <select
                id="foundItem"
                value={item}
                onChange={(event) => {
                  setItem(
                    event.target.value
                  );

                  setFormError("");
                }}
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

                <label htmlFor="foundBrand">
                  Brand
                </label>

                <select
                  id="foundBrand"
                  onChange={() =>
                    setFormError("")
                  }
                >

                  <option value="">
                    Select Brand
                  </option>


                  {item === "Phone" && (
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


                  {item === "Laptop" && (
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


                  {item === "Tablet" && (
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


                  {item ===
                    "Headphones / Earphones" && (
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


                  {item ===
                    "Water Bottle" && (
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

            {needsType(item) && (

              <div className="formField">

                <label htmlFor="foundType">
                  Type
                </label>

                <select
                  id="foundType"
                  onChange={() =>
                    setFormError("")
                  }
                >

                  <option value="">
                    Select Type
                  </option>


                  {item === "Charger" && (
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


                  {item === "Bag" && (
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


                  {item === "Wallet" && (
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


                  {item === "Keys" && (
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


                  {item === "Sweater" && (
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

              <label htmlFor="foundColor">
                Color
              </label>

              <select
                id="foundColor"
                onChange={() =>
                  setFormError("")
                }
              >

                <option value="">
                  Select Color
                </option>

                {colorOptions.map(
                  (color) => (
                    <option
                      value={color}
                      key={color}
                    >
                      {color}
                    </option>
                  )
                )}

              </select>

            </div>


            {/* CAMPUS */}

            <div className="formField">

              <label htmlFor="foundCampus">
                Campus <span className="requiredMark" aria-hidden="true">*</span>
              </label>

              <select
                id="foundCampus"
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
                      value={campusName}
                      key={campusName}
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

                <label htmlFor="foundLocation">
                  Location <span className="requiredMark" aria-hidden="true">*</span>
                </label>

                <select
                  id="foundLocation"
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

                  {campusLocations[
                    campus
                  ].map(
                    (locationName) => (
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

              <label htmlFor="dateFound">
                Date Found <span className="requiredMark" aria-hidden="true">*</span>
              </label>

              <input
                id="dateFound"
                type="date"
                required
                onChange={() =>
                  setFormError("")
                }
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
                    alt="Uploaded found item"
                    className="uploadedPhoto"
                  />

                ) : (

                  <>
                    <img
                      src="/upload-photo.png"
                      alt=""
                      className="uploadPhotoIcon"
                    />

                    <span>
                      Upload a photo of the item found or a reference
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

              <label htmlFor="foundDescription">
                Description
              </label>

              <textarea
                id="foundDescription"
                className="descriptionField"
                placeholder="Optional. Add details, or leave blank and AI will draft a description from the photo and location."
                onChange={() =>
                  setFormError("")
                }
              />

            </div>


            {/* ERROR MESSAGE */}

            {formError && (

              <p
                style={{
                  color: "#c62828",
                  fontWeight: 600,
                  fontSize: "14px",
                  margin: "4px 0 12px -25px",
                }}
              >
                {formError}
              </p>

            )}


            {/* SUBMIT */}

            <button
              type="button"
              className="submitReportButton"
              onClick={submitReport}
              disabled={isSubmitting}
            >
              {isSubmitting ? "AI reviewing report…" : "Submit Report"}
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
