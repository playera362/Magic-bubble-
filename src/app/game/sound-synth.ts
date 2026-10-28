import { Injectable } from '@angular/core';
import { AnimCategory } from './bubble-types';

/**
 * Gentle low-volume gain for continuous Level Menu background music.
 */
const LEVEL_MENU_MUSIC_GAIN = 0.13;

@Injectable({ providedIn: 'root' })
export class SoundSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private echoInput: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private muted = false;
  private menuMusicWanted = false;
  private musicSchedulerId = 0;
  private musicStep = 0;
  private nextNoteTime = 0;
  private unlockListenersBound = false;

  constructor() {
    this.bindAutoplayUnlock();
  }

  private bindAutoplayUnlock(): void {
    if (this.unlockListenersBound || typeof window === 'undefined') return;
    this.unlockListenersBound = true;

    const unlock = () => {
      this.unlockAudio();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('pointerup', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('focus', unlock, { passive: true });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.unlockAudio();
        }
      });
    }
  }

  unlockAudio(): void {
    if (this.muted || typeof window === 'undefined') return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => {
          if (this.menuMusicWanted && !this.musicSchedulerId) {
            this.startMenuMusicLoop();
          }
        })
        .catch(() => undefined);
    } else if (this.menuMusicWanted && !this.musicSchedulerId) {
      this.startMenuMusicLoop();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(muted ? 0.0001 : 0.92, now, 0.04);
    }
    if (muted) {
      this.stopMenuMusicLoop();
    } else if (this.menuMusicWanted) {
      this.startMenuMusicLoop();
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  /**
   * Eternal Low-Volume Enchanted Soundtrack on the Level Menu!
   * Plays a soothing, never-ending Celestial Music-Box + Soft Harp + Velvet Pad loop
   * at gentle background volume (`LEVEL_MENU_MUSIC_GAIN = 0.13`).
   */
  setMenuMusicActive(active: boolean): void {
    this.menuMusicWanted = active;
    if (active && !this.muted) {
      if (!this.musicSchedulerId) {
        this.startMenuMusicLoop();
      } else if (this.musicBus && this.ctx) {
        // Ensure gain stays smoothly at gentle low volume even if previously fading out
        const now = this.ctx.currentTime;
        this.musicBus.gain.cancelScheduledValues(now);
        this.musicBus.gain.setTargetAtTime(LEVEL_MENU_MUSIC_GAIN, now, 0.35);
      }
    } else {
      this.stopMenuMusicLoop();
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        this.ctx = ctx;

        // Studio Dynamics Compressor + Master Gain + Lush Stereo Shimmer Echo
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.knee.value = 18;
        comp.ratio.value = 4;
        comp.attack.value = 0.005;
        comp.release.value = 0.18;

        const master = ctx.createGain();
        master.gain.value = this.muted ? 0.0001 : 0.92;
        master.connect(comp);
        comp.connect(ctx.destination);
        this.masterGain = master;

        const sfx = ctx.createGain();
        sfx.gain.value = 0.96;
        sfx.connect(master);
        this.sfxBus = sfx;

        const music = ctx.createGain();
        music.gain.value = LEVEL_MENU_MUSIC_GAIN;
        music.connect(master);
        this.musicBus = music;

        // Stereo Magical Delay / Shimmer Echo Bus
        const echoIn = ctx.createGain();
        echoIn.gain.value = 0.3;
        const delayL = ctx.createDelay(1.0);
        const delayR = ctx.createDelay(1.0);
        delayL.delayTime.value = 0.26;
        delayR.delayTime.value = 0.39;

        const lpFilter = ctx.createBiquadFilter();
        lpFilter.type = 'lowpass';
        lpFilter.frequency.value = 2500;

        const fb = ctx.createGain();
        fb.gain.value = 0.34;

        const merger = ctx.createChannelMerger(2);
        echoIn.connect(lpFilter);
        lpFilter.connect(delayL);
        lpFilter.connect(delayR);
        delayL.connect(merger, 0, 0);
        delayR.connect(merger, 0, 1);
        delayR.connect(fb);
        fb.connect(lpFilter);
        merger.connect(master);
        this.echoInput = echoIn;

        // Pre-bake 0.5s soft white-noise buffer for crisp air-whoosh & explosion transients
        const sampleRate = ctx.sampleRate;
        const bufLen = Math.floor(sampleRate * 0.5);
        const nBuf = ctx.createBuffer(1, bufLen, sampleRate);
        const data = nBuf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        this.noiseBuffer = nBuf;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  private triggerFilteredNoise(
    startTime: number,
    duration: number,
    filterType: BiquadFilterType,
    startFreq: number,
    endFreq: number,
    peakGain: number,
    q = 1.4,
  ): void {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.setValueAtTime(q, startTime);
    filter.frequency.setValueAtTime(startFreq, startTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), startTime + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0005, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + Math.min(0.014, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0005, startTime + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    src.start(startTime);
    src.stop(startTime + duration + 0.02);
  }

  private startMenuMusicLoop(): void {
    if (typeof window === 'undefined' || this.musicSchedulerId) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.musicBus) return;

    const now = ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(now);
    this.musicBus.gain.setValueAtTime(0.002, now);
    this.musicBus.gain.linearRampToValueAtTime(LEVEL_MENU_MUSIC_GAIN, now + 1.4);

    this.nextNoteTime = now + 0.08;

    // New Dreamy 8-Bar Starlight Sanctuary Progression
    // (Dbmaj9 -> Ebm7/Ab -> Fm9 -> Bbm9 -> Gbmaj9 -> Ab13sus4 -> Dbmaj9 -> Ab9sus4)
    const chords: number[][] = [
      [138.59, 207.65, 261.63, 311.13], // Dbmaj9
      [155.56, 233.08, 277.18, 349.23], // Ebm9
      [174.61, 261.63, 311.13, 392.0],  // Fm9
      [116.54, 207.65, 261.63, 349.23], // Bbm9
      [185.0, 277.18, 349.23, 415.3],   // Gbmaj9
      [207.65, 277.18, 349.23, 466.16], // Ab13sus4
      [138.59, 207.65, 277.18, 349.23], // Dbmaj7(add9)
      [155.56, 233.08, 311.13, 415.3],  // Ab9sus4
    ];

    // New Peaceful 64-Step Celestial Music-Box Lullaby (0 = gentle rest)
    const melody: number[] = [
      554.37, 0, 622.25, 0, 698.46, 830.61, 0, 698.46,
      622.25, 0, 554.37, 0, 466.16, 0, 523.25, 0,
      622.25, 0, 698.46, 0, 830.61, 932.33, 0, 830.61,
      698.46, 0, 622.25, 554.37, 0, 0, 523.25, 0,
      554.37, 0, 698.46, 0, 830.61, 0, 1046.5, 932.33,
      830.61, 0, 698.46, 622.25, 554.37, 0, 622.25, 0,
      698.46, 622.25, 554.37, 0, 466.16, 523.25, 554.37, 0,
      622.25, 0, 698.46, 0, 622.25, 0, 0, 0,
    ];

    const stepDur = 0.31; // Calm, relaxing ~97 BPM 8th-note lullaby (~20s seamless cycle, loops forever!)

    this.musicSchedulerId = window.setInterval(() => {
      if (!this.menuMusicWanted || this.muted || !this.ctx) {
        return;
      }

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => undefined);
        return;
      }
      if (this.ctx.state !== 'running') {
        return;
      }

      // Guard against background-tab timer drift so notes never pile up
      if (this.nextNoteTime < this.ctx.currentTime - 0.12) {
        this.nextNoteTime = this.ctx.currentTime + 0.06;
      }

      while (this.nextNoteTime < this.ctx.currentTime + 0.4) {
        const step = this.musicStep % 64;
        const bar = Math.floor(step / 8);
        const stepInBar = step % 8;
        const chord = chords[bar];
        const t = this.nextNoteTime;

        // 1. Velvet Warm Pad Chord on beat 1 of every bar
        if (stepInBar === 0) {
          this.scheduleWarmPadChord(chord, t, stepDur * 8.4);
        }

        // 2. Delicate Stereo Harp Arpeggio
        const arpFreq = chord[stepInBar % chord.length] * (stepInBar >= 4 ? 2 : 1);
        const pan = ((stepInBar % 4) - 1.5) * 0.28;
        this.scheduleHarpPluck(arpFreq, t, pan, 0.06);

        // 3. Soft Celestial Music-Box Lead Melody
        const melFreq = melody[step];
        if (melFreq > 0) {
          this.scheduleCelesteNote(melFreq, t, 0.095);
        }

        // 4. Subtle High Starlight Twinkle on every 2nd bar
        if (stepInBar === 7 && bar % 2 === 1) {
          this.scheduleCelesteNote(chord[2] * 4, t, 0.026);
        }

        this.nextNoteTime += stepDur;
        this.musicStep = (this.musicStep + 1) % 64000;
      }
    }, 95);
  }

  private stopMenuMusicLoop(): void {
    if (this.musicSchedulerId) {
      window.clearInterval(this.musicSchedulerId);
      this.musicSchedulerId = 0;
    }
    if (this.musicBus && this.ctx) {
      const now = this.ctx.currentTime;
      this.musicBus.gain.cancelScheduledValues(now);
      this.musicBus.gain.setTargetAtTime(0.0001, now, 0.14);
    }
  }

  private scheduleWarmPadChord(freqs: number[], startTime: number, dur: number): void {
    if (!this.ctx || !this.musicBus) return;
    for (let i = 0; i < freqs.length; i++) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freqs[i], startTime);
      osc.detune.setValueAtTime((i - 1.5) * 4.0, startTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(840, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(i === 0 ? 0.06 : 0.04, startTime + 0.75);
      gain.gain.setValueAtTime(i === 0 ? 0.052 : 0.035, startTime + dur - 0.85);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicBus);
      osc.start(startTime);
      osc.stop(startTime + dur + 0.05);
    }
  }

  private scheduleHarpPluck(freq: number, startTime: number, panVal: number, peak: number): void {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1950, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peak, startTime + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.58);

    osc.connect(filter);
    filter.connect(gain);

    if (typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(panVal, startTime);
      gain.connect(panner);
      panner.connect(this.musicBus);
    } else {
      gain.connect(this.musicBus);
    }

    osc.start(startTime);
    osc.stop(startTime + 0.62);
  }

  private scheduleCelesteNote(freq: number, startTime: number, peak: number): void {
    if (!this.ctx || !this.musicBus) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    const gain2 = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, startTime);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, startTime);

    gain1.gain.setValueAtTime(0.0001, startTime);
    gain1.gain.linearRampToValueAtTime(peak, startTime + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.78);

    gain2.gain.setValueAtTime(0.0001, startTime);
    gain2.gain.linearRampToValueAtTime(peak * 0.2, startTime + 0.006);
    gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.24);

    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(this.musicBus);
    gain2.connect(this.musicBus);

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + 0.82);
    osc2.stop(startTime + 0.28);
  }

  /**
   * Dedicated Expressive Emote Sound Effects for All 5 Magic Girl Emote Categories!
   * Subtly varies musical motif & pitch based on emote `index` so every emote feels alive!
   */
  playEmoteSound(category: AnimCategory, index = 0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    const semitoneShift = ((Math.abs(index) * 3) % 7) - 2;
    const pitchMult = Math.pow(2, semitoneShift / 12);

    if (category === 'happy') {
      // Joyful sparkling starlight giggle arpeggio + bell twinkle!
      const notes = [587.33, 739.99, 880.0, 1174.66, 1479.98];
      notes.forEach((f, i) => {
        const t = now + i * 0.048;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(f * pitchMult, t);
        osc.frequency.exponentialRampToValueAtTime(f * pitchMult * 1.04, t + 0.14);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.13, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(g);
        g.connect(this.sfxBus!);
        if (this.echoInput) g.connect(this.echoInput);
        osc.start(t);
        osc.stop(t + 0.24);
      });
      return;
    }

    if (category === 'win') {
      // Royal celebratory victory flourish + shimmering chord!
      const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
      fanfare.forEach((f, i) => {
        const t = now + i * 0.055;
        const osc = ctx.createOscillator();
        const over = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        over.type = 'sine';
        osc.frequency.setValueAtTime(f * pitchMult, t);
        over.frequency.setValueAtTime(f * pitchMult * 2, t);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.14, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
        osc.connect(g);
        over.connect(g);
        g.connect(this.sfxBus!);
        if (this.echoInput) g.connect(this.echoInput);
        osc.start(t);
        over.start(t);
        osc.stop(t + 0.38);
        over.stop(t + 0.38);
      });
      return;
    }

    if (category === 'shoot') {
      // Magical wand swoosh + twin crystal spell chimes!
      this.triggerFilteredNoise(now, 0.16, 'bandpass', 700, 2900, 0.11, 2.2);
      const spell = [659.25, 987.77, 1318.51];
      spell.forEach((f, i) => {
        const t = now + i * 0.04;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f * pitchMult, t);
        osc.frequency.exponentialRampToValueAtTime(f * pitchMult * 1.18, t + 0.15);
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(g);
        g.connect(this.sfxBus!);
        if (this.echoInput) g.connect(this.echoInput);
        osc.start(t);
        osc.stop(t + 0.22);
      });
      return;
    }

    if (category === 'angry') {
      // Cute expressive pouty "hmph!" descending double-note motif!
      const poutNotes = [370.0, 277.18];
      poutNotes.forEach((f, i) => {
        const t = now + i * 0.105;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f * pitchMult, t);
        osc.frequency.exponentialRampToValueAtTime(f * pitchMult * 0.84, t + 0.13);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(920, t);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.12, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        osc.connect(filter);
        filter.connect(g);
        g.connect(this.sfxBus!);
        osc.start(t);
        osc.stop(t + 0.18);
      });
      return;
    }

    // 'idle' — Ethereal breeze harp & fairy wind-chime!
    const breeze = [523.25, 783.99, 1174.66];
    breeze.forEach((f, i) => {
      const t = now + i * 0.065;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * pitchMult, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.095, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
      osc.connect(g);
      g.connect(this.sfxBus!);
      if (this.echoInput) g.connect(this.echoInput);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  playVaultOpen(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    const notes = [440.0, 659.25, 880.0, 1108.73];
    notes.forEach((freq, i) => {
      const t = now + i * 0.048;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(g);
      g.connect(this.sfxBus!);
      if (this.echoInput) g.connect(this.echoInput);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  playDailyReward(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    const notes = [659.25, 880.0, 1046.5, 1318.51, 1760.0];
    notes.forEach((freq, i) => {
      const t = now + i * 0.052;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
      osc.connect(g);
      g.connect(this.sfxBus!);
      if (this.echoInput) g.connect(this.echoInput);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  /**
   * Soaring Cinematic World Complete Flight Fanfare (Magic Girl Flying to Next World!)
   */
  playWorldFlightCutscene(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    const gliss = [
      261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25,
      783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98,
    ];
    gliss.forEach((f, i) => {
      const t = now + i * 0.075;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.65);
      osc.connect(g);
      g.connect(this.sfxBus!);
      if (this.echoInput) g.connect(this.echoInput);
      osc.start(t);
      osc.stop(t + 0.7);
    });

    const flightChords: { delay: number; dur: number; notes: number[] }[] = [
      { delay: 0.4, dur: 2.3, notes: [261.63, 329.63, 392.0, 523.25] },
      { delay: 2.6, dur: 2.3, notes: [349.23, 440.0, 523.25, 659.25] },
      { delay: 4.8, dur: 2.1, notes: [392.0, 493.88, 587.33, 783.99] },
      { delay: 6.7, dur: 2.2, notes: [261.63, 392.0, 523.25, 659.25, 1046.5] },
    ];

    for (const ch of flightChords) {
      const start = now + ch.delay;
      for (const freq of ch.notes) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(0.0005, start);
        g.gain.linearRampToValueAtTime(0.08, start + 0.28);
        g.gain.exponentialRampToValueAtTime(0.0005, start + ch.dur);
        osc.connect(g);
        g.connect(this.sfxBus);
        if (this.echoInput) g.connect(this.echoInput);
        osc.start(start);
        osc.stop(start + ch.dur + 0.05);
      }
    }
  }

  playLaunch(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    // Silky air-whoosh transient + twin harmonic crystal wand chime
    this.triggerFilteredNoise(now, 0.11, 'bandpass', 650, 2400, 0.09, 2.0);

    const body = ctx.createOscillator();
    const sparkle = ctx.createOscillator();
    const bGain = ctx.createGain();
    const sGain = ctx.createGain();

    body.type = 'triangle';
    body.frequency.setValueAtTime(240, now);
    body.frequency.exponentialRampToValueAtTime(680, now + 0.1);

    sparkle.type = 'sine';
    sparkle.frequency.setValueAtTime(1046.5, now);
    sparkle.frequency.exponentialRampToValueAtTime(2093.0, now + 0.12);

    bGain.gain.setValueAtTime(0.17, now);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.125);

    sGain.gain.setValueAtTime(0.075, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    body.connect(bGain);
    sparkle.connect(sGain);
    bGain.connect(this.sfxBus);
    sGain.connect(this.sfxBus);
    if (this.echoInput) sGain.connect(this.echoInput);

    body.start(now);
    sparkle.start(now);
    body.stop(now + 0.13);
    sparkle.stop(now + 0.15);
  }

  playSwap(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.075);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxBus);
    if (this.echoInput) gain.connect(this.echoInput);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  playWallBounce(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.065);

    overtone.type = 'triangle';
    overtone.frequency.setValueAtTime(1760, now);
    overtone.frequency.exponentialRampToValueAtTime(880, now + 0.045);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    osc.connect(gain);
    overtone.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    overtone.start(now);
    osc.stop(now + 0.08);
    overtone.stop(now + 0.08);
  }

  playSnap(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    this.triggerFilteredNoise(now, 0.035, 'highpass', 1400, 700, 0.055, 1.2);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(155, now + 0.065);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playPop(index: number, combo: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime + Math.min(index * 0.034, 0.26);

    // Pentatonic-major crystal scale so rapid chain pops always sound harmonious!
    const scaleNotes = [
      523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0,
    ];
    const pitchIndex = Math.min(index + Math.max(0, combo - 1), scaleNotes.length - 1);
    const freq = scaleNotes[pitchIndex];

    const osc = ctx.createOscillator();
    const bell = ctx.createOscillator();
    const gain = ctx.createGain();
    const bGain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 0.78, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.48, now + 0.085);

    bell.type = 'sine';
    bell.frequency.setValueAtTime(freq * 2.5, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.165, now + 0.009);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.175);

    bGain.gain.setValueAtTime(0.052, now);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    bell.connect(bGain);
    gain.connect(this.sfxBus);
    bGain.connect(this.sfxBus);
    if (this.echoInput) bGain.connect(this.echoInput);

    osc.start(now);
    bell.start(now);
    osc.stop(now + 0.185);
    bell.stop(now + 0.14);
  }

  playCascadeDrop(count: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    const notes = [659.25, 783.99, 987.77, 1174.66, 1567.98, 1975.53];
    const limit = Math.min(count, 6);

    for (let i = 0; i < limit; i++) {
      const t = now + i * 0.046;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(notes[i], t);
      gain.gain.setValueAtTime(0.13, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(this.sfxBus);
      if (this.echoInput) gain.connect(this.echoInput);
      osc.start(t);
      osc.stop(t + 0.27);
    }
  }

  playExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    // Punchy sub-bass shockwave + filtered blast roar
    this.triggerFilteredNoise(now, 0.34, 'lowpass', 1650, 120, 0.22, 1.1);

    const sub = ctx.createOscillator();
    const gain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(160, now);
    sub.frequency.exponentialRampToValueAtTime(32, now + 0.36);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    sub.connect(gain);
    gain.connect(this.sfxBus);
    sub.start(now);
    sub.stop(now + 0.4);
  }

  playLightning(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    this.triggerFilteredNoise(now, 0.22, 'bandpass', 2800, 620, 0.14, 2.5);

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(1760, now);
    osc1.frequency.exponentialRampToValueAtTime(220, now + 0.24);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(2480, now);
    osc2.frequency.exponentialRampToValueAtTime(330, now + 0.22);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxBus);
    if (this.echoInput) gain.connect(this.echoInput);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.27);
    osc2.stop(now + 0.27);
  }

  playCeilingDrop(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.24);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(480, now);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.27);
  }

  playVictory(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    chord.forEach((freq, idx) => {
      const t = now + idx * 0.072;
      const osc = ctx.createOscillator();
      const bell = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      bell.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      bell.frequency.setValueAtTime(freq * 2, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.145, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.62);
      osc.connect(gain);
      bell.connect(gain);
      gain.connect(this.sfxBus!);
      if (this.echoInput) gain.connect(this.echoInput);
      osc.start(t);
      bell.start(t);
      osc.stop(t + 0.64);
      bell.stop(t + 0.64);
    });
  }

  playGameOver(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    const notes = [440.0, 392.0, 349.23, 293.66];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.115;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1100, t);
      gain.gain.setValueAtTime(0.13, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxBus!);
      if (this.echoInput) gain.connect(this.echoInput);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  playCoinEarn(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    const notes = [987.77, 1318.51, 1975.53];
    notes.forEach((freq, i) => {
      const t = now + i * 0.052;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.125, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(g);
      g.connect(this.sfxBus!);
      if (this.echoInput) g.connect(this.echoInput);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  playStorePurchase(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    const notes = [587.33, 739.99, 880.0, 1174.66, 1479.98];
    notes.forEach((freq, i) => {
      const t = now + i * 0.055;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
      osc.connect(g);
      g.connect(this.sfxBus!);
      if (this.echoInput) g.connect(this.echoInput);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  playPowerSummon(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    this.triggerFilteredNoise(now, 0.18, 'bandpass', 600, 2600, 0.09, 2.0);
    const notes = [440.0, 554.37, 659.25, 880.0, 1174.66, 1318.51];
    notes.forEach((freq, i) => {
      const t = now + i * 0.042;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.13, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(g);
      g.connect(this.sfxBus!);
      if (this.echoInput) g.connect(this.echoInput);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  }

  playShooterPreviewFire(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    this.triggerFilteredNoise(now, 0.11, 'bandpass', 720, 2900, 0.08, 2.2);

    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'triangle';
    thump.frequency.setValueAtTime(320, now);
    thump.frequency.exponentialRampToValueAtTime(690, now + 0.08);
    thumpGain.gain.setValueAtTime(0.16, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    thump.connect(thumpGain);
    thumpGain.connect(this.sfxBus);
    thump.start(now);
    thump.stop(now + 0.13);

    // Delayed crystal pop chime when preview projectile strikes upper bubble
    const popNotes = [783.99, 1046.5, 1318.51];
    popNotes.forEach((freq, i) => {
      const t = now + 0.24 + i * 0.032;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(g);
      g.connect(this.sfxBus!);
      if (this.echoInput) g.connect(this.echoInput);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }
}
