import { VifmLogo } from "@/components/shared/vifm-logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary items-center justify-center p-12">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-8">
            <VifmLogo variant="white" size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-primary-foreground mb-3">
            Assessment Center
          </h1>
          <p className="text-primary-foreground/70 text-sm leading-relaxed">
            Virginia Institute of Finance and Management — Professional
            assessment center platform for leadership evaluation and talent
            development across the GCC and MENA region.
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
