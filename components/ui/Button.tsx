"use client";
import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";
import { sfx, type SfxName } from "@/engine/audio/audio";
import { haptic } from "@/engine/juice/haptics";

type Variant = "primary" | "secondary" | "ghost" | "glass" | "gold";
type Size = "sm" | "md" | "lg" | "xl";

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  size?: Size;
  sound?: SfxName | null;
  children?: React.ReactNode;
  block?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white shadow-[0_6px_0_0_rgba(0,0,0,0.18),0_12px_24px_-8px_var(--accent)]",
  secondary: "bg-surface text-ink border border-line shadow-soft",
  ghost: "bg-transparent text-ink hover:bg-surface-2",
  glass: "hud-chip",
  gold: "bg-gold text-[#2a1e00] shadow-[0_6px_0_0_rgba(0,0,0,0.18),0_12px_24px_-8px_var(--gold)]",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm rounded-xl gap-1.5",
  md: "h-11 px-5 text-base rounded-2xl gap-2",
  lg: "h-14 px-7 text-lg rounded-[20px] gap-2.5",
  xl: "h-16 px-9 text-xl rounded-[22px] gap-3",
};

/** Springy button with built-in click sound + haptic tick. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", sound = "tap", className = "", children, onClick, block, disabled, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileHover={disabled ? undefined : { scale: 1.03, y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.93, y: 2 }}
      transition={{ type: "spring", stiffness: 600, damping: 22 }}
      className={`inline-flex select-none items-center justify-center font-display font-semibold tracking-tight outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent-2 disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${block ? "w-full" : ""} ${className}`}
      disabled={disabled}
      onClick={(e) => {
        sfx.unlock();
        if (sound) sfx.play(sound);
        haptic("tick");
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </motion.button>
  );
});

export function IconButton({
  label,
  className = "",
  variant = "glass",
  size = 44,
  ...rest
}: Omit<ButtonProps, "size"> & { label: string; size?: number }) {
  return (
    <Button
      aria-label={label}
      title={label}
      variant={variant}
      className={`!h-auto !rounded-full !px-0 ${className}`}
      style={{ width: size, height: size }}
      {...rest}
    />
  );
}
