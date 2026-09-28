"use client";

import {
  Suspense,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import DashboardLayout from "../Components/DashboardLayout";
import { REPORTS_UPDATED_EVENT } from "../lib/report-storage";


type ItemFilter =
  | "all"
  | "lost"
  | "found";


type SavedReport = {
  id: string;

  reportType:
    | "lost"
    | "found";

  item: string;

  brand?: string;

  itemDetail?: string;

  color?: string;

  location: string;

  incidentDate: string;

  image?: string;

  description?: string;
  campus?: string;

  submittedAt: string;
  status?: string;
  matchedReportId?: string;
};


type SearchItem = {
  id: string;

  demoId?: number;

  reportId?: string;

  status:
    | "lost"
    | "found";

  name: string;

  location: string;

  date: string;

  image?: string;

  brand?: string;

  itemDetail?: string;

  description?: string;
  campus?: string;
};


/*
  DEFAULT / DEMO ITEMS

  These are not real submitted reports.
  They are sample items used to demonstrate
  how PantherFind works.
*/

const demoItems: SearchItem[] = [

  {
    id: "demo-1",
    demoId: 1,
    status: "found",
    name: "Blue Headphones",
    location: "Green Library",
    campus: "MMC",
    date: "Sept 18, 2026",
    image: "/headphones.JPG",
    brand: "Sony",
    itemDetail: "Headphones / Earphones",
    description:
      "Blue Sony headphones found inside the Green Library near a study area. The headphones were left unattended on a table.",
  },

  {
    id: "demo-2",
    demoId: 2,
    status: "lost",
    name: "Yellow water bottle",
    location:
      "Wellness and Recreation Center",
    campus: "MMC",
    date: "Sept 16, 2026",
    image: "/waterbottle.JPEG",
    brand: "Owala",
    itemDetail: "Water Bottle",
    description:
      "Yellow Owala water bottle lost at the Wellness and Recreation Center. It may have been left near the workout or seating area.",
  },

  {
    id: "demo-3",
    demoId: 3,
    status: "found",
    name: "Dorm Keychain",
    location: "Charles E. Perry",
    campus: "MMC",
    date: "Sept 14, 2026",
    image: "/keychain.PNG",
    itemDetail: "Dorm",
    description:
      "Dorm key found near Charles E. Perry with a distinctive keychain attached. The key was found in a common area.",
  },

  {
    id: "demo-4",
    demoId: 4,
    status: "lost",
    name: "Yellow backpack",
    location: "Graham Center",
    campus: "MMC",
    date: "Sept 13, 2026",
    image: "/backpack.JPG",
    itemDetail: "Backpack",
    description:
      "Yellow backpack lost inside the Graham Center. It may have been left near one of the seating or study areas.",
  },

];


function SearchPageContent() {

  const router =
    useRouter();


  const searchParams =
    useSearchParams();


  const searchFromHome =
    searchParams.get("q") || "";


  const selectedItemId =
    searchParams.get("item");


  const selectedReportId =
    searchParams.get("report");


  const [
    search,
    setSearch,
  ] = useState(
    searchFromHome
  );


  const [
    activeFilter,
    setActiveFilter,
  ] =
    useState<ItemFilter>(
      "all"
    );

  const [campusFilter, setCampusFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);


  const [
    items,
    setItems,
  ] =
    useState<SearchItem[]>(
      demoItems
    );


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
    CREATE ITEM NAME
  */

  function createItemName(
    report: SavedReport
  ) {

    const parts = [

      report.color,

      report.brand,

      report.itemDetail,

      report.item,

    ].filter(Boolean);


    return parts.join(" ");

  }


  /*
    LOAD SUBMITTED REPORTS
  */

  useEffect(() => {

    function loadReports() {

    const savedReports =
      localStorage.getItem(
        "pantherFindReports"
      );


    if (!savedReports) {

      setItems(
        demoItems
      );

      return;

    }


    try {

      const reports:
        SavedReport[] =
        JSON.parse(
          savedReports
        );


      if (
        !Array.isArray(
          reports
        )
      ) {

        setItems(
          demoItems
        );

        return;

      }


      /*
        NEWEST REPORT FIRST
      */

      const sortedReports =
        [...reports].sort(
          (a, b) => {

            const aTime =
              new Date(
                a.submittedAt
              ).getTime();


            const bTime =
              new Date(
                b.submittedAt
              ).getTime();


            return (
              bTime - aTime
            );

          }
        );


      /*
        CONVERT REPORTS
        INTO SEARCH CARDS
      */

      const activeReports = sortedReports.filter((report) =>
        report.status !== "Match Found" && report.status !== "Closed" && !report.matchedReportId
      );

      const reportItems:
        SearchItem[] =
        activeReports.map(
          (report) => ({

            id:
              `report-${report.id}`,

            reportId:
              report.id,

            status:
              report.reportType,

            name:
              createItemName(
                report
              ),

            location:
              report.location ||
              "Location not provided",

            campus: report.campus,

            date:
              formatDate(
                report.incidentDate
              ),

            image:
              report.image || undefined,

            brand:
              report.brand,

            itemDetail:
              report.itemDetail,

            description:
              report.description,

          })
        );


      /*
        NEW REPORTS FIRST,
        DEFAULT ITEMS AFTER
      */

      setItems([

        ...reportItems,

        ...demoItems,

      ]);


    } catch (error) {

      console.error(
        "Could not load search reports:",
        error
      );


      setItems(
        demoItems
      );

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
    FILTER ITEMS
  */

  const filteredItems =
    items.filter(
      (item) => {


        /*
          USER CLICKED A
          SUBMITTED REPORT
          FROM HOME
        */

        if (
          selectedReportId
        ) {

          return (
            item.reportId ===
            selectedReportId
          );

        }


        /*
          USER CLICKED A
          DEFAULT ITEM
          FROM HOME
        */

        if (
          selectedItemId
        ) {

          return (
            item.demoId ===
            Number(
              selectedItemId
            )
          );

        }


        /*
          LOST / FOUND FILTER
        */

        const matchesStatus =
          activeFilter ===
            "all" ||
          item.status ===
            activeFilter;


        /*
          SEARCH
        */

        const searchText =
          search
            .trim()
            .toLowerCase();


        const searchableText = [

          item.name,

          item.location,

          item.brand,

          item.itemDetail,

          item.description,

        ]

          .filter(Boolean)

          .join(" ")

          .toLowerCase();


        const matchesSearch =
          searchableText.includes(
            searchText
          );

        const matchesCampus = !campusFilter || item.campus === campusFilter;


        return (
          matchesStatus &&
          matchesSearch &&
          matchesCampus
        );

      }
    );


  /*
    OPEN ITEM DETAILS
  */

  function openItem(
    item: SearchItem
  ) {

    /*
      REAL SUBMITTED REPORT
    */

    if (item.reportId) {

      router.push(
        `/reports/${item.reportId}`
      );

      return;

    }


    /*
      DEFAULT DEMO ITEM
    */

    router.push(
      `/reports/${item.id}`
    );

  }


  return (

    <DashboardLayout activePage="search">

      <div className="searchPage">


        {/* TITLE */}

        <div className="searchHeading">

          <h1>
            Search Items
          </h1>

          <h2>
            Tell us about the Item
          </h2>

        </div>


        {/* SEARCH + FILTER */}

        <div className="searchControls">

          <div className="searchBar">

            <span className="searchBarIcon">
              ⌕
            </span>


            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search by item name, keyword, or brand..."
            />

          </div>


          <button
            type="button"
            className="filterButton"
            onClick={() => setShowFilters((open) => !open)}
            aria-expanded={showFilters}
          >

            <span className="filterIcon">
              ☷
            </span>

            Filter

          </button>

        </div>

        {showFilters && (
          <div className="searchFilterPanel">
            <label htmlFor="campusFilter">Campus</label>
            <select id="campusFilter" value={campusFilter} onChange={(event) => setCampusFilter(event.target.value)}>
              <option value="">All campuses</option>
              {Array.from(new Set(items.map((item) => item.campus).filter((campus): campus is string => Boolean(campus)))).sort().map((campus) => (
                <option key={campus} value={campus}>{campus}</option>
              ))}
            </select>
            {campusFilter && <button type="button" onClick={() => setCampusFilter("")}>Clear</button>}
          </div>
        )}


        {/* ITEM FILTER BUTTONS */}

        <div className="searchTabs">

          <button
            type="button"
            className={`searchTab ${
              activeFilter ===
              "all"

                ? "searchTabActive"

                : ""
            }`}
            onClick={() =>
              setActiveFilter(
                "all"
              )
            }
          >
            All Items
          </button>


          <button
            type="button"
            className={`searchTab ${
              activeFilter ===
              "lost"

                ? "searchTabActive"

                : ""
            }`}
            onClick={() =>
              setActiveFilter(
                "lost"
              )
            }
          >
            Lost Items
          </button>


          <button
            type="button"
            className={`searchTab ${
              activeFilter ===
              "found"

                ? "searchTabActive"

                : ""
            }`}
            onClick={() =>
              setActiveFilter(
                "found"
              )
            }
          >
            Found Items
          </button>

        </div>


        {/* RESULTS */}

        <div className="searchResults">

          {filteredItems.map(
            (item) => (

              <article
                className="searchItemCard"
                key={item.id}

                onClick={() =>
                  openItem(
                    item
                  )
                }

                onKeyDown={(event) => {

                  if (
                    event.key ===
                      "Enter" ||
                    event.key ===
                      " "
                  ) {

                    openItem(
                      item
                    );

                  }

                }}

                role="link"

                tabIndex={0}

                style={{
                  cursor:
                    "pointer",
                }}
              >


                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="searchItemImage"
                  />
                ) : (
                  <div className="searchItemImage noPhotoThumbnail" aria-label={`${item.name}: no photo`}>
                    No Photo
                  </div>
                )}


                <div
                  className={`searchItemStatus ${
                    item.status ===
                    "lost"

                      ? "searchItemLost"

                      : "searchItemFound"
                  }`}
                >

                  {item.status ===
                  "lost"

                    ? "Lost"

                    : "Found"}

                </div>


                <h3>
                  {item.name}
                </h3>


                <div className="searchItemDetail">

                  <span>
                    ●
                  </span>

                  <p>
                    {item.location}
                  </p>

                </div>


                <div className="searchItemDetail">

                  <span>
                    ▣
                  </span>

                  <p>
                    {item.date}
                  </p>

                </div>

              </article>

            )
          )}

        </div>


        {/* NO RESULTS */}

        {filteredItems.length ===
          0 && (

          <p className="noSearchResults">
            No items match your search.
          </p>

        )}

      </div>

    </DashboardLayout>

  );

}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageContent />
    </Suspense>
  );
}
