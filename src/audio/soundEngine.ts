// Procedural Web Audio API Sound Synthesizer & Multi-Channel Mixer for Fleet.io
import type { KillStreakAnnouncement } from '../game/types';
import { getKillStreakMilestone } from '../game/catalog';

export interface SoundMixerSettings {
  muted: boolean;
  musicVolume: number; // 0.0 to 1.0 — Ambient Space Synth Soundtrack
  sfxVolume: number;   // 0.0 to 1.0 — Weapons, Impacts, Explosions, Thrusters
  uiVolume: number;    // 0.0 to 1.0 — Menu Clicks, HUD Alerts, Dock Chimes
}

const AUDIO_STORAGE_KEY = 'fleet_io_audio_mixer_v1';

class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;
  public musicVolume: number = 0.55;
  public sfxVolume: number = 0.85;
  public uiVolume: number = 0.8;

  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicStep: number = 0;
  private musicRunning: boolean = false;

  constructor() {
    this.loadSettings();
  }

  private loadSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(AUDIO_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SoundMixerSettings>;
      if (typeof parsed.muted === 'boolean') this.muted = parsed.muted;
      if (typeof parsed.musicVolume === 'number') {
        this.musicVolume = Math.max(0, Math.min(1, parsed.musicVolume));
      }
      if (typeof parsed.sfxVolume === 'number') {
        this.sfxVolume = Math.max(0, Math.min(1, parsed.sfxVolume));
      }
      if (typeof parsed.uiVolume === 'number') {
        this.uiVolume = Math.max(0, Math.min(1, parsed.uiVolume));
      }
    } catch {
      // Ignore storage error
    }
  }

  private saveSettings(): void {
    if (typeof window === 'undefined') return;
    try {
      const payload: SoundMixerSettings = {
        muted: this.muted,
        musicVolume: this.musicVolume,
        sfxVolume: this.sfxVolume,
        uiVolume: this.uiVolume,
      };
      localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage error
    }
  }

  private getContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.musicRunning && this.musicVolume > 0.01 && !this.muted) {
      this.startMusicLoop();
    }
    return this.ctx;
  }

  public getSettings(): SoundMixerSettings {
    return {
      muted: this.muted,
      musicVolume: this.musicVolume,
      sfxVolume: this.sfxVolume,
      uiVolume: this.uiVolume,
    };
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    this.saveSettings();
    if (this.muted) {
      this.stopMusicLoop();
    } else if (this.musicVolume > 0.01) {
      this.startMusicLoop();
    }
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.saveSettings();
    if (this.muted) {
      this.stopMusicLoop();
    } else if (this.musicVolume > 0.01) {
      this.startMusicLoop();
    }
  }

  public setMusicVolume(vol: number): void {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    this.saveSettings();
    if (this.musicVolume <= 0.01 || this.muted) {
      this.stopMusicLoop();
    } else if (!this.musicRunning) {
      this.startMusicLoop();
    }
  }

  public setSfxVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    this.saveSettings();
  }

  public setUiVolume(vol: number): void {
    this.uiVolume = Math.max(0, Math.min(1, vol));
    this.saveSettings();
  }

  public applyPreset(preset: 'BALANCED' | 'COMBAT' | 'QUIET' | 'DEFAULT'): SoundMixerSettings {
    this.muted = false;
    if (preset === 'COMBAT') {
      this.musicVolume = 0.25;
      this.sfxVolume = 1.0;
      this.uiVolume = 0.75;
    } else if (preset === 'QUIET') {
      this.musicVolume = 0.2;
      this.sfxVolume = 0.35;
      this.uiVolume = 0.4;
    } else {
      this.musicVolume = 0.55;
      this.sfxVolume = 0.85;
      this.uiVolume = 0.8;
    }
    this.saveSettings();
    if (this.musicVolume > 0.01) this.startMusicLoop();
    return this.getSettings();
  }

  public startMusicLoop(): void {
    if (this.musicRunning || typeof window === 'undefined') return;
    this.musicRunning = true;
    if (this.musicTimer) clearInterval(this.musicTimer);

    // Ambient sci-fi space synth arpeggio & deep bass drone pulse
    const bassNotes = [65.41, 65.41, 73.42, 58.27, 65.41, 82.41, 73.42, 61.74]; // C2, D2, Bb1, E2...
    const arpNotes = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 293.66, 349.23];

    this.musicTimer = setInterval(() => {
      if (this.muted || this.musicVolume <= 0.01 || !this.ctx || this.ctx.state !== 'running') {
        return;
      }
      const now = this.ctx.currentTime;
      const step = this.musicStep++;
      const bassFreq = bassNotes[step % bassNotes.length];
      const arpFreq = arpNotes[step % arpNotes.length];

      // Warm lowpass space pad pulse
      const padOsc = this.ctx.createOscillator();
      const padFilter = this.ctx.createBiquadFilter();
      const padGain = this.ctx.createGain();
      padOsc.type = 'sawtooth';
      padOsc.frequency.setValueAtTime(bassFreq, now);
      padFilter.type = 'lowpass';
      padFilter.frequency.setValueAtTime(240, now);

      const padPeak = 0.032 * this.musicVolume;
      padGain.gain.setValueAtTime(0.0005, now);
      padGain.gain.linearRampToValueAtTime(padPeak, now + 0.12);
      padGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.52);

      padOsc.connect(padFilter);
      padFilter.connect(padGain);
      padGain.connect(this.ctx.destination);
      padOsc.start(now);
      padOsc.stop(now + 0.54);

      // Subtle crystalline synth chime on even steps
      if (step % 2 === 0) {
        const arpOsc = this.ctx.createOscillator();
        const arpGain = this.ctx.createGain();
        arpOsc.type = 'sine';
        arpOsc.frequency.setValueAtTime(arpFreq, now);
        const arpPeak = 0.018 * this.musicVolume;
        arpGain.gain.setValueAtTime(0.0005, now);
        arpGain.gain.linearRampToValueAtTime(arpPeak, now + 0.04);
        arpGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.36);
        arpOsc.connect(arpGain);
        arpGain.connect(this.ctx.destination);
        arpOsc.start(now);
        arpOsc.stop(now + 0.38);
      }
    }, 550);
  }

  public stopMusicLoop(): void {
    this.musicRunning = false;
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  // ===========================================================================
  // UI FEEDBACK TONES (Scaled by uiVolume)
  // ===========================================================================
  public playSelect(): void {
    if (this.uiVolume <= 0.01) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.06);
    gain.gain.setValueAtTime(Math.max(0.002, 0.09 * this.uiVolume), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playRepair(): void {
    if (this.uiVolume <= 0.01) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [440, 554.37, 659.25];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(Math.max(0.002, 0.09 * this.uiVolume), now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.16);
    });
  }

  public playTurnStart(isPlayer: boolean): void {
    if (this.uiVolume <= 0.01) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isPlayer ? 392 : 293.66, now);
    osc.frequency.setValueAtTime(isPlayer ? 523.25 : 246.94, now + 0.07);
    gain.gain.setValueAtTime(Math.max(0.002, 0.08 * this.uiVolume), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playVictory(won: boolean): void {
    if (this.uiVolume <= 0.01) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = won ? [392, 493.88, 587.33, 783.99] : [349.23, 311.13, 277.18, 220];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);
      gain.gain.setValueAtTime(Math.max(0.002, 0.12 * this.uiVolume), now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.3);
    });
  }

  public triggerAnnouncementAudio(
    announcement: Pick<
      KillStreakAnnouncement,
      'kind' | 'streakCount' | 'tierLevel' | 'soundCueId' | 'voiceoverLine' | 'title'
    >
  ): void {
    if (this.muted || this.uiVolume <= 0.01) return;

    if (announcement.kind === 'KILL_STREAK') {
      const streak =
        announcement.streakCount ??
        (announcement.soundCueId === 'STREAK_10'
          ? 10
          : announcement.soundCueId === 'STREAK_5'
            ? 5
            : 3);
      this.playKillStreak(streak, announcement.voiceoverLine);
    } else if (announcement.kind === 'TIER_UP') {
      const tier =
        announcement.tierLevel ?? (announcement.soundCueId === 'TIER_3' ? 3 : 2);
      this.playTierUp(tier, announcement.voiceoverLine);
    }
  }

  public playKillStreak(streak: number, voiceoverOverride?: string): void {
    if (this.muted || this.uiVolume <= 0.01) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const vol = this.uiVolume;
    const spec =
      getKillStreakMilestone(streak) ||
      (streak >= 10
        ? getKillStreakMilestone(10)
        : streak >= 5
          ? getKillStreakMilestone(5)
          : getKillStreakMilestone(3));

    const cueId =
      spec?.soundCueId ||
      (streak >= 10 ? 'STREAK_10' : streak >= 5 ? 'STREAK_5' : 'STREAK_3');

    // 1. Tactical Radio Squelch Pre-Chime (Comms Open Click)
    this.playCommsSquelch(ctx, now, vol, cueId === 'STREAK_10' ? 1.25 : 1.0);

    if (cueId === 'STREAK_10') {
      // =======================================================================
      // 10-KILL STREAK MILESTONE ("UNSTOPPABLE · FLEET ACE!")
      // Seismic sub-drop + 7-note detuned supersaw fanfare + crystalline cascade
      // =======================================================================
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(130.81, now);
      subOsc.frequency.exponentialRampToValueAtTime(36.71, now + 0.62);
      subGain.gain.setValueAtTime(Math.max(0.002, 0.24 * vol), now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.66);

      // Grand 7-note harmonic fanfare with dual detuned oscillators
      const aceNotes = [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.5, 1567.98];
      aceNotes.forEach((freq, idx) => {
        const startT = now + 0.05 + idx * 0.068;
        const dur = idx === aceNotes.length - 1 ? 0.55 : 0.28;

        [-4.5, 4.5].forEach((detuneCents, layerIdx) => {
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();

          osc.type = layerIdx === 0 ? 'sawtooth' : 'triangle';
          osc.frequency.setValueAtTime(freq, startT);
          osc.detune.setValueAtTime(detuneCents, startT);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(3400, startT);

          const peak = (idx === aceNotes.length - 1 ? 0.14 : 0.105) * vol;
          gain.gain.setValueAtTime(0.001, startT);
          gain.gain.linearRampToValueAtTime(Math.max(0.002, peak), startT + 0.018);
          gain.gain.exponentialRampToValueAtTime(0.001, startT + dur);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          osc.start(startT);
          osc.stop(startT + dur + 0.02);
        });
      });

      // Crystalline high-octave telemetry shimmer chord at the climax
      [2093.0, 2637.02, 3135.96].forEach((shimmerFreq, sIdx) => {
        const st = now + 0.48 + sIdx * 0.04;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(shimmerFreq, st);
        gain.gain.setValueAtTime(Math.max(0.002, 0.065 * vol), st);
        gain.gain.exponentialRampToValueAtTime(0.001, st + 0.42);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(st);
        osc.stop(st + 0.44);
      });
    } else if (cueId === 'STREAK_5') {
      // =======================================================================
      // 5-KILL STREAK MILESTONE ("RAMPAGE!")
      // Heavy sub-impact + resonant filter sweep + 5-note overdriven power chord
      // =======================================================================
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(110, now);
      subOsc.frequency.exponentialRampToValueAtTime(42, now + 0.46);
      subGain.gain.setValueAtTime(Math.max(0.002, 0.2 * vol), now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.5);

      const rampageNotes = [440, 554.37, 659.25, 880, 1108.73];
      rampageNotes.forEach((freq, idx) => {
        const startT = now + 0.04 + idx * 0.072;
        const dur = idx === rampageNotes.length - 1 ? 0.42 : 0.25;

        const osc = ctx.createOscillator();
        const subHarm = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, startT);

        subHarm.type = 'triangle';
        subHarm.frequency.setValueAtTime(freq * 1.5, startT); // Power fifth harmonic

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(480, startT);
        filter.frequency.exponentialRampToValueAtTime(2800, startT + dur * 0.75);

        const peak = (idx === rampageNotes.length - 1 ? 0.145 : 0.115) * vol;
        gain.gain.setValueAtTime(0.001, startT);
        gain.gain.linearRampToValueAtTime(Math.max(0.002, peak), startT + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, startT + dur);

        osc.connect(filter);
        subHarm.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startT);
        subHarm.start(startT);
        osc.stop(startT + dur + 0.02);
        subHarm.stop(startT + dur + 0.02);
      });
    } else {
      // =======================================================================
      // 3-KILL STREAK MILESTONE ("KILLING SPREE!")
      // Punchy bass pulse + rising 4-note dual-oscillator brass/Lydian stinger
      // =======================================================================
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(98, now);
      subOsc.frequency.exponentialRampToValueAtTime(52, now + 0.34);
      subGain.gain.setValueAtTime(Math.max(0.002, 0.16 * vol), now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.38);

      const spreeNotes = [392.0, 523.25, 659.25, 783.99];
      spreeNotes.forEach((freq, idx) => {
        const startT = now + 0.035 + idx * 0.072;
        const dur = idx === spreeNotes.length - 1 ? 0.34 : 0.22;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(freq, startT);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2, startT);

        const peak = (idx === spreeNotes.length - 1 ? 0.135 : 0.105) * vol;
        gain.gain.setValueAtTime(0.001, startT);
        gain.gain.linearRampToValueAtTime(Math.max(0.002, peak), startT + 0.014);
        gain.gain.exponentialRampToValueAtTime(0.001, startT + dur);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start(startT);
        osc2.start(startT);
        osc1.stop(startT + dur + 0.02);
        osc2.stop(startT + dur + 0.02);
      });
    }

    // 2. Trigger Tactical Announcer Voiceover + Formant Comms Cadence
    const voiceLine =
      voiceoverOverride ||
      spec?.voiceoverLine ||
      (cueId === 'STREAK_10'
        ? 'Unstoppable! Ten kill streak! Supreme Fleet Ace!'
        : cueId === 'STREAK_5'
          ? 'Rampage! Five kill streak! Sector dominance!'
          : 'Killing Spree! Three consecutive kills!');
    const intensity: 1 | 2 | 3 =
      cueId === 'STREAK_10' ? 3 : cueId === 'STREAK_5' ? 2 : 1;

    this.speakAnnouncerVoiceover(ctx, now + 0.14, voiceLine, intensity);
  }

  public playTierUp(tier: 1 | 2 | 3, voiceoverOverride?: string): void {
    if (this.muted || this.uiVolume <= 0.01) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes =
      tier >= 3
        ? [329.63, 440, 554.37, 659.25, 880, 1046.5]
        : [329.63, 440, 554.37, 659.25];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tier >= 3 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.065);
      gain.gain.setValueAtTime(
        Math.max(0.002, 0.12 * this.uiVolume),
        now + idx * 0.065
      );
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.065 + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.065);
      osc.stop(now + idx * 0.065 + 0.25);
    });

    if (voiceoverOverride) {
      this.speakAnnouncerVoiceover(
        ctx,
        now + 0.16,
        voiceoverOverride,
        tier >= 3 ? 2 : 1
      );
    }
  }

  private playCommsSquelch(
    ctx: AudioContext,
    startTime: number,
    vol: number,
    intensityScale: number = 1
  ): void {
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * 0.045));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1850, startTime);
    bandpass.Q.setValueAtTime(3.5, startTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.002, 0.08 * vol * intensityScale), startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.045);

    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(ctx.destination);
    noise.start(startTime);
    noise.stop(startTime + 0.048);
  }

  private speakAnnouncerVoiceover(
    ctx: AudioContext,
    startTime: number,
    line: string,
    intensity: 1 | 2 | 3
  ): void {
    if (this.muted || this.uiVolume <= 0.01) return;

    // 1. Synthesize a subtle cyber-vocoder formant cadence on Web Audio so the announcer
    //    presence is always felt even if browser TTS voices are unavailable
    const syllableCount = intensity === 3 ? 5 : intensity === 2 ? 4 : 3;
    const basePitch = intensity === 3 ? 164.81 : intensity === 2 ? 146.83 : 130.81;
    for (let i = 0; i < syllableCount; i++) {
      const st = startTime + i * 0.095;
      const carrier = ctx.createOscillator();
      const formant = ctx.createBiquadFilter();
      const vGain = ctx.createGain();

      carrier.type = 'sawtooth';
      carrier.frequency.setValueAtTime(
        basePitch * (i === syllableCount - 1 ? 1.18 : 1 + (i % 2) * 0.08),
        st
      );

      formant.type = 'bandpass';
      formant.frequency.setValueAtTime(720 + i * 180, st);
      formant.Q.setValueAtTime(4.2, st);

      const peak = 0.045 * this.uiVolume;
      vGain.gain.setValueAtTime(0.001, st);
      vGain.gain.linearRampToValueAtTime(Math.max(0.002, peak), st + 0.015);
      vGain.gain.exponentialRampToValueAtTime(0.001, st + 0.082);

      carrier.connect(formant);
      formant.connect(vGain);
      vGain.connect(ctx.destination);
      carrier.start(st);
      carrier.stop(st + 0.086);
    }

    // 2. Dispatch Web Speech API Announcer Voiceover
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const synth = window.speechSynthesis;
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(line);
        utterance.volume = Math.max(0, Math.min(1, this.uiVolume));
        utterance.rate = intensity === 3 ? 1.12 : intensity === 2 ? 1.09 : 1.06;
        utterance.pitch = intensity === 3 ? 0.82 : intensity === 2 ? 0.86 : 0.9;

        const voices = synth.getVoices();
        if (voices && voices.length > 0) {
          const preferred =
            voices.find(
              (v) =>
                v.lang.startsWith('en') &&
                /google|daniel|alex|david|mark|male|command/i.test(v.name)
            ) || voices.find((v) => v.lang.startsWith('en'));
          if (preferred) {
            utterance.voice = preferred;
          }
        }
        synth.speak(utterance);
      } catch {
        // Ignore speech synthesis errors in restricted environments
      }
    }
  }

  // ===========================================================================
  // COMBAT SFX (Scaled by sfxVolume)
  // ===========================================================================
  public playMoveStep(): void {
    if (this.sfxVolume <= 0.01) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.09);
    gain.gain.setValueAtTime(Math.max(0.002, 0.08 * this.sfxVolume), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playCannonFire(faction: 'incorruptus' | 'omnitron' | 'aerie'): void {
    if (this.sfxVolume <= 0.01) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (faction === 'incorruptus') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(640, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.13);
    } else if (faction === 'omnitron') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.11);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.15);
    }

    gain.gain.setValueAtTime(Math.max(0.002, 0.13 * this.sfxVolume), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playMissileLaunch(): void {
    if (this.sfxVolume <= 0.01) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(960, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.28);

    gain.gain.setValueAtTime(Math.max(0.002, 0.12 * this.sfxVolume), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  public playHit(shielded: boolean, isCrit: boolean): void {
    if (this.sfxVolume <= 0.01) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    if (shielded) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isCrit ? 620 : 440, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(isCrit ? 220 : 160, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.22);
    }

    const baseGain = isCrit ? 0.19 : 0.14;
    gain.gain.setValueAtTime(Math.max(0.002, baseGain * this.sfxVolume), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  public playExplosion(): void {
    if (this.sfxVolume <= 0.01) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const bufferSize = ctx.sampleRate * 0.45;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(60, now + 0.45);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.002, 0.24 * this.sfxVolume), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.45);
  }
}

export const soundEngine = new SoundEngine();
