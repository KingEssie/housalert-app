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
  const textColor = invert ? "#ffffff" : "#111111";
  const accentColor = invert ? "#ffffff" : "#bbadfb";

  return (
    <svg
      height={h}
      viewBox="0 0 148 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`block flex-shrink-0 ${className}`}
      aria-label="HousAlert"
      data-testid="img-housalert-logo"
    >
      <line x1="8" y1="24" x2="16" y2="4" stroke={accentColor} strokeWidth="2.8" strokeLinecap="round" />
      <text
        x="22"
        y="20"
        fill={textColor}
        fontSize="15"
        fontWeight="800"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
        letterSpacing="0.06em"
      >
        HOUSALERT
      </text>
    </svg>
  );
}

export { logoSrc };
