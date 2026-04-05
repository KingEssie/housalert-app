import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[120px] w-full rounded-[6px] border border-[#E5E7EB] bg-white px-4 py-3 text-[16px] font-medium text-ha-text placeholder:text-ha-text-muted placeholder:font-normal focus:border-[#FF385C] focus:ring-1 focus:ring-[#FF385C]/25 outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
