// FrontLine サウンド合成 — Web Audio APIによる効果音生成

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

/** オシレーターでトーンを再生 */
function playTone(
  freq: number,
  duration: number,
  type: OscillatorType,
  volume: number
): void {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

/** ホワイトノイズを再生（線形減衰） */
function playNoise(duration: number, volume: number): void {
  const ctx = getCtx();
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  gain.gain.value = volume;

  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(ctx.currentTime);
}

export const SoundSynth = {
  /** 拳銃 — 200Hz square 0.08s + noise 0.05s */
  handgunShot(): void {
    playTone(200, 0.08, "square", 0.3);
    playNoise(0.05, 0.2);
  },

  /** 機関銃 — 300Hz square 0.04s + noise 0.03s */
  machinegunShot(): void {
    playTone(300, 0.04, "square", 0.25);
    playNoise(0.03, 0.15);
  },

  /** 散弾銃 — noise 0.12s + 100Hz sawtooth 0.1s */
  shotgunShot(): void {
    playNoise(0.12, 0.35);
    playTone(100, 0.1, "sawtooth", 0.3);
  },

  /** 狙撃銃 — 150Hz sawtooth 0.15s + noise 0.08s */
  sniperShot(): void {
    playTone(150, 0.15, "sawtooth", 0.35);
    playNoise(0.08, 0.25);
  },

  /** リロード — 800Hz 0.05s → 100ms gap → 600Hz 0.05s */
  reload(): void {
    playTone(800, 0.05, "sine", 0.2);
    setTimeout(() => {
      playTone(600, 0.05, "sine", 0.2);
    }, 100);
  },

  /** 被弾 — noise 0.04s */
  hit(): void {
    playNoise(0.04, 0.3);
  },

  /** 爆発 — noise 0.4s + 60Hz sawtooth 0.3s */
  explosion(): void {
    playNoise(0.4, 0.4);
    playTone(60, 0.3, "sawtooth", 0.35);
  },

  /** ヘッドショット — 1200Hz sine 0.15s */
  headshot(): void {
    playTone(1200, 0.15, "sine", 0.3);
  },

  /** 防御 — 200Hz triangle 0.08s */
  defend(): void {
    playTone(200, 0.08, "triangle", 0.25);
  },

  /** 勲章取得 — 523Hz→659Hz→784Hz sine カスケード (150ms間隔) */
  medal(): void {
    playTone(523, 0.15, "sine", 0.25);
    setTimeout(() => {
      playTone(659, 0.15, "sine", 0.25);
    }, 150);
    setTimeout(() => {
      playTone(784, 0.15, "sine", 0.25);
    }, 300);
  },
} as const;
