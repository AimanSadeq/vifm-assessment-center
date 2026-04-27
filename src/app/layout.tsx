import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import { cn } from "@/lib/utils";
import { I18nProvider } from "@/lib/i18n/provider";
import { Toaster } from "sonner";
import "./globals.css";

const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "VIFM Assessment Center",
  description:
    "Assessment Center management platform by Virginia Institute of Finance and Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" className={cn("font-sans", openSans.variable)}>
      <body className="antialiased">
        <I18nProvider>{children}</I18nProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
