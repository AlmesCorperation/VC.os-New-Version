import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Box, Plane, Sphere, Cylinder, Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { Play, Square, Pause, Plus, Trash2, Box as BoxIcon, Circle, Sun, Camera, Layers, Settings, Image as ImageIcon, MonitorPlay, Code2 } from 'lucide-react';
import { MemoryMap } from '../services/memoryMap';
import { GuestBlocker } from './GuestBlocker';
import { GameMaker } from './GameMaker';
import { useSettings } from '../hooks/useSettings';
import { kernel } from '../services/kernel';

type EngineMode = '2D' | 'Pseudo-3D' | 'Retro-3D';

type GameObjectType = 'cube' | 'sphere' | 'plane' | 'cylinder' | 'sprite' | 'light';

interface GameObject {
  id: string;
  name: string;
  type: GameObjectType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
}

const INITIAL_OBJECTS: GameObject[] = [
  { id: '1', name: 'Main Camera', type: 'camera' as any, position: [0, 2, 5], rotation: [-0.2, 0, 0], scale: [1, 1, 1], color: '#ffffff' },
  { id: '2', name: 'Directional Light', type: 'light', position: [5, 10, 5], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#ffffff' },
  { id: '3', name: 'Player Cube', type: 'cube', position: [0, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#3b82f6' },
  { id: '4', name: 'Ground', type: 'plane', position: [0, 0, 0], rotation: [-Math.PI / 2, 0, 0], scale: [10, 10, 1], color: '#2d2d2d' },
];

const RenderObject = ({ obj, mode, isSelected }: { obj: GameObject, mode: EngineMode, isSelected: boolean }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // Script Interpreter (The Librarian for N Language)
  useFrame((state) => {
    if (!meshRef.current || !(window as any).__VC_ENGINE_PLAYING) return;

    const script = (window as any).__VC_ENGINE_SCRIPT as string;
    if (!script) return;

    // N Language Protocol Verification
    if (!script.includes('{[%^Startcode%^}') || !script.includes('{[^%Endcode^%]}')) return;
    if (!script.includes('%^') || !script.includes('^%')) return;
    
    // Extract the active sequence
    const sequenceMatch = script.match(/%\^([\s\S]*?)\^%/);
    if (!sequenceMatch) return;
    const sequence = sequenceMatch[1];

    // 1. Parse Constraints and Definitions
    const definitions: Record<string, string> = {};
    const constraintMatch = sequence.match(/\[([\s\S]*?)\]/);
    if (constraintMatch) {
      const constraints = constraintMatch[1];
      const defRegex = /\+Define\+\s+(\w+)\s+"?([^"\s.]+)"?\s*\./g;
      let dMatch;
      while ((dMatch = defRegex.exec(constraints)) !== null) {
        definitions[dMatch[1]] = dMatch[2];
      }
    }

    // 2. Parse Trigger Block
    const triggerMatch = sequence.match(/\{([\s\S]*?)\}/);
    if (!triggerMatch) return;
    const trigger = triggerMatch[1];

    // Helper to resolve defined names
    const resolve = (val: string) => definitions[val] || val;

    // Key press helper
    const keys = (window as any).__VC_ENGINE_KEYS as Set<string>;
    const isKeyPressed = (key: string) => {
      if (!keys) return false;
      const mappedKey = key.replace('KEY_', '');
      // Handle special keys
      if (mappedKey === 'W') return keys.has('W') || keys.has('ARROWUP');
      if (mappedKey === 'S') return keys.has('S') || keys.has('ARROWDOWN');
      if (mappedKey === 'A') return keys.has('A') || keys.has('ARROWLEFT');
      if (mappedKey === 'D') return keys.has('D') || keys.has('ARROWRIGHT');
      return keys.has(mappedKey);
    };

    // N Language "Interpreter"
    // 1. Handle IF blocks by replacing them with their content if true, or empty if false
    const ifRegex = /IF\s*\(\s*is_key_pressed\s*\(\s*(\w+)\s*\)\s*\)\s*\{\s*([\s\S]*?)\s*\}/g;
    let processedTrigger = trigger.replace(ifRegex, (fullMatch, key, innerCode) => {
      return isKeyPressed(key) ? innerCode : '';
    });

    // 2. Handle rotate_object(Name, x, y, z)
    const rotateRegex = /rotate_object\s*\(\s*(\w+|"[^"]+")\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)\s*\./g;
    let match;
    while ((match = rotateRegex.exec(processedTrigger)) !== null) {
      const targetName = resolve(match[1].replace(/"/g, ''));
      if (targetName === obj.name) {
        meshRef.current.rotation.x += parseFloat(match[2]);
        meshRef.current.rotation.y += parseFloat(match[3]);
        meshRef.current.rotation.z += parseFloat(match[4]);
      }
    }

    // 3. Handle move_object(Name, x, y, z)
    const moveRegex = /move_object\s*\(\s*(\w+|"[^"]+")\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)\s*\./g;
    while ((match = moveRegex.exec(processedTrigger)) !== null) {
      const targetName = resolve(match[1].replace(/"/g, ''));
      if (targetName === obj.name) {
        meshRef.current.position.x += parseFloat(match[2]);
        meshRef.current.position.y += parseFloat(match[3]);
        meshRef.current.position.z += parseFloat(match[4]);
      }
    }
    
    // 4. Handle set_color(Name, hex)
    const colorRegex = /set_color\s*\(\s*(\w+|"[^"]+")\s*,\s*"(#[a-fA-F\d]+)"\s*\)\s*\./g;
    while ((match = colorRegex.exec(processedTrigger)) !== null) {
      const targetName = resolve(match[1].replace(/"/g, ''));
      if (targetName === obj.name) {
        (meshRef.current.material as THREE.MeshLambertMaterial).color.set(match[2]);
      }
    }

    // 5. Handle set_position(Name, x, y, z)
    const setPosRegex = /set_position\s*\(\s*(\w+|"[^"]+")\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)\s*\./g;
    while ((match = setPosRegex.exec(processedTrigger)) !== null) {
      const targetName = resolve(match[1].replace(/"/g, ''));
      if (targetName === obj.name) {
        meshRef.current.position.set(parseFloat(match[2]), parseFloat(match[3]), parseFloat(match[4]));
      }
    }

    // 6. Handle set_rotation(Name, x, y, z)
    const setRotRegex = /set_rotation\s*\(\s*(\w+|"[^"]+")\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)\s*\./g;
    while ((match = setRotRegex.exec(processedTrigger)) !== null) {
      const targetName = resolve(match[1].replace(/"/g, ''));
      if (targetName === obj.name) {
        meshRef.current.rotation.set(parseFloat(match[2]), parseFloat(match[3]), parseFloat(match[4]));
      }
    }

    // 7. Handle set_scale(Name, x, y, z)
    const setScaleRegex = /set_scale\s*\(\s*(\w+|"[^"]+")\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)\s*\./g;
    while ((match = setScaleRegex.exec(processedTrigger)) !== null) {
      const targetName = resolve(match[1].replace(/"/g, ''));
      if (targetName === obj.name) {
        meshRef.current.scale.set(parseFloat(match[2]), parseFloat(match[3]), parseFloat(match[4]));
      }
    }

    // 8. Handle log_to_console(msg) - Throttled to avoid flooding
    const logRegex = /log_to_console\s*\(\s*"([^"]+)"\s*\)\s*\./g;
    if (Math.random() > 0.99) { // Very simple throttle for simulation
      while ((match = logRegex.exec(processedTrigger)) !== null) {
        kernel.emitEvent('TASK', `VC_ENGINE_LOG: ${match[1]}`);
      }
    }
  });

  const wireframeColor = isSelected ? '#ffaa00' : '#ffffff';

  if (obj.type === 'light') return null; // Lights handled separately
  if (obj.type === 'camera' as any) return null;

  if (mode === '2D') {
    // Flatten Z in 2D mode
    return (
      <group position={[obj.position[0], obj.position[1], 0]} rotation={[0, 0, obj.rotation[2]]} scale={obj.scale}>
        <Plane args={[1, 1] as any}>
          <meshBasicMaterial color={obj.color} wireframe={isSelected} />
        </Plane>
      </group>
    );
  }

  if (mode === 'Pseudo-3D' && obj.type !== 'plane') {
    // Doom style billboard sprites for objects
    return (
      <Billboard position={obj.position} args={[obj.scale[0], obj.scale[1]] as any}>
        <Plane args={[1, 1] as any}>
          <meshBasicMaterial color={obj.color} wireframe={isSelected} />
        </Plane>
      </Billboard>
    );
  }

  return (
    <mesh 
      ref={meshRef}
      position={obj.position} 
      rotation={obj.rotation} 
      scale={obj.scale}
    >
      {obj.type === 'cube' && <boxGeometry args={[1, 1, 1]} />}
      {obj.type === 'sphere' && <sphereGeometry args={[0.5, 8, 8]} />} {/* Low poly sphere */}
      {obj.type === 'plane' && <planeGeometry args={[1, 1]} />}
      {obj.type === 'cylinder' && <cylinderGeometry args={[0.5, 0.5, 1, 8]} />}
      
      {mode === 'Pseudo-3D' ? (
        <meshBasicMaterial color={obj.color} />
      ) : (
        <meshLambertMaterial color={obj.color} flatShading={true} />
      )}
      
      {isSelected && (
        <mesh>
          {obj.type === 'cube' && <boxGeometry args={[1.05, 1.05, 1.05]} />}
          {obj.type === 'sphere' && <sphereGeometry args={[0.55, 8, 8]} />}
          {obj.type === 'plane' && <planeGeometry args={[1.05, 1.05]} />}
          {obj.type === 'cylinder' && <cylinderGeometry args={[0.55, 0.55, 1.05, 8]} />}
          <meshBasicMaterial color={wireframeColor} wireframe={true} transparent opacity={0.5} />
        </mesh>
      )}
    </mesh>
  );
};

const Viewport = ({ objects, mode, selectedId, performanceMode }: { objects: GameObject[], mode: EngineMode, selectedId: string | null, performanceMode: boolean }) => {
  const lights = objects.filter(o => o.type === 'light');

  return (
    <Canvas 
      camera={{ 
        position: mode === '2D' ? [0, 0, 10] : [5, 5, 5], 
        fov: 60,
        near: 0.1,
        far: 1000
      }} 
      orthographic={mode === '2D'}
      gl={{ 
        antialias: false, 
        pixelRatio: performanceMode ? 0.5 : (mode === 'Retro-3D' ? 0.3 : (mode === 'Pseudo-3D' ? 0.5 : 1)) // Low res for retro modes
      }}
    >
      <color attach="background" args={['#1a1a1a']} />
      
      {mode !== '2D' && <fog attach="fog" args={['#1a1a1a', 5, 30]} />}

      <ambientLight intensity={mode === 'Retro-3D' ? 0.5 : 0.8} />
      {lights.map(l => (
        <directionalLight 
          key={l.id} 
          position={l.position} 
          intensity={1.5} 
          color={l.color} 
          castShadow={!performanceMode && mode === 'Retro-3D'}
        />
      ))}

      {objects.map(obj => (
        <RenderObject key={obj.id} obj={obj} mode={mode} isSelected={obj.id === selectedId} />
      ))}

      {mode !== '2D' && <OrbitControls makeDefault />}
    </Canvas>
  );
};

export const VCEngine: React.FC<{ onPublish: (game: any) => void, firebaseUser: any, currentUser?: string | null }> = ({ onPublish, firebaseUser, currentUser }) => {
  const [objects, setObjects] = useState<GameObject[]>(INITIAL_OBJECTS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<EngineMode>('Retro-3D');
  const [isPlaying, setIsPlaying] = useState(false);
  const [view, setView] = useState<'scene' | 'scripting'>('scene');
  const { performanceMode } = useSettings();
  const [script, setScript] = useState(`{[%^Startcode%^}
%^
# THE N LANGUAGE: SCENE PROTOCOL #
[
  +Define+ Player "Player Cube" .
  +Define+ RotSpeed 0.02 .
  +Define+ MoveSpeed 0.05 .
]
{
  WHILETRUE {
    rotate_object(Player, 0, RotSpeed, 0) .
    
    IF (is_key_pressed(KEY_W)) { move_object(Player, 0, 0, -MoveSpeed) . }
    IF (is_key_pressed(KEY_S)) { move_object(Player, 0, 0, MoveSpeed) . }
    IF (is_key_pressed(KEY_A)) { move_object(Player, -MoveSpeed, 0, 0) . }
    IF (is_key_pressed(KEY_D)) { move_object(Player, MoveSpeed, 0, 0) . }
  }
}
^%
{[^%Endcode^%]}`);

  const keysPressed = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      keysPressed.current.add(e.key.toUpperCase());
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toUpperCase());
    };

    if (isPlaying) {
      kernel.triggerInterrupt(0x21, `(GAME_INPUT_POLL: ${Array.from(keysPressed.current).join(',')})`);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPlaying]);

  // Sync playing state, script and keys to window for the viewport to access
  (window as any).__VC_ENGINE_PLAYING = isPlaying;
  (window as any).__VC_ENGINE_SCRIPT = script;
  (window as any).__VC_ENGINE_KEYS = keysPressed.current;

  const selectedObj = objects.find(o => o.id === selectedId);

  const handleUpdateObj = (id: string, updates: Partial<GameObject>) => {
    setObjects(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const handleAddObj = (type: GameObjectType) => {
    kernel.triggerInterrupt(0xCC, `(ADD_OBJECT: ${type.toUpperCase()})`);
    const newObj: GameObject = {
      id: Math.random().toString(36).substr(2, 9),
      name: `New ${type}`,
      type,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#ffffff'
    };
    kernel.syscall('SYS_MALLOC', { size: 0.004 }); // 4KB per object
    setObjects(prev => [...prev, newObj]);
    setSelectedId(newObj.id);
  };

  const handleDeleteObj = (id: string) => {
    kernel.triggerInterrupt(0xCC, `(DELETE_OBJECT: ${id.toUpperCase()})`);
    kernel.syscall('SYS_FREE', { size: 0.004 });
    setObjects(prev => prev.filter(o => o.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#2d2d2d] text-white font-sans text-[10px] border-4 border-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-[#1a1a1a] p-2 border-b-4 border-white">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-bold text-blue-400">
            <MonitorPlay size={16} />
            VC.engine
          </div>
          <div className="flex gap-1 bg-black p-1 border-2 border-white">
            {(['2D', 'Pseudo-3D', 'Retro-3D'] as EngineMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2 py-1 ${mode === m ? 'bg-white text-black' : 'hover:bg-white/20'}`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="w-px h-6 bg-white/20 mx-2" />
          <div className="flex gap-1 bg-black p-1 border-2 border-white">
            <button
              onClick={() => setView('scene')}
              className={`flex items-center gap-1 px-2 py-1 ${view === 'scene' ? 'bg-white text-black' : 'hover:bg-white/20'}`}
            >
              <Layers size={12} />
              SCENE
            </button>
            <button
              onClick={() => setView('scripting')}
              className={`flex items-center gap-1 px-2 py-1 ${view === 'scripting' ? 'bg-white text-black' : 'hover:bg-white/20'}`}
            >
              <Code2 size={12} />
              SCRIPTING
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              if (!isPlaying) {
                kernel.emitEvent('TASK', 'VC_ENGINE: PLAY_SCENE');
                kernel.executeTask('VC_ENGINE_RUNTIME', 40);
              } else {
                kernel.emitEvent('TASK', 'VC_ENGINE: STOP_SCENE');
              }
              setIsPlaying(!isPlaying);
            }}
            className={`flex items-center gap-1 px-4 py-1 border-2 ${isPlaying ? 'bg-green-500 border-green-300 text-black' : 'bg-black border-white hover:bg-white/20'}`}
          >
            {isPlaying ? <Square size={12} /> : <Play size={12} />}
            {isPlaying ? 'STOP' : 'PLAY'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {view === 'scene' ? (
          <>
            {/* Hierarchy */}
            <div className="w-48 bg-[#222] border-r-4 border-white flex flex-col">
              <div className="p-2 bg-[#111] border-b-2 border-white font-bold flex justify-between items-center">
                <span>HIERARCHY</span>
                <div className="flex gap-1">
                  <button onClick={() => handleAddObj('cube')} className="p-1 hover:bg-white/20" title="Add Cube"><BoxIcon size={12} /></button>
                  <button onClick={() => handleAddObj('light')} className="p-1 hover:bg-white/20" title="Add Light"><Sun size={12} /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-1">
                {objects.map(obj => (
                  <div 
                    key={obj.id}
                    onClick={() => setSelectedId(obj.id)}
                    className={`flex items-center justify-between p-1 cursor-pointer ${selectedId === obj.id ? 'bg-blue-600 text-white' : 'hover:bg-white/10'}`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {obj.type === 'cube' && <BoxIcon size={10} />}
                      {obj.type === 'sphere' && <Circle size={10} />}
                      {obj.type === 'plane' && <Square size={10} />}
                      {obj.type === 'light' && <Sun size={10} />}
                      {obj.type === 'camera' as any && <Camera size={10} />}
                      <span className="truncate">{obj.name}</span>
                    </div>
                    {selectedId === obj.id && obj.type !== 'camera' as any && (
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteObj(obj.id); }} className="text-red-400 hover:text-red-300">
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Viewport */}
            <div className="flex-1 relative bg-black">
              <Viewport objects={objects} mode={mode} selectedId={selectedId} performanceMode={performanceMode} />
              
              {/* Viewport Overlays */}
              <div className="absolute top-2 left-2 pointer-events-none">
                <div className="bg-black/80 text-white px-2 py-1 border-2 border-white/50">
                  MODE: {mode} | {isPlaying ? 'PLAYING' : 'EDITING'}
                </div>
              </div>
              {mode === 'Retro-3D' && (
                <div className="absolute bottom-2 left-2 pointer-events-none text-white/50">
                  * Low-res rendering active
                </div>
              )}
            </div>

            {/* Inspector */}
            <div className="w-64 bg-[#222] border-l-4 border-white flex flex-col">
              <div className="p-2 bg-[#111] border-b-2 border-white font-bold">
                INSPECTOR
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {selectedObj ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-400 mb-1">Name</label>
                      <input 
                        type="text" 
                        value={selectedObj.name}
                        onChange={(e) => handleUpdateObj(selectedObj.id, { name: e.target.value })}
                        className="w-full bg-black border-2 border-white p-1 text-white"
                      />
                    </div>

                    {selectedObj.type !== 'camera' as any && selectedObj.type !== 'light' && (
                      <div>
                        <label className="block text-gray-400 mb-1">Color</label>
                        <input 
                          type="color" 
                          value={selectedObj.color}
                          onChange={(e) => handleUpdateObj(selectedObj.id, { color: e.target.value })}
                          className="w-full h-8 bg-black border-2 border-white cursor-pointer"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="font-bold border-b border-white/20 pb-1">Transform</div>
                      
                      {/* Position */}
                      <div>
                        <label className="block text-gray-400 mb-1">Position</label>
                        <div className="flex gap-1">
                          {['X', 'Y', 'Z'].map((axis, i) => (
                            <div key={axis} className="flex-1 flex items-center bg-black border-2 border-white">
                              <span className="px-1 text-gray-500">{axis}</span>
                              <input 
                                type="number" 
                                value={selectedObj.position[i]}
                                onChange={(e) => {
                                  const newPos = [...selectedObj.position] as [number, number, number];
                                  newPos[i] = parseFloat(e.target.value) || 0;
                                  handleUpdateObj(selectedObj.id, { position: newPos });
                                }}
                                className="w-full bg-transparent p-1 outline-none"
                                step="0.5"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Rotation */}
                      <div>
                        <label className="block text-gray-400 mb-1">Rotation</label>
                        <div className="flex gap-1">
                          {['X', 'Y', 'Z'].map((axis, i) => (
                            <div key={axis} className="flex-1 flex items-center bg-black border-2 border-white">
                              <span className="px-1 text-gray-500">{axis}</span>
                              <input 
                                type="number" 
                                value={selectedObj.rotation[i]}
                                onChange={(e) => {
                                  const newRot = [...selectedObj.rotation] as [number, number, number];
                                  newRot[i] = parseFloat(e.target.value) || 0;
                                  handleUpdateObj(selectedObj.id, { rotation: newRot });
                                }}
                                className="w-full bg-transparent p-1 outline-none"
                                step="0.1"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Scale */}
                      {selectedObj.type !== 'light' && selectedObj.type !== 'camera' as any && (
                        <div>
                          <label className="block text-gray-400 mb-1">Scale</label>
                          <div className="flex gap-1">
                            {['X', 'Y', 'Z'].map((axis, i) => (
                              <div key={axis} className="flex-1 flex items-center bg-black border-2 border-white">
                                <span className="px-1 text-gray-500">{axis}</span>
                                <input 
                                  type="number" 
                                  value={selectedObj.scale[i]}
                                  onChange={(e) => {
                                    const newScale = [...selectedObj.scale] as [number, number, number];
                                    newScale[i] = parseFloat(e.target.value) || 0;
                                    handleUpdateObj(selectedObj.id, { scale: newScale });
                                  }}
                                  className="w-full bg-transparent p-1 outline-none"
                                  step="0.5"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 text-center mt-10">
                    Select an object to inspect
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 bg-black">
            {currentUser === 'Guest' ? (
              <GuestBlocker />
            ) : (
              <GameMaker 
                onPublish={onPublish} 
                initialScript={script}
                onScriptChange={setScript}
                firebaseUser={firebaseUser}
                sceneObjects={objects}
                engineMode={mode}
              />
            )}
          </div>
        )}
      </div>
      
      {/* Status Bar */}
      <div className="bg-[#111] border-t-4 border-white p-1 flex justify-between text-gray-400">
        <span>VC.engine v1.0.0-alpha</span>
        <span>{objects.length} Objects in Scene</span>
      </div>
    </div>
  );
};
