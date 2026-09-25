import type { Metadata, Viewport } from "next";
import { Libre_Caslon_Display, Libre_Caslon_Text, Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/*
  Three faces, three jobs, drawn from the printing world the product lives in.

  Caslon is the English press face — the one this kind of document was set in
  for two centuries. Display cut for the question at poster scale, Text cut for
  reading, because a display Caslon's hairlines disappear at 17px and a text
  Caslon looks timid at 44px. Using one cut for both is the compromise that
  makes most "editorial" pages look almost right and never sharp.

  Archivo carries every control, label and button. Product UI wants a workhorse
  grotesque, not a display face pressed into service on a 12px label.

  JetBrains Mono sets citations and source metadata, and that is the design's
  load-bearing signal: mono here means "assembled by the application from
  extracted metadata", never "typed by the model".
*/

const caslonDisplay = Libre_Caslon_Display({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-display",
  display: "swap",
});

const caslonText = Libre_Caslon_Text({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sourcely — research with citations you can trust",
  description:
    "Ask a question about history, science or any academic topic. Get a summary, key points, and every source cited in the style your teacher asked for.",
  applicationName: "Sourcely",
  // Read by iOS when the site runs full-screen, including inside the Natively
  // app shell: no browser chrome, and the status bar sits over the page.
  appleWebApp: { capable: true, title: "Sourcely", statusBarStyle: "default" },
  formatDetection: { telephone: false, email: false, address: false },
};

/**
 * `viewportFit: "cover"` is what lets the page extend under the notch and the
 * home indicator. Without it iOS letterboxes the page and every
 * env(safe-area-inset-*) reads as zero, so the insets in globals.css would
 * silently do nothing.
 *
 * Zoom is deliberately left enabled. The usual fix for iOS zooming into a
 * focused field is to disable pinch-zoom entirely, which fails WCAG. The real
 * cause is any input under 16px, and globals.css fixes that directly.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f1e8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${caslonDisplay.variable} ${caslonText.variable} ${archivo.variable} ${jetbrains.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
