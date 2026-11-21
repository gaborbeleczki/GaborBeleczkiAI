import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Családi Hub", template: "%s · Családi Hub" },
  description: "Privát családi szervező: iskola, teendők, befizetések, számlák.",
  robots: { index: false, follow: false, nocache: true },
  appleWebApp: { capable: true, title: "Családi Hub", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#13151b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
