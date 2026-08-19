import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { ShieldCheck } from "lucide-react";
import { BrandHeader } from "./components/brand-header";
import { SidebarNav } from "./components/sidebar-nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const metadataBase = host ? new URL(`${protocol}://${host}`) : undefined;
  return {
    metadataBase,
    title: "Kimbal FFR Intelligence",
    description: "Development proof of concept for staged, register-first FFR case intake.",
    applicationName: "Kimbal FFR Intelligence",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "Kimbal FFR Intelligence",
      description: "Development proof of concept for staged, register-first FFR case intake.",
      type: "website",
      images: [{ url: "/og-v3.png", width: 1736, height: 904, alt: "Kimbal FFR Intelligence — 60 DLMS checks, provisional review required" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Kimbal FFR Intelligence",
      description: "Development proof of concept for staged FFR case intake.",
      images: ["/og-v3.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <div className="app-shell">
          <a className="skip-link" href="#main-content">
            Skip to case intake
          </a>
          <aside className="sidebar">
            <BrandHeader />
            <SidebarNav />
            <div className="sidebar-note">
              <ShieldCheck size={16} />
              <span>
                <strong>Exact identity before case inference</strong>
                <small>
                  Technical DLMS findings can run first; customer-case
                  conclusions need a matched meter.
                </small>
              </span>
            </div>
          </aside>
          <main className="main" id="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
