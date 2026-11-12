import { ProfileWorkspace } from "@/components/profiles/ProfileWorkspace";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AdvanceTrackingPrompt from "@/components/tasks/AdvanceTrackingPrompt";
import Sidebar from "@/components/layout/Sidebar";
import TitleBar from "@/components/layout/TitleBar";
import { NavProvider } from "@/context/NavContext";
import { DataProvider } from "@/lib/data/DataProvider";
import { WidgetProvider } from "@/context/WidgetContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { ProfileGateModal } from "@/components/profiles/ProfileGateModal";
import { themeBootstrap } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
      className={`${inter.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="h-screen bg-canvas text-content-neutral-900 flex flex-col antialiased selection:bg-surface-purple-100 selection:text-content-purple-900 overflow-hidden">
        <ThemeProvider>
          <NavProvider>
            <DataProvider>
              <ProfileProvider>
                <ProfileGateModal />
                <ProfileWorkspace>
                  <AdvanceTrackingPrompt />
                  <WidgetProvider>
                    <TitleBar />
                    <Sidebar />
                    <main className="workspace-scroll min-w-0 flex-1 bg-canvas min-h-0 overflow-y-auto">
                      {children}
                    </main>
                  </WidgetProvider>
                </ProfileWorkspace>
              </ProfileProvider>
            </DataProvider>
          </NavProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
