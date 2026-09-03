import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "RevenueOS — Owner dashboard",
  description: "Single-owner portfolio dashboard for the persistent operator.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-[--color-panel-border] px-6 py-3 bg-[--color-panel]">
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/" className="font-semibold text-[--color-accent]">
              RevenueOS
            </Link>
            <Link href="/">Overview</Link>
            <Link href="/queue">Queue</Link>
            <Link href="/logs">Logs</Link>
            <span className="ml-auto text-[--color-muted]">
              persistent operator + sidecar
            </span>
          </nav>
        </header>
        <main className="p-6 mx-auto max-w-6xl">{children}</main>
      </body>
    </html>
  );
}
