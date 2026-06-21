import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BioDegradableAI — The AI That Forgets.",
  description:
    "Anonymous, ephemeral AI sessions. No login. No history. No record of this conversation ever existing.",
  icons: { icon: "/assets/logo.svg" },
  robots: { index: true, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=DM+Mono:ital,wght@0,300;0,400;0,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
