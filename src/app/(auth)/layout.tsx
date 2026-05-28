import { VifmLogo } from "@/components/shared/vifm-logo";
import { getServerT } from "@/lib/i18n/server";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getServerT();
  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div
        className="hidden lg:flex lg:w-1/2 items-center justify-center p-12"
        style={{ background: "radial-gradient(ellipse at 60% 40%, #121140 0%, #010131 70%)" }}
      >
        <div className="max-w-md text-center">
          <div className="mx-auto mb-8">
            <VifmLogo variant="white" size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-primary-foreground mb-3">
            {t("authPublic.brand.title")}
          </h1>
          <p className="text-primary-foreground/70 text-sm leading-relaxed">
            {t("authPublic.brand.tagline")}
          </p>
        </div>
      </div>
      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
