import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { NavBar } from "@/components/NavBar";
import { MentionBadgeProvider } from "@/components/MentionBadgeProvider";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mila Ventures — Weekly Updates",
  description: "Internal weekly update tracker for the Mila Ventures team",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <MentionBadgeProvider>
          <NavBar />
          <main className="flex-1">{children}</main>
          <Toaster position="bottom-right" richColors />
        </MentionBadgeProvider>
      </body>
    </html>
  );
}
