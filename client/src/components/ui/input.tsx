import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-[56px] w-full rounded-[8px] border border-[#D1D5DB] bg-white px-4 py-3 text-[16px] font-medium text-[#111111] placeholder:text-[#334855] placeholder:opacity-55 placeholder:font-normal file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus:border-ha-primary focus:ring-1 focus:ring-ha-primary/25 outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50",
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
