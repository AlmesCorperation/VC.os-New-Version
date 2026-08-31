import React, { useState, useEffect, useRef } from 'react';
import { kernel, KernelEvent, RegisterState } from '../services/kernel';

export const KernelMonitor: React.FC<{ onCrash: () => void, openWindows?: string[] }> = ({ onCrash, openWindows = [] }) => {
  const [events, setEvents] = useState<KernelEvent[]>(kernel.events);
  const [baseTasks, setBaseTasks] = useState<{ pid: number, name: string, state: string, priority: number }[]>([
    { pid: 0, name: 'IDLE', state: 'RUNNING', priority: 0 },
    { pid: 1, name: 'INIT', state: 'SLEEPING', priority: 1 },
    { pid: 2, name: 'KBD_DRV', state: 'WAITING', priority: 5 },
    { pid: 3, name: 'VFS_SRV', state: 'SLEEPING', priority: 3 },
    { pid: 4, name: 'PIT_AUDIO', state: 'WAITING', priority: 4 },
  ]);
  const [registers, setRegisters] = useState<RegisterState>(kernel.registers);
  const scrollRef = useRef<HTMLDivElement>(null);

  const tasks = [
    ...baseTasks,
    ...openWindows.map((win, i) => ({
      pid: 10 + i,
      name: win.toUpperCase(),
      state: 'RUNNING',
      priority: 10
    }))
  ];

  useEffect(() => {
    const unsubscribe = kernel.subscribe(() => {
      setEvents([...kernel.events]);
      setRegisters({ ...kernel.registers });
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="h-full flex flex-col font-sans text-[10px] gap-1 bg-win95-gray p-1 overflow-hidden">
      <div className="grid grid-cols-2 gap-1 flex-1 min-h-0">
        {/* Kernel Logs */}
        <div className="flex flex-col border-inset bg-black text-green-500 p-2 overflow-hidden font-mono">
          <div className="opacity-50 mb-1 border-b border-green-500/20 pb-1 flex justify-between">
            <span>KERNEL_RING_BUFFER (x86_32_ASM)</span>
            <span className="text-[8px]">v0.0.1-barebones</span>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide" ref={scrollRef}>
            {events.map((ev, i) => (
              <div key={i} className="flex gap-2 leading-tight">
                <span className="opacity-40">[{ev.time}]</span>
                <span className={`font-bold ${
                  ev.type === 'IRQ' ? 'text-red-400' : 
                  ev.type === 'SYSCALL' ? 'text-blue-400' : 
                  ev.type === 'MEM' ? 'text-yellow-400' : 
                  ev.type === 'TASK' ? 'text-purple-400' : 'text-green-300'
                }`}>
                  {ev.type}
                </span>
                <span className="truncate">{ev.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CPU Registers */}
        <div className="flex flex-col border-inset bg-win95-gray p-2 overflow-hidden">
          <div className="font-bold border-b border-win95-dark-gray mb-1 uppercase text-[9px]">CPU_REGISTERS (x86_32)</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[9px]">
            {Object.entries(registers).map(([reg, val]) => (
              <div key={reg} className="flex justify-between border-b border-win95-dark-gray/20">
                <span className="font-bold text-win95-dark-gray">{reg}:</span>
                <span className="text-blue-800">{val}</span>
              </div>
            ))}
          </div>
          
          <div className="mt-2 flex-1 flex flex-col">
            <div className="font-bold border-b border-win95-dark-gray mb-1 uppercase text-[9px]">MEMORY_MAP</div>
            <div className="flex-1 bg-white border-inset p-1 font-mono text-[8px] overflow-y-auto">
              <div className="flex justify-between text-win95-dark-gray border-b">
                <span>RANGE</span>
                <span>TYPE</span>
              </div>
              <div className="flex justify-between"><span>00000-003FF</span><span>IDT</span></div>
              <div className="flex justify-between"><span>00400-004FF</span><span>BDA</span></div>
              <div className="flex justify-between"><span>00500-07BFF</span><span>FREE</span></div>
              <div className="flex justify-between text-blue-600"><span>07C00-07DFF</span><span>BOOT</span></div>
              <div className="flex justify-between text-red-600"><span>00100000-</span><span>KERNEL</span></div>
              <div className="flex justify-between text-green-600"><span>01000000-</span><span>USER</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Scheduler Table */}
      <div className="h-32 border-inset bg-white p-1 overflow-hidden flex flex-col">
        <div className="font-bold border-b border-win95-gray mb-1 flex justify-between items-center px-1">
          <span className="text-[9px]">PROCESS_SCHEDULER (Round-Robin)</span>
          <span className="text-[8px] opacity-50">TICKS: {Math.floor(Date.now() / 1000) % 10000}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-[9px]">
            <thead className="sticky top-0 bg-white">
              <tr className="opacity-50 border-b">
                <th className="px-1">PID</th>
                <th className="px-1">NAME</th>
                <th className="px-1">STATE</th>
                <th className="px-1">PRIO</th>
                <th className="px-1">MEM_USAGE</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(t => (
                <tr key={t.pid} className="border-b border-win95-gray/10 hover:bg-win95-blue/10">
                  <td className="px-1">{t.pid}</td>
                  <td className="px-1 font-bold">{t.name}</td>
                  <td className="px-1">
                    <span className={`px-1 rounded-sm ${
                      t.state === 'RUNNING' ? 'bg-green-100 text-green-800 font-bold' : 
                      t.state === 'WAITING' ? 'bg-yellow-100 text-yellow-800' : 'bg-zinc-100 text-zinc-600'
                    }`}>
                      {t.state}
                    </span>
                  </td>
                  <td className="px-1">{t.priority}</td>
                  <td className="px-1 font-mono">{Math.floor(Math.random() * 1024)} KB</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
