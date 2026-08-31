import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Timer as TimerIcon, Flag } from 'lucide-react';

export const TimerApp: React.FC = () => {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTime(prev => prev + 10);
      }, 10);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  };

  const handleReset = () => {
    setIsRunning(false);
    setTime(0);
    setLaps([]);
  };

  const handleLap = () => {
    setLaps(prev => [time, ...prev]);
  };

  return (
    <div className="flex flex-col h-full bg-win95-gray font-sans p-4">
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <div className="text-5xl font-mono bg-black text-green-500 p-6 border-inset shadow-inner tracking-widest">
          {formatTime(time)}
        </div>

        <div className="flex gap-4">
          <button 
            onClick={() => setIsRunning(!isRunning)}
            className={`px-6 py-2 border-outset font-bold flex items-center gap-2 active:border-inset ${isRunning ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}
          >
            {isRunning ? <Pause size={18} /> : <Play size={18} />}
            {isRunning ? 'STOP' : 'START'}
          </button>
          
          <button 
            onClick={handleLap}
            disabled={!isRunning}
            className="px-6 py-2 bg-win95-gray border-outset font-bold flex items-center gap-2 active:border-inset disabled:opacity-50"
          >
            <Flag size={18} />
            LAP
          </button>

          <button 
            onClick={handleReset}
            className="px-6 py-2 bg-win95-gray border-outset font-bold flex items-center gap-2 active:border-inset"
          >
            <RotateCcw size={18} />
            RESET
          </button>
        </div>
      </div>

      {laps.length > 0 && (
        <div className="h-32 mt-4 bg-white border-inset overflow-y-auto p-2">
          <div className="text-[10px] font-bold text-gray-500 mb-1 uppercase">Lap History</div>
          {laps.map((lapTime, index) => (
            <div key={index} className="flex justify-between border-b border-win95-gray py-1 text-sm">
              <span className="text-gray-400 font-mono">#{laps.length - index}</span>
              <span className="font-mono">{formatTime(lapTime)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 text-[9px] text-win95-dark-gray text-center uppercase tracking-tighter">
        VC.os High Precision Timing Utility v1.0
      </div>
    </div>
  );
};
