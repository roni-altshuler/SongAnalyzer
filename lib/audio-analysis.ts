/**
 * Client-side audio analysis using the Web Audio API.
 *
 * Extracts:
 *  - Tempo (BPM) via onset/autocorrelation
 *  - RMS energy (loudness)
 *  - Spectral centroid (brightness)
 *  - Dynamic range (loudness variation)
 *  - Zero-crossing rate (noisiness / percussiveness)
 *
 * Maps those features to human-readable mood / vibe / energy descriptors.
 */

export interface AudioFeatures {
  bpm: number;
  rmsEnergy: number;        // 0-1 normalised
  spectralCentroid: number; // Hz — higher = brighter
  dynamicRange: number;     // 0-1 normalised
  zeroCrossingRate: number; // 0-1 normalised
  duration: number;         // seconds
}

export interface AudioAnalysisResult {
  mood: string;
  vibe: string;
  energy: string;
  sentiment: string;
  tempo: string;
  bpm: number;
  characteristics: string[];
  detailedAnalysis: string;
  confidence: number;
  duration: number;
  features: AudioFeatures;
}

// ─── Feature extraction ─────────────────────────────────────

/**
 * Decode an audio file into an AudioBuffer using the Web Audio API.
 */
async function decodeAudio(file: File): Promise<AudioBuffer> {
  const ctx = new AudioContext();
  const arrayBuf = await file.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuf);
  await ctx.close();
  return audioBuffer;
}

/**
 * Estimate BPM using onset-based autocorrelation on a down-mixed mono signal.
 */
function estimateBPM(data: Float32Array, sampleRate: number): number {
  // Down-sample to ~11 kHz for speed
  const factor = Math.max(1, Math.floor(sampleRate / 11025));
  const len = Math.floor(data.length / factor);
  const ds = new Float32Array(len);
  for (let i = 0; i < len; i++) ds[i] = Math.abs(data[i * factor]);

  // Onset envelope: difference of successive samples (half-wave rectified)
  const onset = new Float32Array(len - 1);
  for (let i = 1; i < len; i++) {
    onset[i - 1] = Math.max(0, ds[i] - ds[i - 1]);
  }

  // Autocorrelation over BPM range 60-200
  const dsSR = sampleRate / factor;
  const minLag = Math.floor(dsSR * 60 / 200); // 200 BPM
  const maxLag = Math.floor(dsSR * 60 / 60);  // 60 BPM
  const acLen = Math.min(maxLag + 1, onset.length);

  let bestLag = minLag;
  let bestVal = -Infinity;

  for (let lag = minLag; lag <= Math.min(maxLag, acLen - 1); lag++) {
    let sum = 0;
    const n = Math.min(onset.length - lag, 8192); // limit compute
    for (let i = 0; i < n; i++) {
      sum += onset[i] * onset[i + lag];
    }
    if (sum > bestVal) {
      bestVal = sum;
      bestLag = lag;
    }
  }

  return Math.round((dsSR * 60) / bestLag);
}

/**
 * RMS (root mean square) energy normalised to 0-1.
 */
function computeRMS(data: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  const rms = Math.sqrt(sum / data.length);
  return Math.min(rms * 4, 1); // scale up — typical RMS is 0.05-0.25
}

/**
 * Spectral centroid using a single FFT frame (centre of the file).
 */
function computeSpectralCentroid(data: Float32Array, sampleRate: number): number {
  const fftSize = 4096;
  const start = Math.max(0, Math.floor(data.length / 2) - fftSize / 2);
  const frame = data.slice(start, start + fftSize);

  // Apply Hann window
  for (let i = 0; i < frame.length; i++) {
    frame[i] *= 0.5 * (1 - Math.cos((2 * Math.PI * i) / (frame.length - 1)));
  }

  // Simple DFT magnitude (only need first half)
  const halfN = fftSize / 2;
  const mag = new Float32Array(halfN);
  for (let k = 0; k < halfN; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < fftSize; n++) {
      const angle = (2 * Math.PI * k * n) / fftSize;
      re += frame[n] * Math.cos(angle);
      im -= frame[n] * Math.sin(angle);
    }
    mag[k] = Math.sqrt(re * re + im * im);
  }

  let weightedSum = 0, totalMag = 0;
  for (let k = 0; k < halfN; k++) {
    const freq = (k * sampleRate) / fftSize;
    weightedSum += freq * mag[k];
    totalMag += mag[k];
  }

  return totalMag > 0 ? weightedSum / totalMag : 0;
}

