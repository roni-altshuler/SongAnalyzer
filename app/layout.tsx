import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Song Lyric Analyzer",
  description: "Analyze song lyrics to determine mood, vibe, and emotional insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
