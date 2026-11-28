import type { Metadata, Viewport } from "next";
import { Bungee, Space_Mono } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import {
  ANALYTICS_SCRIPT_SRC,
  ANALYTICS_SITE_ID,
  GOOGLE_SITE_VERIFICATION,
  OG_IMAGE_ALT,
  OG_IMAGE_PATH,
  OG_IMAGE_SIZE,
  OG_LOCALE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
  THEME_COLOR,
  X_HANDLE,
} from "@/config";
import { umamiScriptProps } from "@/lib/analytics";
import "./globals.css";

// Display font: words only (DESIGN §1). Never used for numbers or currency symbols.
const bungee = Bungee({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-bungee",
  display: "swap",
});

// Body font and ALL numbers/currency symbols (the ₦ glyph itself comes from `naira` below).
const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-space-mono",
  display: "swap",
});

// The ₦ sign only (U+20A6, about 1 KB). Space Mono draws its own ₦ short and squat, so at 12px it
// reads like a "#". This is a subset of Space Grotesk (same family lineage, full-height ₦, both
// weights), placed before Space Mono in the font stack in globals.css. Licence: app/fonts/.
const naira = localFont({
  src: [{ path: "./fonts/naira.woff2", weight: "400 700", style: "normal" }],
  variable: "--font-naira",
  display: "swap",
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+20A6" }],
});

// Link preview (T10.2). `metadataBase` turns the relative image and page URL into absolute ones,
// which WhatsApp and X need. The icons need no entry here: Next picks up app/icon.svg,
// app/favicon.ico and app/apple-icon.png by file name. Share links put the calculation in the
// #hash, which crawlers never fetch, so every link previews the same site image (D4).
const OG_IMAGE = {
  url: OG_IMAGE_PATH,
  width: OG_IMAGE_SIZE.width,
  height: OG_IMAGE_SIZE.height,
  alt: OG_IMAGE_ALT,
  type: "image/png",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  // Share links and test URLs (`?v=1`) all point at the one page, so say which URL is the real one.
  alternates: { canonical: "/" },
  // Search Console ownership tag (T10.5). Nothing is rendered until a token is set in config.
  ...(GOOGLE_SITE_VERIFICATION === ""
    ? {}
    : { verification: { google: GOOGLE_SITE_VERIFICATION } }),
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    locale: OG_LOCALE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    site: X_HANDLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

// `cover` lets the page draw under the iOS notch and home indicator, which is what makes
// env(safe-area-inset-*) non-zero. The damage meter pads itself by those insets (DESIGN §4).
export const viewport: Viewport = {
  viewportFit: "cover",
  // Danfo yellow, so the phone's toolbar matches the header band (T10.2 follow-up).
  themeColor: THEME_COLOR,
};

// Umami (T10.3). `null` until a site ID is set in config, so no script is added and `track()` does
// nothing. The attributes keep the #hash (the share link) out of the pageview URL and limit sending
// to the real host. The script and its events go through this site's own origin (T10.4), so
// Umami's hostnames never appear in the page. `afterInteractive` keeps it off the critical path.
const umami = umamiScriptProps(ANALYTICS_SITE_ID, ANALYTICS_SCRIPT_SRC, SITE_URL);

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bungee.variable} ${spaceMono.variable} ${naira.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {umami !== null && <Script strategy="afterInteractive" {...umami} />}
      </body>
    </html>
  );
}