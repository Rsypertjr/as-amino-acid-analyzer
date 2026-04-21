import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Amino Acid Code Sequence Analyzer",
  description:
    "Analyze protein minimotif sequences from FASTA-format data files",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        <nav className="bg-blue-700 text-white shadow-md">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
            <Link href="/" className="text-xl font-bold tracking-tight hover:text-blue-200">
              Amino Analyzer
            </Link>
            <Link href="/amino" className="hover:text-blue-200 text-sm font-medium">
              Analyzer
            </Link>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
        <footer className="bg-gray-800 text-gray-400 text-center text-xs py-4">
          Amino Acid Code Sequence Analyzer &mdash; Migrated from Laravel to Next.js
        </footer>
      </body>
    </html>
  );
}
