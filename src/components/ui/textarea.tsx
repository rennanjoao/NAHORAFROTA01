import * as React from "react";

import { cn } from "@/lib/utils";
import { fieldClasses } from "./input";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return <textarea className={cn("flex min-h-[88px] py-2.5 leading-relaxed", fieldClasses, className)} ref={ref} {...props} />;
});
Textarea.displayName = "Textarea";

export { Textarea };
