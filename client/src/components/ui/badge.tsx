import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "whitespace-nowrap inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#F5F7FA] text-[#222222]",
        secondary: "border-transparent bg-[#F5F7FA] text-[#222222]",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "border border-[#E5E7EB] text-[#222222]",
        neon: "border-transparent bg-[#EBF2FF] text-[#0D6EFD] font-medium",
        dark: "border-transparent bg-[#0B2A4A] text-white font-medium",
        purple: "border-transparent bg-[#EBF2FF] text-[#0D6EFD] font-medium",
        success: "border-transparent bg-[#F0FDF4] text-[#16A34A] font-medium",
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
