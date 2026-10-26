import type { Metadata, Viewport } from "next";
import { Inter, Noto_Naskh_Arabic } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/providers/AppProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const naskh = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  variable: "--font-naskh",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ResearchPilot AI V2",
  description: "Autonomous, multilingual AI research with sources you can check.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Runs before the page paints, so the saved theme and text direction
// are applied immediately (no light/dark or LTR/RTL flash).
// The storage keys must match STORAGE_KEYS in src/lib/constants.ts.
const initScript = `
(function () {
  try {
    var root = document.documentElement;
    var theme = localStorage.getItem("rp-theme");
    if (!theme) {
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    root.classList.toggle("dark", theme === "dark");
    var lang = localStorage.getItem("rp-ui-lang");
    if (lang === "ur" || lang === "sd") root.dir = "rtl";
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${naskh.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
      </head>
      <body className="font-sans">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