/**
 * Dynamic range: standard deviation of short-term RMS values, normalised 0-1.
 */
function computeDynamicRange(data: Float32Array, sampleRate: number): number {
  const windowSize = Math.floor(sampleRate * 0.05); // 50 ms windows
  const hop = Math.floor(windowSize / 2);
  const rmsValues: number[] = [];

  for (let i = 0; i + windowSize <= data.length; i += hop) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) sum += data[i + j] * data[i + j];
    rmsValues.push(Math.sqrt(sum / windowSize));
  }

  if (rmsValues.length < 2) return 0;

  const mean = rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length;
  const variance = rmsValues.reduce((a, v) => a + (v - mean) ** 2, 0) / rmsValues.length;
  const std = Math.sqrt(variance);

  return Math.min(std * 8, 1); // normalise
}

/**
 * Zero-crossing rate normalised to 0-1.
 */
function computeZeroCrossingRate(data: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < data.length; i++) {
    if ((data[i] >= 0 && data[i - 1] < 0) || (data[i] < 0 && data[i - 1] >= 0)) {
      crossings++;
    }
  }
  const zcr = crossings / data.length;
  return Math.min(zcr * 10, 1); // normalise — typical ZCR is 0.02-0.15
}

/**
 * Down-mix a multi-channel AudioBuffer to a mono Float32Array.
 */
function getMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  const L = buffer.getChannelData(0);
  const R = buffer.getChannelData(1);
  const mono = new Float32Array(L.length);
  for (let i = 0; i < L.length; i++) mono[i] = (L[i] + R[i]) / 2;
  return mono;
}

// ─── Feature-to-mood mapping ────────────────────────────────

function mapMood(f: AudioFeatures): string {
  if (f.rmsEnergy > 0.6 && f.bpm > 130) return 'Euphoric';
  if (f.rmsEnergy > 0.5 && f.spectralCentroid < 1500) return 'Aggressive';
  if (f.rmsEnergy < 0.25 && f.bpm < 90) return 'Melancholic';
  if (f.rmsEnergy < 0.3 && f.spectralCentroid > 2500) return 'Peaceful';
  if (f.bpm > 120 && f.spectralCentroid > 2000) return 'Uplifting';
  if (f.dynamicRange > 0.5) return 'Dramatic';
  if (f.bpm < 100 && f.rmsEnergy < 0.4) return 'Contemplative';
  if (f.spectralCentroid > 3000) return 'Bright';
  return 'Balanced';
}

function mapVibe(f: AudioFeatures, mood: string): string {
  if (f.bpm > 140) return 'High-Energy';
  if (f.bpm > 120 && f.rmsEnergy > 0.4) return 'Upbeat';
  if (f.rmsEnergy > 0.55) return 'Intense';
  if (f.rmsEnergy < 0.2) return 'Mellow';
  if (f.zeroCrossingRate > 0.5) return 'Edgy';
  if (f.spectralCentroid < 1200) return 'Warm';
  if (mood === 'Peaceful' || mood === 'Contemplative') return 'Tranquil';
  if (f.spectralCentroid > 2500) return 'Dreamy';
  return 'Laid-back';
}

function mapEnergy(f: AudioFeatures): string {
  const score = f.rmsEnergy * 40 + (f.bpm / 200) * 30 + f.zeroCrossingRate * 15 + f.dynamicRange * 15;
  if (score > 65) return 'Very High';
  if (score > 50) return 'High';
  if (score > 35) return 'Moderate';
  if (score > 20) return 'Low';
  return 'Very Low';
}

function mapSentiment(f: AudioFeatures): string {
  // Brighter spectral content & moderate-high tempo → positive
  const positivity = (f.spectralCentroid / 5000) * 50 + (f.bpm / 200) * 30 + f.dynamicRange * 20;
  if (positivity > 55) return 'Positive';
  if (positivity > 40) return 'Neutral/Mixed';
  return 'Negative';
}

