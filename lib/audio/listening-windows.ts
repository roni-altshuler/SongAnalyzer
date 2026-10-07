/** Listening aids for a local recording, never inferred musical sections. */
export interface ListeningWindow { start: number; end: number }
export const WAVEFORM_SAMPLE_RATE = 22_050;
const MAX_MEASUREMENT_SAMPLES = 1_000_000;

export function listeningWindows(duration: number): ListeningWindow[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const count = Math.min(12, Math.max(duration > 1 ? 2 : 1, Math.ceil(duration / 5)));
  return Array.from({ length: count }, (_, index) => ({ start: duration * index / count, end: duration * (index + 1) / count }));
}

export function windowAt(windows: ListeningWindow[], time: number): number {
  return Math.max(0, windows.findIndex((window, index) => time >= window.start
    && (time < window.end || index === windows.length - 1 && time <= window.end)));
}

export function formatAudioTime(seconds: number): string {
  const tenths = Math.round(Math.max(0, Number.isFinite(seconds) ? seconds : 0) * 10);
  return `${Math.floor(tenths / 600)}:${String(Math.floor(tenths / 10) % 60).padStart(2, '0')}.${tenths % 10}`;
}

type DecodedSamples = Pick<AudioBuffer, 'sampleRate' | 'length' | 'numberOfChannels' | 'getChannelData'>;
export type WindowLevel = { status: 'ready'; rmsDb: number | null; peakDb: number | null; samples: number }
  | { status: 'unavailable' | 'too-long' };

/** RMS/peak of decoded waveform PCM, all channels. No normalization or model. */
export function windowLevel(buffer: DecodedSamples | null, window: ListeningWindow): WindowLevel {
  if (!buffer || !Number.isFinite(buffer.sampleRate) || buffer.sampleRate <= 0
    || buffer.numberOfChannels <= 0 || !Number.isFinite(window.start) || !Number.isFinite(window.end)
    || window.start < 0 || window.end <= window.start) return { status: 'unavailable' };
  const start = Math.min(buffer.length, Math.ceil(window.start * buffer.sampleRate));
  const end = Math.min(buffer.length, Math.ceil(window.end * buffer.sampleRate));
  const samples = (end - start) * buffer.numberOfChannels;
  if (samples <= 0) return { status: 'unavailable' };
  if (samples > MAX_MEASUREMENT_SAMPLES) return { status: 'too-long' };
  let sum = 0; let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let index = start; index < end; index++) {
      const value = data[index];
      if (!Number.isFinite(value)) return { status: 'unavailable' };
      sum += value * value;
      peak = Math.max(peak, Math.abs(value));
    }
  }
  return { status: 'ready', samples,
    rmsDb: sum > 0 ? 20 * Math.log10(Math.sqrt(sum / samples)) : null,
    peakDb: peak > 0 ? 20 * Math.log10(peak) : null };
}

/** A periodic estimated beat grid is not a count of detected drum hits. */
export function windowGridTicks(grid: number[] | undefined, window: ListeningWindow, duration: number): number | null {
  if (!grid) return null;
  return new Set(grid.filter(time => Number.isFinite(time) && time >= window.start
    && (time < window.end || window.end === duration && time === window.end))).size;
}
