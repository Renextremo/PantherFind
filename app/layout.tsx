import type { Metadata, Viewport } from "next";
import InboxDrawer from "./Components/InboxDrawer";
import "./globals.css";

export const metadata: Metadata = {
  title: "PantherFind",
  description: "FIU Lost and Found",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <InboxDrawer />
      </body>
    </html>
  );
}
