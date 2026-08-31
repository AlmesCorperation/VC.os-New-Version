import React, { useState } from 'react';
import { Terminal, Cpu, Database, Shield, Zap, Bug, Code, RefreshCw, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { kernel } from '../services/kernel';

interface DevToolsProps {
  onPanic?: () => void;
}

export const DevTools: React.FC<DevToolsProps> = ({ onPanic }) => {
  const [activeTab, setActiveTab] = useState<'kernel' | 'memory' | 'network' | 'security'>('kernel');
  const [isOverclocking, setIsOverclocking] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    '[0.000000] Initializing DevTools context for user: KEO',
    '[0.000412] Bypassing standard security protocols...',
    '[0.000845] Accessing raw framebuffer at 0xA0000000',
    '[0.001254] Hooking system calls: [OPEN, READ, WRITE, EXECUTE]'
  ]);

  const addLog = (msg: string) => {
    const timestamp = (performance.now() / 1000).toFixed(6);
    setLogs(prev => [...prev.slice(-15), `[${timestamp}] ${msg}`]);
  };

  const handleInject = () => {
    const payloads = [
      'Injecting shellcode into win_mgr.exe...',
      'Memory corruption successful at 0x7FFF0012',
      'Elevating process privileges to SYSTEM...',
      'Bypassing DEP/ASLR protections...'
    ];
    const msg = payloads[Math.floor(Math.random() * payloads.length)];
    addLog(msg);
    kernel.emitEvent('CRITICAL', `DEVTOOLS: ${msg}`);
  };

  const handleReload = () => {
    setLogs(['[0.000000] System re-initialization requested...', '[0.000120] Flushing instruction cache...', '[0.000250] Reloading kernel modules...']);
    addLog('Hot reload complete. All systems nominal.');
    kernel.emitEvent('TASK', 'DEVTOOLS: HOT_RELOAD');
  };

  const stats = [
    { label: 'Kernel Threads', value: isOverclocking ? '892' : '142', icon: <Cpu size={14} /> },
    { label: 'Memory Pressure', value: isOverclocking ? '88%' : '12%', icon: <Database size={14} /> },
    { label: 'Sandbox Integrity', value: isOverclocking ? '14.2%' : '99.9%', icon: <Shield size={14} /> },
    { label: 'IOPS', value: isOverclocking ? '99.1k' : '12.4k', icon: <Zap size={14} /> },
  ];

  return (
    <div className="flex flex-col h-full bg-win95-gray text-black font-sans overflow-hidden">
      {/* Dev Header */}
      <div className="bg-gradient-to-r from-red-900 to-red-600 p-2 flex items-center justify-between text-white border-b border-black">
        <div className="flex items-center gap-2">
          <Bug size={18} />
          <span className="font-bold text-xs tracking-widest uppercase">Developer Access: Level 0</span>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono">
          <span className="animate-pulse">● LIVE_DEBUGGER</span>
          <span>BUILD: 2026.03.11</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-win95-gray border-b border-win95-dark-gray">
        {(['kernel', 'memory', 'network', 'security'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              addLog(`Switched to ${tab.toUpperCase()} context.`);
            }}
            className={`px-4 py-1 text-[11px] font-bold border-r border-win95-dark-gray transition-colors ${
              activeTab === tab ? 'bg-white shadow-inner' : 'hover:bg-zinc-200'
            }`}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 flex gap-4 overflow-hidden">
        {/* Sidebar Stats */}
        <div className="w-48 flex flex-col gap-2">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white border-inset p-2 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-win95-dark-gray">
                {stat.icon}
                <span className="text-[9px] font-bold uppercase">{stat.label}</span>
              </div>
              <span className={`text-xl font-mono font-bold ${isOverclocking ? 'text-red-500 animate-pulse' : 'text-red-700'}`}>
                {stat.value}
              </span>
            </div>
          ))}
          
          <button 
            onClick={() => {
              setIsOverclocking(!isOverclocking);
              const msg = isOverclocking ? 'Overclocking disabled. Cooling down...' : 'WARNING: CPU Overclocking engaged. Thermal limits bypassed.';
              addLog(msg);
              kernel.emitEvent('CRITICAL', `DEVTOOLS: ${msg}`);
            }}
            className={`mt-auto p-2 border-outset font-bold text-[10px] flex items-center justify-center gap-2 transition-all ${
              isOverclocking ? 'bg-red-600 text-white animate-pulse' : 'bg-win95-gray'
            }`}
          >
            <Zap size={14} />
            {isOverclocking ? 'OVERCLOCKING...' : 'FORCE OVERCLOCK'}
          </button>
        </div>

        {/* Main Console */}
        <div className="flex-1 flex flex-col bg-black border-inset rounded overflow-hidden">
          <div className="flex-1 p-3 font-mono text-[11px] text-green-500 overflow-y-auto">
            <div className="text-red-500 mb-2"># VC.os Kernel Debugger v4.2.0</div>
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
            
            <div className="mt-4 text-white underline">ACTIVE_PROCESSES:</div>
            <div className="grid grid-cols-[80px_1fr_60px] gap-2 opacity-80">
              <span>PID</span><span>NAME</span><span>MEM</span>
              <span>001</span><span>kernel.sys</span><span>12MB</span>
              <span>042</span><span>win_mgr.exe</span><span>45MB</span>
              <span>108</span><span>vc_linux.bin</span><span>128MB</span>
              <span className="text-red-400">666</span><span className="text-red-400">rootkit.vxd</span><span className="text-red-400">???</span>
            </div>
            
            <div className="mt-4 flex gap-2">
              <span className="text-blue-400">dev@vcos:~$</span>
              <span className="animate-pulse">_</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-[#222] p-2 flex gap-2 border-t border-win95-dark-gray">
            <button 
              onClick={handleInject}
              className="px-3 py-1 bg-win95-gray border-outset text-[10px] font-bold flex items-center gap-1 active:border-inset"
            >
              <Code size={12} /> INJECT_CODE
            </button>
            <button 
              onClick={handleReload}
              className="px-3 py-1 bg-win95-gray border-outset text-[10px] font-bold flex items-center gap-1 active:border-inset"
            >
              <RefreshCw size={12} /> HOT_RELOAD
            </button>
            <button 
              onClick={() => {
                addLog('CRITICAL ERROR: KERNEL PANIC INITIATED BY USER');
                setTimeout(() => onPanic?.(), 500);
              }}
              className="px-3 py-1 bg-win95-gray border-outset text-[10px] font-bold flex items-center gap-1 text-red-700 active:border-inset"
            >
              <AlertCircle size={12} /> KERNEL_PANIC
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-win95-gray p-1 px-3 text-[9px] text-win95-dark-gray flex justify-between border-t border-win95-white/50">
        <span>ROOT_PRIVILEGES: GRANTED</span>
        <span className="text-red-600 font-bold">UNSAFE_MODE</span>
      </div>
    </div>
  );
};
