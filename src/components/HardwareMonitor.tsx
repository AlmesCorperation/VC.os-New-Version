import React, { useState, useEffect } from 'react';
import { PALETTE } from '../constants';
import { Zap, ShieldCheck, ShieldAlert, Activity } from 'lucide-react';
import { vfs } from '../services/vfs';
import { useSettings } from '../hooks/useSettings';
import { kernel, CPURing } from '../services/kernel';

export const HardwareMonitor: React.FC<{ onCrash: () => void }> = ({ onCrash }) => {
  const [cpuLoad, setCpuLoad] = useState<number[]>(kernel.cpuLoad);
  const [memUsage, setMemUsage] = useState(kernel.memUsage);
  const [currentRing, setCurrentRing] = useState<CPURing>(kernel.currentRing);
  const [integrity, setIntegrity] = useState<'NOMINAL' | 'DEGRADED' | 'CRITICAL'>('NOMINAL');
  const { performanceMode, setPerformanceMode } = useSettings();

  useEffect(() => {
    const unsubscribe = kernel.subscribe(() => {
      setCpuLoad([...kernel.cpuLoad]);
      setMemUsage(kernel.memUsage);
      setCurrentRing(kernel.currentRing);
    });

    const interval = setInterval(() => {
      // Check VFS Integrity
      const files = vfs.ls();
      const hasKernel = files.includes('kernel.sys');
      const hasLogs = files.includes('sys_logs.dat');
      const kernelFile = vfs.getFile('kernel.sys');
      
      if (!hasKernel || !hasLogs) {
        setIntegrity('CRITICAL');
      } else if (kernelFile?.isCorrupted) {
        setIntegrity('DEGRADED');
      } else {
        setIntegrity('NOMINAL');
      }
    }, 500);
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  return (
    <div className="space-y-4 font-sans text-[11px] p-2 bg-win95-gray h-full overflow-y-auto">
      <div className="flex items-center justify-between p-2 border-inset bg-white">
        <div className="flex items-center gap-2">
          {integrity === 'NOMINAL' ? <ShieldCheck size={14} className="text-green-600" /> : <ShieldAlert size={14} className={integrity === 'CRITICAL' ? 'text-red-600 animate-pulse' : 'text-yellow-600'} />}
          <span className="font-bold">SYSTEM_INTEGRITY</span>
        </div>
        <span className={`font-bold ${integrity === 'NOMINAL' ? 'text-green-600' : integrity === 'CRITICAL' ? 'text-red-600' : 'text-yellow-600'}`}>
          {integrity}
        </span>
      </div>

      <div className="border-inset p-2 bg-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-blue-600" />
            <span className="font-bold">PERFORMANCE_MODE</span>
          </div>
          <button 
            onClick={() => setPerformanceMode(!performanceMode)}
            className={`px-3 py-1 border-outset font-bold active:border-inset ${performanceMode ? 'bg-green-600 text-white' : 'bg-win95-gray text-black'}`}
          >
            {performanceMode ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>
        <p className="text-[9px] text-gray-500 leading-tight">
          When enabled, heavy animations and 3D rendering are disabled to prevent browser crashes on low-end devices.
        </p>
      </div>

      <div className="border-inset p-2 bg-white">
        <div className="flex justify-between mb-1">
          <span className="font-bold">CPU_PRIVILEGE_LEVEL</span>
          <span className={`font-bold ${currentRing === CPURing.RING_0 ? 'text-red-600' : 'text-blue-600'}`}>
            RING_{currentRing} ({currentRing === CPURing.RING_0 ? 'KERNEL' : 'USER'})
          </span>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2, 3].map(ring => (
            <div 
              key={ring}
              className={`flex-1 h-2 border ${currentRing === ring ? (ring === 0 ? 'bg-red-500' : 'bg-blue-500') : 'bg-gray-200'}`}
            />
          ))}
        </div>
      </div>

      <div className="border-inset p-2 bg-white">
        <div className="flex justify-between mb-1">
          <span className="font-bold">CPU_CORE_0</span>
          <span>{cpuLoad[cpuLoad.length - 1].toFixed(1)}%</span>
        </div>
        <div className="h-16 flex items-end gap-0.5 border-b border-win95-dark-gray bg-zinc-50">
          {cpuLoad.map((load, i) => (
            <div
              key={i}
              className="flex-1 bg-win95-blue"
              style={{ height: `${load}%`, opacity: 0.3 + (i / 20) * 0.7 }}
            />
          ))}
        </div>
      </div>

      <div className="border-inset p-2 bg-white">
        <div className="flex justify-between mb-1">
          <span className="font-bold">MICROKERNEL_SERVERS</span>
          <span>{kernel.servers.length} RUNNING</span>
        </div>
        <div className="space-y-1">
          {kernel.servers.map(srv => (
            <div key={srv.pid} className="flex justify-between text-[10px]">
              <span className="font-mono">[{srv.pid}] {srv.name}</span>
              <span className={`font-mono ${srv.status === 'ACTIVE' ? 'text-green-600' : srv.status === 'WAITING_IPC' ? 'text-blue-500' : 'text-red-500'}`}>
                {srv.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-inset p-2 bg-white">
        <div className="flex justify-between mb-1">
          <span className="font-bold">MEM_ALLOC</span>
          <span>{memUsage.toFixed(1)}MB / 128MB</span>
        </div>
        <div className="h-4 border-inset bg-zinc-100 overflow-hidden">
          <div 
            className="h-full bg-win95-blue transition-all duration-500"
            style={{ width: `${(memUsage / 128) * 100}%` }}
          />
        </div>
      </div>

      <div className="p-2 border-inset text-[10px] bg-white">
        <div className="flex justify-between font-bold border-b border-win95-gray mb-1">
          <span>IDT_VECTOR</span>
          <span>COUNT</span>
        </div>
        {kernel.idt.filter(e => e.count > 0).slice(-5).map(e => (
          <div key={e.vector} className="flex justify-between">
            <span className="text-blue-700">0x{e.vector.toString(16).toUpperCase()} ({e.handler})</span>
            <span className="font-mono">{e.count}</span>
          </div>
        ))}
        {kernel.idt.filter(e => e.count > 0).length === 0 && (
          <div className="text-gray-400 italic">No interrupts recorded.</div>
        )}
      </div>

      <div className="pt-2">
        <button 
          onClick={onCrash}
          className="w-full flex items-center justify-center gap-2 bg-win95-gray border-outset py-1 hover:bg-zinc-200 active:border-inset font-bold uppercase"
        >
          <Zap size={14} className="text-red-600" />
          Trigger RSOD
        </button>
      </div>
    </div>
  );
};
