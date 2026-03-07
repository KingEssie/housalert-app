import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-[#673DE6] hover:bg-[#5B30D6] text-white border-0",
        destructive:
          "bg-destructive text-destructive-foreground border border-destructive-border",
        outline:
          "border border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F8FAFC]",
        secondary: "border border-[#E5E7EB] bg-[#F8FAFC] text-[#1F2937] hover:bg-[#F3F4F6]",
        ghost: "border border-transparent hover:bg-[#F8FAFC]",
      },
      size: {
        default: "min-h-[48px] px-5 py-3.5",
        sm: "min-h-8 rounded-[10px] px-3 text-xs",
        lg: "min-h-[52px] rounded-[14px] px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
