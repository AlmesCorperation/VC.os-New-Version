import React, { useState, useEffect } from 'react';
import { usePIT } from '../hooks/useAudio';
import { kernel } from '../services/kernel';

export const GlitchEditor: React.FC<{ onCrash: () => void }> = ({ onCrash }) => {
  const [text, setText] = useState('// VC.os Glitch Editor\n// Type to experience hardware entropy\n\n');
  const { playTone } = usePIT();

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    
    // Check for "Major Bug" triggers
    if (val.includes('0xDEADBEEF') || val.includes('asm("hlt")')) {
      setText(val);
      playTone(100, 0.5, 'square');
      kernel.emitEvent('CRITICAL', 'KERNEL_PANIC: MANUAL_TRIGGER');
      setTimeout(onCrash, 500);
      return;
    }

    // Randomly glitch the text
    if (Math.random() > 0.95) {
      const chars = val.split('');
      const idx = Math.floor(Math.random() * chars.length);
      chars[idx] = String.fromCharCode(Math.floor(Math.random() * 255));
      setText(chars.join(''));
      playTone(200 + Math.random() * 1000, 0.05, 'sawtooth');
      kernel.emitEvent('MEM', `PAGE_FAULT @ 0x${Math.floor(Math.random() * 0xFFFFFFFF).toString(16).toUpperCase()}`);
    } else {
      setText(val);
    }
  };

  return (
    <div className="h-full flex flex-col font-mono">
      <div className="bg-black text-white text-[10px] px-2 py-0.5 flex justify-between">
        <span>EDITOR_v0.1</span>
        <span>UTF-8_RAW</span>
      </div>
      <textarea
        className="flex-1 bg-white text-black p-2 outline-none resize-none text-[12px] leading-tight"
        value={text || ''}
        onChange={handleChange}
        spellCheck={false}
      />
    </div>
  );
};
