import { WorkspaceAppearance } from "@/components/settings/WorkspaceAppearance";
import { ProfileWorkspace } from "@/components/profiles/ProfileWorkspace";
import type { Metadata } from "next";
import localFont from "next/font/local";
import AdvanceTrackingPrompt from "@/components/tasks/AdvanceTrackingPrompt";
import Sidebar from "@/components/layout/Sidebar";
import TitleBar from "@/components/layout/TitleBar";
import { NavProvider } from "@/context/NavContext";
import { DataProvider } from "@/lib/data/DataProvider";
import { WidgetProvider } from "@/context/WidgetContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/context/ToastContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { ProfileGateHost } from "@/components/profiles/ProfileGateHost";
import { InputPickerEnhancer } from "@/components/ui/InputPickerEnhancer";
import { themeBootstrap } from "@/lib/theme";
import {
  CurrencyFeedback,
  CurrencyAttribution,
} from "@/components/ui/CurrencyFeedback";
import { ReportingProvider } from "@/context/ReportingContext";
import { WorkspaceTour } from "@/components/onboarding/WorkspaceTour";
import { KeyboardShortcutsModal } from "@/components/onboarding/KeyboardShortcutsModal";
import "./globals.css";

const inter = localFont({
  src: "../../public/fonts/inter-latin.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
  style: "normal",
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
          <ToastProvider>
            <NavProvider>
            <DataProvider>
              <WorkspaceAppearance />
              <InputPickerEnhancer />
              <ReportingProvider>
                <ProfileProvider>
                  <ProfileWorkspace>
                    <AdvanceTrackingPrompt />
                    <CurrencyFeedback />
                    <WidgetProvider>
                      <TitleBar />
                      <Sidebar />
                      <WorkspaceTour />
                      <KeyboardShortcutsModal />
                      <main className="workspace-scroll min-w-0 flex-1 bg-canvas min-h-0 overflow-y-auto">
                        {children}
                        <CurrencyAttribution />
                      </main>
                    </WidgetProvider>
                  </ProfileWorkspace>
                  <ProfileGateHost />
                </ProfileProvider>
              </ReportingProvider>
            </DataProvider>
            </NavProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
