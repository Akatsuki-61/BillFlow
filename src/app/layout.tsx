import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Playfair_Display,
  Inter,
  Newsreader,
} from "next/font/google";
import AdvanceTrackingPrompt from "@/components/AdvanceTrackingPrompt";
import Sidebar from "@/components/Sidebar";
import TitleBar from "@/components/TitleBar";
import { NavProvider } from "@/context/NavContext";
import { DataProvider } from "@/lib/data/DataProvider";
import { WidgetProvider } from "@/context/WidgetContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { themeBootstrap } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BillFlow - Operations Hub",
  description:
    "Modern financial management and task outsourcing workspace for freelancers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${inter.variable} ${newsreader.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="h-screen bg-canvas text-content-neutral-900 flex flex-col antialiased selection:bg-surface-purple-100 selection:text-content-purple-900 overflow-hidden">
        <ThemeProvider>
          <NavProvider>
            <DataProvider>
              <AdvanceTrackingPrompt />
              <WidgetProvider>
                <TitleBar />
                <div className="flex flex-1 min-h-0 overflow-hidden">
                  <Sidebar />
                  <main className="workspace-scroll min-w-0 flex-1 bg-canvas min-h-0 overflow-y-auto">
                    {children}
                  </main>
                </div>
              </WidgetProvider>
            </DataProvider>
          </NavProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
