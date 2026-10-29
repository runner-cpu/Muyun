import type { Season, Settings } from '../types';

type SfxName = 'blip' | 'confirm' | 'cancel' | 'collect' | 'hit' | 'win' | 'lose' | 'step' | 'bell';

const NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 783.99, 659.25, 587.33];

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private settings: Settings = { music: 0.28, sfx: 0.45, muted: false };
  private season: Season = 'spring';
  private started = false;

  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.applySettings();
    }
    void this.ctx.resume();
    if (!this.started) {
      this.started = true;
      this.startMusic();
    }
  }

  setSettings(settings: Settings): void {
    this.settings = { ...settings };
    this.applySettings();
  }

  setSeason(season: Season): void { this.season = season; }

  playSfx(name: SfxName): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const freq: Record<SfxName, number> = {
      blip: 660, confirm: 880, cancel: 220, collect: 1046, hit: 150,
      win: 1318, lose: 180, step: 120, bell: 740,
    };
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = name === 'hit' ? 'sawtooth' : name === 'bell' ? 'triangle' : 'square';
    osc.frequency.setValueAtTime(freq[name], now);
    if (name === 'collect' || name === 'win') {
      osc.frequency.exponentialRampToValueAtTime(freq[name] * 1.5, now + 0.16);
    }
    if (name === 'lose' || name === 'cancel') {
      osc.frequency.exponentialRampToValueAtTime(freq[name] * 0.6, now + 0.2);
    }
    const duration = name === 'hit' ? 0.12 : name === 'collect' ? 0.25 : 0.09;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.9, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private applySettings(): void {
    if (!this.ctx || !this.master || !this.musicGain || !this.sfxGain) return;
    const muted = this.settings.muted ? 0 : 1;
    this.master.gain.setTargetAtTime(muted, this.ctx.currentTime, 0.05);
    this.musicGain.gain.setTargetAtTime(this.settings.music * 0.22, this.ctx.currentTime, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfx * 0.5, this.ctx.currentTime, 0.05);
  }

  private startMusic(): void {
    if (!this.ctx || !this.musicGain) return;
    const schedule = (): void => {
      if (!this.ctx || !this.musicGain) return;
      const note = NOTES[this.step % NOTES.length];
      const octave = this.step % 8 >= 4 ? 0.5 : 1;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = this.season === 'winter' ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(note * octave, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.35, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 0.38);
      this.step += 1;
    };
    schedule();
    this.timer = window.setInterval(schedule, this.season === 'winter' ? 620 : 480);
  }

  destroy(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }
}

export const audio = new AudioManager();
