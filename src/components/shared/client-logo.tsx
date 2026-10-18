/* eslint-disable @next/next/no-img-element */

// A client's logo on a candidate screen (bundle sign-in and welcome, 00236).
// The path is a file shipped under /client-logos/ (validated server-side), so
// the browser loads it from the platform's own domain.
export function ClientLogo({
  src,
  className = "",
  align = "center",
}: {
  src: string;
  className?: string;
  align?: "center" | "start";
}) {
  return (
    <div className={`flex ${align === "start" ? "justify-start" : "justify-center"} ${className}`}>
      <img src={src} alt="Organization logo" className="h-14 w-auto max-w-full object-contain" />
    </div>
  );
}
