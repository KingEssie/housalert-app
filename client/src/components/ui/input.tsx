import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-[56px] w-full rounded-[6px] border border-[#E5E7EB] bg-white px-4 py-3 text-[16px] font-medium text-ha-text placeholder:text-ha-text-muted placeholder:font-normal file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus:border-[#e91e63] focus:ring-1 focus:ring-[#e91e63]/25 outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50",
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
