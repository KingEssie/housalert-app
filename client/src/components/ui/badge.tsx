import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "whitespace-nowrap inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#673DE5] text-white",
        secondary: "border-transparent bg-[#F3F4F6] text-[#111827]",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "border border-[#E5E7EB] text-[#111827]",
        neon: "border-transparent bg-[#CBFF02] text-[#000000] font-medium",
        dark: "border-transparent bg-[#110C29] text-white font-medium",
        purple: "border-transparent bg-[#471EA7] text-white font-medium",
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
