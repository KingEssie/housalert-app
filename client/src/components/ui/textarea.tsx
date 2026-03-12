import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[120px] w-full rounded-[20px] border-0 bg-[#F3F4F6] px-5 py-4 text-[16px] font-medium text-[#111827] ring-0 ring-offset-0 placeholder:text-[#9CA3AF] placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6EFD]/20 disabled:cursor-not-allowed disabled:opacity-50 transition-all",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
