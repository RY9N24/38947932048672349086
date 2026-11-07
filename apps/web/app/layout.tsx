import type { Metadata } from "next";
import localFont from "next/font/local";
import "./style.css";
const sans = localFont({
  src: [
    { path: "./fonts/IBMPlexSans-Regular.woff2", weight: "400" },
    { path: "./fonts/IBMPlexSans-Medium.woff2", weight: "500" },
    { path: "./fonts/IBMPlexSans-SemiBold.woff2", weight: "600" },
  ],
  variable: "--plex-sans",
  display: "swap",
});
const condensed = localFont({
  src: [
    { path: "./fonts/IBMPlexSansCondensed-Medium.woff2", weight: "500" },
    { path: "./fonts/IBMPlexSansCondensed-SemiBold.woff2", weight: "600" },
  ],
  variable: "--plex-condensed",
  display: "swap",
});
const mono = localFont({
  src: [
    { path: "./fonts/IBMPlexMono-Regular.woff2", weight: "400" },
    { path: "./fonts/IBMPlexMono-Medium.woff2", weight: "500" },
    { path: "./fonts/IBMPlexMono-SemiBold.woff2", weight: "600" },
  ],
  variable: "--plex-mono",
  display: "swap",
});
export const metadata: Metadata = {
  title: "Честный раунд — платформа соревнований",
  description:
    "Контесты, дуэли и командный зачёт. Запись решения и судейский протокол.",
  icons: { icon: "/favicon.svg" },
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ru"
      className={`${sans.variable} ${condensed.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
