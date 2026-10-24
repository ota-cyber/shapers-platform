import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Hanken_Grotesk, DM_Mono } from "next/font/google";
import { AppProvider } from "@/lib/store";
import { Shell } from "@/components/Shell";
import "./globals.css";

const serif = Instrument_Serif({ subsets: ["latin", "latin-ext"], weight: "400", variable: "--font-serif" });
const sans = Hanken_Grotesk({ subsets: ["latin", "latin-ext"], weight: ["400", "500"], variable: "--font-sans" });
const mono = DM_Mono({ subsets: ["latin", "latin-ext"], weight: ["300", "400"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Global Shapers",
  description: "Tasks, hours, meetings and your path through the tiers.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#f7f7f7" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <AppProvider>
          <Shell>{children}</Shell>
        </AppProvider>
      </body>
    </html>
  );
}
