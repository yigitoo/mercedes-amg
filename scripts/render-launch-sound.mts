#!/usr/bin/env node
/**
 * Lansman açılış sesini WAV dosyasına yazar (video kurgusu için). Uygulamadaki sesle birebir aynıdır:
 * aynı sentez fonksiyonu (src/lib/launch-sound.ts → scheduleLaunchSound) çevrimdışı bağlamda çalışır.
 *
 *   node scripts/render-launch-sound.mts çıktı.wav
 */
import { writeFileSync } from "node:fs";
import { OfflineAudioContext } from "node-web-audio-api";

import { scheduleLaunchSound } from "../src/lib/launch-sound.ts";

const out = process.argv[2] ?? "launch-sound.wav";
const SAMPLE_RATE = 48_000;
const ZERO_TO_HUNDRED_MS = 2_700;
const TAIL_SECONDS = 2.5; // yankının sönmesi için

const seconds = ZERO_TO_HUNDRED_MS / 1000 + 1.5 + TAIL_SECONDS;
const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: Math.ceil(seconds * SAMPLE_RATE), sampleRate: SAMPLE_RATE });
scheduleLaunchSound(ctx as unknown as BaseAudioContext, 0, ZERO_TO_HUNDRED_MS);
const buffer = await ctx.startRendering();
writeFileSync(out, toWav(buffer.getChannelData(0), buffer.getChannelData(1), SAMPLE_RATE));
console.log(`✓ ${out} (${seconds.toFixed(1)} sn, ${SAMPLE_RATE} Hz stereo)`);

/** 16-bit PCM stereo WAV. */
function toWav(left: Float32Array, right: Float32Array, rate: number): Buffer {
  const frames = left.length;
  const data = Buffer.alloc(frames * 4);
  for (let i = 0; i < frames; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i]!)) * 32767), i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i]!)) * 32767), i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(2, 22); // stereo
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}
