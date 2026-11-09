"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { AMG_PATHS, MercedesStar } from "@/components/brand/logos";
import { ACCELERATION, canPlaySoundNow, playLaunchSound } from "@/lib/launch-sound";

/** Aracın 0-100 süresi: yükleme tam bu sürede dolar, ses de aynı sürede yükselir. */
const ZERO_TO_HUNDRED_MS = 2_700;
/** Final: yıldız önce ekranın tam ortasına kayar (CENTER_SHARE), sonra dönerek büyür. */
const REVEAL_MS = 2_400;
const CENTER_SHARE = 0.26;
const REVEAL_SPIN_DEG = 390;
/**
 * Kaplamanın solması: yıldız büyürken başlar, eşit hızda (yumuşak eğri) ilerler. Kaplama ancak tamamen
 * saydamlaştıktan sonra kaldırılır; canlı ekran (LiveWall) aynı anda netleşerek gelir. Ani geçiş olmaz.
 */
export const OVERLAY_FADE = { delayMs: 900, durationMs: 1_500 } as const;
const SMOOTH = [0.4, 0, 0.2, 1] as const;
const AMG_VIEWBOX = { x: 179.6, y: 226.8, width: 482.3, height: 47.9 };

/** armed: ses izni yok, ilk dokunuşu bekliyor · loading: 0→100 · reveal: yıldız büyür · done: kapandı */
type Phase = "armed" | "loading" | "reveal" | "done";

/**
 * Lansman açılışı (canlı ekran ilk açıldığında): "Lansmana hoş geldiniz", Mercedes-Benz kilidi ve
 * yükleme çubuğu olarak AMG logosu. Logo 0→100 km/s sayacıyla birlikte 2,7 sn'de dolar; dolunca Mercedes
 * yıldızı dönerek büyür, ekranın içinden geçilir ve canlı ekran açılır. Elektrikli motor sesi eşlik eder.
 *
 * Ses güvencesi: tarayıcı etkileşimsiz sese izin vermiyorsa açılış "armed" durumda bekler ve
 * "Başlatmak için dokunun · Enter" gösterir; dolum ve ses ilk dokunuşla birlikte başlar (TV kaydında sessiz kalmaz).
 * İzin varsa (kiosk uygulaması, önceden etkileşim) beklemeden başlar. `?intro=off` açılışı atlar, Esc geçer.
 * Azaltılmış harekette kısa bir karşılama gösterilip solarak geçilir.
 */
