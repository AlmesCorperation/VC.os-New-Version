import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { kernel } from '../services/kernel';
import { ShieldAlert, RefreshCw, Terminal, Gamepad2 } from 'lucide-react';
import { VirtualGamepad } from './VirtualGamepad';

interface InterpreterProps {
  script: string;
  isPaused?: boolean;
  gameId?: string;
  isMultiplayer?: boolean;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class SpectrumErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("SpectrumInterpreter ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full bg-[#111] text-yellow-400 p-4 font-mono text-[11px] flex flex-col items-center justify-center border-2 border-yellow-700 select-none">
          <ShieldAlert size={28} className="text-yellow-500 mb-2" />
          <div className="font-bold text-xs text-yellow-300 mb-1 uppercase">Spectrum 2D Sandboxed Recovery</div>
          <div className="text-gray-400 mb-2 text-center text-[10px] max-w-sm">
            Interpreter caught an execution exception: {this.state.error?.message}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-1 px-3 py-1 bg-yellow-900/40 hover:bg-yellow-800 text-yellow-200 border border-yellow-500 rounded text-[10px]"
          >
            <RefreshCw size={11} /> Reset Interpreter
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const SpectrumCanvas: React.FC<InterpreterProps> = ({ script, isPaused, gameId, isMultiplayer }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const varsRef = useRef<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const clientId = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    if (isMultiplayer && gameId) {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocket(`${protocol}//${window.location.host}`);
        socketRef.current = socket;

        socket.onopen = () => {
          socket.send(JSON.stringify({ type: 'join', gameId }));
        };

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'sync' && message.sender !== clientId.current) {
              Object.assign(varsRef.current, message.state);
            }
          } catch (e) {}
        };

