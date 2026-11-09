"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import { GAUGE_RANGE } from "@/domain/heart-rate";
import { cn } from "@/lib/cn";

/** Ekranı bir kez taramak için geçen süre (saniye): monitördeki gibi, her atış tek tek okunur. */
const SWEEP_SECONDS = 4;
/** Tarama imlecinin önünde silinen boşluk (genişliğe oran): yeni iz eskisinin üstüne yazılır. */
const ERASE_GAP = 0.035;
/** Taban çizgisi (yüksekliğe oran) ve R tepesinin en büyük yüksekliği. */
const BASELINE = 0.68;
const MAX_AMPLITUDE = 0.58;
/** Gösterilen nabız gerçek nabza bu hızla yaklaşır (saniye): ölçümler arası sıçrama olmaz. */
const BPM_EASE_SECONDS = 1.5;
const COLOR = "#e8112d";

interface EcgMonitorProps {
  /** Son nabız; null ise sinyal yok, düz çizgi. */
  bpm: number | null;
  redline: boolean;
}

interface TraceState {
  bpm: number | null;
  redline: boolean;
}

/**
 * EKG monitörü: iz soldan sağa taranarak çizilir, imlecin önündeki eski iz silinir (gerçek hasta monitörü gibi).
 * Atış hızı son nabızdan gelir; her atışın aralığı ve yüksekliği hafifçe değişir, taban çizgisi solunumla
 * dalgalanır, sinyalde ince gürültü vardır. Ölçüm gelişinden bağımsız her karede çizilir: duraksama olmaz.
 *
 * Performans: her karede tek yol çizilir; ışıltı canvas gölgesiyle değil, öğenin CSS filtresiyle (GPU) verilir.
 * Azaltılmış harekette tarama yok, durağan bir iz gösterilir.
 */
export function EcgMonitor({ bpm, redline }: EcgMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();
  // Çizim döngüsü her karede günceli okur; prop değişimi döngüyü yeniden başlatmaz.
  const target = useRef<TraceState>({ bpm, redline });
  useEffect(() => {
    target.current = { bpm, redline };
  }, [bpm, redline]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const monitor = new Monitor(target.current.bpm);

    const resize = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (width === canvas.width && height === canvas.height) return;
      canvas.width = width;
      canvas.height = height;
      // Ekran boş başlamasın: iz bir taramalık geçmişle dolu açılır, tarama oradan sürer.
      monitor.fill(context, canvas, target.current, ratio);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    if (reduceMotion) return () => observer.disconnect();

    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      // Sekme arka planda kaldıysa uzun aralık tek seferde çizilmez; iz kaldığı yerden sürer.
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      monitor.advance(context, canvas, dt, target.current, Math.min(2, window.devicePixelRatio || 1));
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [reduceMotion]);

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        "absolute inset-0 h-full w-full transition-[filter] duration-300",
        redline ? "[filter:drop-shadow(0_0_6px_rgb(232_17_45/0.8))]" : "[filter:drop-shadow(0_0_3px_rgb(232_17_45/0.55))]",
      )}
      aria-hidden
    />
  );
}

// ── EKG üreteci ───────────────────────────────────────────────────────────

/** Atış biçimi, saniye cinsinden (nabızdan bağımsız): yumuşak P, keskin QRS, geniş T. Yükseklik 1 = R tepesi. */
function beatShape(t: number): number {
  return (
    gauss(t, 0.08, 0.022, 0.11) + // P
    gauss(t, 0.2, 0.008, -0.12) + // Q
    gauss(t, 0.222, 0.0075, 1) + // R
    gauss(t, 0.245, 0.009, -0.3) + // S
    gauss(t, 0.43, 0.045, 0.24) // T
  );
}
/** Biçimin bittiği an; hızlı nabızda biçim sonraki atışa çakışmayacak kadar daraltılır. */
const BEAT_SECONDS = 0.56;

function gauss(t: number, center: number, width: number, height: number): number {
  const d = (t - center) / width;
  return height * Math.exp(-0.5 * d * d);
}

