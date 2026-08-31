import React, { useEffect, useRef } from 'react';

export const BouncingBoxScreensaver: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const box = {
      x: Math.random() * (canvas.width - 200),
      y: Math.random() * (canvas.height - 100),
      w: 200,
      h: 100,
      vx: 3,
      vy: 3,
      color: '#00ffff'
    };

    const colors = ['#00ffff', '#ff00ff', '#ffff00', '#00ff00', '#ff0000', '#0000ff', '#ffffff'];

    const draw = () => {
      const sw = canvas.width;
      const sh = canvas.height;
      
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, sw, sh);

      box.x += box.vx;
      box.y += box.vy;

      let hit = false;
      if (box.x <= 0 || box.x + box.w >= sw) {
        box.vx *= -1;
        hit = true;
      }
      if (box.y <= 0 || box.y + box.h >= sh) {
        box.vy *= -1;
        hit = true;
      }

      if (hit) {
        // Change color on bounce
        box.color = colors[Math.floor(Math.random() * colors.length)];
      }

      ctx.strokeStyle = box.color;
      ctx.lineWidth = 4;
      ctx.strokeRect(box.x, box.y, box.w, box.h);
      ctx.fillStyle = box.color;
      ctx.font = '24px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('VC.os', box.x + box.w / 2, box.y + box.h / 2);

      animationFrameId = requestAnimationFrame(draw);
    };

    const handleResize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        if (box.x + box.w > canvas.width) box.x = Math.max(0, canvas.width - box.w);
        if (box.y + box.h > canvas.height) box.y = Math.max(0, canvas.height - box.h);
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
