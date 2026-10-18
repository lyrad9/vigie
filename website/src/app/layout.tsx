import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// The only two families on the site: Satoshi for headings, DM Sans for paragraphs.
const satoshi = localFont({
  src: [
    { path: "../fonts/Satoshi-Variable.woff2", weight: "300 900", style: "normal" },
    { path: "../fonts/Satoshi-VariableItalic.woff2", weight: "300 900", style: "italic" },
  ],
  variable: "--font-satoshi",
  display: "swap",
});
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://vigie.lyrad.dev"),
  title: "Vigie — un seul superviseur pour tous vos serveurs locaux",
  authors: [{ name: "Daryl Ngako", url: "https://lyrad.dev" }],
  creator: "Daryl Ngako",
  description:
    "Vos agents relancent sans cesse le même serveur. Vigie le lance une fois, et chaque agent, terminal et fenêtre lit le même état en direct : port, PID, santé.",
  openGraph: {
    title: "Vigie — un seul superviseur pour tous vos serveurs locaux",
    description: "Inspecter d'abord, lancer seulement si besoin. Gratuit et open source, pour Windows.",
    type: "website",
    images: ["/screens/app-light.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1c1c" },
  ],
};

// Runs before first paint: saved choice, else the OS preference. Avoids a light/dark flash.
const themeScript = `(function(){try{var t=localStorage.getItem('vigie-theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${satoshi.variable} ${dmSans.variable} antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh overflow-x-clip">{children}</body>
    </html>
  );
}