function mapTempo(bpm: number): string {
  if (bpm > 150) return 'Very Fast';
  if (bpm > 120) return 'Fast';
  if (bpm > 95) return 'Moderate';
  if (bpm > 70) return 'Slow';
  return 'Very Slow';
}

function extractCharacteristics(f: AudioFeatures): string[] {
  const chars: string[] = [];
  if (f.bpm > 120) chars.push('Uptempo');
  if (f.bpm < 85) chars.push('Downtempo');
  if (f.rmsEnergy > 0.5) chars.push('Loud & Powerful');
  if (f.rmsEnergy < 0.2) chars.push('Soft & Gentle');
  if (f.spectralCentroid > 3000) chars.push('Bright Tones');
  if (f.spectralCentroid < 1500) chars.push('Dark / Warm Tones');
  if (f.dynamicRange > 0.5) chars.push('Dynamic');
  if (f.dynamicRange < 0.15) chars.push('Compressed / Consistent');
  if (f.zeroCrossingRate > 0.4) chars.push('Percussive');
  if (f.zeroCrossingRate < 0.1) chars.push('Smooth');
  return chars.slice(0, 5);
}

function generateAudioAnalysis(
  mood: string,
  vibe: string,
  energy: string,
  sentiment: string,
  tempo: string,
  bpm: number,
  chars: string[],
  duration: number,
): string {
  let text = `This audio clip (${Math.round(duration)}s at ~${bpm} BPM) carries a ${mood.toLowerCase()} mood with a ${vibe.toLowerCase()} vibe. `;
  text += `The tempo is ${tempo.toLowerCase()}, and the overall energy level is ${energy.toLowerCase()}. `;
  text += `The emotional sentiment reads as ${sentiment.toLowerCase()}.\n\n`;

  if (chars.length > 0) {
    text += `Notable characteristics: ${chars.join(', ')}. `;
  }

  if (mood === 'Euphoric' || mood === 'Uplifting') {
    text += '\n\nThe bright, driving quality of this track suggests an uplifting or celebratory feel — great for energising playlists.';
  } else if (mood === 'Melancholic' || mood === 'Contemplative') {
    text += '\n\nThe slower pace and softer dynamics create a reflective, introspective atmosphere — suited for quiet listening.';
  } else if (mood === 'Aggressive') {
    text += '\n\nHeavy energy and darker tonal character give this track an aggressive, powerful edge.';
  } else if (mood === 'Peaceful') {
    text += '\n\nGentle dynamics and airy tones produce a calm, soothing sonic landscape.';
  }

  return text;
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Analyse an uploaded audio file and return a structured result.
 * All processing runs client-side via the Web Audio API.
 */
export async function analyzeAudioFile(file: File): Promise<AudioAnalysisResult> {
  const buffer = await decodeAudio(file);
  const mono = getMono(buffer);
  const sr = buffer.sampleRate;

  const features: AudioFeatures = {
    bpm: estimateBPM(mono, sr),
    rmsEnergy: computeRMS(mono),
    spectralCentroid: computeSpectralCentroid(mono, sr),
    dynamicRange: computeDynamicRange(mono, sr),
    zeroCrossingRate: computeZeroCrossingRate(mono),
    duration: buffer.duration,
  };

  const mood = mapMood(features);
  const vibe = mapVibe(features, mood);
  const energy = mapEnergy(features);
  const sentiment = mapSentiment(features);
  const tempo = mapTempo(features.bpm);
  const characteristics = extractCharacteristics(features);

  // Confidence based on file duration (longer = more reliable)
  let confidence = 0.5;
  if (features.duration > 120) confidence = 0.92;
  else if (features.duration > 60) confidence = 0.85;
  else if (features.duration > 30) confidence = 0.75;
  else if (features.duration > 10) confidence = 0.65;

  const detailedAnalysis = generateAudioAnalysis(
    mood, vibe, energy, sentiment, tempo, features.bpm, characteristics, features.duration,
  );

  return {
    mood,
    vibe,
    energy,
    sentiment,
    tempo,
    bpm: features.bpm,
    characteristics,
    detailedAnalysis,
    confidence,
    duration: features.duration,
    features,
  };
}

// ─── Pure mapping functions exported for testing ────────────
export const _test = {
  mapMood,
  mapVibe,
  mapEnergy,
  mapSentiment,
  mapTempo,
  extractCharacteristics,
};
