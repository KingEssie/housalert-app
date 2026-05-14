import logoSrc from "@assets/4AFC371A-6456-4EEB-9CC2-7A2666B4AAEC_1778720699340.png";

interface HousAlertLogoProps {
  size?: number;
  height?: number;
  className?: string;
  showText?: boolean;
  textClassName?: string;
  invert?: boolean;
}

export function HousAlertLogo({ size = 28, height, className = "", invert = false }: HousAlertLogoProps) {
  const h = height ?? size;
  return (
    <img
      src={logoSrc}
      alt="HousAlert"
      className={`object-contain block ${className}`}
      style={{
        height: h,
        width: "auto",
        filter: invert ? "invert(1)" : "none",
        mixBlendMode: invert ? "screen" : "multiply",
      }}
      data-testid="img-housalert-logo"
    />
  );
}

export { logoSrc };
