import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Kimbal FFR Intelligence",
    description: "Development proof of concept for staged, register-first FFR case intake.",
    applicationName: "Kimbal FFR Intelligence",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "Kimbal FFR Intelligence",
      description: "Development proof of concept for staged, register-first FFR case intake.",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Kimbal FFR Intelligence",
      description: "Development proof of concept for staged FFR case intake.",
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
