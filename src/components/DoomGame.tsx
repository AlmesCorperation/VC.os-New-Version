import React, { useEffect, useRef, useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { kernel } from '../services/kernel';
import { VirtualGamepad } from './VirtualGamepad';
import { Crosshair, Gamepad2, Volume2 } from 'lucide-react';

const MAP_WIDTH = 16;
const MAP_HEIGHT = 16;
const MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
  [1,0,0,2,2,0,1,0,0,3,3,3,3,0,0,1],
  [1,0,0,2,0,0,0,0,0,3,0,0,3,0,0,1],
  [1,0,0,0,0,0,0,0,0,3,0,0,3,0,0,1],
  [1,0,0,0,0,0,0,0,0,3,3,0,3,0,0,1],
  [1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,4,4,4,4,4,0,0,0,0,1],
  [1,0,0,0,0,0,4,0,0,0,4,0,0,0,0,1],
  [1,0,0,0,0,0,4,0,0,0,4,0,0,0,0,1],
  [1,0,0,0,0,0,4,0,0,0,4,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const COLORS = [
  '#000000', // 0 empty
  '#AA0000', // 1 red
  '#00AA00', // 2 green
  '#0000AA', // 3 blue
  '#AAAA00', // 4 yellow
];

interface Monster {
  x: number;
  y: number;
  hp: number;
  state: 'idle' | 'chase' | 'dead';
  color: string;
}

export const DoomGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fps, setFps] = useState(0);
  const [playerHp, setPlayerHp] = useState(100);
  const [score, setScore] = useState(0);
  const [showTouchControls, setShowTouchControls] = useState(true);
  const { performanceMode } = useSettings();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let px = 2.5, py = 2.5, pa = 0;
    let lastTime = performance.now();
    let frames = 0;
    let lastFpsTime = lastTime;
    let gunRecoil = 0;
    let hp = 100;
    let currentScore = 0;

    const monsters: Monster[] = [
      { x: 7.5, y: 7.5, hp: 100, state: 'idle', color: '#FF00FF' },
      { x: 12.5, y: 12.5, hp: 100, state: 'idle', color: '#FF00FF' },
      { x: 13.5, y: 2.5, hp: 100, state: 'idle', color: '#FF00FF' },
      { x: 2.5, y: 13.5, hp: 100, state: 'idle', color: '#FF00FF' },
    ];

    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      keys[e.key] = true;
      if (e.code === 'Space' && gunRecoil === 0) {
        // Shoot
        gunRecoil = 10;
        kernel.emitEvent('TASK', 'DOOM: FIRE_WEAPON');
        
        // Check hit
        for (const m of monsters) {
          if (m.state === 'dead') continue;
          
          const dx = m.x - px;
          const dy = m.y - py;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // Calculate angle to monster
          let angleToMonster = Math.atan2(dy, dx) - pa;
          
          // Normalize angle
          while (angleToMonster < -Math.PI) angleToMonster += 2 * Math.PI;
          while (angleToMonster > Math.PI) angleToMonster -= 2 * Math.PI;
          
          // If monster is in front and close enough to center of screen
          if (Math.abs(angleToMonster) < 0.2 && dist < 8) {
            m.hp -= 50;
            if (m.hp <= 0) {
              m.state = 'dead';
              currentScore += 100;
              setScore(currentScore);
              kernel.emitEvent('TASK', 'DOOM: ENEMY_KILLED');
            } else {
              m.state = 'chase'; // Wake up if shot
            }
          }
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys[e.key] = false;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let animationFrameId: number;

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      frames++;
      if (time - lastFpsTime >= 1000) {
        setFps(frames);
        frames = 0;
        lastFpsTime = time;
      }

      if (gunRecoil > 0) gunRecoil -= dt * 30;
      if (gunRecoil < 0) gunRecoil = 0;

      // Movement
      const moveSpeed = 3.0 * dt;
      const rotSpeed = 2.0 * dt;

      if (keys['ArrowLeft'] || keys['a']) pa -= rotSpeed;
      if (keys['ArrowRight'] || keys['d']) pa += rotSpeed;

      let moveStep = 0;
      if (keys['ArrowUp'] || keys['w']) moveStep = moveSpeed;
      if (keys['ArrowDown'] || keys['s']) moveStep = -moveSpeed;

      if (moveStep !== 0) {
        const nx = px + Math.cos(pa) * moveStep;
        const ny = py + Math.sin(pa) * moveStep;
        if (MAP[Math.floor(py)][Math.floor(nx)] === 0) px = nx;
        if (MAP[Math.floor(ny)][Math.floor(px)] === 0) py = ny;
      }

      // Monster AI
      for (const m of monsters) {
        if (m.state === 'dead') continue;
        
        const dx = px - m.x;
        const dy = py - m.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 6) m.state = 'chase';
        
        if (m.state === 'chase') {
          if (dist > 0.5) {
            const mx = m.x + (dx / dist) * 1.5 * dt;
            const my = m.y + (dy / dist) * 1.5 * dt;
            if (MAP[Math.floor(m.y)][Math.floor(mx)] === 0) m.x = mx;
            if (MAP[Math.floor(my)][Math.floor(m.x)] === 0) m.y = my;
          } else {
            // Attack player
            hp -= 10 * dt;
            setPlayerHp(Math.max(0, Math.floor(hp)));
          }
        }
      }

      // Draw
      ctx.fillStyle = '#383838'; // Ceiling
      ctx.fillRect(0, 0, 320, 100);
      ctx.fillStyle = '#707070'; // Floor
      ctx.fillRect(0, 100, 320, 100);

      // Raycasting
      const fov = Math.PI / 3;
      const halfFov = fov / 2;
      const numRays = performanceMode ? 80 : 320; // Reduce rays in performance mode
      const maxDepth = 16;
      const zBuffer: number[] = new Array(numRays).fill(0);
      const rayWidth = 320 / numRays;

      for (let x = 0; x < numRays; x++) {
        const rayAngle = (pa - halfFov) + (x / numRays) * fov;
        const eyeX = Math.cos(rayAngle);
        const eyeY = Math.sin(rayAngle);

        let distanceToWall = 0;
        let hitWall = false;
        let wallType = 0;

        while (!hitWall && distanceToWall < maxDepth) {
          distanceToWall += performanceMode ? 0.1 : 0.05; // Larger steps in performance mode
          const testX = Math.floor(px + eyeX * distanceToWall);
          const testY = Math.floor(py + eyeY * distanceToWall);

          if (testX < 0 || testX >= MAP_WIDTH || testY < 0 || testY >= MAP_HEIGHT) {
            hitWall = true;
            distanceToWall = maxDepth;
          } else {
            if (MAP[testY][testX] > 0) {
              hitWall = true;
              wallType = MAP[testY][testX];
            }
          }
        }

        // Fix fisheye
        const correctedDistance = distanceToWall * Math.cos(rayAngle - pa);
        zBuffer[x] = correctedDistance;
        
        const ceiling = 100 - 100 / correctedDistance;
        const floor = 100 + 100 / correctedDistance;
        const wallHeight = floor - ceiling;

        // Shading
        const shade = Math.max(0, 1 - distanceToWall / maxDepth);
        const baseColor = COLORS[wallType] || '#FFFFFF';
        
        ctx.fillStyle = baseColor;
        ctx.globalAlpha = shade;
        ctx.fillRect(x * rayWidth, ceiling, rayWidth, wallHeight);
        ctx.globalAlpha = 1.0;
      }

      // Render Sprites (Monsters)
      // Sort monsters by distance (far to near)
      const sortedMonsters = [...monsters].sort((a, b) => {
        const distA = Math.pow(px - a.x, 2) + Math.pow(py - a.y, 2);
        const distB = Math.pow(px - b.x, 2) + Math.pow(py - b.y, 2);
        return distB - distA;
      });

      for (const m of sortedMonsters) {
        const dx = m.x - px;
        const dy = m.y - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        let angleToMonster = Math.atan2(dy, dx) - pa;
        while (angleToMonster < -Math.PI) angleToMonster += 2 * Math.PI;
        while (angleToMonster > Math.PI) angleToMonster -= 2 * Math.PI;
        
        // Is monster in FOV?
        if (Math.abs(angleToMonster) < halfFov + 0.5 && dist > 0.1) {
          const spriteScreenX = (0.5 * (angleToMonster / halfFov) + 0.5) * numRays;
          const spriteHeight = 200 / dist;
          const spriteWidth = spriteHeight;
          const spriteTop = 100 - spriteHeight / 2;
          
          // Draw sprite column by column
          const startX = Math.floor(spriteScreenX - spriteWidth / 2);
          const endX = Math.floor(spriteScreenX + spriteWidth / 2);
          
          for (let sx = startX; sx < endX; sx++) {
            if (sx >= 0 && sx < numRays && zBuffer[sx] > dist) {
              ctx.fillStyle = m.state === 'dead' ? '#880000' : m.color;
              
              // Simple sprite drawing (rectangle with eyes)
              const shade = Math.max(0, 1 - dist / maxDepth);
              ctx.globalAlpha = shade;
              
              if (m.state === 'dead') {
                // Dead body on floor
                ctx.fillRect(sx * rayWidth, 100 + spriteHeight/4, rayWidth, spriteHeight/4);
              } else {
                // Standing monster
                ctx.fillRect(sx * rayWidth, spriteTop, rayWidth, spriteHeight);
                
                // Draw eyes
                if (sx > startX + spriteWidth * 0.2 && sx < startX + spriteWidth * 0.4) {
                  ctx.fillStyle = '#FFFFFF';
                  ctx.fillRect(sx * rayWidth, spriteTop + spriteHeight * 0.2, rayWidth, spriteHeight * 0.1);
                }
                if (sx > startX + spriteWidth * 0.6 && sx < startX + spriteWidth * 0.8) {
                  ctx.fillStyle = '#FFFFFF';
                  ctx.fillRect(sx * rayWidth, spriteTop + spriteHeight * 0.2, rayWidth, spriteHeight * 0.1);
                }
              }
              ctx.globalAlpha = 1.0;
            }
          }
        }
      }

      // Draw Gun
      const gunY = 150 + gunRecoil * 2;
      ctx.fillStyle = '#555';
      ctx.fillRect(140, gunY, 40, 50);
      ctx.fillStyle = '#333';
      ctx.fillRect(155, gunY - 20, 10, 20);
      
      // Muzzle flash
      if (gunRecoil > 8) {
        ctx.fillStyle = '#FFFF00';
        ctx.beginPath();
        ctx.arc(160, gunY - 25, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FF8800';
        ctx.beginPath();
        ctx.arc(160, gunY - 25, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Crosshair
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillRect(159, 95, 2, 10);
      ctx.fillRect(155, 99, 10, 2);

      // Red flash when hurt
      if (hp < 100 && Math.random() > hp / 100) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.fillRect(0, 0, 320, 200);
      }

      if (hp > 0) {
        animationFrameId = requestAnimationFrame(loop);
      } else {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.fillRect(0, 0, 320, 200);
        ctx.fillStyle = 'white';
        ctx.font = '20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('YOU DIED', 160, 100);
      }
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, [performanceMode]);

  const triggerShoot = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
    setTimeout(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true }));
    }, 100);
  };

  return (
    <div className="flex flex-col h-full bg-black text-white font-mono text-xs select-none items-center justify-center relative overflow-hidden">
      {/* Top HUD */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-2">
        <span className="text-red-500 font-bold bg-black/60 px-1.5 py-0.5 rounded border border-red-500/30">FPS: {fps}</span>
        <button
          type="button"
          onClick={() => setShowTouchControls(prev => !prev)}
          className="px-2 py-0.5 bg-zinc-800/80 hover:bg-zinc-700 text-white/80 hover:text-white border border-zinc-500/50 rounded flex items-center gap-1 text-[10px]"
        >
          <Gamepad2 size={12} className={showTouchControls ? 'text-green-400' : 'text-zinc-400'} />
          <span>{showTouchControls ? 'Hide Controls' : 'Touch Controls'}</span>
        </button>
      </div>

      <div className="absolute top-2 right-2 z-20 text-red-500 font-bold bg-black/60 px-2 py-0.5 rounded border border-red-500/30 hidden sm:block">
        WASD/D-Pad: Move | SPACE/Button: Shoot
      </div>

      <div className="absolute bottom-2 left-2 z-20 text-red-500 font-bold text-base bg-black/60 px-2 py-0.5 rounded border border-red-500/40">
        HP: {playerHp}%
      </div>
      <div className="absolute bottom-2 right-2 z-20 text-yellow-500 font-bold text-base bg-black/60 px-2 py-0.5 rounded border border-yellow-500/40">
        SCORE: {score}
      </div>

      {/* Canvas */}
      <canvas 
        ref={canvasRef} 
        width={320} 
        height={200} 
        onClick={triggerShoot}
        className="w-full h-full object-contain bg-black cursor-crosshair"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* Touch Screen Joystick & Action Controls */}
      {showTouchControls && (
        <div className="absolute inset-x-0 bottom-0 z-30 pointer-events-none pb-2">
          <VirtualGamepad 
            keyMap={{
              up: 'w',
              down: 's',
              left: 'a',
              right: 'd',
              a: ' '
            }}
            customButtons={[
              {
                id: 'shoot',
                label: 'FIRE',
                key: ' ',
                color: 'bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-red-900/50',
                icon: <Crosshair size={18} />
              }
            ]}
          />
        </div>
      )}
    </div>
  );
};