export function LaunchIntro({ onReveal }: { onReveal: () => void }) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("armed");
  const starRef = useRef<HTMLDivElement>(null);
  // Yıldızın ekran merkezine uzaklığı; final başlarken ölçülür (her ekran boyutunda tam ortaya gelsin).
  const [toCenter, setToCenter] = useState({ x: 0, y: 0 });
  const progress = useMotionValue(0);
  const speed = useTransform(progress, (p) => String(Math.round(p * 100)));
  const fillWidth = useTransform(progress, (p) => p * AMG_VIEWBOX.width);

  /** Dolum + ses. Bir tıklama/tuş olayından çağrılırsa ses her tarayıcıda çalar. */
  const launch = () => {
    setPhase("loading");
    void playLaunchSound(ZERO_TO_HUNDRED_MS);
    animate(progress, 1, { duration: ZERO_TO_HUNDRED_MS / 1000, ease: ACCELERATION, onComplete: reveal });
  };

  const reveal = () => {
    const rect = starRef.current?.getBoundingClientRect();
    if (rect) setToCenter({ x: window.innerWidth / 2 - (rect.left + rect.width / 2), y: window.innerHeight / 2 - (rect.top + rect.height / 2) });
    setPhase("reveal");
    onReveal(); // canlı ekran yıldız büyürken netleşerek gelir
  };

  /** Açılışı atla: kaplama kalkar, canlı ekran yine yumuşak gelir. */
  const skip = () => {
    setPhase("done");
    onReveal();
  };

  // Açılış kararı: atla, kısa karşılama (azaltılmış hareket), hemen başlat (ses izni var) ya da dokunuş bekle.
  useEffect(() => {
    const decide = setTimeout(() => {
      if (new URLSearchParams(window.location.search).get("intro") === "off") skip();
      else if (reduceMotion) setTimeout(skip, 1_400);
      else if (canPlaySoundNow()) launch();
    }, 0);
    return () => clearTimeout(decide);
    // launch yalnız ilk kararda kullanılır; progress ve setPhase kararlıdır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  useEffect(() => {
    if (phase !== "reveal") return;
    const timer = setTimeout(() => setPhase("done"), Math.max(REVEAL_MS, OVERLAY_FADE.delayMs + OVERLAY_FADE.durationMs) + 100);
    return () => clearTimeout(timer);
  }, [phase]);

  // Klavye/kumanda: beklerken Enter ya da Boşluk başlatır; her an Esc atlar.
  useEffect(() => {
    if (phase === "done") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") skip();
      else if (phase === "armed" && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        launch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === "done") return null;
  const revealing = phase === "reveal";

  return (
    <motion.div
      className={`fixed inset-0 z-50 grid place-items-center overflow-hidden bg-ink ${phase === "armed" ? "cursor-pointer" : ""}`}
      onClick={() => phase === "armed" && launch()}
      initial={{ opacity: 1 }}
      animate={{ opacity: revealing ? 0 : 1 }}
      // Kaplama, yıldız ortalanıp büyümeye başlayınca eşit hızda solar (bkz. OVERLAY_FADE).
      transition={revealing ? { duration: OVERLAY_FADE.durationMs / 1000, delay: OVERLAY_FADE.delayMs / 1000, ease: SMOOTH } : { duration: 0 }}
      role="status"
      aria-label="Lansmana hoş geldiniz"
    >
      <div className="relative flex flex-col items-center">
        {/* Mercedes yıldızı: dolum bitince döner ve büyüyerek ekranı doldurur */}
        <motion.div
          ref={starRef}
          initial={{ opacity: 0, scale: 0.6, rotate: -90 }}
          animate={
            revealing
              ? { opacity: 1, x: [0, toCenter.x, toCenter.x], y: [0, toCenter.y, toCenter.y], scale: [1, 1.25, 30], rotate: [0, 0, REVEAL_SPIN_DEG] }
              : { opacity: 1, scale: 1, rotate: 0 }
          }
          transition={
            revealing
              ? { duration: REVEAL_MS / 1000, times: [0, CENTER_SHARE, 1], ease: [[0.16, 1, 0.3, 1], [0.7, 0, 0.84, 0]] }
              : { duration: 0.9, ease: [0.16, 1, 0.3, 1] }
          }
          className="text-fg"
        >
          <MercedesStar className="size-28 xl:size-36" />
        </motion.div>

        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, y: 16 }}
          animate={revealing ? { opacity: 0, y: -10 } : { opacity: 1, y: 0 }}
          transition={{ duration: revealing ? 0.25 : 0.8, delay: revealing ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="mt-7 font-wordmark text-4xl xl:text-5xl">Mercedes-Benz</p>
          <p className="mt-5 font-title text-2xl font-light tracking-[0.18em] text-soft xl:text-3xl">LANSMANA HOŞ GELDİNİZ</p>

          {/* Yükleme çubuğu: AMG logosu soldan sağa dolar, yanında 0→100 sayacı */}
          <div className="mt-14 flex items-end gap-8">
            <div className="w-[min(26rem,70vw)]">
              <svg viewBox={`${AMG_VIEWBOX.x} ${AMG_VIEWBOX.y} ${AMG_VIEWBOX.width} ${AMG_VIEWBOX.height}`} className="h-auto w-full" aria-hidden>
                <defs>
                  <clipPath id="amg-fill">
                    <motion.rect x={AMG_VIEWBOX.x} y={AMG_VIEWBOX.y} height={AMG_VIEWBOX.height} style={{ width: fillWidth }} />
                  </clipPath>
                </defs>
                <g fill="white" fillOpacity={0.12}>
                  {AMG_PATHS.map((d) => (
                    <path key={d} d={d} />
                  ))}
                </g>
                <g fill="var(--color-fg)" clipPath="url(#amg-fill)">
                  {AMG_PATHS.map((d) => (
                    <path key={d} d={d} />
                  ))}
                </g>
              </svg>
              <motion.span className="mt-4 block h-[3px] origin-left bg-amg" style={{ scaleX: progress }} aria-hidden />
            </div>
            <div className="text-right">
              <p className="font-title text-5xl leading-none font-extrabold tabular" aria-live="off">
                <motion.span>{speed}</motion.span>
                <span className="ml-1 font-label text-base font-normal text-muted">km/s</span>
              </p>
              <p className="mt-2 font-label text-xs tracking-[0.18em] text-muted uppercase">0-100 · 2,7 sn</p>
            </div>
          </div>

          {/* Ses izni yoksa: tek dokunuş dolumu ve sesi birlikte başlatır */}
          <p
            className={`mt-12 flex items-center gap-3 font-label text-sm tracking-[0.2em] text-muted uppercase transition-opacity duration-300 ${phase === "armed" ? "opacity-100" : "opacity-0"}`}
          >
            <span className="size-2 animate-live-dot rounded-full bg-amg" aria-hidden />
            Başlatmak için dokunun · Enter
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
