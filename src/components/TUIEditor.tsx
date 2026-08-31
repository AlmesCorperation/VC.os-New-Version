import React, { useState } from 'react';
import { SPECTRUM_GRADIENT } from '../constants';
import { kernel } from '../services/kernel';

interface Pane {
  id: number;
  text: string;
}

export const TUIEditor: React.FC = () => {
  const [panes, setPanes] = useState<Pane[]>([
    { id: 1, text: '/* VC.os Freestanding TUI Editor */\n// Windows 1.0 Tiling Logic Active\n// Framebuffer: 0xB8000\n\n' }
  ]);
  const [activePane, setActivePane] = useState(1);

  const handleSplit = () => {
    if (panes.length >= 4) return; // Max 4 panes for the 4 spectrum colors
    kernel.emitEvent('SYSCALL', 'SYS_FORK (TUI_SPLIT)');
    kernel.allocateMemory(1024 * 64); // Allocate 64KB for new pane
    setPanes([...panes, { id: Date.now(), text: '' }]);
  };

  const handleClose = (id: number) => {
    if (panes.length === 1) return;
    kernel.emitEvent('SYSCALL', 'SYS_EXIT (TUI_CLOSE)');
    kernel.freeMemory(1024 * 64); // Free 64KB
    const newPanes = panes.filter(p => p.id !== id);
    setPanes(newPanes);
    if (activePane === id) {
      setActivePane(newPanes[0].id);
    }
  };

  return (
    <div className="flex w-full h-full bg-black p-1 gap-1 font-mono text-sm select-none">
      {panes.map((pane, index) => {
        const color = SPECTRUM_GRADIENT[index % SPECTRUM_GRADIENT.length];
        const isActive = activePane === pane.id;
        
        return (
          <div 
            key={pane.id} 
            className="flex-1 flex flex-col border-2 transition-colors"
            style={{ borderColor: isActive ? color : '#333' }}
            onClick={() => setActivePane(pane.id)}
          >
            <div 
              className="px-2 py-1 text-xs font-bold flex justify-between items-center"
              style={{ 
                backgroundColor: isActive ? color : '#333',
                color: isActive ? '#000' : '#888'
              }}
            >
              <span>BUFFER_{index}.TXT</span>
              <div className="flex gap-2">
                {panes.length < 4 && (
                  <button onClick={(e) => { e.stopPropagation(); handleSplit(); }} className="hover:bg-white/30 px-1">
                    SPLIT
                  </button>
                )}
                {panes.length > 1 && (
                  <button onClick={(e) => { e.stopPropagation(); handleClose(pane.id); }} className="hover:bg-red-500 hover:text-white px-1">
                    X
                  </button>
                )}
              </div>
            </div>
            <textarea
              value={pane.text}
              onChange={(e) => {
                const newPanes = [...panes];
                const pIndex = newPanes.findIndex(p => p.id === pane.id);
                newPanes[pIndex].text = e.target.value;
                setPanes(newPanes);
                if (Math.random() > 0.9) kernel.emitEvent('IRQ', 'IRQ_0x21: KBD_EVENT');
              }}
              className="flex-1 bg-black p-2 outline-none resize-none"
              style={{ color: color }}
              spellCheck={false}
              autoFocus={isActive}
            />
          </div>
        );
      })}
    </div>
  );
};
