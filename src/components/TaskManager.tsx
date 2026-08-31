import React from 'react';
import { X, Activity, Terminal, Monitor, Gamepad2, ShoppingBag, Shield, Globe, Folder, Settings, Search, HelpCircle, FileText, Bug, Cpu } from 'lucide-react';

interface TaskManagerProps {
  openWindows: string[];
  activeWindow: string | null;
  closeWindow: (id: string) => void;
  bringToFront: (id: string) => void;
  windowTitles: Record<string, string>;
}

export const TaskManager: React.FC<TaskManagerProps> = ({ 
  openWindows, 
  activeWindow, 
  closeWindow, 
  bringToFront,
  windowTitles
}) => {
  const getIcon = (id: string) => {
    if (id.startsWith('notepad-')) return <FileText size={14} />;
    if (id === 'kernelbrowser') return <Terminal size={14} />;
    if (id === 'sys') return <Activity size={14} />;
    if (id === 'kern') return <Shield size={14} />;
    if (id === 'vcengine') return <Monitor size={14} />;
    if (id === 'search') return <Globe size={14} />;
    if (id === 'store') return <ShoppingBag size={14} />;
    if (id === 'edit') return <Bug size={14} />;
    if (id === 'find') return <Search size={14} />;
    if (id === 'help') return <HelpCircle size={14} />;
    if (id === 'docs') return <Folder size={14} />;
    if (id === 'fileman') return <Cpu size={14} />;
    if (id === 'linux') return <Terminal size={14} />;
    return <Gamepad2 size={14} />;
  };

  return (
    <div className="flex flex-col h-full bg-win95-gray font-sans text-[11px]">
      <div className="p-2 bg-win95-dark-gray text-white font-bold flex items-center gap-2 border-b border-white">
        <Activity size={16} />
        TASK_MANAGER.EXE
      </div>
      
      <div className="flex-1 overflow-auto p-1 bg-white m-1 border-inset">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-win95-gray border-b border-win95-dark-gray">
              <th className="p-1 font-bold border-r border-win95-dark-gray">Task</th>
              <th className="p-1 font-bold border-r border-win95-dark-gray">Status</th>
              <th className="p-1 font-bold">Action</th>
            </tr>
          </thead>
          <tbody>
            {openWindows.map(id => (
              <tr 
                key={id} 
                className={`border-b border-win95-gray hover:bg-win95-blue/10 cursor-pointer ${activeWindow === id ? 'bg-win95-blue/20' : ''}`}
                onClick={() => bringToFront(id)}
              >
                <td className="p-1 flex items-center gap-2 truncate">
                  {getIcon(id)}
                  <span className="truncate">{windowTitles[id] || id.toUpperCase()}</span>
                </td>
                <td className="p-1 text-green-600 font-bold">Running</td>
                <td className="p-1">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      closeWindow(id);
                    }}
                    className="px-2 py-0.5 bg-win95-gray border-outset hover:bg-red-100 text-red-600 flex items-center gap-1 active:border-inset"
                  >
                    <X size={10} />
                    End Task
                  </button>
                </td>
              </tr>
            ))}
            {openWindows.length === 0 && (
              <tr>
                <td colSpan={3} className="p-4 text-center text-gray-400 italic">
                  No active tasks found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-2 bg-win95-gray border-t border-white flex justify-between items-center">
        <div className="flex gap-4">
          <div className="flex items-center gap-1">
            <span className="text-gray-600">CPU:</span>
            <span className="font-mono">{Math.floor(Math.random() * 15) + 2}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-600">MEM:</span>
            <span className="font-mono">{openWindows.length * 12 + 42}MB</span>
          </div>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-1 bg-win95-gray border-outset font-bold active:border-inset"
        >
          Restart System
        </button>
      </div>
    </div>
  );
};
