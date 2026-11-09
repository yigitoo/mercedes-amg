/**
 * Sürüş sırasında nabzın basit fizyolojik modeli.
 *
 *   hedef nabız = dinlenme nabzı + pist yoğunluğu × sürücünün tepkiselliği + anlık heyecan
 *   gerçek nabız, hedefe birinci dereceden gecikmeyle yaklaşır (kalp anında tepki vermez, ~6-10 sn).
 *
 * Pist yoğunluğu bir tur döngüsüdür: düzlükte gaz (yükselir), frenleme/viraj (tepe), çıkış (iner).
 * Arada rastgele "an"lar olur (kayma, son anda fren): kısa ama sert bir sıçrama, sonra söner.
 */

export interface DriverProfile {
  /** Dinlenme nabzı. */
  restingBpm: number;
  /** Pistteki en yüksek yoğunlukta dinlenmeye eklenen nabız. */
  reactivity: number;
  /** Tur süresi (sn); her sürücü farklı hızda. */
  lapSeconds: number;
  /** Tur içindeki başlangıç noktası (0..1); araçlar aynı anda aynı virajda olmasın. */
  phase: number;
}

/** Tekrarlanabilir rastgelelik: aynı tohum, aynı sürüş. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

export function randomProfile(random: () => number): DriverProfile {
  return {
    restingBpm: 64 + random() * 20,
    reactivity: 45 + random() * 55,
    lapSeconds: 70 + random() * 50,
    phase: random(),
  };
}

/** Tur içindeki konuma göre pist yoğunluğu (0..1). */
function trackIntensity(lapPosition: number): number {
  // İki düzlük + iki viraj kompleksi: yumuşak dalga, virajlarda keskin tepe.
  const wave = 0.5 - 0.5 * Math.cos(lapPosition * 4 * Math.PI);
  const corner = Math.exp(-(((lapPosition % 0.5) - 0.38) ** 2) / 0.002);
  return Math.min(1, 0.35 + 0.4 * wave + 0.35 * corner);
}

const RESPONSE_SECONDS = 7;
const MOMENT_CHANCE_PER_SECOND = 0.012;
const MOMENT_DECAY_PER_SECOND = 0.9;

export class HeartModel {
  private readonly profile: DriverProfile;
  private readonly random: () => number;
  private bpm: number;
  private excitement = 0;
  private elapsed = 0;

  // Not: Node'un yerleşik TypeScript desteği constructor parametre özelliklerini (private x) desteklemez.
  constructor(profile: DriverProfile, random: () => number) {
    this.profile = profile;
    this.random = random;
    this.bpm = profile.restingBpm + 10;
  }

  /** Modeli `dtSeconds` ilerletir ve ölçülen nabzı döner (bileklik gürültüsüyle, tam sayı). */
  step(dtSeconds: number): number {
    this.elapsed += dtSeconds;
    const { restingBpm, reactivity, lapSeconds, phase } = this.profile;

    // İlk dakikada ısınma: araca yeni binen sürücü sakin başlar.
    const warmup = Math.min(1, this.elapsed / 60);
    const lapPosition = (this.elapsed / lapSeconds + phase) % 1;
    const intensity = trackIntensity(lapPosition) * warmup;

    if (this.random() < MOMENT_CHANCE_PER_SECOND * dtSeconds) this.excitement += 18 + this.random() * 22;
    this.excitement *= MOMENT_DECAY_PER_SECOND ** dtSeconds;

    const target = restingBpm + intensity * reactivity + this.excitement;
    this.bpm += (target - this.bpm) * (1 - Math.exp(-dtSeconds / RESPONSE_SECONDS));

    const sensorNoise = (this.random() - 0.5) * 4;
    return Math.round(Math.min(215, Math.max(45, this.bpm + sensorNoise)));
  }
}
