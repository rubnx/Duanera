import type { Metadata } from "next";

import "flag-icons/css/flag-icons.min.css";
import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Duanera",
  description: "Customs, import/export, and trade intelligence for Chile.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={cn("font-sans", geist.variable, geistMono.variable)}
    >
      <body>{children}</body>
    </html>
  );
}
