import logoSrc from "@assets/5B9D5117-02CB-4353-8AF3-6CCA9249F824_1773839918481.png";

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
          className={textClassName || "font-semibold text-[#111C3D] text-[15px]"}
          data-testid="text-logo"
        >
          HousAlert
        </span>
      )}
    </div>
  );
}

export { logoSrc };
