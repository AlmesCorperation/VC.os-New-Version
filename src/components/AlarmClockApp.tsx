import React, { useState, useEffect, useRef } from 'react';
import { AlarmClock as AlarmIcon, Plus, Trash2, Bell, BellOff, Volume2, Save } from 'lucide-react';
import { kernel } from '../services/kernel';

interface Alarm {
  id: string;
  time: string;
  label: string;
  isEnabled: boolean;
}

export const AlarmClockApp: React.FC = () => {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [newAlarmTime, setNewAlarmTime] = useState('08:00');
  const [newAlarmLabel, setNewAlarmLabel] = useState('Wake Up');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [ringingAlarm, setRingingAlarm] = useState<Alarm | null>(null);
  
  const audioContext = useRef<AudioContext | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      
      // Check for alarms
      const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).slice(0, 5);
      
      alarms.forEach(alarm => {
        if (alarm.isEnabled && alarm.time === timeStr && now.getSeconds() === 0) {
          triggerAlarm(alarm);
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [alarms]);

  const triggerAlarm = (alarm: Alarm) => {
    setRingingAlarm(alarm);
    kernel.emitEvent('TASK', `ALARM_TRIGGERED: ${alarm.label.toUpperCase()}`);
    
    // Play sound if supported
    try {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      playBip(440, 0.5);
    } catch (e) {
      console.warn('Audio not supported', e);
    }
  };

  const playBip = (freq: number, duration: number) => {
    if (!audioContext.current) return;
    const osc = audioContext.current.createOscillator();
    const gain = audioContext.current.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, audioContext.current.currentTime);
    gain.gain.setValueAtTime(0.1, audioContext.current.currentTime);
    osc.connect(gain);
    gain.connect(audioContext.current.destination);
    osc.start();
    osc.stop(audioContext.current.currentTime + duration);
  };

  const addAlarm = () => {
    const newAlarm: Alarm = {
      id: Math.random().toString(36).substr(2, 9),
      time: newAlarmTime,
      label: newAlarmLabel || 'Alarm',
      isEnabled: true
    };
    setAlarms(prev => [...prev, newAlarm]);
    setNewAlarmLabel('');
  };

  const removeAlarm = (id: string) => {
    setAlarms(prev => prev.filter(a => a.id !== id));
  };

  const toggleAlarm = (id: string) => {
    setAlarms(prev => prev.map(a => a.id === id ? { ...a, isEnabled: !a.isEnabled } : a));
  };

  const stopRinging = () => {
    setRingingAlarm(null);
  };

  return (
    <div className="flex flex-col h-full bg-win95-gray font-sans overflow-hidden">
      {/* Alarm Status Overlay */}
      {ringingAlarm && (
        <div className="absolute inset-0 z-50 bg-red-600 flex flex-col items-center justify-center animate-pulse p-4 text-white text-center">
          <Bell size={64} className="mb-4" />
          <h1 className="text-3xl font-black mb-2 uppercase tracking-tighter">! ALARM TRIGGERED !</h1>
          <p className="text-xl mb-8 border-y border-white py-2 w-full">{ringingAlarm.label}</p>
          <button 
            onClick={stopRinging}
            className="px-12 py-4 bg-white text-red-600 font-black text-xl border-outset border-gray-300 active:border-inset active:translate-y-1 shadow-lg"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Main UI */}
      <div className="p-4 flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Clock Display */}
        <div className="bg-black p-4 border-inset flex flex-col items-center justify-center shrink-0">
          <div className="text-4xl font-mono text-green-500 tracking-widest leading-none">
            {currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-[10px] text-green-800 font-mono mt-1 uppercase">VC.os System Time</div>
        </div>

        {/* Add Alarm */}
        <div className="bg-win95-gray border-inset p-3 space-y-3 shrink-0">
          <div className="text-[10px] font-bold text-gray-700 uppercase flex items-center gap-1">
            <Plus size={10} /> Add New Alarm
          </div>
          <div className="flex gap-2">
            <input 
              type="time" 
              value={newAlarmTime}
              onChange={(e) => setNewAlarmTime(e.target.value)}
              className="bg-white border-inset p-1 text-sm outline-none focus:ring-1 focus:ring-win95-blue"
            />
            <input 
              type="text" 
              placeholder="Label (e.g. Work)"
              value={newAlarmLabel}
              onChange={(e) => setNewAlarmLabel(e.target.value)}
              className="flex-1 bg-white border-inset p-1 text-sm outline-none focus:ring-1 focus:ring-win95-blue"
            />
            <button 
              onClick={addAlarm}
              className="px-3 bg-win95-gray border-outset font-bold active:border-inset hover:bg-white"
            >
              ADD
            </button>
          </div>
        </div>

        {/* Alarm List */}
        <div className="flex-1 border-inset bg-white overflow-y-auto">
          <div className="sticky top-0 bg-gray-100 p-1 border-b text-[8px] font-bold text-gray-500 uppercase flex justify-between">
            <span>Active Alarms</span>
            <span>Total: {alarms.length}</span>
          </div>
          {alarms.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400 italic text-[10px]">
              No alarms set.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {alarms.map(alarm => (
                <div key={alarm.id} className={`p-2 flex items-center gap-3 ${!alarm.isEnabled ? 'opacity-50' : ''}`}>
                  <button 
                    onClick={() => toggleAlarm(alarm.id)}
                    className={`p-1 border shadow-sm ${alarm.isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-400'}`}
                  >
                    {alarm.isEnabled ? <Bell size={14} /> : <BellOff size={14} />}
                  </button>
                  <div className="flex-1">
                    <div className="text-sm font-bold font-mono">{alarm.time}</div>
                    <div className="text-[9px] text-gray-500 uppercase truncate max-w-[120px]">{alarm.label}</div>
                  </div>
                  <button 
                    onClick={() => removeAlarm(alarm.id)}
                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-2 bg-win95-gray border-t border-white flex items-center justify-between text-[9px] text-win95-dark-gray uppercase tracking-tighter shrink-0">
        <div className="flex items-center gap-1">
          <Volume2 size={10} /> Audio System: Ready
        </div>
        <div>v1.0.0-PRO</div>
      </div>
    </div>
  );
};
