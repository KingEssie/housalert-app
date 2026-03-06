import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    // h-9 to match icon buttons and default buttons.
    return (
      <input
        type={type}
        className={cn(
          "flex h-[52px] w-full rounded-xl border-0 bg-[#F3F4F8] px-4 py-3 text-[15px] font-medium text-[#1B2A4A] ring-0 ring-offset-0 placeholder:text-[#7A8599] placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF]/15 focus-visible:bg-[#FAFBFC] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground disabled:cursor-not-allowed disabled:opacity-50 transition-all",
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
