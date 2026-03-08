import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[120px] w-full rounded-lg border-0 bg-[var(--yo-surface)] px-4 py-4 text-[16px] font-medium text-[var(--yo-dark)] ring-0 ring-offset-0 placeholder:text-[var(--yo-dark)] placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--yo-teal)]/15 focus-visible:bg-white disabled:cursor-not-allowed disabled:opacity-50 transition-all",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
