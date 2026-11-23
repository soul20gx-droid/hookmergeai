import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "HookMerge AI — Turn any reference video into your next viral script",
    template: "%s · HookMerge AI",
  },
  description:
    "HookMerge AI analyses the storytelling mechanics of any reference video and writes an original, high-retention short-form script for your niche — using your own AI API key.",
  applicationName: "HookMerge AI",
  keywords: [
    "viral script generator",
    "YouTube Shorts script",
    "TikTok script",
    "Instagram Reels script",
    "AI script writer",
  ],
};

export const viewport: Viewport = {
  themeColor: "#08080D",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-ink-950 font-sans">{children}</body>
    </html>
  );
}
