import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    // h-9 to match icon buttons and default buttons.
    return (
      <input
        type={type}
        className={cn(
          "flex h-[52px] w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-4 text-[16px] font-medium text-[#1F2937] ring-0 ring-offset-0 placeholder:text-[#6B7280] placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6EFD]/20 focus-visible:border-[#0D6EFD] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground disabled:cursor-not-allowed disabled:opacity-50 transition-all",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
