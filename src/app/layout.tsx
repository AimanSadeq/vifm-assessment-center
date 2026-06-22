import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import { cn } from "@/lib/utils";
import { I18nProvider } from "@/lib/i18n/provider";
import { Toaster } from "sonner";
import { RecoveryRedirect } from "@/components/shared/recovery-redirect";
import { SessionIndicator } from "@/components/shared/session-indicator";
import { GuidedDemo } from "@/components/shared/guided-demo/guided-demo";
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
      <head>
        {/* Runs before the body paints: if a password-recovery token is present
            in the URL hash, jump straight to the set-password page so the portal
            never flashes. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(location.hash.indexOf('type=recovery')!==-1&&location.pathname!=='/update-password'){location.replace('/update-password'+location.hash);}}catch(e){}})();",
          }}
        />
      </head>
      <body className="antialiased">
        <RecoveryRedirect />
        <SessionIndicator />
        <I18nProvider>{children}</I18nProvider>
        <GuidedDemo />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
