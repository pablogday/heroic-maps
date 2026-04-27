import type { Metadata } from "next";
import { Cinzel, Inter } from "next/font/google";
import { BootSplash } from "@/components/BootSplash";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Heroic Maps — HoMM3 map browser",
    template: "%s — Heroic Maps",
  },
  description:
    "Browse, filter, review and download Heroes of Might and Magic 3 maps. SoD, HotA, WoG, Chronicles and beyond.",
  applicationName: "Heroic Maps",
  keywords: [
    "Heroes of Might and Magic",
    "HoMM3",
    "Heroes 3",
    "maps",
    "HotA",
    "WoG",
    "Chronicles",
  ],
  openGraph: {
    type: "website",
    siteName: "Heroic Maps",
    title: "Heroic Maps — HoMM3 map browser",
    description:
      "Browse, filter, review and download Heroes of Might and Magic 3 maps.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Heroic Maps — HoMM3 map browser",
    description:
      "Browse, filter, review and download Heroes of Might and Magic 3 maps.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col relative">
        {/* Runs before paint: hides the boot splash if the user already
            saw it this session. Inlined here (rather than in <head>) to
            avoid layout-time hydration quirks in App Router. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(sessionStorage.getItem('hm-splashed')==='1')document.documentElement.classList.add('hm-splash-seen')}catch(e){}",
          }}
        />
        <BootSplash />
        {children}
      </body>
    </html>
  );
}
