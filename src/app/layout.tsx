import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Parachute | Collaborative AI Agent Workspace",
  description:
    "One workspace. Many developers. Infinite AI agents. Collaborate in real-time with AI coding agents, orchestrated by a single intelligent swarm controller.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-[#020202] text-white`}
        suppressHydrationWarning
      >
        <div className="bg-noise" />
        {children}
      </body>
    </html>
  );
}
