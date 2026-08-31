import React, { useState, useEffect, useRef } from 'react';
import { PALETTE } from '../constants';
import { useSettings } from '../hooks/useSettings';
import { kernel } from '../services/kernel';
import { VirtualGamepad } from './VirtualGamepad';
import { Gamepad2, ArrowUp, ArrowDown } from 'lucide-react';

export const PongGame: React.FC = () => {
  const [ball, setBall] = useState({ x: 50, y: 50, dx: 1.5, dy: 1.5 });
  const [paddle1, setPaddle1] = useState(40);
  const [paddle2, setPaddle2] = useState(40);
  const [score, setScore] = useState({ p1: 0, p2: 0 });
  const [episodes, setEpisodes] = useState(0);
  const [lastAction, setLastAction] = useState<number>(0);
  const [showTouchControls, setShowTouchControls] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const { performanceMode } = useSettings();

  // RL State: Q-Table [ballYBin][paddleYBin][ballDYDir][action]
  // Actions: 0: Stay, 1: Up, 2: Down
  const qTable = useRef<number[][][][]>(
    Array.from({ length: 10 }, (_, bYBin) => 
      Array.from({ length: 10 }, (_, pYBin) => 
        Array.from({ length: 2 }, () => {
          // Semi-pre-trained logic:
          // If ball is above paddle (bYBin < pYBin), prefer Up (action 1)
          // If ball is below paddle (bYBin > pYBin), prefer Down (action 2)
          // If level, prefer Stay (action 0)
          if (bYBin < pYBin) return [0, 5, -2];
          if (bYBin > pYBin) return [0, -2, 5];
          return [5, 0, 0];
        })
      )
    )
  );

  const learningRate = 0.5;
  const discountFactor = 0.95;
  const epsilon = 0.01; // Exploration rate (Very low)

  const getState = (bY: number, pY: number, bDY: number) => {
    const bYBin = Math.max(0, Math.min(9, Math.floor(bY / 10)));
    const pYBin = Math.max(0, Math.min(9, Math.floor(pY / 10)));
    const bDYDir = bDY > 0 ? 1 : 0;
    return { bYBin, pYBin, bDYDir };
  };

  useEffect(() => {
    const interval = setInterval(() => {
      let reward = 0;
      let hitOccurred = false;

      setBall((b) => {
        let nx = b.x + b.dx;
        let ny = b.y + b.dy;
        let ndx = b.dx;
        let ndy = b.dy;

        // Top/Bottom bounce
        if (ny <= 0 || ny >= 95) ndy = -ndy;

        // Paddle 1 (Left)
        if (nx <= 5 && ny >= paddle1 && ny <= paddle1 + 20) {
          ndx = -ndx;
          nx = 6;
        }

        // Paddle 2 (Right - AI)
        if (nx >= 92 && ny >= paddle2 && ny <= paddle2 + 20) {
          ndx = -ndx;
          nx = 91;
          reward = 5; // Big reward for hitting the ball
          hitOccurred = true;
        }

        // Score
        if (nx <= 0) {
          setScore(s => ({ ...s, p2: s.p2 + 1 }));
          kernel.emitEvent('TASK', 'PONG: P2_SCORED');
          return { x: 50, y: 50, dx: 1.5, dy: 1.5 };
        }
        if (nx >= 100) {
          setScore(s => ({ ...s, p1: s.p1 + 1 }));
          reward = -10; // Penalty for missing
          setEpisodes(e => e + 1);
          kernel.emitEvent('TASK', 'PONG: P1_SCORED');
          return { x: 50, y: 50, dx: -1.5, dy: 1.5 };
        }

        return { x: nx, y: ny, dx: ndx, dy: ndy };
      });

      // RL Decision for Paddle 2
      setPaddle2(p => {
        const state = getState(ball.y, p, ball.dy);
        const qValues = qTable.current[state.bYBin][state.pYBin][state.bDYDir];
        
        // Epsilon-greedy action selection
        let action: number;
        if (Math.random() < epsilon) {
          action = Math.floor(Math.random() * 3);
        } else {
          action = qValues.indexOf(Math.max(...qValues));
        }
        setLastAction(action);

        // Apply action
        let nextP = p;
        if (action === 1) nextP = Math.max(0, p - 3);
        if (action === 2) nextP = Math.min(80, p + 3);

        // Update Q-Table
        const nextState = getState(ball.y, nextP, ball.dy);
        const nextQValues = qTable.current[nextState.bYBin][nextState.pYBin][nextState.bDYDir];
        const maxNextQ = Math.max(...nextQValues);

        // Q-Learning Formula: Q(s,a) = Q(s,a) + alpha * (reward + gamma * max(Q(s',a')) - Q(s,a))
        qTable.current[state.bYBin][state.pYBin][state.bDYDir][action] += 
          learningRate * (reward + discountFactor * maxNextQ - qValues[action]);

        return nextP;
      });
      // Artificial Lag
      if (!performanceMode) {
        const lag = Math.random() * 50;
        const start = performance.now();
        while (performance.now() - start < lag) {
          // Busy wait to freeze the thread
        }
      }
    }, 50); // Slower tick rate

    return () => clearInterval(interval);
  }, [ball.y, ball.dy, paddle1, paddle2, performanceMode]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const y = ((e.clientY - rect.top) / rect.height) * 100 - 10;
    setPaddle1(Math.max(0, Math.min(80, y)));
  };

  const handleTouch = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const rect = containerRef.current.getBoundingClientRect();
    const y = ((touch.clientY - rect.top) / rect.height) * 100 - 10;
    setPaddle1(Math.max(0, Math.min(80, y)));
  };

  const handleDirection = (dir: 'up' | 'down' | 'left' | 'right') => {
    if (dir === 'up') setPaddle1(p => Math.max(0, p - 6));
    if (dir === 'down') setPaddle1(p => Math.min(80, p + 6));
  };

  return (
    <div 
      className="h-full flex flex-col font-mono bg-black text-white p-2 select-none relative overflow-hidden"
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouch}
      onTouchMove={handleTouch}
      ref={containerRef}
    >
      <div className="flex justify-between items-center text-[10px] mb-2 z-20">
        <div className="flex items-center gap-2">
          <span className="text-blue-400 font-bold">PONG_RL_v4.0</span>
          <button
            type="button"
            onClick={() => setShowTouchControls(p => !p)}
            className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-white/80 border border-zinc-600 rounded flex items-center gap-1 text-[9px]"
          >
            <Gamepad2 size={10} className={showTouchControls ? 'text-green-400' : 'text-zinc-400'} />
            <span>{showTouchControls ? 'Hide Controls' : 'Touch Controls'}</span>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-yellow-400 font-bold text-xs">{score.p1} : {score.p2}</span>
          <span className="text-green-400 text-[8px]">EP: {episodes}</span>
        </div>
      </div>
      
      <div className="flex-1 relative border border-white/20 bg-zinc-900 overflow-hidden cursor-crosshair">
        {/* Brain Visualization Overlay */}
        <div className="absolute top-2 right-2 z-10 bg-black/80 border border-blue-500/30 p-1 text-[7px] font-mono pointer-events-none">
          <div className="text-blue-400 mb-1 flex justify-between items-center">
            <span>BRAIN_STATE</span>
            <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
          </div>
          <div className="flex gap-1">
            <div className={`w-2 h-2 ${lastAction === 1 ? 'bg-green-500 shadow-[0_0_5px_#00ff00]' : 'bg-zinc-800'}`} title="UP" />
            <div className={`w-2 h-2 ${lastAction === 0 ? 'bg-blue-500 shadow-[0_0_5px_#0000ff]' : 'bg-zinc-800'}`} title="STAY" />
            <div className={`w-2 h-2 ${lastAction === 2 ? 'bg-red-500 shadow-[0_0_5px_#ff0000]' : 'bg-zinc-800'}`} title="DOWN" />
          </div>
          <div className="mt-1 opacity-50">
            S: {Math.floor(ball.y/10)},{Math.floor(paddle2/10)},{ball.dy > 0 ? 1 : 0}
          </div>
        </div>
        {/* Center Line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 border-l border-dashed border-white/20 pointer-events-none" />
        
        {/* Ball */}
        <div 
          className="absolute w-2.5 h-2.5 bg-white rounded-none pointer-events-none"
          style={{ left: `${ball.x}%`, top: `${ball.y}%` }}
        />

        {/* Paddle 1 */}
        <div 
          className="absolute left-1.5 w-2.5 h-[20%] bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)] pointer-events-none transition-all duration-75"
          style={{ top: `${paddle1}%` }}
        />

        {/* Paddle 2 */}
        <div 
          className="absolute right-1.5 w-2.5 h-[20%] bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)] pointer-events-none transition-all duration-75"
          style={{ top: `${paddle2}%` }}
        />
      </div>

      {/* Touch Screen On-Screen Gamepad & Controls */}
      {showTouchControls && (
        <div className="relative z-20 pt-1">
          <VirtualGamepad 
            onDirectionPress={handleDirection}
            onDirectionChange={(vec) => {
              if (vec.active) {
                setPaddle1(p => Math.max(0, Math.min(80, p + vec.y * 4)));
              }
            }}
            compact={true}
            showActions={true}
            customButtons={[
              {
                id: 'up',
                label: 'UP',
                icon: <ArrowUp size={16} />,
                color: 'bg-yellow-600 hover:bg-yellow-500'
              },
              {
                id: 'down',
                label: 'DOWN',
                icon: <ArrowDown size={16} />,
                color: 'bg-yellow-600 hover:bg-yellow-500'
              }
            ]}
            onButtonPress={(id) => {
              if (id === 'up') setPaddle1(p => Math.max(0, p - 6));
              if (id === 'down') setPaddle1(p => Math.min(80, p + 6));
            }}
          />
        </div>
      )}
    </div>
  );
};
