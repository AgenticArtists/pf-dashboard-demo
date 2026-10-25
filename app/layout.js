import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata = {
  title: "Household Finance Dashboard — Demo",
  description: "A read-only demo of a household finance dashboard, running on a fully synthetic household — every name, account and figure is invented.",
  openGraph: { title: "Household Finance Dashboard — Demo", description: "A read-only demo of a household finance dashboard, running on a fully synthetic household — every name, account and figure is invented.", type: "website" },
  twitter: { card: "summary", title: "Household Finance Dashboard — Demo", description: "A read-only demo of a household finance dashboard, running on a fully synthetic household — every name, account and figure is invented." },
  robots: { index: true, follow: true },
  applicationName: "Household Finance Dashboard — Demo",
  // Installed to the iPhone home screen it runs full-screen, no Safari bars.
  appleWebApp: { capable: true, title: "Finances", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};
export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4f1" },
    { media: "(prefers-color-scheme: dark)", color: "#121110" },
  ],
};

// Applies a saved light/dark choice before first paint (no theme flash).
// Without a saved choice the CSS follows the system setting.
const THEME_BOOT = `try{var t=localStorage.getItem("pf-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
