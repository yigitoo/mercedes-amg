/**
 * Elektrikli AMG hızlanma sesi, ses dosyası olmadan Web Audio ile sentezlenir. Katmanlar:
 *
 *   kalkış darbesi   torkun geldiği an kısa, derin bir "tok"
 *   motor ıslığı     invertör/motor harmonikleri (1×, 2×, 3,2× motor dereceleri), hafif detune ve titreşimle
 *   güç tonu         AMG elektrikli modellerinin sentetik alt tonu, yumuşak doygunluk
 *   yol uğultusu     kahverengi gürültü, hızla açılan alçak geçiren filtre
 *   rüzgâr           beyaz gürültü, hızın karesiyle artar
 *   geçiş            dolum bitince Doppler düşüşü, sesi soldan sağa geçirip uzaklaştırır
 *   ortam            sentetik yankı (convolver) + kompresör
 *
 * Hız eğrisi görseldeki dolumla aynı fonksiyondan (ACCELERATION) üretilir: ses ve AMG çubuğu senkron ilerler.
 *
 * Tarayıcılar kullanıcı etkileşimi olmadan sesi engeller (autoplay politikası). Bu yüzden:
 *   - `canPlaySoundNow()` sayfa açılırken izin olup olmadığını söyler (açılış buna göre bekler ya da başlar);
 *   - `playLaunchSound()` bir tıklama/tuş olayının içinden çağrılırsa her tarayıcıda çalar.
 * Masaüstü/kiosk uygulamasında (Electron) engel kapalıdır, ses her açılışta çalar.
 */

/** Elektrikli araç ivmesi (cubic-bezier): hızlı kalkış, sona doğru hafif yumuşama. Görsel ve ses ortak kullanır. */
export const ACCELERATION = [0.25, 0.1, 0.25, 1] as const;

const AudioCtx = (): typeof AudioContext | undefined =>
  typeof window === "undefined" ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);

/** Şu an etkileşimsiz ses çalınabilir mi? (Yeni bağlam "running" başlıyorsa izin var.) */
export function canPlaySoundNow(): boolean {
  const Ctx = AudioCtx();
  if (!Ctx) return false;
  const probe = new Ctx();
  const allowed = probe.state === "running";
  void probe.close();
  return allowed;
}

export async function playLaunchSound(durationMs: number): Promise<boolean> {
  const Ctx = AudioCtx();
  if (!Ctx) return false;
  const ctx = new Ctx();
  if (ctx.state !== "running") await ctx.resume().catch(() => undefined);
  if ((ctx.state as AudioContextState) !== "running") {
    void ctx.close();
    return false;
  }

  const t0 = ctx.currentTime + 0.06;
  const T = durationMs / 1000;
  const PASS = 1.5; // geçiş ve uzaklaşma süresi
  const speed = speedCurve(96); // 0..1, görseldeki dolumla aynı eğri
  const out = createOutput(ctx);

  kick(ctx, out, t0);
  motorWhine(ctx, out, t0, T, PASS, speed);
  powerTone(ctx, out, t0, T, PASS, speed);
  roadAndWind(ctx, out, t0, T, PASS, speed);

  setTimeout(() => void ctx.close(), (T + PASS + 2.5) * 1000);
  return true;
}

// ── Çıkış zinciri: kompresör + kuru/yankılı karışım ──────────────────────────

function createOutput(ctx: AudioContext): AudioNode {
  const input = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.ratio.value = 3.5;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.25;
  const master = ctx.createGain();
  master.gain.value = 0.85;

  const reverb = ctx.createConvolver();
  reverb.buffer = impulseResponse(ctx, 2.2, 2.8);
  const wet = ctx.createGain();
  wet.gain.value = 0.22;

  input.connect(compressor);
  input.connect(reverb).connect(wet).connect(compressor);
  compressor.connect(master).connect(ctx.destination);
  return input;
}

/** Sentetik oda yankısı: üstel sönen stereo gürültü. */
function impulseResponse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
  }
  return buffer;
}

// ── Katmanlar ──────────────────────────────────────────────────────────────

/** Kalkış: düşen frekanslı kısa sinüs, torkun geldiği an. */
function kick(ctx: AudioContext, out: AudioNode, t0: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(95, t0);
  osc.frequency.exponentialRampToValueAtTime(38, t0 + 0.35);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.55, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
  osc.connect(gain).connect(out);
  osc.start(t0);
  osc.stop(t0 + 0.5);
}

/** Motor ıslığı: motor dereceleri (1×, 2×, 3,2×), her biri hafif detune çiftli; titreşimle canlı. */
function motorWhine(ctx: AudioContext, out: AudioNode, t0: number, T: number, pass: number, speed: Float32Array) {
  const bus = ctx.createGain();
  envelope(bus.gain, t0, T, pass, 0.9);
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.setValueAtTime(1_400, t0);
  tone.frequency.linearRampToValueAtTime(7_500, t0 + T);
  bus.connect(tone).connect(out);

  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = 5.3;
  const vibratoDepth = ctx.createGain();
  vibratoDepth.gain.value = 4; // cent
  vibrato.connect(vibratoDepth);
  vibrato.start(t0);
  vibrato.stop(t0 + T + pass);

  const BASE = 160;
  const TOP = 1_180;
  for (const [order, level] of [
    [1, 0.05],
    [2, 0.028],
    [3.2, 0.014],
  ] as const) {
    for (const detune of [-6, 7]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.detune.value = detune;
      vibratoDepth.connect(osc.detune);
      const curve = speed.map((v) => (BASE + (TOP - BASE) * v) * order);
      osc.frequency.setValueCurveAtTime(curve, t0, T);
      // Geçiş: Doppler, frekans ~%14 düşer.
      osc.frequency.setValueAtTime(TOP * order, t0 + T + CURVE_GAP);
      osc.frequency.exponentialRampToValueAtTime(TOP * order * 0.86, t0 + T + pass);
      const gain = ctx.createGain();
      gain.gain.value = level;
      osc.connect(gain).connect(bus);
      osc.start(t0);
      osc.stop(t0 + T + pass);
    }
  }
}

