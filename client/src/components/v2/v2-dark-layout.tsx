import { type ReactNode } from "react";

interface V2DarkScreenLayoutProps {
  children: ReactNode;
  className?: string;
}

export function V2DarkScreenLayout({ children, className = "" }: V2DarkScreenLayoutProps) {
  return (
    <div
      className={`min-h-[100dvh] bg-[#1A1A2E] text-white flex flex-col ${className}`}
      data-testid="v2-dark-layout"
    >
      {children}
    </div>
  );
}

interface V2DarkHeaderProps {
  logo?: ReactNode;
  right?: ReactNode;
}

export function V2DarkHeader({ logo, right }: V2DarkHeaderProps) {
  return (
    <header className="w-full sticky top-0 z-20 bg-[#1A1A2E]/95 backdrop-blur-sm">
      <div className="max-w-lg mx-auto px-5 h-[56px] flex items-center justify-between">
        <div className="flex items-center gap-2">{logo}</div>
        {right && <div>{right}</div>}
      </div>
    </header>
  );
}

interface V2DarkContentProps {
  children: ReactNode;
  className?: string;
  center?: boolean;
}

export function V2DarkContent({ children, className = "", center = false }: V2DarkContentProps) {
  return (
    <main
      className={`flex-1 flex flex-col ${center ? "items-center justify-center" : ""} px-6 pb-[max(env(safe-area-inset-bottom),24px)] ${className}`}
    >
      <div className="w-full max-w-[420px] mx-auto">{children}</div>
    </main>
  );
}
