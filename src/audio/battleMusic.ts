/**
 * Trilha de batalha estilo MOBA/chiptune, gerada na hora com Web Audio (nada de arquivos de áudio).
 * Lá menor, 148 BPM, loop de 8 compassos. Camadas:
 *   sempre: pad + arpejo suave
 *   "batalha" (há agentes trabalhando): baixo, bateria e melodia — entra e sai com fade
 */
const BPM = 148;
const STEP = 60 / BPM / 4; // semicolcheia
const LOOKAHEAD = 0.14;

const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);

// Am | F | C | G | Am | F | Dm | E
const CHORDS = [
  { root: 33, tones: [57, 60, 64] },
  { root: 29, tones: [53, 57, 60] },
  { root: 36, tones: [55, 60, 64] },
  { root: 31, tones: [55, 59, 62] },
  { root: 33, tones: [57, 60, 64] },
  { root: 29, tones: [53, 57, 60] },
  { root: 38, tones: [53, 57, 62] },
  { root: 40, tones: [56, 59, 64] },
];

const N = null;
const LEAD: (number | null)[][] = [
  [69, N, N, 72, N, N, 71, N, 69, N, 67, N, 69, N, N, N],
  [65, N, N, 69, N, N, 67, N, 65, N, 64, N, 65, N, N, N],
  [67, N, N, 72, N, N, 71, N, 67, N, 64, N, 67, N, N, N],
  [67, N, N, 71, N, N, 69, N, 67, N, 62, N, 67, N, N, N],
  [69, N, 72, N, 76, N, 72, N, 71, N, 69, N, 71, N, N, N],
  [72, N, 69, N, 65, N, 69, N, 72, N, N, N, 71, N, 69, N],
  [74, N, N, 72, N, N, 69, N, 65, N, 69, N, 74, N, N, N],
  [71, N, 68, N, 71, N, 76, N, 75, N, 76, N, 71, N, N, N],
];

export class BattleMusic {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private timer: ReturnType<typeof setInterval> | null = null;
  private next = 0;
  private step = 0;
  private volume = 0.5;
  private target = 0; // 0 calmo, 1 batalha
  private level = 0; // suavizado
  private running = false;

  get isRunning() {
    return this.running;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.ctx) this.master.gain.setTargetAtTime(this.volume * 0.9, this.ctx.currentTime, 0.05);
  }

  /** 0 = calmo, 1 = batalha */
  setIntensity(v: 0 | 1) {
    this.target = v;
  }

  async start() {
    if (this.running) return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      // ruído para caixa e chimbal
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    await this.ctx.resume().catch(() => undefined);
    this.running = true;
    this.next = this.ctx.currentTime + 0.08;
    this.step = 0;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(this.volume * 0.9, this.ctx.currentTime, 0.4); // fade in
    this.timer = setInterval(() => this.tick(), 30);
  }

  stop() {
    if (!this.running || !this.ctx) return;
    this.running = false;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15); // fade out
    const t = this.timer;
    setTimeout(() => t && clearInterval(t), 600);
    this.timer = null;
  }

  private tick() {
    if (!this.ctx || !this.running) return;
    while (this.next < this.ctx.currentTime + LOOKAHEAD) {
      this.level += (this.target - this.level) * 0.06; // fade entre calmo e batalha
      this.play(this.step, this.next);
      this.next += STEP;
      this.step = (this.step + 1) % (16 * 8);
    }
  }

  private play(step: number, t: number) {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const chord = CHORDS[bar];
    const L = this.level;

    // pad calmo: acorde sustentado a cada compasso
    if (s === 0) for (const m of chord.tones) this.tone(mtof(m - 12), t, STEP * 15, 'triangle', 0.05);

    // arpejo suave (sempre)
    if (s % 2 === 0) {
      const i = (s / 2) % 4;
      const m = chord.tones[[0, 1, 2, 1][i]] + (s >= 8 ? 12 : 0);
      this.tone(mtof(m), t, STEP * 1.6, 'square', 0.025 + 0.02 * (1 - L), 0.02);
    }

    if (L < 0.05) return;

    // baixo em colcheias com oitava
    if (s % 2 === 0) {
      const m = chord.root + (s % 8 === 6 ? 12 : 0);
      this.tone(mtof(m), t, STEP * 1.8, 'sawtooth', 0.16 * L, 0.01, 900);
    }
    // melodia
    const lead = LEAD[bar][s];
    if (lead != null) this.tone(mtof(lead), t, STEP * (LEAD[bar][s + 1] === undefined || LEAD[bar][s + 1] === null ? 3 : 1.5), 'square', 0.07 * L, 0.01, 3200, 0.006);
    // bateria
    if (s === 0 || s === 8 || (s === 10 && bar % 2 === 1)) this.kick(t, 0.5 * L);
    if (s === 4 || s === 12) this.snare(t, 0.28 * L);
    if (s % 2 === 0) this.hat(t, (s % 4 === 0 ? 0.1 : 0.06) * L);
    if (s === 15 && bar % 4 === 3) this.snare(t, 0.2 * L); // virada
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, vol: number, atk = 0.015, cutoff = 4000, vibrato = 0) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    const f = c.createBiquadFilter();
    o.type = type;
    o.frequency.value = freq;
    if (vibrato) {
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = 6;
      lg.gain.value = freq * vibrato;
      lfo.connect(lg);
      lg.connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.1);
    }
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f);
    f.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private kick(t: number, vol: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.22);
  }

  private noiseHit(t: number, dur: number, vol: number, hp: number) {
    const c = this.ctx!;
    const src = c.createBufferSource();
    const g = c.createGain();
    const f = c.createBiquadFilter();
    src.buffer = this.noise;
    f.type = 'highpass';
    f.frequency.value = hp;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private snare(t: number, vol: number) {
    this.noiseHit(t, 0.14, vol, 1800);
    this.tone(190, t, 0.08, 'triangle', vol * 0.6, 0.002);
  }

  private hat(t: number, vol: number) {
    this.noiseHit(t, 0.04, vol, 7000);
  }

  destroy() {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
  }
}
