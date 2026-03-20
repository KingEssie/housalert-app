import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white border-0",
        destructive:
          "bg-destructive text-destructive-foreground border border-destructive-border",
        outline:
          "border-2 border-[#0D6EFD] bg-white text-[#0D6EFD] hover:bg-[#EBF2FF]",
        secondary: "border border-[#E5E7EB] bg-white text-[#222222] hover:bg-[#F5F7FA]",
        ghost: "border border-transparent hover:bg-[#F5F7FA]",
        banner: "bg-white text-[#222222] hover:bg-[#F3F4F6] border-0 font-medium",
      },
      size: {
        default: "min-h-[52px] px-7 py-3.5",
        sm: "min-h-8 rounded-full px-4 text-xs",
        lg: "min-h-[56px] rounded-full px-8",
        icon: "h-9 w-9",
        compact: "min-h-[44px] px-5 py-2 text-[14px]",
        save: "min-h-[52px] w-[180px] px-6",
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
