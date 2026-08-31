import React, { useState, useEffect } from 'react';
import { Shield, Activity, Cpu, AlertTriangle, List } from 'lucide-react';
import { kernel, IDTEntry } from '../services/kernel';

export const InterruptMonitor: React.FC = () => {
  const [idt, setIdt] = useState<IDTEntry[]>([]);
  const [recentInterrupts, setRecentInterrupts] = useState<any[]>([]);
  const [view, setView] = useState<'table' | 'flow'>('table');

  useEffect(() => {
    const unsubscribe = kernel.subscribe(() => {
      setIdt([...kernel.idt]);
      setRecentInterrupts(kernel.events.filter(e => e.type === 'INT').slice(-10).reverse());
    });
    return unsubscribe;
  }, []);

  return (
    <div className="flex flex-col h-full bg-win95-gray font-sans text-[11px]">
      <div className="p-2 bg-win95-dark-gray text-white font-bold flex items-center justify-between border-b border-white">
        <div className="flex items-center gap-2">
          <Shield size={16} />
          INTERRUPT_DESCRIPTOR_TABLE.SYS
        </div>
        <div className="flex gap-1 bg-black p-0.5 border border-white">
          <button 
            onClick={() => setView('table')}
            className={`px-2 py-0.5 ${view === 'table' ? 'bg-white text-black' : 'hover:bg-white/20'}`}
          >
            TABLE
          </button>
          <button 
            onClick={() => setView('flow')}
            className={`px-2 py-0.5 ${view === 'flow' ? 'bg-white text-black' : 'hover:bg-white/20'}`}
          >
            FLOW
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col p-2 gap-2">
        {view === 'table' ? (
          <div className="flex-1 border-inset bg-white overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-win95-gray z-10">
                <tr className="border-b border-win95-dark-gray">
                  <th className="p-1 border-r border-win95-dark-gray">Vector</th>
                  <th className="p-1 border-r border-win95-dark-gray">Handler</th>
                  <th className="p-1 border-r border-win95-dark-gray">Description</th>
                  <th className="p-1">Count</th>
                </tr>
              </thead>
              <tbody>
                {idt.map(entry => (
                  <tr 
                    key={entry.vector} 
                    className={`border-b border-win95-gray hover:bg-win95-blue/10 ${entry.count > 0 ? 'bg-green-50' : ''}`}
                  >
                    <td className="p-1 font-mono border-r border-win95-gray">0x{entry.vector.toString(16).toUpperCase().padStart(2, '0')}</td>
                    <td className={`p-1 font-bold border-r border-win95-gray ${entry.handler === 'RESERVED' ? 'text-gray-400' : 'text-blue-700'}`}>
                      {entry.handler}
                    </td>
                    <td className="p-1 border-r border-win95-gray text-gray-600 truncate max-w-[200px]">{entry.description}</td>
                    <td className="p-1 font-mono text-right">{entry.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex-1 border-inset bg-black p-2 font-mono text-green-500 overflow-auto text-[10px]">
              <div className="text-white border-b border-white/20 mb-2 pb-1">REAL-TIME INTERRUPT FLOW</div>
              {recentInterrupts.map((int, i) => (
                <div key={i} className="flex gap-2 mb-1 animate-in fade-in slide-in-from-left-2">
                  <span className="text-gray-500">[{int.time}]</span>
                  <span className="text-blue-400">R{int.ring}</span>
                  <span className="text-yellow-400">INT 0x{int.vector?.toString(16).toUpperCase().padStart(2, '0')}</span>
                  <span className="text-white">{int.message.split(': ')[1]}</span>
                </div>
              ))}
              {recentInterrupts.length === 0 && (
                <div className="text-gray-600 italic">Waiting for hardware interrupts...</div>
              )}
            </div>
            
            <div className="h-24 border-inset bg-win95-gray p-2 flex items-center justify-center gap-8">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full border-4 border-win95-dark-gray bg-black flex items-center justify-center relative overflow-hidden">
                  <Activity size={24} className="text-green-500" />
                  <div className="absolute inset-0 bg-green-500/10 animate-pulse" />
                </div>
                <span className="mt-1 font-bold uppercase text-[9px]">CPU_PIPELINE</span>
              </div>
              <div className="flex-1 h-px bg-win95-dark-gray relative">
                <div className="absolute top-1/2 left-0 w-2 h-2 bg-yellow-400 rounded-full -translate-y-1/2 animate-[ping_2s_infinite]" />
                <div className="absolute top-1/2 right-0 w-2 h-2 bg-blue-400 rounded-full -translate-y-1/2" />
              </div>
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-win95-dark-gray bg-win95-gray flex items-center justify-center">
                  <Shield size={24} className="text-blue-600" />
                </div>
                <span className="mt-1 font-bold uppercase text-[9px]">IDT_CONTROLLER</span>
              </div>
            </div>
          </div>
        )}

        <div className="p-2 border-inset bg-win95-gray flex justify-between items-center text-[9px]">
          <div className="flex gap-4">
            <div className="flex items-center gap-1">
              <span className="text-gray-600 uppercase">Total Interrupts:</span>
              <span className="font-bold">{idt.reduce((acc, curr) => acc + curr.count, 0)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-gray-600 uppercase">Active Vectors:</span>
              <span className="font-bold">{idt.filter(e => e.count > 0).length}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-red-600 font-bold animate-pulse">
            <Cpu size={10} />
            PIPELINE_ACTIVE
          </div>
        </div>
      </div>
    </div>
  );
};
