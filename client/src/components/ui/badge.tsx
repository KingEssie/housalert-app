import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "whitespace-nowrap inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#F7F7F7] text-[#111111]",
        secondary: "border-transparent bg-[#F7F7F7] text-[#111111]",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "border border-[#E5E7EB] text-[#111111]",
        neon: "border-transparent bg-ha-primary/5 text-[#FF385C] font-medium",
        dark: "border-transparent bg-[#111111] text-white font-medium",
        purple: "border-transparent bg-ha-primary/5 text-[#FF385C] font-medium",
        success: "border-transparent bg-ha-success/10 text-ha-success font-medium",
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
