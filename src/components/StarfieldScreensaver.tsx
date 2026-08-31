import React, { useEffect, useRef } from 'react';

export const StarfieldScreensaver: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const stars: { x: number; y: number; z: number }[] = [];
    const numStars = 400;

    for (let i = 0; i < numStars; i++) {
        stars.push({
            x: Math.random() * 2000 - 1000,
            y: Math.random() * 2000 - 1000,
            z: Math.random() * 2000
        });
    }

    const draw = () => {
        const sw = canvas.width;
        const sh = canvas.height;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, sw, sh);

        const centerX = sw / 2;
        const centerY = sh / 2;

        ctx.fillStyle = 'white';
        for (let i = 0; i < numStars; i++) {
            const star = stars[i];
            star.z -= 10;

            if (star.z <= 0) {
                star.x = Math.random() * 2000 - 1000;
                star.y = Math.random() * 2000 - 1000;
                star.z = 2000;
            }

            const sx = star.x / star.z * 1000 + centerX;
            const sy = star.y / star.z * 1000 + centerY;

            const size = (1 - star.z / 2000) * 3;

            if (sx > 0 && sx < sw && sy > 0 && sy < sh) {
                ctx.beginPath();
                ctx.arc(sx, sy, size, 0, 2 * Math.PI);
                ctx.fill();
            }
        }

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
