import * as React from "react";

import { cn } from "@/lib/utils";

/** Classes compartilhadas por Input, Textarea e SelectTrigger. */
export const fieldClasses =
  "w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-xs ring-offset-background transition-[border-color,box-shadow] duration-fast ease-out placeholder:text-muted-foreground hover:border-foreground/25 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/20";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 py-2 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          fieldClasses,
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
