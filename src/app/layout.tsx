import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display, Inter, Newsreader } from "next/font/google";
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
  description: "Modern financial management and task outsourcing workspace for freelancers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${inter.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-[#f8f8fa] text-neutral-900 flex antialiased selection:bg-purple-100 selection:text-purple-900">
        <NavProvider>
          <Sidebar />
          <main className="flex-1 bg-[#f8f8fa] min-h-screen overflow-y-auto">
            {children}
          </main>
        </NavProvider>
      </body>
    </html>
  );
}
