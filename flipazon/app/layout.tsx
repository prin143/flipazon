import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flipazon | Shop more. Save more.",
  description: "Flipazon — a modern shopping experience. Discover deals on electronics, fashion, home and more.",
  icons: { icon: "/brand/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
