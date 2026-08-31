import React, { useState, useEffect } from 'react';
import { Terminal, Folder, File, ChevronRight, ChevronLeft, Cpu } from 'lucide-react';
import { kernel } from '../services/kernel';

/**
 * VC.os Kernel File Browser (TUI Simulation)
 * This component simulates the freestanding C++20 file browser.
 */

interface FileEntry {
  name: string;
  is_directory: boolean;
  size: number;
}

interface Directory {
  path: string;
  entries: FileEntry[];
}

const FILESYSTEM: Record<string, Directory> = {
  '/': {
    path: '/',
    entries: [
      { name: 'sys', is_directory: true, size: 0 },
      { name: 'docs', is_directory: true, size: 0 },
      { name: 'boot.cfg', is_directory: false, size: 512 },
      { name: 'kernel.bin', is_directory: false, size: 1048576 },
      { name: 'README.txt', is_directory: false, size: 2048 },
      { name: 'logo.Picture', is_directory: false, size: 65536 },
    ],
  },
  '/sys': {
    path: '/sys',
    entries: [
      { name: '..', is_directory: true, size: 0 },
      { name: 'drivers', is_directory: true, size: 0 },
      { name: 'hal.bin', is_directory: false, size: 256000 },
      { name: 'init.cfg', is_directory: false, size: 1024 },
    ],
  },
  '/docs': {
    path: '/docs',
    entries: [
      { name: '..', is_directory: true, size: 0 },
      { name: 'manual.txt', is_directory: false, size: 4096 },
      { name: 'credits.txt', is_directory: false, size: 1024 },
    ],
  },
};

export const KernelFileBrowser: React.FC = () => {
  const [currentPath, setCurrentPath] = useState('/');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [logs, setLogs] = useState<string[]>(['Kernel File Browser v1.0 initialized.', 'HAL: VGA_MODE 0x13 active.']);
  const [isOpening, setIsOpening] = useState(false);

  const currentDir = FILESYSTEM[currentPath] || FILESYSTEM['/'];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpening) return;

      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : currentDir.entries.length - 1));
          break;
        case 's':
        case 'arrowdown':
          setSelectedIndex(prev => (prev < currentDir.entries.length - 1 ? prev + 1 : 0));
          break;
        case 'enter':
          handleEnter();
          break;
        case 'backspace':
          if (currentPath !== '/') {
            setCurrentPath('/');
            setSelectedIndex(0);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPath, selectedIndex, isOpening]);

  const handleEnter = () => {
    const entry = currentDir.entries[selectedIndex];
    if (entry.is_directory) {
      if (entry.name === '..') {
        setCurrentPath('/');
        setSelectedIndex(0);
      } else {
        const newPath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
        if (FILESYSTEM[newPath]) {
          setCurrentPath(newPath);
          setSelectedIndex(0);
          setLogs(prev => [...prev.slice(-5), `FS: Changed directory to ${newPath}`]);
          kernel.emitEvent('SYSCALL', `SYS_CHDIR (${newPath})`);
        }
      }
    } else {
      setIsOpening(true);
      setLogs(prev => [...prev.slice(-5), `FS: Opening ${entry.name}...`]);
      kernel.emitEvent('SYSCALL', `SYS_OPEN (${entry.name})`);
      setTimeout(() => {
        setIsOpening(false);
        setLogs(prev => [...prev.slice(-5), `FS: ${entry.name} read complete (${entry.size} bytes).`]);
      }, 1000);
    }
  };

  return (
    <div className="h-full bg-black text-green-500 font-mono p-4 flex flex-col border-2 border-green-900/30">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-green-900/50 pb-2 mb-4">
        <div className="flex items-center gap-2">
          <Terminal size={16} />
          <span className="text-xs font-bold uppercase tracking-widest">VC.os Kernel File Browser</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] opacity-70">
          <Cpu size={12} />
          <span>CPU: x86_64 | MEM: 256MB</span>
        </div>
      </div>

      {/* Path */}
      <div className="mb-4 text-xs">
        <span className="text-white opacity-50">Current Path: </span>
        <span className="text-white font-bold underline">{currentPath}</span>
      </div>

      {/* Entry List */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {currentDir.entries.map((entry, i) => (
          <div
            key={entry.name}
            className={`flex items-center gap-2 px-2 py-1 text-sm transition-colors ${
              i === selectedIndex ? 'bg-green-500 text-black' : 'hover:bg-green-900/20'
            }`}
          >
            <div className="w-4 flex justify-center">
              {i === selectedIndex ? <ChevronRight size={14} /> : null}
            </div>
            {entry.is_directory ? (
              <Folder size={14} className={i === selectedIndex ? 'text-black' : 'text-yellow-500'} />
            ) : (
              <File size={14} className={i === selectedIndex ? 'text-black' : 'text-blue-400'} />
            )}
            <span className="flex-1 truncate">{entry.name}</span>
            <span className="text-[10px] opacity-50">
              {entry.is_directory ? '<DIR>' : `${(entry.size / 1024).toFixed(1)} KB`}
            </span>
          </div>
        ))}
      </div>

      {/* Footer / Logs */}
      <div className="mt-4 border-t border-green-900/50 pt-2">
        <div className="text-[10px] opacity-50 mb-1 uppercase tracking-tighter">Kernel Logs:</div>
        <div className="h-16 overflow-y-auto text-[10px] space-y-0.5 scrollbar-hide">
          {logs.map((log, i) => (
            <div key={i} className="flex gap-2">
              <span className="opacity-30">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
              <span>{log}</span>
            </div>
          ))}
          {isOpening && <div className="animate-pulse text-white">READING_SECTOR_DATA...</div>}
        </div>
        
        <div className="mt-2 flex justify-between text-[9px] opacity-40 border-t border-green-900/20 pt-1">
          <span>[W/S] NAVIGATE</span>
          <span>[ENTER] OPEN</span>
          <span>[BACKSPACE] UP</span>
        </div>
      </div>
    </div>
  );
};
