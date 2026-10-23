import type { Metadata, Viewport } from "next";
import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";
import { SmoothScroll } from "@/components/smooth-scroll";
import { openGraphBase } from "@/lib/metadata.ts";
import "./globals.css";

// The only two families on the site: Plus Jakarta Sans for headings and UI, DM Sans for paragraphs.
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://vigie.lyrad.dev"),
  title: {
    default: "Vigie — superviseur de serveurs de dev pour agents IA",
    template: "%s · Vigie",
  },
  applicationName: "Vigie",
  authors: [{ name: "Daryl Ngako", url: "https://lyrad.dev" }],
  creator: "Daryl Ngako",
  description:
    "Vigie, le superviseur de serveurs de dev locaux pour agents IA : il lance chaque serveur une fois, et Claude Code, Codex, Cursor et vos terminaux lisent le même état en direct (port, PID, santé). Gratuit, open source, pour Windows.",
  keywords: ["Vigie", "superviseur de serveurs de dev", "dev server supervisor", "agents IA", "Claude Code", "Codex", "Cursor", "port déjà utilisé"],
  openGraph: {
    ...openGraphBase,
    title: "Vigie — superviseur de serveurs de dev pour agents IA",
    description: "Inspecter d'abord, lancer seulement si besoin. Gratuit et open source, pour Windows.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vigie — superviseur de serveurs de dev pour agents IA",
    description: "Un seul serveur, lu par tous vos agents. Gratuit et open source, pour Windows.",
    creator: "@daryl_ngako",
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
    <html lang="fr" suppressHydrationWarning className={`${jakarta.variable} ${dmSans.variable} antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh overflow-x-clip">
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
