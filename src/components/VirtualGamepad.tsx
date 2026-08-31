import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Gamepad2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Circle, Crosshair } from 'lucide-react';

export interface VirtualGamepadProps {
  onDirectionPress?: (dir: 'up' | 'down' | 'left' | 'right') => void;
  onDirectionRelease?: (dir: 'up' | 'down' | 'left' | 'right') => void;
  onDirectionChange?: (vector: { x: number; y: number; angle: number; active: boolean }) => void;
  onButtonPress?: (btn: string) => void;
  onButtonRelease?: (btn: string) => void;
  // Key mappings to dispatch synthetic KeyboardEvents automatically
  keyMap?: {
    up?: string;
    down?: string;
    left?: string;
    right?: string;
    a?: string;
    b?: string;
    x?: string;
    y?: string;
    select?: string;
    start?: string;
  };
  customButtons?: Array<{
    id: string;
    label: string;
    color?: string;
    key?: string;
    icon?: React.ReactNode;
  }>;
  showJoystick?: boolean;
  showDpad?: boolean;
  showActions?: boolean;
  className?: string;
  compact?: boolean;
}

export const VirtualGamepad: React.FC<VirtualGamepadProps> = ({
  onDirectionPress,
  onDirectionRelease,
  onDirectionChange,
  onButtonPress,
  onButtonRelease,
  keyMap = {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    a: ' ',
    b: 'Shift',
    start: 'Enter'
  },
  customButtons,
  showJoystick = false,
  showDpad = true,
  showActions = true,
  className = '',
  compact = false,
}) => {
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<'dpad' | 'joystick'>(showJoystick ? 'joystick' : 'dpad');
  
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const activeTouchId = useRef<number | null>(null);

  // Dispatch real KeyboardEvent to window
  const dispatchKey = useCallback((keyName: string, type: 'keydown' | 'keyup') => {
    if (!keyName) return;
    try {
      const code = keyName === ' ' ? 'Space' : 
                   keyName === 'Enter' ? 'Enter' : 
                   keyName.startsWith('Arrow') ? keyName : 
                   `Key${keyName.toUpperCase()}`;
      
      const event = new KeyboardEvent(type, {
        key: keyName,
        code: code,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(event);
    } catch (e) {
      console.warn("KeyboardEvent dispatch error:", e);
    }
  }, []);

  const triggerHaptic = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch (e) {}
  };

  const handlePress = useCallback((dirOrBtn: 'up' | 'down' | 'left' | 'right' | string, mappedKey?: string) => {
    triggerHaptic();
    setActiveKeys(prev => new Set(prev).add(dirOrBtn));

    if (['up', 'down', 'left', 'right'].includes(dirOrBtn)) {
      const dir = dirOrBtn as 'up' | 'down' | 'left' | 'right';
      onDirectionPress?.(dir);
      const key = mappedKey || keyMap[dir];
      if (key) dispatchKey(key, 'keydown');
    } else {
      onButtonPress?.(dirOrBtn);
      if (mappedKey) dispatchKey(mappedKey, 'keydown');
    }
  }, [keyMap, onDirectionPress, onButtonPress, dispatchKey]);

  const handleRelease = useCallback((dirOrBtn: 'up' | 'down' | 'left' | 'right' | string, mappedKey?: string) => {
    setActiveKeys(prev => {
      const next = new Set(prev);
      next.delete(dirOrBtn);
      return next;
    });

    if (['up', 'down', 'left', 'right'].includes(dirOrBtn)) {
      const dir = dirOrBtn as 'up' | 'down' | 'left' | 'right';
      onDirectionRelease?.(dir);
      const key = mappedKey || keyMap[dir];
      if (key) dispatchKey(key, 'keyup');
    } else {
      onButtonRelease?.(dirOrBtn);
      if (mappedKey) dispatchKey(mappedKey, 'keyup');
    }
  }, [keyMap, onDirectionRelease, onButtonRelease, dispatchKey]);

  // Joystick touch handlers
  const handleJoystickStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    triggerHaptic();
    setJoystickActive(true);
    updateJoystick(e);
  };

  const updateJoystick = (e: React.TouchEvent | React.MouseEvent) => {
    if (!joystickBaseRef.current) return;
    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      const touch = e.touches[0];
      if (!touch) return;
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const maxRadius = rect.width / 2;
    const rawDx = clientX - centerX;
    const rawDy = clientY - centerY;
    const distance = Math.hypot(rawDx, rawDy);
    const angle = Math.atan2(rawDy, rawDx);

    const clampedRadius = Math.min(distance, maxRadius);
    const normX = (clampedRadius / maxRadius) * Math.cos(angle);
    const normY = (clampedRadius / maxRadius) * Math.sin(angle);

    setJoystickPos({
      x: normX * (maxRadius * 0.7),
      y: normY * (maxRadius * 0.7)
    });

    onDirectionChange?.({
      x: normX,
      y: normY,
      angle,
      active: true
    });

    // Map to synthetic D-Pad direction keys if above threshold
    const threshold = 0.35;
    const nextDirs: ('up' | 'down' | 'left' | 'right')[] = [];
    if (normY < -threshold) nextDirs.push('up');
    if (normY > threshold) nextDirs.push('down');
    if (normX < -threshold) nextDirs.push('left');
    if (normX > threshold) nextDirs.push('right');

    const allDirs: ('up' | 'down' | 'left' | 'right')[] = ['up', 'down', 'left', 'right'];
    allDirs.forEach(dir => {
      const isTarget = nextDirs.includes(dir);
      const isCurrentlyActive = activeKeys.has(dir);
      if (isTarget && !isCurrentlyActive) {
        handlePress(dir);
      } else if (!isTarget && isCurrentlyActive) {
        handleRelease(dir);
      }
    });
  };

  const handleJoystickEnd = () => {
    setJoystickActive(false);
    setJoystickPos({ x: 0, y: 0 });
    onDirectionChange?.({ x: 0, y: 0, angle: 0, active: false });
    ['up', 'down', 'left', 'right'].forEach(dir => {
      if (activeKeys.has(dir)) handleRelease(dir);
    });
  };

  return (
    <div className={`select-none pointer-events-auto flex items-end justify-between w-full p-2 sm:p-3 text-white font-mono ${className}`}>
      {/* Left Control: D-Pad or Virtual Joystick */}
      <div className="flex flex-col items-center gap-1">
        {mode === 'dpad' && showDpad && (
          <div className={`relative ${compact ? 'w-28 h-28' : 'w-36 h-36 sm:w-40 sm:h-40'} bg-black/40 backdrop-blur-sm border-2 border-white/40 rounded-full p-2 shadow-2xl flex items-center justify-center`}>
            {/* Center Cap */}
            <div className="absolute w-8 h-8 rounded-full bg-zinc-800 border border-zinc-600 shadow-inner z-10 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-zinc-500" />
            </div>

            {/* UP */}
            <button
              type="button"
              className={`absolute top-1 left-1/2 -translate-x-1/2 w-10 h-11 sm:w-11 sm:h-12 bg-gradient-to-b from-zinc-700 to-zinc-800 active:from-blue-600 active:to-blue-800 border-2 border-white/60 rounded-t-lg flex items-center justify-center shadow-lg transition-all ${
                activeKeys.has('up') ? 'scale-95 bg-blue-600 border-yellow-400 text-yellow-300 ring-2 ring-yellow-400' : 'text-white'
              }`}
              onMouseDown={() => handlePress('up')}
              onMouseUp={() => handleRelease('up')}
              onMouseLeave={() => activeKeys.has('up') && handleRelease('up')}
              onTouchStart={(e) => { e.preventDefault(); handlePress('up'); }}
              onTouchEnd={(e) => { e.preventDefault(); handleRelease('up'); }}
              aria-label="Up"
            >
              <ArrowUp size={20} className="filter drop-shadow" />
            </button>

            {/* DOWN */}
            <button
              type="button"
              className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-10 h-11 sm:w-11 sm:h-12 bg-gradient-to-t from-zinc-700 to-zinc-800 active:from-blue-600 active:to-blue-800 border-2 border-white/60 rounded-b-lg flex items-center justify-center shadow-lg transition-all ${
                activeKeys.has('down') ? 'scale-95 bg-blue-600 border-yellow-400 text-yellow-300 ring-2 ring-yellow-400' : 'text-white'
              }`}
              onMouseDown={() => handlePress('down')}
              onMouseUp={() => handleRelease('down')}
              onMouseLeave={() => activeKeys.has('down') && handleRelease('down')}
              onTouchStart={(e) => { e.preventDefault(); handlePress('down'); }}
              onTouchEnd={(e) => { e.preventDefault(); handleRelease('down'); }}
              aria-label="Down"
            >
              <ArrowDown size={20} className="filter drop-shadow" />
            </button>

            {/* LEFT */}
            <button
              type="button"
              className={`absolute left-1 top-1/2 -translate-y-1/2 w-11 h-10 sm:w-12 sm:h-11 bg-gradient-to-r from-zinc-700 to-zinc-800 active:from-blue-600 active:to-blue-800 border-2 border-white/60 rounded-l-lg flex items-center justify-center shadow-lg transition-all ${
                activeKeys.has('left') ? 'scale-95 bg-blue-600 border-yellow-400 text-yellow-300 ring-2 ring-yellow-400' : 'text-white'
              }`}
              onMouseDown={() => handlePress('left')}
              onMouseUp={() => handleRelease('left')}
              onMouseLeave={() => activeKeys.has('left') && handleRelease('left')}
              onTouchStart={(e) => { e.preventDefault(); handlePress('left'); }}
              onTouchEnd={(e) => { e.preventDefault(); handleRelease('left'); }}
              aria-label="Left"
            >
              <ArrowLeft size={20} className="filter drop-shadow" />
            </button>

            {/* RIGHT */}
            <button
              type="button"
              className={`absolute right-1 top-1/2 -translate-y-1/2 w-11 h-10 sm:w-12 sm:h-11 bg-gradient-to-l from-zinc-700 to-zinc-800 active:from-blue-600 active:to-blue-800 border-2 border-white/60 rounded-r-lg flex items-center justify-center shadow-lg transition-all ${
                activeKeys.has('right') ? 'scale-95 bg-blue-600 border-yellow-400 text-yellow-300 ring-2 ring-yellow-400' : 'text-white'
              }`}
              onMouseDown={() => handlePress('right')}
              onMouseUp={() => handleRelease('right')}
              onMouseLeave={() => activeKeys.has('right') && handleRelease('right')}
              onTouchStart={(e) => { e.preventDefault(); handlePress('right'); }}
              onTouchEnd={(e) => { e.preventDefault(); handleRelease('right'); }}
              aria-label="Right"
            >
              <ArrowRight size={20} className="filter drop-shadow" />
            </button>
          </div>
        )}

        {mode === 'joystick' && (
          <div
            ref={joystickBaseRef}
            className={`relative ${compact ? 'w-28 h-28' : 'w-36 h-36 sm:w-40 sm:h-40'} bg-black/50 backdrop-blur-sm border-2 border-white/50 rounded-full flex items-center justify-center shadow-2xl touch-none cursor-grab active:cursor-grabbing`}
            onTouchStart={handleJoystickStart}
            onTouchMove={updateJoystick}
            onTouchEnd={handleJoystickEnd}
            onTouchCancel={handleJoystickEnd}
            onMouseDown={handleJoystickStart}
            onMouseMove={(e) => joystickActive && updateJoystick(e)}
            onMouseUp={handleJoystickEnd}
            onMouseLeave={() => joystickActive && handleJoystickEnd()}
          >
            {/* Guide Rings */}
            <div className="absolute inset-4 rounded-full border border-white/20 pointer-events-none" />
            <div className="absolute inset-8 rounded-full border border-white/10 pointer-events-none" />
            <div className="absolute w-px h-full bg-white/20 pointer-events-none" />
            <div className="absolute h-px w-full bg-white/20 pointer-events-none" />

            {/* Joystick Thumb Stick */}
            <div
              className="absolute w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-zinc-600 via-zinc-800 to-black border-2 border-white shadow-2xl flex items-center justify-center transition-transform"
              style={{
                transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
                transition: joystickActive ? 'none' : 'transform 0.15s ease-out'
              }}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-700 to-blue-500 border border-blue-300/80 shadow-inner flex items-center justify-center">
                <Crosshair size={14} className="text-white opacity-80" />
              </div>
            </div>
          </div>
        )}

        {/* Mode Toggle Switch */}
        <button
          type="button"
          onClick={() => setMode(m => m === 'dpad' ? 'joystick' : 'dpad')}
          className="mt-1 px-2 py-0.5 bg-black/60 hover:bg-black/90 text-white/70 hover:text-white border border-white/30 rounded text-[9px] uppercase tracking-wider flex items-center gap-1"
        >
          <Gamepad2 size={10} />
          {mode === 'dpad' ? 'Switch to Stick' : 'Switch to D-Pad'}
        </button>
      </div>

      {/* Right Control: Action Buttons (A / B / Space / Custom) */}
      {showActions && (
        <div className="flex flex-col items-end gap-2">
          {/* Custom Buttons or Default A/B */}
          {customButtons && customButtons.length > 0 ? (
            <div className="flex flex-wrap gap-2 justify-end max-w-[200px]">
              {customButtons.map(btn => (
                <button
                  key={btn.id}
                  type="button"
                  className={`px-3 py-2.5 min-w-[50px] min-h-[44px] ${btn.color || 'bg-blue-600 hover:bg-blue-500'} active:scale-95 active:brightness-125 border-2 border-white rounded-lg font-bold text-xs shadow-xl flex items-center justify-center gap-1.5 transition-transform ${
                    activeKeys.has(btn.id) ? 'ring-2 ring-yellow-400 scale-95' : ''
                  }`}
                  onMouseDown={() => handlePress(btn.id, btn.key)}
                  onMouseUp={() => handleRelease(btn.id, btn.key)}
                  onMouseLeave={() => activeKeys.has(btn.id) && handleRelease(btn.id, btn.key)}
                  onTouchStart={(e) => { e.preventDefault(); handlePress(btn.id, btn.key); }}
                  onTouchEnd={(e) => { e.preventDefault(); handleRelease(btn.id, btn.key); }}
                >
                  {btn.icon}
                  <span>{btn.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center">
              {/* Button B (Secondary / Action) */}
              <button
                type="button"
                className={`absolute bottom-1 left-1 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 active:from-amber-400 active:to-amber-600 border-2 border-white shadow-2xl flex flex-col items-center justify-center font-bold transition-transform active:scale-95 ${
                  activeKeys.has('b') ? 'ring-2 ring-yellow-400 scale-95 brightness-125' : ''
                }`}
                onMouseDown={() => handlePress('b', keyMap.b)}
                onMouseUp={() => handleRelease('b', keyMap.b)}
                onMouseLeave={() => activeKeys.has('b') && handleRelease('b', keyMap.b)}
                onTouchStart={(e) => { e.preventDefault(); handlePress('b', keyMap.b); }}
                onTouchEnd={(e) => { e.preventDefault(); handleRelease('b', keyMap.b)} }
                aria-label="Button B"
              >
                <span className="text-sm font-extrabold text-white leading-none">B</span>
                <span className="text-[8px] text-white/80 uppercase">Alt</span>
              </button>

              {/* Button A (Primary / Jump / Shoot) */}
              <button
                type="button"
                className={`absolute top-1 right-1 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-red-500 to-red-700 active:from-red-400 active:to-red-600 border-2 border-white shadow-2xl flex flex-col items-center justify-center font-bold transition-transform active:scale-95 ${
                  activeKeys.has('a') ? 'ring-2 ring-yellow-400 scale-95 brightness-125' : ''
                }`}
                onMouseDown={() => handlePress('a', keyMap.a)}
                onMouseUp={() => handleRelease('a', keyMap.a)}
                onMouseLeave={() => activeKeys.has('a') && handleRelease('a', keyMap.a)}
                onTouchStart={(e) => { e.preventDefault(); handlePress('a', keyMap.a); }}
                onTouchEnd={(e) => { e.preventDefault(); handleRelease('a', keyMap.a); }}
                aria-label="Button A"
              >
                <span className="text-sm font-extrabold text-white leading-none">A</span>
                <span className="text-[8px] text-white/80 uppercase">Action</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
