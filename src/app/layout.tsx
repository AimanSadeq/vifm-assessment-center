import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import { cn } from "@/lib/utils";
import { cookies } from "next/headers";
import { I18nProvider } from "@/lib/i18n/provider";
import { LOCALE_COOKIE } from "@/lib/i18n/cookie";
import { LOCALE_AWARE_PREFIXES, LOCALE_EXCLUDED_PREFIXES } from "@/lib/i18n/locale-routes";
import { Toaster } from "sonner";
import { RecoveryRedirect } from "@/components/shared/recovery-redirect";
import { SessionIndicator } from "@/components/shared/session-indicator";
import { GuidedDemo } from "@/components/shared/guided-demo/guided-demo";
import "./globals.css";

const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "VIFM Talent Intelligence",
  description:
    "Talent intelligence platform by Virginia Institute of Finance and Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialLocale = cookies().get(LOCALE_COOKIE)?.value ?? null;
  // I18N-03: set dir/lang BEFORE the body paints, from the same route list the
  // I18nProvider uses, so an Arabic user never sees the page flash
  // left-to-right first. Only reads document.cookie + location.pathname.
  const localeScript =
    "(function(){try{var m=document.cookie.match(/(?:^|;\\s*)" + LOCALE_COOKIE + "=([^;]+)/);" +
    "if(!m||m[1]!=='ar')return;var p=location.pathname;" +
    "var no=" + JSON.stringify(LOCALE_EXCLUDED_PREFIXES) + ";var yes=" + JSON.stringify(LOCALE_AWARE_PREFIXES) + ";" +
    "for(var i=0;i<no.length;i++){if(p.indexOf(no[i])===0)return;}" +
    "for(var j=0;j<yes.length;j++){if(p.indexOf(yes[j])===0){var d=document.documentElement;d.dir='rtl';d.lang='ar';return;}}" +
    "}catch(e){}})();";
  return (
    <html lang="en" dir="ltr" className={cn("font-sans", openSans.variable)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: localeScript }} />
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
        <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>
        <GuidedDemo />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
