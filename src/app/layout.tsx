import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

// Primary body and interface font: Inter
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Editorial newspaper font for brand and heading items: Newsreader
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});

// Application metadata
export const metadata: Metadata = {
  title: "BillFlow - Operations Hub",
  description: "Modern financial management and task outsourcing workspace",
};

// Application root layout with persistent Sidebar navigation
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable} h-full antialiased`}>
      <body className="min-h-screen bg-[#faf9f5] text-[#111827] flex antialiased selection:bg-[#ede9fe] selection:text-[#7133f5] font-sans">
        {/* Left Sidebar navigation */}
        <Sidebar />
        {/* Main application content area */}
        <main className="flex-1 bg-[#faf9f5] min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
