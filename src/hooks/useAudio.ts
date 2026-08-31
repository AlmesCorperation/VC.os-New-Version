import { useEffect, useRef, useCallback } from 'react';

export const usePIT = () => {
  const audioCtx = useRef<AudioContext | null>(null);

  const playTone = useCallback((freq: number, duration: number, type: OscillatorType = 'square') => {
    try {
      if (!audioCtx.current) {
        audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const osc = audioCtx.current.createOscillator();
      const gain = audioCtx.current.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.current.currentTime);
      
      gain.gain.setValueAtTime(0.1, audioCtx.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.current.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.current.destination);

      osc.start();
      osc.stop(audioCtx.current.currentTime + duration);
    } catch (e) {
      console.warn('Audio playback failed:', e);
    }
  }, []);

  const glitchTone = useCallback(() => {
    const tones = [100, 200, 400, 800, 1600];
    tones.forEach((t, i) => {
      setTimeout(() => playTone(t + Math.random() * 50, 0.1, 'sawtooth'), i * 50);
    });
  }, [playTone]);

  return { playTone, glitchTone };
};
