import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[120px] w-full rounded-xl border-0 bg-[#F3F4F8] px-4 py-3.5 text-[15px] text-[#1B2A4A] ring-0 ring-offset-0 placeholder:text-[#9BA5B7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF]/20 focus-visible:bg-white disabled:cursor-not-allowed disabled:opacity-50 transition-all",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
