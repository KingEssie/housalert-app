import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[120px] w-full rounded-[8px] border border-[#D1D5DB] bg-white px-4 py-3 text-[16px] font-medium text-ha-text placeholder:text-ha-text-muted placeholder:font-normal focus:border-ha-primary focus:ring-1 focus:ring-ha-primary/25 outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
