import type { Metadata, Viewport } from "next";
import "@fontsource-variable/nunito";
import "@fontsource-variable/fredoka";
import "./globals.css";
import { ThemeController } from "@/components/ThemeController";

export const metadata: Metadata = {
  title: "Modulo: Holes",
  description: "Tiny, juicy games. Golf and Billiards — one more round.",
  applicationName: "Modulo: Holes",
  appleWebApp: { capable: true, title: "Modulo", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0c0d13" },
    { media: "(prefers-color-scheme: light)", color: "#f3efe7" },
  ],
};

// Set the theme before first paint to avoid a light/dark flash.
const themeScript = `(function(){try{var s=JSON.parse(localStorage.getItem('modulo:settings')||'{}');var t=(s.state&&s.state.theme)||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeController />
        {children}
      </body>
    </html>
  );
}
