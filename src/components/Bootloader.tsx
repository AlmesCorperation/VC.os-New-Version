import React, { useState, useEffect } from 'react';
import { usePIT } from '../hooks/useAudio';
import { kernel } from '../services/kernel';

export const Bootloader: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [lines, setLines] = useState<string[]>([]);
  const { playTone } = usePIT();

  useEffect(() => {
    kernel.emitEvent('CRITICAL', 'BOOT_SEQ_START');
    kernel.executeTask('BOOTLOADER', 80);

    const bootSequence = [
      { text: "VC.bios Extensions Active (powered by SeaBIOS 1.16.2)", delay: 100 },
      { text: "", delay: 300 },
      { text: "i440FX (vcos)", delay: 350 },
      { text: `Machine UUID ${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6'}`, delay: 400 },
      { text: "Found 1 cpu(s), max supported 1", delay: 450 },
      { text: "Ram Size=16 MB (0x0000000001000000)", delay: 500 },
      { text: "Relocating init from 0x000e0000 to 0x00fdd210 (size 40400)", delay: 600 },
      { text: "Found 1 PCI devices (max PCI buses 1)", delay: 700 },
      { text: "", delay: 1000 },
      { text: "Booting from Hard Disk...", delay: 1500 },
      { text: "Booting from 0000:7c00", delay: 2000 },
      { text: "Loading VC.os Kernel...", delay: 2300 },
      { text: "Switching to 32-bit Protected Mode...", delay: 2500 },
      { text: "Initializing GUI...", delay: 2800 },
    ];

    const timeouts: NodeJS.Timeout[] = [];

    // BIOS Beep
    setTimeout(() => playTone(1000, 0.1, 'square'), 200);

    bootSequence.forEach(({ text, delay }, index) => {
      const t = setTimeout(() => {
        setLines(prev => [...prev, text]);
        if (index === bootSequence.length - 1) {
          setTimeout(() => {
            kernel.emitEvent('CRITICAL', 'BOOT_SEQ_COMPLETE');
            onComplete();
          }, 800);
        }
      }, delay);
      timeouts.push(t);
    });

    return () => timeouts.forEach(clearTimeout);
  }, []);

  return (
    <div 
      className="fixed inset-0 bg-black z-50 overflow-hidden p-4 font-mono text-gray-300 text-[14px]"
      style={{ fontFamily: 'monospace' }}
    >
      <div className="flex flex-col">
        {lines.map((line, i) => (
          <div key={i} className="min-h-[20px]">{line}</div>
        ))}
        {lines.length > 0 && lines.length < 14 && (
          <div className="w-2 h-4 bg-gray-300 animate-pulse mt-1" />
        )}
      </div>
    </div>
  );
};
