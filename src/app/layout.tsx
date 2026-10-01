import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import { NavProvider } from "@/context/NavContext";
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
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BillFlow - Operations Hub",
  description: "Modern financial management and billing operations tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}>
      <body className="min-h-screen bg-[#F8F9FA] text-neutral-900 flex antialiased selection:bg-purple-100 selection:text-purple-900 font-sans">
        <NavProvider>
          <Sidebar />
          <main className="flex-1 min-h-screen bg-[#F8F9FA] overflow-y-auto">
            {children}
          </main>
        </NavProvider>
      </body>
    </html>
  );
}
