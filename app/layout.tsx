import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LRTB",
  description:
    "Interactive tool for correcting perspective distortion in photos",
  manifest: "/manifest.json",
  themeColor: "#27272A",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LRTB",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon-192.jpg" />
        <link rel="apple-touch-icon" href="/icon-192.jpg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="font-sans antialiased dark">{children}</body>
    </html>
  );
}
