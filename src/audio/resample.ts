import type { AudioBufferData } from "../app/types";

const mixToMono = (audio: AudioBuffer): Float32Array => {
  if (audio.numberOfChannels === 1) {
    return audio.getChannelData(0);
  }
  const length = audio.length;
  const left = audio.getChannelData(0);
  const right = audio.getChannelData(1);
  const mono = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    mono[i] = (left[i] + right[i]) * 0.5;
  }
  return mono;
};

const linearResample = (
  samples: Float32Array,
  srcRate: number,
  dstRate: number
): Float32Array => {
  if (srcRate === dstRate) {
    return new Float32Array(samples);
  }
  const ratio = dstRate / srcRate;
  const length = Math.max(1, Math.round(samples.length * ratio));
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const pos = i / ratio;
    const left = Math.floor(pos);
    const right = Math.min(samples.length - 1, left + 1);
    const t = pos - left;
    out[i] = samples[left] * (1 - t) + samples[right] * t;
  }
  return out;
};

const normalize = (samples: Float32Array): Float32Array => {
  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) {
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  if (peak <= 0) {
    return samples;
  }
  const gain = 1 / peak;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    out[i] = samples[i] * gain;
  }
  return out;
};

export const toMono16k = (audio: AudioBuffer): AudioBufferData => {
  const mono = mixToMono(audio);
  const resampled = linearResample(mono, audio.sampleRate, 16000);
  const normalized = normalize(resampled);
  return {
    sampleRate: 16000,
    samples: normalized,
    durationSec: normalized.length / 16000
  };
};
