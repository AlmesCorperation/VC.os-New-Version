export class VirtualAudioDSP {
  private audioCtx: AudioContext | null = null;
  public isMuted: boolean = false;
  public masterVolume: number = 0.8;
  private currentFrequency: number = 0;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;

  constructor() {
    // Lazy audio context init on user interaction
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
  }

  private ensureContext() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public playTone(freq: number, durationMs: number = 100, type: OscillatorType = 'square') {
    if (this.isMuted || freq <= 0) return;
    try {
      this.ensureContext();
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      const targetGain = 0.1 * this.masterVolume;
      gain.gain.setValueAtTime(targetGain, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + durationMs / 1000);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + durationMs / 1000);
    } catch (e) {
      // Audio context might be restricted before user gesture
    }
  }

  public playBeep() {
    this.playTone(880, 80, 'square'); // Standard BIOS beep
  }

  public playErrorBeep() {
    this.playTone(220, 250, 'sawtooth');
  }

  // Handle SoundBlaster / AdLib FM Synthesizer Port 0x388 / PC Speaker 0x42/0x43
  public handleIOWrite(port: number, value: number) {
    if (port === 0x42) {
      // PIT Channel 2 (PC Speaker Frequency divisor)
      const divisor = Math.max(1, value * 4);
      const freq = Math.floor(1193180 / (divisor * 256));
      if (freq > 20 && freq < 20000) {
        this.playTone(freq, 50, 'square');
      }
    } else if (port === 0x388) {
      // FM Synth write
      const freq = 100 + ((value & 0x7F) * 15);
      this.playTone(freq, 70, 'triangle');
    }
  }
}
