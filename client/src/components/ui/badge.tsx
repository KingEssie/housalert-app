import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "whitespace-nowrap inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#2DD4BF] text-white",
        secondary: "border-transparent bg-[var(--yo-surface)] text-[var(--yo-dark)]",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "border border-[var(--yo-divider)] text-[var(--yo-dark)]",
        neon: "border-transparent bg-[#2DD4BF] text-[#000000] font-medium",
        dark: "border-transparent bg-[#1A1A1A] text-white font-medium",
        purple: "border-transparent bg-[#1A8A7D] text-white font-medium",
        success: "border-transparent bg-[#8BEA63] text-[var(--yo-dark)] font-medium",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants }
