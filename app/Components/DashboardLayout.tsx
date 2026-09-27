"use client";

import Link from "next/link";

type DashboardLayoutProps = {
  children: React.ReactNode;
  activePage: "lost" | "found" | "search" | "reports";
};

const sidebarButtons = [
  {
    id: "lost",
    label: "Report a Lost Item",
    href: "/lost",
    blueIcon: "/lost-blue.png",
    yellowIcon: "/lost-yellow.png",
  },
  {
    id: "found",
    label: "Report a Found Item",
    href: "/found",
    blueIcon: "/found-blue.png",
    yellowIcon: "/found-yellow.png",
  },
  {
    id: "search",
    label: "Search Items",
    href: "/search",
    blueIcon: "/search-blue.png",
    yellowIcon: "/search-yellow.png",
  },
  {
    id: "reports",
    label: "My Reports",
    href: "/reports",
    blueIcon: "/reports-blue.png",
    yellowIcon: "/reports-yellow.png",
  },
] as const;

export default function DashboardLayout({
  children,
  activePage,
}: DashboardLayoutProps) {
  return (
    <div className="dashboardPage">
      <header className="header">
        <Link href="/">
          <img
            src="/logo.png"
            alt="PantherFind"
            className="headerIcon"
          />
        </Link>

        <Link href="/">
          <img
            src="/logotext.PNG"
            alt="PantherFind"
            className="headerLogo"
          />
        </Link>
      </header>

      <div className="dashboard">
        <aside className="sidebar">
          {sidebarButtons.map((button) => {
            const isActive = activePage === button.id;

            return (
              <Link
                key={button.id}
                href={button.href}
                className={`sidebarButton ${
                  isActive ? "sidebarActive" : ""
                }`}
              >
                <img
                  src={isActive ? button.yellowIcon : button.blueIcon}
                  alt=""
                  className={`sidebarIcon ${
                  button.id === "lost" ? "lostSidebarIcon" : ""
                  }`}
                  />

                <span className="sidebarButtonText">
                  {button.label}
                </span>
              </Link>
            );
          })}
        </aside>

        <main className="dashboardContent">
          {children}
        </main>
      </div>
    </div>
  );
}