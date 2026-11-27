export function playGiftSound(context: AudioContext | null, cue: "fall" | "land" | "shake") {
  if (!context || context.state !== "running") return;
  const now = context.currentTime;
  const burst = (offset: number, duration: number, from: number, to: number, volume: number, attack: number) => {
    const start = now + offset;
    const noise = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(to, start + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(context.destination);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(start);
  };
  if (cue === "fall") burst(.15, .54, 2400, 560, .17, .36);
  if (cue === "land") burst(0, .22, 280, 90, .45, .008);
  if (cue === "shake") {
    for (const offset of [0, .12, .25, .4]) burst(offset, .09, 1500, 800, .12 * (1 - offset), .012);
  }
}
