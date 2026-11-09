import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  // AMG Red yalnızca birincil eylemde: "AMG Red is used to activate."
  primary: "bg-amg text-white hover:bg-amg-hover",
  secondary: "border border-line-strong bg-raised text-fg hover:border-soft",
  ghost: "text-soft hover:bg-raised hover:text-fg",
  danger: "border border-amg/60 text-amg-text hover:bg-amg hover:text-white",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
}

export function buttonClasses({ variant = "secondary", size = "md", className }: Pick<ButtonProps, "variant" | "size" | "className">) {
  return cn(
    "inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm font-title font-bold whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
    size === "sm" ? "h-9 px-3 text-sm" : "h-11 px-5 text-[0.95rem]",
    VARIANTS[variant],
    className,
  );
}

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}
