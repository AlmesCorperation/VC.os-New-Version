import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SPECTRUM_GRADIENT } from '../constants';
import { kernel } from '../services/kernel';
import { VirtualGamepad } from './VirtualGamepad';
import { Gamepad2, RotateCcw } from 'lucide-react';

const GRID_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION = { x: 1, y: 0 };

export const SnakeGame: React.FC = () => {
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [food, setFood] = useState({ x: 15, y: 15 });
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [showTouchpad, setShowTouchpad] = useState(true);
  const gameRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const changeDirection = useCallback((dir: 'up' | 'down' | 'left' | 'right') => {
    setDirection(prev => {
      if (dir === 'up' && prev.y === 0) return { x: 0, y: -1 };
      if (dir === 'down' && prev.y === 0) return { x: 0, y: 1 };
      if (dir === 'left' && prev.x === 0) return { x: -1, y: 0 };
      if (dir === 'right' && prev.x === 0) return { x: 1, y: 0 };
      return prev;
    });
  }, []);

  const moveSnake = useCallback(() => {
    if (gameOver) return;

    setSnake((prevSnake) => {
      const head = prevSnake[0];
      const newHead = {
        x: (head.x + direction.x + GRID_SIZE) % GRID_SIZE,
        y: (head.y + direction.y + GRID_SIZE) % GRID_SIZE,
      };

      // Check collision with self
      if (prevSnake.some((segment) => segment.x === newHead.x && segment.y === newHead.y)) {
        setGameOver(true);
        kernel.emitEvent('TASK', 'SNAKE: GAME_OVER');
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // Check food
      if (newHead.x === food.x && newHead.y === food.y) {
        setScore((s) => s + 1);
        kernel.emitEvent('TASK', 'SNAKE: ATE_FOOD');
        setFood({
          x: Math.floor(Math.random() * GRID_SIZE),
          y: Math.floor(Math.random() * GRID_SIZE),
        });
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [direction, food, gameOver]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          changeDirection('up');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          changeDirection('down');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          changeDirection('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          changeDirection('right');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Artificial Lag: Random jitter added to base interval
    const baseInterval = 180;
    const jitter = Math.random() * 60;
    const interval = setInterval(moveSnake, baseInterval + jitter);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(interval);
    };
  }, [moveSnake, changeDirection]);

  const resetGame = () => {
    setSnake(INITIAL_SNAKE);
    setDirection(INITIAL_DIRECTION);
    setGameOver(false);
    setScore(0);
  };

  // Touch swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) > 20) {
      if (absX > absY) {
        changeDirection(dx > 0 ? 'right' : 'left');
      } else {
        changeDirection(dy > 0 ? 'down' : 'up');
      }
    }
    touchStartRef.current = null;
  };

  return (
    <div className="h-full flex flex-col font-mono bg-black text-white p-2 relative overflow-hidden" ref={gameRef}>
      <div className="flex justify-between items-center text-[10px] mb-1.5 z-20">
        <div className="flex items-center gap-2">
          <span className="text-green-400 font-bold">SNAKE_PROC_ID: 0x42</span>
          <button
            type="button"
            onClick={() => setShowTouchpad(p => !p)}
            className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-white/80 border border-zinc-600 rounded flex items-center gap-1 text-[9px]"
          >
            <Gamepad2 size={10} className={showTouchpad ? 'text-green-400' : 'text-zinc-400'} />
            <span>{showTouchpad ? 'Hide D-Pad' : 'Show D-Pad'}</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 font-bold">SCORE: {score.toString().padStart(4, '0')}</span>
          <button 
            type="button"
            onClick={resetGame}
            className="p-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded text-white"
            title="Reset"
          >
            <RotateCcw size={10} />
          </button>
        </div>
      </div>
      
      <div 
        className="flex-1 relative border border-white/20 bg-zinc-900 touch-none cursor-pointer"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          className="absolute inset-0 grid" 
          style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)` }}
        >
          {snake.map((segment, i) => (
            <div
              key={i}
              className="border-[0.5px] border-black/20"
              style={{ 
                gridColumnStart: segment.x + 1, 
                gridRowStart: segment.y + 1,
                backgroundColor: SPECTRUM_GRADIENT[i % SPECTRUM_GRADIENT.length]
              }}
            />
          ))}
          <div
            className="bg-white animate-pulse"
            style={{ 
              gridColumnStart: food.x + 1, 
              gridRowStart: food.y + 1 
            }}
          />
        </div>

        {gameOver && (
          <div className="absolute inset-0 bg-red-600/90 z-30 flex flex-col items-center justify-center text-center p-4">
            <div className="text-xl font-bold mb-2">SEGMENTATION_FAULT</div>
            <div className="text-[10px] mb-4">SNAKE_COLLISION_DETECTED</div>
            <button 
              onClick={resetGame}
              className="border-2 border-white px-4 py-2 bg-black/40 hover:bg-white hover:text-red-600 transition-all text-xs font-bold rounded"
            >
              RETRY_EXEC
            </button>
          </div>
        )}
      </div>

      {/* On-screen touch D-Pad / Joystick */}
      {showTouchpad && (
        <div className="relative z-20 pt-1 pb-0.5">
          <VirtualGamepad 
            onDirectionPress={changeDirection}
            compact={true}
            showActions={false}
            className="justify-center"
          />
        </div>
      )}
    </div>
  );
};
