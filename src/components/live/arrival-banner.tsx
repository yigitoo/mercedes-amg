"use client";

import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { useEffect, useState } from "react";

import type { Arrival } from "./use-live-feed";

const HOLD_MS = 6_000;
/** Bu süreden eski gelişler sıraya girmez (ekran uzun süre arka planda kaldıysa birikmesin). */
const MAX_AGE_MS = 60_000;
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Yarışçı tanıtımı: yeni sürücü bindiğinde sol altta, yarış yayınlarındaki sürücü tanıtım grafiği gibi.
 *   1. kırmızı eğik blok ekranı yararak girer
 *   2. içinde büyük araç numarası belirir
 *   3. ad ince, SOYAD kalın; harfler tek tek düşer
 *   4. altında kırmızı çizgi soldan sağa çizilir, plaka ve model gelir
 * Aynı anda birden fazla biniş olursa sırayla gösterilir. Azaltılmış harekette yalnız solarak gelir.
 */
export function ArrivalBanner({ arrivals }: { arrivals: Arrival[] }) {
  const reduceMotion = useReducedMotion() ?? false;
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set());
  const [clock, setClock] = useState(0);
  const current = arrivals.find((a) => !shown.has(a.key) && clock - a.at < MAX_AGE_MS);

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => {
      setShown((prev) => new Set(prev).add(current.key));
      setClock(Date.now());
    }, HOLD_MS);
    return () => clearTimeout(timer);
  }, [current]);

  // Yeni geliş eklendiğinde yaş kontrolü için saati tazele.
  useEffect(() => {
    const timer = setTimeout(() => setClock(Date.now()), 0);
    return () => clearTimeout(timer);
  }, [arrivals.length]);

  return (
    <div className="pointer-events-none fixed bottom-12 left-6 z-30 xl:bottom-16 xl:left-8" aria-live="polite">
      <AnimatePresence mode="wait">{current && <DriverIntro key={current.key} arrival={current} reduceMotion={reduceMotion} />}</AnimatePresence>
    </div>
  );
}

function DriverIntro({ arrival, reduceMotion }: { arrival: Arrival; reduceMotion: boolean }) {
  // Büyük harf JS ile ve Türkçe kurallarla (CSS uppercase tr dilinde "i"yi doğru çevirir ama burada kontrol bizde).
  const lastName = arrival.driver.lastName.toLocaleUpperCase("tr-TR");
  const number = String(arrival.slot).padStart(2, "0");

  if (reduceMotion) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-[var(--radius-card)] bg-ink/95 p-6">
        <p className="font-label text-xs font-bold tracking-[0.28em] text-amg-text uppercase">Sürüşe başladı · {number}</p>
        <p className="mt-2 font-title text-5xl font-extrabold">
          {arrival.driver.firstName} {lastName}
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="relative flex items-stretch overflow-hidden rounded-[var(--radius-card)] shadow-[0_30px_80px_rgba(0,0,0,0.7)]"
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={{ hidden: {}, visible: {}, exit: { x: "-115%", skewX: -8, transition: { duration: 0.45, ease: [0.7, 0, 0.84, 0] } } }}
    >
      {/* 1. Kırmızı eğik blok: ekranı yararak girer, araç numarasını taşır */}
      <motion.div
        className="relative z-10 flex items-center bg-amg pr-10 pl-7 [clip-path:polygon(0_0,100%_0,calc(100%-1.75rem)_100%,0_100%)]"
        variants={{ hidden: { x: "-100%" }, visible: { x: 0, transition: { duration: 0.45, ease: EASE } } }}
      >
        <motion.span
          className="font-title text-[5.5rem] leading-none font-extrabold tracking-[-0.04em] text-white tabular"
          variants={{ hidden: { opacity: 0, scale: 1.6 }, visible: { opacity: 1, scale: 1, transition: { delay: 0.3, duration: 0.5, ease: EASE } } }}
        >
          {number}
        </motion.span>
      </motion.div>

      {/* 2. Koyu gövde: bloğun arkasından açılır */}
      <motion.div
        className="-ml-7 flex min-w-[26rem] flex-col justify-center bg-ink/95 py-5 pr-12 pl-14 backdrop-blur"
        style={{ originX: 0 }}
        variants={{ hidden: { scaleX: 0 }, visible: { scaleX: 1, transition: { delay: 0.2, duration: 0.55, ease: EASE } } }}
      >
        <motion.p
          className="font-label text-xs font-bold tracking-[0.3em] text-amg-text uppercase"
          variants={fadeUp(0.55)}
        >
          Sürüşe başladı
        </motion.p>

        {/* 3. Ad ince, SOYAD kalın; harfler tek tek düşer */}
        <p className="mt-1 flex items-baseline gap-4 overflow-hidden pb-1 leading-[1.05] whitespace-nowrap">
          <Letters text={arrival.driver.firstName} delay={0.65} className="font-title text-5xl font-light" />
          <Letters text={lastName} delay={0.8} className="font-title text-5xl font-extrabold tracking-[-0.01em]" />
        </p>

        {/* 4. Kırmızı çizgi + plaka / model */}
        <motion.span
          className="mt-3 block h-[3px] w-full bg-amg"
          style={{ originX: 0 }}
          variants={{ hidden: { scaleX: 0 }, visible: { scaleX: 1, transition: { delay: 1.1, duration: 0.7, ease: EASE } } }}
          aria-hidden
        />
        <motion.p className="mt-3 font-label text-sm tracking-[0.14em] text-soft uppercase" variants={fadeUp(1.35)}>
          {arrival.plate}
          <span className="mx-2 text-dim">/</span>
          {arrival.model}
        </motion.p>
      </motion.div>

      {/* Sağ kenarda akan AMG şeritleri */}
      <motion.div
        className="absolute inset-y-0 right-0 flex w-24 gap-1.5 pr-3"
        variants={{ hidden: { x: 60, opacity: 0 }, visible: { x: 0, opacity: 1, transition: { delay: 0.9, duration: 0.6, ease: EASE } } }}
        aria-hidden
      >
        {[0.55, 0.38, 0.24, 0.14, 0.07].map((opacity, i) => (
          <span key={i} className="h-full flex-1 -skew-x-[24deg] bg-amg" style={{ opacity }} />
        ))}
      </motion.div>
    </motion.div>
  );
}

function fadeUp(delay: number): Variants {
  return { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { delay, duration: 0.5, ease: EASE } } };
}

/** Harfleri tek tek aşağıdan düşürür (yarış yayını tipografisi). Ekran okuyucu tüm kelimeyi okur. */
function Letters({ text, delay, className }: { text: string; delay: number; className: string }) {
  return (
    <span className={className} aria-label={text}>
      {[...text].map((char, i) => (
        <motion.span
          key={i}
          className="inline-block"
          aria-hidden
          variants={{
            hidden: { y: "110%", opacity: 0 },
            visible: { y: 0, opacity: 1, transition: { delay: delay + i * 0.035, duration: 0.55, ease: EASE } },
          }}
        >
          {char === " " ? " " : char}
        </motion.span>
      ))}
    </span>
  );
}
