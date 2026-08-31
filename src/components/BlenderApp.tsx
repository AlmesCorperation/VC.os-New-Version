import React, { useState, useEffect } from 'react';
import { Box, Layers, Play, MousePointer2, Grid3X3, Maximize, RotateCcw } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { kernel } from '../services/kernel';

export const BlenderApp: React.FC = () => {
  const [rotation, setRotation] = useState({ x: 45, y: 45 });
  const [isRotating, setIsRotating] = useState(true);
  const { performanceMode } = useSettings();

  useEffect(() => {
    if (!isRotating || performanceMode) return;
    const interval = setInterval(() => {
      setRotation(prev => ({
        x: (prev.x + 1) % 360,
        y: (prev.y + 1) % 360
      }));
      if (Math.random() > 0.95) kernel.emitEvent('TASK', 'BLENDER: RENDER_FRAME');
    }, 50);
    return () => clearInterval(interval);
  }, [isRotating, performanceMode]);

  return (
    <div className="flex flex-col h-full bg-[#2e2e2e] text-[#d1d1d1] font-sans overflow-hidden select-none">
      {/* Blender Header */}
      <div className="bg-[#3d3d3d] p-1 flex items-center gap-4 text-[11px] border-b border-[#1a1a1a]">
        <div className="flex items-center gap-1 px-2 py-0.5 bg-[#4d4d4d] rounded text-orange-400 font-bold">
          <Box size={12} />
          <span>Blender 3.4.1</span>
        </div>
        <div className="flex gap-3 opacity-80">
          <span>File</span>
          <span>Edit</span>
          <span>Render</span>
          <span>Window</span>
          <span>Help</span>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 flex relative bg-[#1a1a1a]">
        {/* Left Toolbar */}
        <div className="w-10 bg-[#3d3d3d] border-r border-[#1a1a1a] flex flex-col items-center py-4 gap-4 text-gray-400">
          <MousePointer2 size={18} className="text-orange-400" />
          <Grid3X3 size={18} />
          <Layers size={18} />
          <Maximize size={18} />
          <div className="mt-auto mb-2">
            <RotateCcw 
              size={18} 
              className={`cursor-pointer ${isRotating ? 'text-green-400' : ''}`}
              onClick={() => {
                setIsRotating(!isRotating);
                kernel.emitEvent('TASK', `BLENDER: ${!isRotating ? 'START' : 'STOP'}_ROTATION`);
              }}
            />
          </div>
        </div>

        {/* 3D Canvas Simulation */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 opacity-10" style={{ 
            backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', 
            backgroundSize: '20px 20px' 
          }} />
          
          {/* Simulated 3D Cube */}
          <div 
            className="relative w-32 h-32 preserve-3d transition-transform duration-100"
            style={{ 
              transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
              transformStyle: 'preserve-3d'
            }}
          >
            {[
              { transform: 'rotateY(0deg) translateZ(64px)', color: 'bg-orange-500/80' },
              { transform: 'rotateY(180deg) translateZ(64px)', color: 'bg-orange-600/80' },
              { transform: 'rotateY(90deg) translateZ(64px)', color: 'bg-orange-400/80' },
              { transform: 'rotateY(-90deg) translateZ(64px)', color: 'bg-orange-700/80' },
              { transform: 'rotateX(90deg) translateZ(64px)', color: 'bg-orange-300/80' },
              { transform: 'rotateX(-90deg) translateZ(64px)', color: 'bg-orange-800/80' },
            ].map((face, i) => (
              <div 
                key={i}
                className={`absolute inset-0 border border-white/20 flex items-center justify-center text-white/10 font-bold text-4xl ${face.color}`}
                style={{ transform: face.transform, backfaceVisibility: 'visible' }}
              >
                VC
              </div>
            ))}
          </div>

          {/* Viewport Info */}
          <div className="absolute top-4 left-4 text-[10px] text-gray-500 font-mono">
            User Perspective<br/>
            (1) Collection | Cube<br/>
            Rotation: {rotation.x}°, {rotation.y}°
          </div>
        </div>

        {/* Right Properties Panel */}
        <div className="w-48 bg-[#3d3d3d] border-l border-[#1a1a1a] p-3 flex flex-col gap-4">
          <div className="text-[11px] font-bold border-b border-[#1a1a1a] pb-1">Properties</div>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[9px] uppercase text-gray-500">Transform</label>
              <div className="grid grid-cols-3 gap-1">
                <div className="bg-[#2e2e2e] p-1 text-[10px] text-center border border-[#1a1a1a]">0.0</div>
                <div className="bg-[#2e2e2e] p-1 text-[10px] text-center border border-[#1a1a1a]">0.0</div>
                <div className="bg-[#2e2e2e] p-1 text-[10px] text-center border border-[#1a1a1a]">0.0</div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] uppercase text-gray-500">Rotation</label>
              <div className="grid grid-cols-3 gap-1 text-orange-400">
                <div className="bg-[#2e2e2e] p-1 text-[10px] text-center border border-[#1a1a1a]">{rotation.x}</div>
                <div className="bg-[#2e2e2e] p-1 text-[10px] text-center border border-[#1a1a1a]">{rotation.y}</div>
                <div className="bg-[#2e2e2e] p-1 text-[10px] text-center border border-[#1a1a1a]">0</div>
              </div>
            </div>
          </div>
          <button className="mt-auto w-full py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded flex items-center justify-center gap-2">
            <Play size={12} />
            RENDER
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="h-12 bg-[#3d3d3d] border-t border-[#1a1a1a] flex items-center px-4 gap-4">
        <div className="text-[10px] font-mono text-orange-400">0</div>
        <div className="flex-1 h-4 bg-[#1a1a1a] relative rounded-sm overflow-hidden">
          <div className="absolute top-0 bottom-0 w-0.5 bg-blue-500 left-1/4" />
          <div className="absolute top-0 bottom-0 w-0.5 bg-blue-500 left-1/2" />
          <div className="absolute top-0 bottom-0 w-0.5 bg-blue-500 left-3/4" />
        </div>
        <div className="text-[10px] font-mono text-gray-500">250</div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .preserve-3d { transform-style: preserve-3d; }
      `}} />
    </div>
  );
};
