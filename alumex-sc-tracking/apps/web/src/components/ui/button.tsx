import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2379d1] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-55 min-h-[35px] px-3 py-2",
  {
    variants: {
      variant: {
        default: "border border-[#cdd9e6] bg-white text-[#18527e] hover:bg-[#f0f6fd]",
        primary: "border border-blue-primary bg-blue-primary text-white hover:bg-blue-hover",
        subtle: "border-transparent bg-transparent text-[#456078] hover:bg-[#eef4fa]",
        ghost: "border-transparent bg-transparent hover:bg-[#eef4fa] text-sub",
      },
      size: {
        default: "min-h-[35px] px-3",
        sm: "min-h-[30px] px-2 py-1",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";