/** Tek panelin monitör durumu: zaman, gösterilen nabız, o anki atış ve tarama imleci. */
class Monitor {
  private time = 0;
  private shownBpm: number;
  private beatStart = -Math.random(); // paneller aynı anda atmasın
  private beat: { period: number; amplitude: number };
  private x = 0;
  private lastY: number | null = null;

  constructor(bpm: number | null) {
    this.shownBpm = bpm ?? 72;
    this.beat = this.nextBeat();
  }

  /** dt saniye ilerler: önce imlecin önünü siler, sonra yeni dilimi tek yol olarak çizer. */
  advance(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, dt: number, state: TraceState, ratio: number) {
    const { width, height } = canvas;
    const pxPerSecond = width / SWEEP_SECONDS;
    // Piksel başına bir örnek: keskin QRS sivrisi atlanmaz.
    const steps = Math.max(1, Math.round(dt * pxPerSecond));
    const step = dt / steps;
    if (state.bpm != null) this.shownBpm += (state.bpm - this.shownBpm) * Math.min(1, dt / BPM_EASE_SECONDS);

    ctx.lineWidth = (state.redline ? 2.6 : 2) * ratio;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = COLOR;
    ctx.beginPath();
    if (this.lastY != null) ctx.moveTo(this.x, this.lastY);

    for (let i = 0; i < steps; i++) {
      this.time += step;
      const y = height * BASELINE - this.sample(state.bpm != null) * height * MAX_AMPLITUDE;
      this.x += pxPerSecond * step;
      if (this.x >= width) {
        // Kenara gelince yolu bitir, yeni tarama soldan başlar.
        ctx.stroke();
        ctx.beginPath();
        this.x -= width;
        this.lastY = null;
      }
      ctx.clearRect(Math.floor(this.x) + 1, 0, Math.ceil(width * ERASE_GAP), height);
      if (this.lastY == null) ctx.moveTo(this.x, y);
      else ctx.lineTo(this.x, y);
      this.lastY = y;
    }
    ctx.stroke();
  }

  /** Ekranı soldan bir kez doldurur (açılış, boyut değişimi; azaltılmış harekette tek görüntü). */
  fill(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: TraceState, ratio: number) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.x = 0;
    this.lastY = null;
    this.advance(ctx, canvas, SWEEP_SECONDS * 0.97, state, ratio);
  }

  /** Şu anki sinyal: taban dalgalanması + gürültü + (sinyal varsa) atış. */
  private sample(hasSignal: boolean): number {
    const wander = Math.sin(this.time * 2 * Math.PI * 0.25) * 0.025 + Math.sin(this.time * 2 * Math.PI * 0.07) * 0.015;
    const noise = (Math.random() - 0.5) * 0.012;
    let t = this.time - this.beatStart;
    if (!hasSignal) {
      // Sinyal yokken atış saati de ilerler; sinyal dönünce birikmiş atış topluca çizilmez.
      this.beatStart = this.time;
      return noise * 0.5;
    }
    if (t >= this.beat.period) {
      this.beatStart += this.beat.period;
      this.beat = this.nextBeat();
      t = this.time - this.beatStart;
    }
    const squeeze = Math.min(1, (this.beat.period * 0.95) / BEAT_SECONDS);
    return wander + noise + beatShape(t / squeeze) * this.beat.amplitude;
  }

  /** Sıradaki atış: aralık nabızdan, ±%4 doğal oynama (kalp hızı değişkenliği); yükseklik nabızla biraz artar. */
  private nextBeat() {
    const period = (60 / this.shownBpm) * (1 + (Math.random() - 0.5) * 0.08);
    const { min, max } = GAUGE_RANGE;
    const ratio = Math.min(1, Math.max(0, (this.shownBpm - min) / (max - min)));
    const amplitude = (0.72 + ratio * 0.28) * (1 + (Math.random() - 0.5) * 0.12);
    return { period, amplitude };
  }
}
