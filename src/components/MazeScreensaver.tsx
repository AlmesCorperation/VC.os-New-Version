import React, { useEffect, useRef, useState } from 'react';

const MAP_SIZE = 32;
const TEX_WIDTH = 64;
const TEX_HEIGHT = 64;

export const MazeScreensaver: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isUpsideDown, setIsUpsideDown] = useState(false);
  const flipCallback = useRef<() => void>(() => {});

  useEffect(() => {
    flipCallback.current = () => {
      setIsUpsideDown(prev => !prev);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // --- Generate Textures ---
    const textures: (HTMLCanvasElement | null)[] = [null];
    
    // 1. Brick Wall
    const brick = document.createElement('canvas');
    brick.width = TEX_WIDTH; brick.height = TEX_HEIGHT;
    const bctx = brick.getContext('2d')!;
    bctx.fillStyle = '#9b301c';
    bctx.fillRect(0, 0, TEX_WIDTH, TEX_HEIGHT);
    bctx.fillStyle = '#cfcfcf'; // Mortar
    for(let y = 0; y < TEX_HEIGHT; y += 16) {
      bctx.fillRect(0, y, TEX_WIDTH, 2);
      for(let x = 0; x < TEX_WIDTH; x += 16) {
        bctx.fillRect(x + (y % 32 === 0 ? 0 : 8), y, 2, 16);
      }
    }
    textures.push(brick);

    // 2. Gravity Rock
    const rock = document.createElement('canvas');
    rock.width = TEX_WIDTH; rock.height = TEX_HEIGHT;
    const rctx = rock.getContext('2d')!;
    rctx.fillStyle = '#0ff'; // Base cyan
    rctx.fillRect(0, 0, TEX_WIDTH, TEX_HEIGHT);
    rctx.fillStyle = '#f0f'; // Magenta weird shapes
    for(let i = 0; i < 150; i++) {
       rctx.fillRect(Math.random() * TEX_WIDTH, Math.random() * TEX_HEIGHT, Math.random() * 8, Math.random() * 12);
    }
    textures.push(rock);

    // --- Generate Map ---
    const map = new Uint8Array(MAP_SIZE * MAP_SIZE).fill(1); // 1 = wall
    const carve = (x: number, y: number) => {
        map[y * MAP_SIZE + x] = 0;
        const dirs = [ [0,-2], [2,0], [0,2], [-2,0] ];
        for (let i = dirs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
        }
        for (const [dx, dy] of dirs) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx > 0 && nx < MAP_SIZE - 1 && ny > 0 && ny < MAP_SIZE - 1 && map[ny * MAP_SIZE + nx] === 1) {
                map[(y + dy / 2) * MAP_SIZE + (x + dx / 2)] = 0;
                carve(nx, ny);
            }
        }
    };
    carve(1, 1);
    
    // Add Gravity Rocks at dead ends
    for (let y = 1; y < MAP_SIZE - 1; y++) {
        for (let x = 1; x < MAP_SIZE - 1; x++) {
            if (map[y * MAP_SIZE + x] === 0 && !(x === 1 && y === 1)) {
                let neighbors = 0;
                if (map[(y-1)*MAP_SIZE+x] === 0) neighbors++;
                if (map[(y+1)*MAP_SIZE+x] === 0) neighbors++;
                if (map[y*MAP_SIZE+x-1] === 0) neighbors++;
                if (map[y*MAP_SIZE+x+1] === 0) neighbors++;
                if (neighbors === 1 && Math.random() < 0.3) {
                    map[y * MAP_SIZE + x] = 2; // Gravity Rock
                }
            }
        }
    }
    // Safety clear spawn
    map[1 * MAP_SIZE + 1] = 0;

    // --- AI & Raycaster State ---
    let cx = 1, cy = 1;     // grid position
    let cdir = 1;           // 0=N, 1=E, 2=S, 3=W
    let px = 1.5, py = 1.5; // continuous pos
    let angle = 0;          // continuous angle, East=0
    
    let aiState = 'idle';   // 'idle', 'moving', 'turning'
    let targetPx = 1.5, targetPy = 1.5;
    let targetAngle = 0;

    const DIRS = [ [0,-1], [1,0], [0,1], [-1,0] ]; // N, E, S, W
    const WALK_SPEED = 2.0;
    const TURN_SPEED = 3.0;

    const visitCounts = new Uint32Array(MAP_SIZE * MAP_SIZE);

    let lastTime = performance.now();
    let animationFrameId: number;

    const drawRaycaster = () => {
        const sw = canvas.width;
        const sh = canvas.height;
        
        ctx.fillStyle = '#333'; // ceiling
        ctx.fillRect(0, 0, sw, sh / 2);
        ctx.fillStyle = '#7a7a7a'; // floor
        ctx.fillRect(0, sh / 2, sw, sh / 2);

        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);
        const planeX = -Math.sin(angle) * 0.66;
        const planeY = Math.cos(angle) * 0.66;

        for (let x = 0; x < sw; x++) {
            const cameraX = 2 * x / sw - 1;
            const rayDirX = dirX + planeX * cameraX;
            const rayDirY = dirY + planeY * cameraX;

            let mapX = Math.floor(px);
            let mapY = Math.floor(py);

            let sideDistX, sideDistY;
            const deltaDistX = Math.abs(1 / rayDirX);
            const deltaDistY = Math.abs(1 / rayDirY);
            let perpWallDist;

            let stepX, stepY;
            let hit = 0;
            let side = 0;

            if (rayDirX < 0) { stepX = -1; sideDistX = (px - mapX) * deltaDistX; }
            else { stepX = 1; sideDistX = (mapX + 1.0 - px) * deltaDistX; }
            if (rayDirY < 0) { stepY = -1; sideDistY = (py - mapY) * deltaDistY; }
            else { stepY = 1; sideDistY = (mapY + 1.0 - py) * deltaDistY; }

            // DDA
            while (hit === 0) {
                if (sideDistX < sideDistY) {
                    sideDistX += deltaDistX;
                    mapX += stepX;
                    side = 0;
                } else {
                    sideDistY += deltaDistY;
                    mapY += stepY;
                    side = 1;
                }
                const mx = mapX & (MAP_SIZE - 1);
                const my = mapY & (MAP_SIZE - 1);
                const block = map[my * MAP_SIZE + mx];
                if (block > 0) hit = block;
            }

            if (side === 0) perpWallDist = (mapX - px + (1 - stepX) / 2) / rayDirX;
            else perpWallDist = (mapY - py + (1 - stepY) / 2) / rayDirY;

            // Prevent division by zero
            if (perpWallDist < 0.01) perpWallDist = 0.01;

            const lineHeight = Math.floor(sh / perpWallDist);
            const destY = Math.round(-lineHeight / 2 + sh / 2);

            let wallX;
            if (side === 0) wallX = py + perpWallDist * rayDirY;
            else wallX = px + perpWallDist * rayDirX;
            wallX -= Math.floor(wallX);

            let texX = Math.floor(wallX * TEX_WIDTH);
            if (side === 0 && rayDirX > 0) texX = TEX_WIDTH - texX - 1;
            if (side === 1 && rayDirY < 0) texX = TEX_WIDTH - texX - 1;

            const tex = textures[hit] || textures[1];
            if (tex) {
                ctx.filter = side === 1 ? 'brightness(70%)' : 'none';
                ctx.drawImage(tex, texX, 0, 1, TEX_HEIGHT, x, destY, 1, lineHeight);
            }
        }
        ctx.filter = 'none'; // reset
    };

    const updateAI = (dt: number) => {
        // Check for adjacent rocks
        for(let d=0; d<4; d++) {
            const rx = cx + DIRS[d][0];
            const ry = cy + DIRS[d][1];
            if (map[ry * MAP_SIZE + rx] === 2) {
                map[ry * MAP_SIZE + rx] = 0; // Consume rock
                flipCallback.current();
                break; 
            }
        }

        if (aiState === 'idle') {
            visitCounts[cy * MAP_SIZE + cx]++;

            const leftDir = (cdir + 3) % 4;
            const rightDir = (cdir + 1) % 4;
            const forwardDir = cdir;
            const backDir = (cdir + 2) % 4;

            const canGo = (d: number) => {
                const nx = cx + DIRS[d][0];
                const ny = cy + DIRS[d][1];
                return map[ny * MAP_SIZE + nx] !== 1;
            };

            const options: number[] = [];
            if (canGo(forwardDir)) options.push(forwardDir);
            if (canGo(leftDir)) options.push(leftDir);
            if (canGo(rightDir)) options.push(rightDir);
            
            // Only consider going backward if it's a dead end
            if (options.length === 0 && canGo(backDir)) {
                 options.push(backDir);
            }

            if (options.length > 0) {
                // Pick the option that has the lowest visit count
                let bestDirs: number[] = [];
                let minVisits = Infinity;

                for (const d of options) {
                    const nx = cx + DIRS[d][0];
                    const ny = cy + DIRS[d][1];
                    const visits = visitCounts[ny * MAP_SIZE + nx];
                    if (visits < minVisits) {
                        minVisits = visits;
                        bestDirs = [d];
                    } else if (visits === minVisits) {
                        bestDirs.push(d);
                    }
                }

                // Prefer going straight if it's tied for the lowest visit count
                let nextDir = bestDirs[0];
                if (bestDirs.length > 1) {
                    if (bestDirs.includes(forwardDir)) {
                        nextDir = forwardDir;
                    } else {
                        nextDir = bestDirs[Math.floor(Math.random() * bestDirs.length)];
                    }
                }

                if (nextDir !== cdir) {
                    let diff = nextDir - cdir;
                    if (diff === -3) diff = 1;
                    if (diff === 3) diff = -1;
                    if (diff === -2) diff = 2; // 180 degrees
                    targetAngle = angle + (diff * Math.PI / 2);
                    cdir = nextDir;
                    aiState = 'turning';
                } else {
                    cx += DIRS[cdir][0];
                    cy += DIRS[cdir][1];
                    targetPx = cx + 0.5;
                    targetPy = cy + 0.5;
                    aiState = 'moving';
                }
            } else {
                // Stuck? (Should not happen unless literally boxed in 1x1 area)
                cdir = (cdir + 1) % 4;
                targetAngle = angle + Math.PI / 2;
                aiState = 'turning';
            }
        } else if (aiState === 'turning') {
            const step = TURN_SPEED * dt;
            if (Math.abs(targetAngle - angle) <= step) {
                angle = targetAngle;
                aiState = 'idle';
            } else {
                angle += Math.sign(targetAngle - angle) * step;
            }
        } else if (aiState === 'moving') {
            const dist = Math.hypot(targetPx - px, targetPy - py);
            const step = WALK_SPEED * dt;
            if (dist <= step) {
                px = targetPx;
                py = targetPy;
                aiState = 'idle';
            } else {
                px += Math.cos(angle) * step;
                py += Math.sin(angle) * step;
            }
        }
    };

    const loop = (time: number) => {
        let dt = (time - lastTime) / 1000;
        lastTime = time;
        if (dt > 0.1) dt = 0.1; // clamp to prevent huge jumps
        
        updateAI(dt);
        drawRaycaster();
        
        animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden perspective-[1000px]">
      <canvas
        ref={canvasRef}
        width={320}
        height={240}
        className="w-full h-full object-cover"
        style={{
           imageRendering: 'pixelated',
           transition: 'transform 1.0s cubic-bezier(0.45, 0, 0.55, 1)',
           transform: isUpsideDown ? 'rotateZ(180deg) scaleX(-1)' : 'rotateZ(0deg) scaleX(1)'
        }}
      />
    </div>
  );
};
