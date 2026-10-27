import localFont from "next/font/local";

export const figtree = localFont({
  src: [
    { path: "../fonts/figtree-latin-wght-normal.woff2", weight: "300 900", style: "normal" },
    { path: "../fonts/figtree-latin-ext-wght-normal.woff2", weight: "300 900", style: "normal" },
  ],
  variable: "--font-figtree",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Arial", "sans-serif"],
});

export const bricolage = localFont({
  src: [
    { path: "../fonts/bricolage-grotesque-latin-wght-normal.woff2", weight: "200 800", style: "normal" },
    { path: "../fonts/bricolage-grotesque-latin-ext-wght-normal.woff2", weight: "200 800", style: "normal" },
  ],
  variable: "--font-bricolage",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
});