/** AMG güç tonu: derin üçgen dalga, yumuşak doygunlukla (waveshaper), alçak geçiren filtre. */
function powerTone(ctx: AudioContext, out: AudioNode, t0: number, T: number, pass: number, speed: Float32Array) {
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueCurveAtTime(
    speed.map((v) => 42 + 78 * v),
    t0,
    T,
  );
  osc.frequency.setValueAtTime(120, t0 + T + CURVE_GAP);
  osc.frequency.exponentialRampToValueAtTime(96, t0 + T + pass);

  const shaper = ctx.createWaveShaper();
  shaper.curve = softClip(2.4);
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 520;
  const gain = ctx.createGain();
  envelope(gain.gain, t0, T, pass, 0.2);
  osc.connect(shaper).connect(lowpass).connect(gain).connect(out);
  osc.start(t0);
  osc.stop(t0 + T + pass);
}

/** Yol uğultusu (kahverengi gürültü) ve rüzgâr (beyaz gürültü, hızın karesi); geçişte soldan sağa kayar. */
function roadAndWind(ctx: AudioContext, out: AudioNode, t0: number, T: number, pass: number, speed: Float32Array) {
  const seconds = T + pass + 0.2;
  const panner = ctx.createStereoPanner();
  panner.pan.setValueAtTime(-0.15, t0);
  panner.pan.linearRampToValueAtTime(0, t0 + T);
  panner.pan.linearRampToValueAtTime(0.75, t0 + T + pass);
  panner.connect(out);

  const road = noiseSource(ctx, seconds, "brown");
  const roadFilter = ctx.createBiquadFilter();
  roadFilter.type = "lowpass";
  roadFilter.frequency.setValueCurveAtTime(
    speed.map((v) => 110 + 520 * v),
    t0,
    T,
  );
  const roadGain = ctx.createGain();
  roadGain.gain.setValueCurveAtTime(
    speed.map((v) => 0.02 + 0.42 * v),
    t0,
    T,
  );
  roadGain.gain.setValueAtTime(0.44, t0 + T + CURVE_GAP);
  roadGain.gain.exponentialRampToValueAtTime(0.0001, t0 + T + pass);
  road.connect(roadFilter).connect(roadGain).connect(panner);

  const wind = noiseSource(ctx, seconds, "white");
  const windHigh = ctx.createBiquadFilter();
  windHigh.type = "highpass";
  windHigh.frequency.value = 700;
  const windBand = ctx.createBiquadFilter();
  windBand.type = "bandpass";
  windBand.Q.value = 0.6;
  windBand.frequency.setValueCurveAtTime(
    speed.map((v) => 900 + 2_600 * v),
    t0,
    T,
  );
  windBand.frequency.setValueAtTime(3_500, t0 + T + CURVE_GAP);
  windBand.frequency.exponentialRampToValueAtTime(900, t0 + T + pass);
  const windGain = ctx.createGain();
  windGain.gain.setValueCurveAtTime(
    speed.map((v) => 0.0005 + 0.13 * v * v),
    t0,
    T,
  );
  // Geçiş anı: rüzgâr kısa bir an kabarır, sonra uzaklaşır.
  windGain.gain.setValueAtTime(0.13, t0 + T + CURVE_GAP);
  windGain.gain.linearRampToValueAtTime(0.22, t0 + T + 0.18);
  windGain.gain.exponentialRampToValueAtTime(0.0001, t0 + T + pass);
  wind.connect(windHigh).connect(windBand).connect(windGain).connect(panner);

  road.start(t0);
  wind.start(t0);
}

// ── Yardımcılar ────────────────────────────────────────────────────────────

/** Eğri (setValueCurveAtTime) bitişine tam denk gelen yeni ayar bazı tarayıcılarda hata verir; 5 ms sonra ayarlanır. */
const CURVE_GAP = 0.005;

/** Hızlanma boyunca seviyede kalır, geçişte söner. */
function envelope(param: AudioParam, t0: number, T: number, pass: number, level: number) {
  param.setValueAtTime(0.0001, t0);
  param.exponentialRampToValueAtTime(level, t0 + 0.25);
  param.setValueAtTime(level, t0 + T + CURVE_GAP);
  param.exponentialRampToValueAtTime(0.0001, t0 + T + pass);
}

function noiseSource(ctx: AudioContext, seconds: number, color: "white" | "brown"): AudioBufferSourceNode {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (color === "white") data[i] = white;
    else {
      last = (last + 0.02 * white) / 1.02; // entegre gürültü: alçak, gürleyen
      data[i] = last * 3.5;
    }
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return source;
}

function softClip(drive: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(drive * x) / Math.tanh(drive);
  }
  return curve;
}

/** ACCELERATION eğrisinin zamana göre değerleri (0..1); cubic-bezier x→y sayısal çözülür. */
function speedCurve(points: number): Float32Array<ArrayBuffer> {
  const [x1, y1, x2, y2] = ACCELERATION;
  const bezier = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  const curve = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const x = i / (points - 1);
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 24; k++) {
      const mid = (lo + hi) / 2;
      if (bezier(mid, x1, x2) < x) lo = mid;
      else hi = mid;
    }
    curve[i] = bezier((lo + hi) / 2, y1, y2);
  }
  return curve;
}
