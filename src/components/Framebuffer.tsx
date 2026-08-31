import React, { useEffect, useRef } from 'react';
import { PALETTE } from '../constants';
import { useSettings } from '../hooks/useSettings';

export const Framebuffer: React.FC<{ isCrashing: boolean }> = ({ isCrashing }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { performanceMode } = useSettings();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;

    const render = () => {
      if (isCrashing && !performanceMode) {
        const imageData = ctx.createImageData(canvas.width, canvas.height);
        for (let i = 0; i < imageData.data.length; i += 4) {
          imageData.data[i] = Math.random() * 255;     // R
          imageData.data[i + 1] = Math.random() * 255; // G
          imageData.data[i + 2] = Math.random() * 255; // B
          imageData.data[i + 3] = 255;                 // A
        }
        ctx.putImageData(imageData, 0, 0);
        animationFrame = requestAnimationFrame(render);
      }
    };

    if (isCrashing && !performanceMode) {
      render();
    }
    
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [isCrashing, performanceMode]);

  if (performanceMode) return null;

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={200}
      className="fixed inset-0 w-full h-full object-cover pointer-events-none opacity-20 mix-blend-screen"
      style={{ imageRendering: 'pixelated' }}
    />
  );
};
