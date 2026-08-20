import type { Metadata } from "next";
import { THEME_CSS } from "./theme-css";
import { AppShell } from "./components/AppShell";

export const metadata: Metadata = {
  title: "KIMBAL — Fast Failure Resolution (FFR)",
  description: "Deterministic diagnostic reasoning for returned electricity meters",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <style id="ffr-theme" dangerouslySetInnerHTML={{ __html: THEME_CSS }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
