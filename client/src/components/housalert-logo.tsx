import logoSrc from "@assets/06CC2246-251F-489D-9B2B-D22F45324AEE_1775477564051.png";

interface HousAlertLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  textClassName?: string;
}

export function HousAlertLogo({ size = 28, className = "", showText = true, textClassName }: HousAlertLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={logoSrc}
        alt="HousAlert"
        width={size}
        height={size}
        className="object-contain"
        style={{ width: size, height: size, borderRadius: size >= 32 ? 10 : 6 }}
        data-testid="img-housalert-logo"
      />
      {showText && (
        <span
          className={textClassName || "font-medium text-ha-text text-[15px]"}
          data-testid="text-logo"
        >
          HousAlert
        </span>
      )}
    </div>
  );
}

export { logoSrc };