        return () => {
          socket.close();
        };
      } catch (e) {}
    }
  }, [isMultiplayer, gameId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const keysPressed = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => keysPressed.add(e.key.toLowerCase());
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.delete(e.key.toLowerCase());
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const safeScript = script || '';
    const lines = safeScript.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#') && !l.startsWith(';'));

    const resolve = (val: string): any => {
      if (val === undefined || val === null) return 0;
      if (typeof val !== 'string') return val;
      
      if (val === '$PID') return clientId.current;

      // Handle basic arithmetic like $X+1 or $X-1
      if (val.includes('+') || (val.includes('-') && !val.startsWith('-'))) {
        const op = val.includes('+') ? '+' : '-';
        const [left, right] = val.split(op);
        const lVal = Number(resolve(left ? left.trim() : '0'));
        const rVal = Number(resolve(right ? right.trim() : '0'));
        return op === '+' ? lVal + rVal : lVal - rVal;
      }

      if (val.startsWith('$')) {
        const varName = val.slice(1);
        return varsRef.current[varName] ?? 0;
      }
      return isNaN(Number(val)) ? val : Number(val);
    };

    const executeLine = (line: string, context: CanvasRenderingContext2D) => {
      if (!line) return;
      const parts = line.split(/\s+/);
      if (parts.length === 0) return;
      const cmd = parts[0].toUpperCase();

      try {
        switch (cmd) {
          case 'VAR':
            if (parts[1]) varsRef.current[parts[1]] = resolve(parts[2] || '0');
            break;
          case 'INC':
            if (parts[1]) varsRef.current[parts[1]] = (Number(varsRef.current[parts[1]]) || 0) + Number(resolve(parts[2] || '1'));
            break;
          case 'DEC':
            if (parts[1]) varsRef.current[parts[1]] = (Number(varsRef.current[parts[1]]) || 0) - Number(resolve(parts[2] || '1'));
            break;
          case 'BG':
            context.fillStyle = (resolve(parts[1]) as string) || '#000000';
            context.fillRect(0, 0, canvas.width, canvas.height);
            break;
          case 'RECT':
            context.fillStyle = (resolve(parts[5]) as string) || '#ffffff';
            context.fillRect(
              Number(resolve(parts[1])) || 0,
              Number(resolve(parts[2])) || 0,
              Number(resolve(parts[3])) || 10,
              Number(resolve(parts[4])) || 10
            );
            break;
          case 'TEXT':
            context.fillStyle = (resolve(parts[parts.length - 1]) as string) || '#ffffff';
            context.font = '10px monospace';
            const textContent = parts.slice(3, -1).join(' ').replace(/"/g, '') || parts[3] || '';
            context.fillText(textContent, Number(resolve(parts[1])) || 0, Number(resolve(parts[2])) || 10);
            break;
          case 'IF_KEY': {
            const key = (parts[1] || '').toLowerCase();
            if (keysPressed.has(key)) {
              kernel.emitEvent('IRQ', `IRQ_0x21: SPECTRUM_KEY (${key})`);
              executeLine(parts.slice(2).join(' '), context);
            }
            break;
          }
          case 'IF_GT': {
            const val1 = Number(resolve(parts[1]));
            const val2 = Number(resolve(parts[2]));
            if (val1 > val2) {
              executeLine(parts.slice(3).join(' '), context);
            }
            break;
          }
          case 'IF_LT': {
            const val1 = Number(resolve(parts[1]));
            const val2 = Number(resolve(parts[2]));
            if (val1 < val2) {
              executeLine(parts.slice(3).join(' '), context);
            }
            break;
          }
          case 'IF_EQ': {
            const val1 = Number(resolve(parts[1]));
            const val2 = Number(resolve(parts[2]));
            if (val1 === val2) {
              executeLine(parts.slice(3).join(' '), context);
            }
            break;
          }
          case 'IF_COLLIDE': {
            const x1 = Number(resolve(parts[1])) || 0;
            const y1 = Number(resolve(parts[2])) || 0;
            const w1 = Number(resolve(parts[3])) || 0;
            const h1 = Number(resolve(parts[4])) || 0;
            const x2 = Number(resolve(parts[5])) || 0;
            const y2 = Number(resolve(parts[6])) || 0;
            const w2 = Number(resolve(parts[7])) || 0;
            const h2 = Number(resolve(parts[8])) || 0;
            
            if (x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2) {
              executeLine(parts.slice(9).join(' '), context);
            }
            break;
          }
          case 'SET': {
            if (parts[1]) varsRef.current[parts[1]] = resolve(parts[2]);
            break;
          }
          case 'GEN_GLITCH_MAP': {
            const level = Number(resolve(parts[1])) || 0;
            const map = [];
            for (let r = 0; r < 20; r++) {
              const row = [];
              for (let c = 0; c < 8; c++) {
                if (r === 19) {
                  row.push(1);
                } else if (r >= 4 && r % 4 === 0) {
                  let isSolid = Math.random() > 0.3 ? 1 : 0;
                  if (Math.random() < level * 0.05) isSolid = 1 - isSolid;
                  row.push(isSolid);
                } else {
                  let isSolid = 0;
                  if (Math.random() < level * 0.02) isSolid = 1;
                  row.push(isSolid);
                }
              }
              map.push(row);
            }
            if (map[15]) map[15][0] = 0;
            if (map[14]) map[14][0] = 0;
            if (map[16]) map[16][0] = 0;
            if (map[4]) map[4][7] = 0;
            if (map[3]) map[3][7] = 0;
            if (map[5]) map[5][7] = 0;
            varsRef.current['_MAP'] = map;
            break;
          }
          case 'DRAW_GLITCH_MAP': {
            const map = varsRef.current['_MAP'];
            if (!map || !Array.isArray(map)) break;
            const level = Number(resolve(parts[1])) || 0;
            context.fillStyle = level > 5 ? '#FF0055' : '#555555';
            for (let r = 0; r < 20; r++) {
              for (let c = 0; c < 8; c++) {
                if (map[r] && map[r][c] === 1) {
                  const glitchX = (Math.random() < level * 0.01) ? (Math.random() * 4 - 2) : 0;
                  const glitchY = (Math.random() < level * 0.01) ? (Math.random() * 4 - 2) : 0;
                  context.fillRect(c * 40 + glitchX, r * 10 + glitchY, 40, 10);
                }
              }
            }
            break;
          }
          case 'COLLIDE_GLITCH_MAP': {
            const map = varsRef.current['_MAP'];
            if (!map || !Array.isArray(map)) break;
            const xVar = parts[1];
            const yVar = parts[2];
            const w = Number(resolve(parts[3])) || 10;
            const h = Number(resolve(parts[4])) || 10;
            const vyVar = parts[5];
            const jumpVar = parts[6];
            const level = Number(resolve(parts[7])) || 0;

            let px = Number(varsRef.current[xVar]) || 0;
            let py = Number(varsRef.current[yVar]) || 0;
            let pvy = Number(varsRef.current[vyVar]) || 0;

            let landed = false;
            for (let r = 0; r < 20; r++) {
              for (let c = 0; c < 8; c++) {
                if (map[r] && map[r][c] === 1) {
                  const bx = c * 40;
                  const by = r * 10;
                  const bw = 40;
                  const bh = 10;

                  if (px < bx + bw && px + w > bx && py < by + bh && py + h > by) {
                    if (level > 10 && Math.random() < (level - 10) * 0.02) {
                      continue;
                    }

                    const overlapTop = (py + h) - by;
                    const overlapBottom = (by + bh) - py;
                    const overlapLeft = (px + w) - bx;
                    const overlapRight = (bx + bw) - px;

                    const minOverlap = Math.min(overlapTop, overlapBottom, overlapLeft, overlapRight);

                    if (minOverlap === overlapTop && pvy >= 0) {
                      py = by - h;
                      pvy = 0;
                      landed = true;
                      
                      if (level > 5 && Math.random() < (level - 5) * 0.05) {
                        pvy = -Math.random() * 10;
                        landed = false;
                      }
                    } else if (minOverlap === overlapBottom && pvy < 0) {
                      py = by + bh;
                      pvy = 0;
                    } else if (minOverlap === overlapLeft) {
                      px = bx - w;
                    } else if (minOverlap === overlapRight) {
                      px = bx + bw;
                    }
                  }
                }
              }
            }

            if (level > 15 && Math.random() < (level - 15) * 0.01) {
              px += (Math.random() * 40 - 20);
              py += (Math.random() * 40 - 20);
            }

            if (xVar) varsRef.current[xVar] = px;
            if (yVar) varsRef.current[yVar] = py;
            if (vyVar) varsRef.current[vyVar] = pvy;
            if (landed && jumpVar) {
              varsRef.current[jumpVar] = 1;
            }
            break;
          }
          default:
            break;
        }
      } catch (e: any) {
        setError(e.message || 'Execution error');
      }
    };

    const setupLines = lines.filter(l => !l.startsWith('LOOP'));
    const loopLines = lines.filter(l => l.startsWith('LOOP')).map(l => l.slice(5));

    // Run setup once
    setupLines.forEach(line => executeLine(line, ctx));

    const render = () => {
      if (isPaused) return;
      
      const prevState = JSON.stringify(varsRef.current);

      // Execute loop lines
      loopLines.forEach(line => executeLine(line, ctx));

      const currentState = JSON.stringify(varsRef.current);
      if (isMultiplayer && socketRef.current?.readyState === WebSocket.OPEN && prevState !== currentState) {
        try {
          socketRef.current.send(JSON.stringify({
            type: 'update',
            state: varsRef.current,
            sender: clientId.current
          }));
        } catch (e) {}
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [script, isPaused]);

  const [showGamepad, setShowGamepad] = useState(true);

  return (
    <div className="relative w-full h-full bg-black flex flex-col items-center justify-center overflow-hidden border border-white/10 select-none">
      <div className="absolute top-1 right-1 z-20 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setShowGamepad(p => !p)}
          className="p-1 bg-zinc-900/80 hover:bg-zinc-800 text-white/70 hover:text-white border border-white/20 rounded text-[9px] flex items-center gap-1"
          title="Toggle Virtual Joystick"
        >
          <Gamepad2 size={12} className={showGamepad ? 'text-green-400' : 'text-zinc-400'} />
          <span className="hidden sm:inline">{showGamepad ? 'Hide Pad' : 'Gamepad'}</span>
        </button>
      </div>

      <canvas 
        ref={canvasRef} 
        width={320} 
        height={200} 
        className="w-full h-full object-contain"
        style={{ imageRendering: 'pixelated' }}
        tabIndex={0}
      />
      {error && (
        <div className="absolute top-0 left-0 right-0 bg-red-600/90 text-white text-[9px] p-1 font-mono z-20">
          SPECTRUM_WARN: {error}
        </div>
      )}
      <div className="absolute bottom-1 right-1 text-[8px] text-white/30 font-mono pointer-events-none">
        SPECTRUM_VM_v2.0
      </div>

      {/* On-screen touch gamepad overlay */}
      {showGamepad && (
        <div className="absolute inset-x-0 bottom-0 z-30 pointer-events-none pb-1">
          <VirtualGamepad 
            compact={true}
            keyMap={{
              up: 'ArrowUp',
              down: 'ArrowDown',
              left: 'ArrowLeft',
              right: 'ArrowRight',
              a: ' ',
              b: 'z'
            }}
          />
        </div>
      )}
    </div>
  );
};

export const SpectrumInterpreter: React.FC<InterpreterProps> = (props) => {
  return (
    <SpectrumErrorBoundary>
      <SpectrumCanvas {...props} />
    </SpectrumErrorBoundary>
  );
};
