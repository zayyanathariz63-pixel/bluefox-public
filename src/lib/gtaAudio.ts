// Web Audio API Synthesizer for Grand Theft Bluefox 6 BGM & SFX

class GtaAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmTimer: ReturnType<typeof setInterval> | null = null;
  private sirenTimer: ReturnType<typeof setInterval> | null = null;
  private muted: boolean = false;
  private step: number = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.35;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.35, this.ctx.currentTime, 0.03);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public unlock() {
    this.ensureContext();
  }

  // Vice City Synthwave Heist Loop
  public startHeistBgm() {
    this.stopHeistBgm();
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    this.step = 0;
    const bassNotes = [55, 55, 65.41, 55, 73.42, 65.41, 55, 49]; // A1, C2, D2, G1 synthwave groove
    const arpNotes = [220, 261.63, 329.63, 392, 329.63, 261.63, 293.66, 392];

    const playTick = () => {
      if (!this.ctx || !this.masterGain || this.muted) return;
      const now = this.ctx.currentTime;
      const idx = this.step % bassNotes.length;

      // Driving bass pulse
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(bassNotes[idx], now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(360, now);

      bassGain.gain.setValueAtTime(0.22, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

      bassOsc.connect(filter);
      filter.connect(bassGain);
      bassGain.connect(this.masterGain);
      bassOsc.start(now);
      bassOsc.stop(now + 0.2);

      // Kick on 0 & 4
      if (this.step % 2 === 0) {
        const kick = this.ctx.createOscillator();
        const kGain = this.ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(125, now);
        kick.frequency.exponentialRampToValueAtTime(38, now + 0.11);
        kGain.gain.setValueAtTime(0.32, now);
        kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        kick.connect(kGain);
        kGain.connect(this.masterGain);
        kick.start(now);
        kick.stop(now + 0.14);
      }

      // Snare / hi-hat pulse
      if (this.step % 4 === 2) {
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.07);
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const nFilter = this.ctx.createBiquadFilter();
        nFilter.type = 'highpass';
        nFilter.frequency.setValueAtTime(1400, now);
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.12, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        noise.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(this.masterGain);
        noise.start(now);
      }

      // Neon Arpeggio shimmer
      const arpOsc = this.ctx.createOscillator();
      const arpGain = this.ctx.createGain();
      arpOsc.type = 'triangle';
      arpOsc.frequency.setValueAtTime(arpNotes[(this.step + 2) % arpNotes.length], now);
      arpGain.gain.setValueAtTime(0.07, now);
      arpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      arpOsc.connect(arpGain);
      arpGain.connect(this.masterGain);
      arpOsc.start(now);
      arpOsc.stop(now + 0.17);

      this.step += 1;
    };

    playTick();
    this.bgmTimer = setInterval(playTick, 195);
  }

  public stopHeistBgm() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    if (this.sirenTimer) {
      clearInterval(this.sirenTimer);
      this.sirenTimer = null;
    }
  }

  public playSirenBurst(cycles = 3) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    if (this.sirenTimer) {
      clearInterval(this.sirenTimer);
      this.sirenTimer = null;
    }

    let count = 0;
    const triggerTone = () => {
      if (!this.ctx || !this.masterGain || this.muted || count >= cycles) {
        if (this.sirenTimer) {
          clearInterval(this.sirenTimer);
          this.sirenTimer = null;
        }
        return;
      }
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(640, now);
      osc.frequency.linearRampToValueAtTime(980, now + 0.24);
      osc.frequency.linearRampToValueAtTime(620, now + 0.48);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.11, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.5);
      count += 1;
    };

    triggerTone();
    this.sirenTimer = setInterval(triggerTone, 520);
  }

  public playWaveSlamSfx(waveNum: number) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;

    // Sub impact boom
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(140 + waveNum * 15, now);
    sub.frequency.exponentialRampToValueAtTime(34, now + 0.42);
    subGain.gain.setValueAtTime(0.5, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 0.46);

    // Synth brass stab
    const stab = ctx.createOscillator();
    const stabGain = ctx.createGain();
    stab.type = 'sawtooth';
    stab.frequency.setValueAtTime(waveNum === 3 ? 293.66 : 220, now);
    stabGain.gain.setValueAtTime(0.16, now);
    stabGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    stab.connect(stabGain);
    stabGain.connect(this.masterGain);
    stab.start(now);
    stab.stop(now + 0.34);
  }

  public playHitSfx(kind: 'officer' | 'car' | 'heli') {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (kind === 'officer') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.11);
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.13);
    } else if (kind === 'car') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.22);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.25);
    } else {
      osc.type = 'square';
      osc.frequency.setValueAtTime(310, now);
      osc.frequency.exponentialRampToValueAtTime(44, now + 0.34);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.37);
    }
  }

  public playLineTravelSfx() {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 2.4);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.35);
    gain.gain.linearRampToValueAtTime(0.18, now + 2.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.65);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 2.7);
  }

  public playNodeUnlockSfx() {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;

    const chord = [440, 554.37, 659.25, 880]; // A major Vice City shimmer
    chord.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.045);
      gain.gain.setValueAtTime(0.16, now + i * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.75);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + i * 0.045);
      osc.stop(now + i * 0.045 + 0.78);
    });
  }

  public playVictoryBgmAndPopupSfx() {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.muted) return;
    const now = ctx.currentTime;

    const fanfare = [329.63, 440, 554.37, 659.25, 880];
    fanfare.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 1.15);
    });
  }
}

export const gtaAudio = new GtaAudioEngine();
