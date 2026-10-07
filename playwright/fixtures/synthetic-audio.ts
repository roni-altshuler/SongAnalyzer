/** Original synthetic chord/pulse clip. No provider audio or private recording. */
export function syntheticClip({ duration = 4, secondHalfGain = 1, silent = false }: { duration?: number; secondHalfGain?: number; silent?: boolean } = {}) {
  const sampleRate = 22050;
  const samples = Math.round(sampleRate * duration);
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const pulse = Math.exp(-20 * (t % 0.5));
    const freqs = t < 2 ? [261.63, 329.63, 392] : [293.66, 349.23, 440];
    const gain = t < duration / 2 ? 1 : secondHalfGain;
    const value = silent ? 0 : freqs.reduce((sum, f) => sum + Math.sin(2 * Math.PI * f * t), 0) * (0.06 + pulse * 0.12) * gain;
    wav.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  return wav;
}
