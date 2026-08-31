import React, { useEffect, useRef } from 'react';

export const MystifyScreensaver: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    class Point {
        x: number;
        y: number;
        vx: number;
        vy: number;

        constructor(x: number, y: number) {
            this.x = x;
            this.y = y;
            this.vx = (Math.random() - 0.5) * 8;
            this.vy = (Math.random() - 0.5) * 8;
        }

        update(w: number, h: number) {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x <= 0 || this.x >= w) this.vx *= -1;
            if (this.y <= 0 || this.y >= h) this.vy *= -1;
        }
    }

    class Polygon {
        points: Point[] = [];
        color: string;

        constructor(x: number, y: number, color: string) {
            for (let i = 0; i < 4; i++) {
                this.points.push(new Point(x + Math.random() * 100 - 50, y + Math.random() * 100 - 50));
            }
            this.color = color;
        }

        update(w: number, h: number) {
            this.points.forEach(p => p.update(w, h));
        }

        draw(ctx: CanvasRenderingContext2D) {
            ctx.beginPath();
            ctx.moveTo(this.points[0].x, this.points[0].y);
            for (let i = 1; i < this.points.length; i++) {
                ctx.lineTo(this.points[i].x, this.points[i].y);
            }
            ctx.closePath();
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }

    const polys = [
        new Polygon(200, 200, '#00ffff'),
        new Polygon(400, 300, '#ff00ff'),
    ];

    const draw = () => {
        const sw = canvas.width;
        const sh = canvas.height;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, sw, sh);

        polys.forEach(p => {
            p.update(sw, sh);
            p.draw(ctx);
        });

        animationFrameId = requestAnimationFrame(draw);
    };

    const handleResize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
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
