"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Admin sayfa geçişi. `template` her gezinmede yeniden kurulur (layout'tan farklı olarak), yani animasyon
 * yalnız sayfa değişince oynar; AutoRefresh'in arka plan tazelemeleri tetiklemez.
 * Sidebar sabit kalır, yalnız içerik hafif yukarı kayıp netleşerek girer.
 */
export default function PanelTemplate({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, filter: "blur(6px)" }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
