/**
 * VC.os Red Screen of Death (RSOD)
 * 
 * Implements a fatal system error visualization that simulates
 * direct framebuffer corruption using pseudo-random entropy.
 */

import React, { useEffect, useRef } from 'react';
import { usePIT } from '../hooks/useAudio';
import { useSettings } from '../hooks/useSettings';
import { kernel } from '../services/kernel';
import { MemoryMap } from '../services/memoryMap';

export const RSOD: React.FC<{ onRestart: () => void }> = ({ onRestart }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { glitchTone } = usePIT();
  const { performanceMode } = useSettings();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Set canvas to full window resolution
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onRestart);
    resize();

    // Audio chaos
    const audioInterval = setInterval(() => {
      if (!performanceMode && Math.random() > 0.7) glitchTone();
      if (Math.random() > 0.9) kernel.emitEvent('CRITICAL', 'KERNEL_PANIC: MEMORY_CORRUPTION');
    }, 100);

    let frameId: number;
    let frameCount = 0;

    const render = () => {
      frameCount++;
      
      // 1. Base Red Flood (Memory Leak Simulation)
      // Don't clear every frame to create "smearing" effect
      if (frameCount % 2 === 0 || performanceMode) {
        ctx.fillStyle = `rgba(100, 0, 0, 0.1)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      if (!performanceMode) {
        // 2. Hardware Entropy Simulation (Random Pixel Noise)
        // Corrupt random chunks of memory (pixels)
        // We process a few random blocks per frame for performance
        for (let i = 0; i < 50; i++) {
          const x = Math.floor(Math.random() * canvas.width);
          const y = Math.floor(Math.random() * canvas.height);
          const w = Math.floor(Math.random() * 200);
          const h = Math.floor(Math.random() * 20);
          
          // Direct buffer manipulation simulation
          const offset = (y * canvas.width + x) * 4;
          
          // Random "garbage" color
          const r = Math.floor(Math.random() * 255);
          const g = 0; // Keep it mostly red/black
          const b = 0;
          
          // Draw raw blocks
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(x, y, w, h);
        }

        // 3. Text Buffer Corruption
        ctx.font = '16px monospace';
        ctx.fillStyle = '#ffaaaa';
        for (let i = 0; i < 20; i++) {
          const charCode = 0x20 + Math.floor(Math.random() * 0x60); // Printable ASCII
          const char = String.fromCharCode(charCode);
          const x = Math.floor(Math.random() * canvas.width);
          const y = Math.floor(Math.random() * canvas.height);
          ctx.fillText(char, x, y);
        }
      }

      // 4. Fatal Error Message (Persistent and Responsive)
      const boxW = Math.min(600, canvas.width - 32);
      const boxH = Math.min(220, canvas.height - 40);
      const boxX = Math.max(16, (canvas.width - boxW) / 2);
      const boxY = Math.max(20, (canvas.height - boxH) / 2);

      ctx.fillStyle = '#000000';
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, boxW, boxH);
      
      ctx.fillStyle = '#ff0000';
      ctx.font = `bold ${boxW < 400 ? '16px' : '20px'} monospace`;
      ctx.fillText('*** FATAL SYSTEM ERROR ***', boxX + 16, boxY + 36);
      
      ctx.font = `${boxW < 400 ? '12px' : '14px'} monospace`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`Fatal exception 0E at 0x${MemoryMap.VGA_BUFFER_START.toString(16).toUpperCase()}`, boxX + 16, boxY + 70);
      ctx.fillText(`in VXD VMM(01) + 0x${MemoryMap.KERNEL_CORE_START.toString(16).toUpperCase()}`, boxX + 16, boxY + 95);
      ctx.fillText('System halted.', boxX + 16, boxY + 125);
      
      ctx.font = `${boxW < 400 ? '10px' : '12px'} monospace`;
      ctx.fillStyle = '#aaaaaa';
      ctx.fillText('Tap or press any key to restart...', boxX + 16, boxY + boxH - 24);
      
      // Blink prompt
      if (Math.floor(Date.now() / 500) % 2 === 0) {
        ctx.fillText('_', boxX + 16 + ctx.measureText('System halted.').width + 8, boxY + 125);
      }

      // 5. Scanline / Sync Loss Effect
      if (!performanceMode && Math.random() > 0.9) {
        const shift = (Math.random() - 0.5) * 20;
        ctx.drawImage(canvas, shift, 0);
      }

      if (!performanceMode || frameCount % 30 === 0) {
        frameId = requestAnimationFrame(render);
      } else {
        frameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onRestart);
      cancelAnimationFrame(frameId);
      clearInterval(audioInterval);
    };
  }, [performanceMode]);

  return (
    <div className="fixed inset-0 z-[99999] bg-black cursor-none" onClick={onRestart}>
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};
