/* eslint-disable @next/next/no-img-element */

type Props = {
  variant?: "color" | "white" | "dark";
  className?: string;
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
};

const sizes = {
  sm: { width: 90, height: 36 },
  md: { width: 140, height: 56 },
  lg: { width: 200, height: 80 },
};

/**
 * VIFM Official Logo - uses brand kit images.
 * - "color": Primary color logo (blue V + dark IFM + tagline) - for light backgrounds
 * - "white": White logo (inverted from black) - for dark backgrounds (sidebar, login panel)
 * - "dark": Black monochrome - for light backgrounds without color
 */
export function VifmLogo({
  variant = "color",
  className,
  size = "md",
  showTagline = false,
}: Props) {
  const { width, height } = sizes[size];

  // "white" variant: use the black logo and invert it via CSS filter
  // "color" variant: use the color logo directly
  // "dark" variant: use the black logo directly
  const src =
    variant === "color"
      ? "/images/vifm-logo-light.png"
      : "/images/vifm-logo-dark.png";

  const style: React.CSSProperties = {
    width,
    height: "auto",
    maxHeight: height,
    objectFit: "contain",
    ...(variant === "white" ? { filter: "brightness(0) invert(1)" } : {}),
  };

  return (
    <div className={className}>
      <img
        src={src}
        alt="VIFM - Virginia Institute of Finance and Management"
        width={width}
        height={height}
        style={style}
      />
      {showTagline && (
        <p className="text-[10px] opacity-60 mt-0.5">Talent Intelligence Platform</p>
      )}
    </div>
  );
}
