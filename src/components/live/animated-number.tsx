"use client";

import { motion, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";

/** Sayı değişimini yumuşak sayar (devir göstergesi gibi). Erişilebilir değer olarak gerçek sayı okunur. */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const reduceMotion = useReducedMotion();
  const spring = useSpring(value, reduceMotion ? { duration: 0 } : { stiffness: 160, damping: 22 });
  const rounded = useTransform(spring, (v) => Math.round(v).toString());

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return (
    <motion.span className={className} aria-label={String(value)}>
      {rounded}
    </motion.span>
  );
}
