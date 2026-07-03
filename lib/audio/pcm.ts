/**
 * PCM utilities shared by the fingerprint + feature workers and the seed
 * script. Pure TypeScript — no Web Audio / Node dependencies.
 */

/** Average N channels into a mono Float32Array. */
export function downmixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0];

  const len = channels[0].length;
  const mono = new Float32Array(len);
  for (const channel of channels) {
    for (let i = 0; i < len; i++) mono[i] += channel[i];
  }
  const inv = 1 / channels.length;
  for (let i = 0; i < len; i++) mono[i] *= inv;
  return mono;
}

/**
 * Resample to a target rate.
 *
 * Downsampling uses block averaging (cheap anti-aliasing that is plenty for
 * peak-picking on log-band maxima); upsampling uses linear interpolation.
 * Returns the input untouched when the rates already match.
 */
export function resampleTo(
  data: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate || data.length === 0) return data;

  const outLen = Math.floor((data.length * toRate) / fromRate);
  const out = new Float32Array(outLen);
  const ratio = fromRate / toRate;

  if (ratio > 1) {
    // Downsample: average each source block so high frequencies don't fold
    // straight into the band-limited spectrum.
    for (let i = 0; i < outLen; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.min(data.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
      let sum = 0;
      for (let j = start; j < end; j++) sum += data[j];
      out[i] = sum / (end - start);
    }
  } else {
    for (let i = 0; i < outLen; i++) {
      const pos = i * ratio;
      const i0 = Math.floor(pos);
      const i1 = Math.min(data.length - 1, i0 + 1);
      const frac = pos - i0;
      out[i] = data[i0] * (1 - frac) + data[i1] * frac;
    }
  }

  return out;
}
