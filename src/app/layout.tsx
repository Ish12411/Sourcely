import type { Metadata } from "next";
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
