"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { REPORTS_UPDATED_EVENT } from "./lib/report-storage";


type SavedReport = {
  id: string;
  reportType: "lost" | "found";
  item: string;
  brand?: string;
  itemDetail?: string;
  color?: string;
  location: string;
  incidentDate: string;
  image: string;
  submittedAt: string;
  status?: string;
  matchedReportId?: string;
};


type RecentItem = {
  id: string;
  image?: string;
  status: "Lost" | "Found";
  name: string;
  location: string;
  date: string;
  reportId?: string;
  demoId?: number;
};


export default function Home() {

  const router = useRouter();


  const [
    search,
    setSearch,
  ] = useState("");


  const [
    recentItems,
    setRecentItems,
  ] = useState<RecentItem[]>([]);


  /*
    ORIGINAL DEMO ITEMS
  */

  const demoItems: RecentItem[] = [

    {
      id: "demo-1",
      demoId: 1,
      image: "/images/headphones.jpg",
      status: "Found",
      name: "Blue Headphones",
      location: "Green Library",
      date: "Sept 18, 2026",
    },

    {
      id: "demo-2",
      demoId: 2,
      image: "/images/waterbottle.jpeg",
      status: "Lost",
      name: "Yellow water bottle",
      location:
        "Wellness and Recreation Center",
      date: "Sept 16, 2026",
    },

    {
      id: "demo-3",
      demoId: 3,
      image: "/images/keychain.png",
      status: "Found",
      name: "Dorm Keychain",
      location: "Charles E. Perry",
      date: "Sept 14, 2026",
    },

    {
      id: "demo-4",
      demoId: 4,
      image: "/images/backpack.jpg",
      status: "Lost",
      name: "Yellow backpack",
      location: "Graham Center",
      date: "Sept 11, 2026",
    },

  ];


  /*
    FORMAT REPORT DATE
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


    return parsedDate.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    );

  }


  /*
    CREATE CARD NAME
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

    function loadRecentItems() {

    const savedReports =
      localStorage.getItem(
        "pantherFindReports"
      );


    if (!savedReports) {

      setRecentItems(
        demoItems
      );

      return;

    }


    try {

      const reports: SavedReport[] =
        JSON.parse(
          savedReports
        );


      if (!Array.isArray(reports)) {

        setRecentItems(
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
        TURN REPORTS INTO HOME CARDS
      */

      const reportItems:
        RecentItem[] =
        sortedReports.filter((report) =>
          report.status !== "Match Found" && report.status !== "Closed" && !report.matchedReportId
        ).map(
          (report) => ({

            id:
              `report-${report.id}`,

            reportId:
              report.id,

            image:
              report.image || undefined,

            status:
              report.reportType ===
              "lost"

                ? "Lost"

                : "Found",

            name:
              createItemName(
                report
              ),

            location:
              report.location ||
              "Location not provided",

            date:
              formatDate(
                report.incidentDate
              ),

          })
        );


      setRecentItems(
        [...reportItems, ...demoItems].slice(0, 4)
      );


    } catch (error) {

      console.error(
        "Could not load recent reports:",
        error
      );


      setRecentItems(
        demoItems
      );

    }

    }

    loadRecentItems();
    window.addEventListener("storage", loadRecentItems);
    window.addEventListener(REPORTS_UPDATED_EVENT, loadRecentItems);
    return () => {
      window.removeEventListener("storage", loadRecentItems);
      window.removeEventListener(REPORTS_UPDATED_EVENT, loadRecentItems);
    };

  }, []);


  /*
    SEARCH
  */

  function handleSearch(
    event:
      FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();


    const cleanedSearch =
      search.trim();


    if (!cleanedSearch) {
      return;
    }


    router.push(
      `/search?q=${encodeURIComponent(
        cleanedSearch
      )}`
    );

  }


  /*
    OPEN ITEM
  */

  function openItem(
    item: RecentItem
  ) {

    /*
      USER SUBMITTED REPORT
    */

    if (item.reportId) {

      router.push(
        `/search?report=${encodeURIComponent(
          item.reportId
        )}`
      );

      return;

    }


    /*
      ORIGINAL DEMO ITEM
    */

    if (item.demoId) {

      router.push(
        `/search?item=${item.demoId}`
      );

    }

  }


  return (

    <main className="page">


      {/* HEADER */}

      <header className="header">

        <div className="homeBrand">

          <img
            src="/images/logo.png"
            alt="PantherFind logo"
            className="headerIcon"
          />

          <img
            src="/images/logotext.png"
            alt="PantherFind"
            className="headerLogo"
          />

        </div>


        <div className="homeHeaderActions">


          {/* SEARCH BAR */}

          <form
            className="homeSearchBar"
            onSubmit={
              handleSearch
            }
          >

            <span className="homeSearchIcon">
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
              aria-label="Search items"
            />

          </form>


          {/* LOGIN */}

          <Link
            href="/login"
            className="homeLoginButton"
          >
            Log In
          </Link>

        </div>

      </header>


      {/* HERO */}

      <section className="hero">

        <img
          src="/images/picture1.jpeg"
          className="heroBackground"
          alt=""
        />

        <div className="heroOverlay">

          <img
            src="/images/phrase.png"
            alt="Lost something? Let's find it"
            className="heroPhrase"
          />

          <div className="heroButtons">

            <Link
              href="/lost"
              className="lostButton"
            >
              I lost an Item
            </Link>

            <Link
              href="/found"
              className="foundButton"
            >
              I found an Item
            </Link>

          </div>

        </div>

      </section>


      {/* FEATURES */}

      <section className="features">

        <div className="feature">

          <img
            src="/images/logo1.png"
            alt="Magnifying glass"
            className="featureImage"
          />

          <p>
            Report easily
          </p>

        </div>


        <div className="divider" />


        <div className="feature">

          <img
            src="/images/logo2.png"
            alt="Bell"
            className="featureImage2"
          />

          <p>
            Stay updated
          </p>

        </div>


        <div className="divider" />


        <div className="feature">

          <img
            src="/images/logo3.png"
            alt="People"
            className="featureImage3"
          />

          <p>
            Help the FIU community
          </p>

        </div>

      </section>


      {/* RECENT ITEMS */}

      <section className="recentSection">

        <div className="recentHeader">

          <h2>
            Recently Reported Items
          </h2>

          <Link
            href="/search"
            className="viewAll"
          >
            View All →
          </Link>

        </div>


        <div className="itemsGrid">

          {recentItems.map(
            (item) => (

              <div
                className="itemCard clickableItemCard"
                key={item.id}
                onClick={() =>
                  openItem(item)
                }
                role="link"
                tabIndex={0}
                onKeyDown={(
                  event
                ) => {

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
              >

                {item.image ? (
                  <img src={item.image} alt={item.name} className="itemImage" />
                ) : (
                  <div className="itemImage noPhotoThumbnail">No Photo</div>
                )}


                <div className="itemInfo">

                  <div
                    className={
                      item.status ===
                      "Lost"

                        ? "status lost"

                        : "status found"
                    }
                  >
                    {item.status}
                  </div>


                  <h3>
                    {item.name}
                  </h3>


                  <p className="itemDetail">

                    <span>
                      ●
                    </span>

                    {item.location}

                  </p>


                  <p className="itemDetail">

                    <span>
                      ▣
                    </span>

                    {item.date}

                  </p>

                </div>

              </div>

            )
          )}

        </div>

        {recentItems.length === 0 && (
          <p className="noSearchResults">There are no active reports right now. New lost and found reports will appear here.</p>
        )}

      </section>


      {/* FIU FOOTER */}

      <footer className="fiuFooter">

        <div className="fiuFooterContent">


          {/* FIU BRAND */}

          <div className="fiuFooterBrand">

            <div className="fiuFooterLogoRow">

              <div className="fiuWordmark">
                FIU
              </div>

              <div className="fiuUniversityName">
                FLORIDA
                <br />
                INTERNATIONAL
                <br />
                UNIVERSITY
              </div>

            </div>


            <h3>
              Connect
            </h3>

            <a
              href="https://www.fiu.edu/contact/"
              target="_blank"
              rel="noreferrer"
            >
              Contact FIU
            </a>

            <a
              href="https://news.fiu.edu/"
              target="_blank"
              rel="noreferrer"
            >
              FIU News
            </a>


          </div>


          {/* CONNECT */}

          <div className="fiuFooterColumn">

            <h3>
              Connect
            </h3>

            <div className="fiuFooterLinkColumns">

              <div>

                <a
                  href="https://www.fiu.edu/about/"
                  target="_blank"
                  rel="noreferrer"
                >
                  About FIU
                </a>

                <a
                  href="https://www.fiu.edu/academics/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Academics
                </a>

                <a
                  href="https://research.fiu.edu/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Research
                </a>

                <a
                  href="https://fiusports.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Athletics
                </a>

                <a
                  href="https://hr.fiu.edu/careers/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Careers at FIU
                </a>

              </div>


              <div>

                <a
                  href="https://admissions.fiu.edu/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Admissions
                </a>

                <a
                  href="https://www.fiu.edu/locations/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Locations
                </a>

                <a
                  href="https://studentaffairs.fiu.edu/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Student Life
                </a>

                <a
                  href="https://www.fiualumni.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Alumni and Giving
                </a>

                <a
                  href="https://admissions.fiu.edu/cost-and-aid/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Estimate Cost of Attendance
                </a>

              </div>

            </div>

          </div>


          {/* TOOLS & RESOURCES */}

          <div className="fiuFooterColumn">

            <h3>
              Tools &amp; Resources
            </h3>

            <div className="fiuFooterLinkColumns">

              <div>

                <a
                  href="https://phonebook.fiu.edu/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Phonebook (Directory)
                </a>

                <a
                  href="https://campusmaps.fiu.edu/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Campus Maps
                </a>

                <a
                  href="https://canvas.fiu.edu/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Canvas
                </a>

                <a
                  href="https://status.fiu.edu/"
                  target="_blank"
                  rel="noreferrer"
                >
                  System Status
                </a>

                <a
                  href="https://hr.fiu.edu/equity-and-inclusion/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Nondiscrimination
                </a>

                <a
                  href="https://report.fiu.edu/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Report Discrimination or Harassment
                </a>

              </div>


              <div>

                <a
                  href="https://calendar.fiu.edu/"
                  target="_blank"
                  rel="noreferrer"
                >
                  University Calendar
                </a>

                <a
                  href="https://my.fiu.edu/"
                  target="_blank"
                  rel="noreferrer"
                >
                  MyFIU
                </a>

                <a
                  href="https://mail.fiu.edu/"
                  target="_blank"
                  rel="noreferrer"
                >
                  FIU Email
                </a>

                <a
                  href="https://reservespace.fiu.edu/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Reserve Space
                </a>

                <a
                  href="https://titleix.fiu.edu/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Title IX
                </a>

              </div>

            </div>

          </div>


          {/* LOST AND FOUND CONTACT */}

          <div className="fiuFooterHelp">

            <h3>
              Need help?
            </h3>

            <p>
              Contact FIU Lost and Found
            </p>

            <p>
              MMC:{" "}
              <a href="tel:3053485911">
                (305) 348-5911
              </a>
            </p>

            <p>
              BBC:{" "}
              <a href="tel:3059195911">
                (305) 919-5911
              </a>
            </p>

          </div>

        </div>


        {/* COPYRIGHT */}

        <div className="fiuFooterBottom">

          <p>
            © 2026 Florida International University
          </p>

          <p>
            Website by{" "}
            <span>
              Rene E. Arellano
            </span>
          </p>

        </div>

      </footer>

    </main>

  );

}
