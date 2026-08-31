import React, { useEffect, useRef } from 'react';

export const PipesScreensaver: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const COLORS = ['#ff0000', '#00ff00', '#0044ff', '#ffff00', '#ff00ff', '#00ffff', '#dddddd'];

    const DIRS = [
      [1, 0, 0], [-1, 0, 0],
      [0, 1, 0], [0, -1, 0],
      [0, 0, 1], [0, 0, -1]
    ];

    const project = (x: number, y: number, z: number) => {
      const scale = 20;
      const px = (x - z) * 0.866 * scale;
      const py = ((x + z) * 0.5 - y) * scale;
      return { x: px + canvas.width / 2, y: py + canvas.height / 2 };
    };

    class Pipe {
      x: number; y: number; z: number;
      dx: number; dy: number; dz: number;
      color: string;
      targetX: number; targetY: number; targetZ: number;
      progress: number;
      active: boolean;

      constructor() {
        this.x = Math.floor(Math.random() * 20 - 10);
        this.y = Math.floor(Math.random() * 20 - 10);
        this.z = Math.floor(Math.random() * 20 - 10);
        const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
        this.dx = dir[0]; this.dy = dir[1]; this.dz = dir[2];
        this.targetX = this.x + this.dx;
        this.targetY = this.y + this.dy;
        this.targetZ = this.z + this.dz;
        this.progress = 0;
        this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
        this.active = true;
      }

      update() {
        if (!this.active) return;
        this.progress += 0.1;
        if (this.progress >= 1) {
          this.x = this.targetX;
          this.y = this.targetY;
          this.z = this.targetZ;
          this.progress = 0;

          if (Math.abs(this.x) > 15 || Math.abs(this.y) > 15 || Math.abs(this.z) > 15 || Math.random() < 0.2) {
            const validDirs = DIRS.filter(d => 
              (d[0] !== -this.dx || d[1] !== -this.dy || d[2] !== -this.dz) &&
              (d[0] !== this.dx || d[1] !== this.dy || d[2] !== this.dz)
            );
            const dir = validDirs[Math.floor(Math.random() * validDirs.length)];
            this.dx = dir[0]; this.dy = dir[1]; this.dz = dir[2];
            
            if (this.x > 10 && this.dx > 0) this.dx = -1;
            if (this.x < -10 && this.dx < 0) this.dx = 1;
            if (this.y > 10 && this.dy > 0) this.dy = -1;
            if (this.y < -10 && this.dy < 0) this.dy = 1;
            if (this.z > 10 && this.dz > 0) this.dz = -1;
            if (this.z < -10 && this.dz < 0) this.dz = 1;
          }
          this.targetX = this.x + this.dx;
          this.targetY = this.y + this.dy;
          this.targetZ = this.z + this.dz;
        }
      }

      draw(ctx: CanvasRenderingContext2D) {
        if (!this.active) return;
        
        const curX = this.x + this.dx * this.progress;
        const curY = this.y + this.dy * this.progress;
        const curZ = this.z + this.dz * this.progress;

        const prevX = this.x + this.dx * Math.max(0, this.progress - 0.1);
        const prevY = this.y + this.dy * Math.max(0, this.progress - 0.1);
        const prevZ = this.z + this.dz * Math.max(0, this.progress - 0.1);

        const p1 = project(prevX, prevY, prevZ);
        const p2 = project(curX, curY, curZ);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(p1.x - 2, p1.y - 2);
        ctx.lineTo(p2.x - 2, p2.y - 2);
        ctx.stroke();
      }
    }

    let pipes: Pipe[] = [];
    let lastClear = Date.now();

    const draw = () => {
      const now = Date.now();
      
      if (pipes.length < 5 && Math.random() < 0.02) {
        pipes.push(new Pipe());
      }
      
      if (now - lastClear > 15000) {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        pipes = [new Pipe()];
        lastClear = now;
      }

      pipes.forEach(p => {
        p.update();
        p.draw(ctx);
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    const handleResize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        pipes = [new Pipe()];
        lastClear = Date.now();
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="w-full h-full bg-black block overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
