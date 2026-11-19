import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/shared/theme-provider";

export const metadata: Metadata = {
  title: "Ideal Invoicing",
  description: "Business management for Ideal Events Hire",
  appleWebApp: { capable: true, title: "Ideal", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#800020",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
