import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createNoise2D } from 'simplex-noise';
import { kernel } from '../services/kernel';
import { VirtualGamepad } from './VirtualGamepad';
import { Gamepad2 } from 'lucide-react';

// --- Constants ---
const TILE_WATER = 0;
const TILE_GRASS = 1;
const TILE_FOREST = 2;
const TILE_MOUNTAIN = 3;

const MAP_WIDTH = 100;
const MAP_HEIGHT = 100;
const VIEW_WIDTH = 24;
const VIEW_HEIGHT = 16;
const TILE_SIZE = 24;

const CIVS = [
  { id: 'romans', name: 'Romans', color: '#FF4444' },
  { id: 'egyptians', name: 'Egyptians', color: '#FFFF44' },
  { id: 'greeks', name: 'Greeks', color: '#44FFFF' },
  { id: 'babylonians', name: 'Babylonians', color: '#FF44FF' },
  { id: 'aztecs', name: 'Aztecs', color: '#44FF44' }
];

const TECHS: Record<string, {name: string, cost: number, req: string[]}> = {
  'bronze': { name: 'Bronze Working', cost: 50, req: [] },
  'wheel': { name: 'The Wheel', cost: 40, req: [] },
  'horseback': { name: 'Horseback Riding', cost: 80, req: ['wheel'] },
  'iron': { name: 'Iron Working', cost: 120, req: ['bronze'] },
  'math': { name: 'Mathematics', cost: 100, req: ['wheel', 'bronze'] }
};

const UNIT_TYPES: Record<string, {name: string, cost: number, hp: number, attack: number, moves: number, reqTech: string | null, symbol: string}> = {
  'settler': { name: 'Settler', cost: 40, hp: 10, attack: 0, moves: 2, reqTech: null, symbol: 'S' },
  'warrior': { name: 'Warrior', cost: 20, hp: 20, attack: 10, moves: 2, reqTech: null, symbol: 'W' },
  'phalanx': { name: 'Phalanx', cost: 30, hp: 30, attack: 15, moves: 2, reqTech: 'bronze', symbol: 'P' },
  'horseman': { name: 'Horseman', cost: 40, hp: 25, attack: 20, moves: 4, reqTech: 'horseback', symbol: 'H' },
  'swordsman': { name: 'Swordsman', cost: 50, hp: 40, attack: 25, moves: 2, reqTech: 'iron', symbol: 'X' },
  'catapult': { name: 'Catapult', cost: 60, hp: 20, attack: 40, moves: 1, reqTech: 'math', symbol: 'C' }
};

interface Unit {
  id: string;
  type: string;
  x: number;
  y: number;
  hp: number;
  movesLeft: number;
  ownerId: string;
}

interface City {
  id: string;
  name: string;
  x: number;
  y: number;
  ownerId: string;
}

interface Player {
  id: string;
  civ: typeof CIVS[0];
  isHuman: boolean;
  gold: number;
  science: number;
  techs: string[];
  currentTech: string | null;
}

export const CivilGame: React.FC = () => {
  const [gameState, setGameState] = useState<'splash' | 'playing' | 'gameover'>('splash');
  const [playerCiv, setPlayerCiv] = useState(CIVS[0]);
  const [map, setMap] = useState<number[][]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [turn, setTurn] = useState(1);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [gameOverMsg, setGameOverMsg] = useState<string | null>(null);
  const [camX, setCamX] = useState(0);
  const [camY, setCamY] = useState(0);
  const [showTechTree, setShowTechTree] = useState(false);
  const [showGamepad, setShowGamepad] = useState(true);
  const touchStartRef = useRef<{ x: number; y: number; camX: number; camY: number } | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  // Touch handlers for panning the map
  const handleMapTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    isDraggingRef.current = false;
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      camX,
      camY
    };
  };

  const handleMapTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    if (Math.hypot(dx, dy) > 8) {
      isDraggingRef.current = true;
    }

    const tileDx = Math.round(-dx / TILE_SIZE);
    const tileDy = Math.round(-dy / TILE_SIZE);

    const targetX = Math.max(0, Math.min(MAP_WIDTH - VIEW_WIDTH, touchStartRef.current.camX + tileDx));
    const targetY = Math.max(0, Math.min(MAP_HEIGHT - VIEW_HEIGHT, touchStartRef.current.camY + tileDy));

    setCamX(targetX);
    setCamY(targetY);
  };

  const handleMapTouchEnd = () => {
    touchStartRef.current = null;
  };

  const generateMap = useCallback(() => {
    const noise2D = createNoise2D();
    const newMap: number[][] = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      const row: number[] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        const value = noise2D(x / 15, y / 15);
        if (value < -0.2) row.push(TILE_WATER);
        else if (value < 0.4) row.push(TILE_GRASS);
        else if (value < 0.7) row.push(TILE_FOREST);
        else row.push(TILE_MOUNTAIN);
      }
      newMap.push(row);
    }
    return newMap;
  }, []);

  const startGame = () => {
    const newMap = generateMap();
    setMap(newMap);
    
    kernel.emitEvent('TASK', 'CIVIL: START_GAME');

    const findSpawn = () => {
      while(true) {
        const x = Math.floor(Math.random() * (MAP_WIDTH - 20)) + 10;
        const y = Math.floor(Math.random() * (MAP_HEIGHT - 20)) + 10;
        if (newMap[y][x] === TILE_GRASS) return {x, y};
      }
    };

    const pSpawn = findSpawn();
    const eSpawn = findSpawn();

    const enemyCiv = CIVS.find(c => c.id !== playerCiv.id) || CIVS[1];

    setPlayers([
      { id: 'p1', civ: playerCiv, isHuman: true, gold: 50, science: 0, techs: [], currentTech: null },
      { id: 'e1', civ: enemyCiv, isHuman: false, gold: 50, science: 0, techs: [], currentTech: null }
    ]);

    setUnits([
      { id: 'u1', type: 'settler', x: pSpawn.x, y: pSpawn.y, hp: UNIT_TYPES['settler'].hp, movesLeft: UNIT_TYPES['settler'].moves, ownerId: 'p1' },
      { id: 'u2', type: 'warrior', x: pSpawn.x + 1, y: pSpawn.y, hp: UNIT_TYPES['warrior'].hp, movesLeft: UNIT_TYPES['warrior'].moves, ownerId: 'p1' },
      { id: 'e1', type: 'settler', x: eSpawn.x, y: eSpawn.y, hp: UNIT_TYPES['settler'].hp, movesLeft: UNIT_TYPES['settler'].moves, ownerId: 'e1' },
      { id: 'e2', type: 'warrior', x: eSpawn.x + 1, y: eSpawn.y, hp: UNIT_TYPES['warrior'].hp, movesLeft: UNIT_TYPES['warrior'].moves, ownerId: 'e1' }
    ]);

    setCities([]);
    setTurn(1);
    setCamX(Math.max(0, Math.min(MAP_WIDTH - VIEW_WIDTH, pSpawn.x - Math.floor(VIEW_WIDTH / 2))));
    setCamY(Math.max(0, Math.min(MAP_HEIGHT - VIEW_HEIGHT, pSpawn.y - Math.floor(VIEW_HEIGHT / 2))));
    setGameState('playing');
    setGameOverMsg(null);
  };

  const humanPlayer = players.find(p => p.isHuman);
  const selectedUnit = units.find(u => u.id === selectedUnitId);

  const handleTileClick = (x: number, y: number) => {
    if (gameState !== 'playing' || !humanPlayer) return;

    const clickedUnit = units.find(u => u.x === x && u.y === y);
    if (clickedUnit && clickedUnit.ownerId === humanPlayer.id) {
      setSelectedUnitId(clickedUnit.id);
      return;
    }

    if (selectedUnit && selectedUnit.ownerId === humanPlayer.id && selectedUnit.movesLeft > 0) {
      const dx = Math.abs(selectedUnit.x - x);
      const dy = Math.abs(selectedUnit.y - y);
      
      if (dx <= 1 && dy <= 1 && (dx > 0 || dy > 0)) {
        const terrain = map[y][x];
        if (terrain === TILE_WATER || terrain === TILE_MOUNTAIN) return;

        if (clickedUnit && clickedUnit.ownerId !== humanPlayer.id) {
          const damage = UNIT_TYPES[selectedUnit.type].attack;
          const newUnits = units.filter(u => u.id !== clickedUnit.id).map(u => {
            if (u.id === selectedUnit.id) return { ...u, movesLeft: 0 };
            return u;
          });
          if (clickedUnit.hp - damage > 0) {
            newUnits.push({ ...clickedUnit, hp: clickedUnit.hp - damage });
          }
          setUnits(newUnits);
          setSelectedUnitId(null);
          return;
        }

        const clickedCity = cities.find(c => c.x === x && c.y === y);
        if (clickedCity && clickedCity.ownerId !== humanPlayer.id) {
          setCities(cities.map(c => c.id === clickedCity.id ? { ...c, ownerId: humanPlayer.id } : c));
        }

        setUnits(units.map(u => u.id === selectedUnit.id ? { ...u, x, y, movesLeft: u.movesLeft - 1 } : u));
      }
    } else {
      setSelectedUnitId(null);
    }
  };

  // Keyboard controls for moving selected units (and VirtualGamepad mapping)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing' || !selectedUnitId || !humanPlayer) return;
      const unit = units.find(u => u.id === selectedUnitId);
      if (!unit || unit.ownerId !== humanPlayer.id || unit.movesLeft <= 0) return;

      let targetX = unit.x;
      let targetY = unit.y;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          targetY = Math.max(0, unit.y - 1);
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          targetY = Math.min(MAP_HEIGHT - 1, unit.y + 1);
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          targetX = Math.max(0, unit.x - 1);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          targetX = Math.min(MAP_WIDTH - 1, unit.x + 1);
          break;
        default:
          return;
      }

      if (targetX !== unit.x || targetY !== unit.y) {
        handleTileClick(targetX, targetY);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedUnitId, units, humanPlayer, gameState]);

  const buildCity = () => {
    if (selectedUnit && selectedUnit.type === 'settler' && selectedUnit.movesLeft > 0 && humanPlayer) {
      if (cities.some(c => c.x === selectedUnit.x && c.y === selectedUnit.y)) return;

      const newCity: City = {
        id: 'c_' + Date.now(),
        name: humanPlayer.civ.name + ' City',
        x: selectedUnit.x,
        y: selectedUnit.y,
        ownerId: humanPlayer.id
      };
      setCities([...cities, newCity]);
      setUnits(units.filter(u => u.id !== selectedUnit.id));
      setSelectedUnitId(null);
    }
  };

  const buyUnit = (type: string) => {
    if (!humanPlayer) return;
    const cost = UNIT_TYPES[type].cost;
    if (humanPlayer.gold >= cost) {
      const playerCities = cities.filter(c => c.ownerId === humanPlayer.id);
      if (playerCities.length > 0) {
        const spawnCity = playerCities[0];
        setPlayers(players.map(p => p.id === humanPlayer.id ? { ...p, gold: p.gold - cost } : p));
        setUnits([...units, {
          id: 'u_' + Date.now(),
          type,
          x: spawnCity.x,
          y: spawnCity.y,
          hp: UNIT_TYPES[type].hp,
          movesLeft: UNIT_TYPES[type].moves,
          ownerId: humanPlayer.id
        }]);
      }
    }
  };

  const selectTech = (techId: string) => {
    if (!humanPlayer) return;
    setPlayers(players.map(p => p.id === humanPlayer.id ? { ...p, currentTech: techId } : p));
    setShowTechTree(false);
  };

  const endTurn = () => {
    kernel.emitEvent('TASK', 'CIVIL: END_TURN');
    let currentUnits = [...units];
    let currentCities = [...cities];
    let currentPlayers = [...players];

    currentPlayers = currentPlayers.map(p => {
      const playerCities = currentCities.filter(c => c.ownerId === p.id);
      let newGold = p.gold + playerCities.length * 5;
      let newScience = p.science + playerCities.length * 5;
      let newTechs = [...p.techs];
      let newCurrentTech = p.currentTech;

      if (newCurrentTech) {
        const techCost = TECHS[newCurrentTech].cost;
        if (newScience >= techCost) {
          newScience -= techCost;
          newTechs.push(newCurrentTech);
          newCurrentTech = null;
        }
      }

      if (!p.isHuman) {
        if (!newCurrentTech) {
          const availableTechs = Object.keys(TECHS).filter(t => !newTechs.includes(t) && TECHS[t].req.every(r => newTechs.includes(r)));
          if (availableTechs.length > 0) {
            newCurrentTech = availableTechs[Math.floor(Math.random() * availableTechs.length)];
          }
        }

        playerCities.forEach(c => {
          if (newGold >= 40 && Math.random() < 0.3) {
            const availableUnits = Object.entries(UNIT_TYPES).filter(([id, u]) => !u.reqTech || newTechs.includes(u.reqTech));
            const bestUnit = availableUnits.sort((a, b) => b[1].attack - a[1].attack)[0];
            const unitToBuy = (playerCities.length < 3 && newGold >= 40 && Math.random() < 0.5) ? 'settler' : bestUnit[0];
            const cost = UNIT_TYPES[unitToBuy].cost;
            
            if (newGold >= cost) {
              newGold -= cost;
              currentUnits.push({
                id: 'u_' + Date.now() + Math.random(),
                type: unitToBuy,
                x: c.x,
                y: c.y,
                hp: UNIT_TYPES[unitToBuy].hp,
                movesLeft: UNIT_TYPES[unitToBuy].moves,
                ownerId: p.id
              });
            }
          }
        });
      }

      return { ...p, gold: newGold, science: newScience, techs: newTechs, currentTech: newCurrentTech };
    });

    currentUnits = currentUnits.map(u => {
      const owner = currentPlayers.find(p => p.id === u.ownerId);
      if (owner && !owner.isHuman) {
        if (u.type === 'settler') {
          if (!currentCities.some(c => c.x === u.x && c.y === u.y)) {
            currentCities.push({
              id: 'c_' + Date.now() + Math.random(),
              name: owner.civ.name + ' City',
              x: u.x,
              y: u.y,
              ownerId: owner.id
            });
            return { ...u, hp: -1 };
          } else {
            const nx = u.x + Math.floor(Math.random() * 3) - 1;
            const ny = u.y + Math.floor(Math.random() * 3) - 1;
            if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT && map[ny][nx] !== TILE_WATER && map[ny][nx] !== TILE_MOUNTAIN) {
              u.x = nx; u.y = ny;
            }
          }
        } else {
          const enemies = currentUnits.filter(eu => eu.ownerId !== u.ownerId);
          if (enemies.length > 0) {
            const target = enemies.sort((a, b) => (Math.abs(a.x - u.x) + Math.abs(a.y - u.y)) - (Math.abs(b.x - u.x) + Math.abs(b.y - u.y)))[0];
            const dx = Math.sign(target.x - u.x);
            const dy = Math.sign(target.y - u.y);
            const nx = u.x + dx;
            const ny = u.y + dy;
            
            if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT && map[ny][nx] !== TILE_WATER && map[ny][nx] !== TILE_MOUNTAIN) {
              const enemyUnit = currentUnits.find(eu => eu.x === nx && eu.y === ny && eu.ownerId !== u.ownerId);
              if (enemyUnit) {
                enemyUnit.hp -= UNIT_TYPES[u.type].attack;
              } else {
                u.x = nx; u.y = ny;
              }
            }
          }
        }
      }
      return { ...u, movesLeft: UNIT_TYPES[u.type].moves };
    }).filter(u => u.hp > 0);

    setUnits(currentUnits);
    setCities(currentCities);
    setPlayers(currentPlayers);
    setTurn(t => t + 1);
    setSelectedUnitId(null);

    const hPlayer = currentPlayers.find(p => p.isHuman);
    const humanHasCities = currentCities.some(c => c.ownerId === hPlayer?.id);
    const humanHasUnits = currentUnits.some(u => u.ownerId === hPlayer?.id);
    const aiHasCities = currentCities.some(c => c.ownerId !== hPlayer?.id);
    const aiHasUnits = currentUnits.some(u => u.ownerId !== hPlayer?.id);

    if (!humanHasCities && !humanHasUnits) {
      setGameOverMsg('DEFEAT! Your civilization has fallen.');
      setGameState('gameover');
    } else if (!aiHasCities && !aiHasUnits) {
      setGameOverMsg('VICTORY! You have conquered the world.');
      setGameState('gameover');
    }
  };

  const getTileColor = (type: number) => {
    switch (type) {
      case TILE_WATER: return '#0000AA';
      case TILE_GRASS: return '#00AA00';
      case TILE_FOREST: return '#005500';
      case TILE_MOUNTAIN: return '#555555';
      default: return '#000000';
    }
  };

  if (gameState === 'splash') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-black text-white font-mono select-none">
        <h1 className="text-4xl font-bold text-yellow-400 mb-2">KEO'S CIVIL 1</h1>
        <p className="text-gray-400 mb-8">A 1990s Demake</p>
        <div className="mb-8 text-center">
          <h2 className="text-xl mb-4">CHOOSE YOUR CIVILIZATION</h2>
          <div className="flex flex-wrap gap-4 justify-center max-w-md">
            {CIVS.map(civ => (
              <button
                key={civ.id}
                onClick={() => setPlayerCiv(civ)}
                className={`px-4 py-2 border-2 ${playerCiv.id === civ.id ? 'border-yellow-400 bg-gray-800' : 'border-gray-600 hover:border-white'}`}
                style={{ color: civ.color }}
              >
                {civ.name}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={startGame}
          className="px-8 py-4 bg-blue-900 border-2 border-white text-xl hover:bg-blue-800 transition-colors"
        >
          START GAME
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black text-white font-mono text-xs select-none relative">
      {/* Header */}
      <div className="flex justify-between items-center bg-blue-900 p-2 border-b-2 border-white">
        <div className="flex items-center gap-2">
          <span className="font-bold text-yellow-400" style={{ color: humanPlayer?.civ.color }}>{humanPlayer?.civ.name.toUpperCase()}</span>
          <button
            type="button"
            onClick={() => setShowGamepad(p => !p)}
            className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-white/80 border border-zinc-600 rounded flex items-center gap-1 text-[9px]"
          >
            <Gamepad2 size={10} className={showGamepad ? 'text-green-400' : 'text-zinc-400'} />
            <span>{showGamepad ? 'Hide Pad' : 'D-Pad'}</span>
          </button>
        </div>
        <div className="flex gap-4">
          <span>TURN: {turn}</span>
          <span className="text-yellow-400">GOLD: {humanPlayer?.gold}</span>
          <span className="text-blue-300">SCI: {humanPlayer?.science}</span>
          <span className="text-purple-300">
            TECH: {humanPlayer?.currentTech ? TECHS[humanPlayer.currentTech].name : 'NONE'}
          </span>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map Area with Panning */}
        <div className="flex-1 flex flex-col bg-gray-900 relative">
          <div className="flex justify-center gap-2 p-1 bg-gray-800 border-b border-gray-600 select-none z-20">
            <button onClick={() => setCamY(y => Math.max(0, y - 5))} className="px-2 bg-gray-700 hover:bg-gray-600">↑ UP</button>
            <button onClick={() => setCamY(y => Math.min(MAP_HEIGHT - VIEW_HEIGHT, y + 5))} className="px-2 bg-gray-700 hover:bg-gray-600">↓ DOWN</button>
            <button onClick={() => setCamX(x => Math.max(0, x - 5))} className="px-2 bg-gray-700 hover:bg-gray-600">← LEFT</button>
            <button onClick={() => setCamX(x => Math.min(MAP_WIDTH - VIEW_WIDTH, x + 5))} className="px-2 bg-gray-700 hover:bg-gray-600">→ RIGHT</button>
          </div>
          <div 
            className="flex-1 relative overflow-hidden flex items-center justify-center touch-none select-none cursor-grab active:cursor-grabbing"
            onTouchStart={handleMapTouchStart}
            onTouchMove={handleMapTouchMove}
            onTouchEnd={handleMapTouchEnd}
          >
            <div 
              className="relative" 
              style={{ 
                width: VIEW_WIDTH * TILE_SIZE, 
                height: VIEW_HEIGHT * TILE_SIZE,
                imageRendering: 'pixelated'
              }}
            >
              {map.slice(camY, camY + VIEW_HEIGHT).map((row, y) => 
                row.slice(camX, camX + VIEW_WIDTH).map((tile, x) => {
                  const worldX = camX + x;
                  const worldY = camY + y;
                  return (
                    <div
                      key={`${worldX}-${worldY}`}
                      onClick={(e) => {
                        if (isDraggingRef.current) {
                          e.preventDefault();
                          return;
                        }
                        handleTileClick(worldX, worldY);
                      }}
                      className="absolute border border-black/20 hover:border-white/50 cursor-pointer"
                      style={{
                        left: x * TILE_SIZE,
                        top: y * TILE_SIZE,
                        width: TILE_SIZE,
                        height: TILE_SIZE,
                        backgroundColor: getTileColor(tile),
                      }}
                    >
                      {tile === TILE_FOREST && <div className="text-[10px] text-center mt-1 opacity-50">♠</div>}
                      {tile === TILE_MOUNTAIN && <div className="text-[10px] text-center mt-1 opacity-50">▲</div>}
                    </div>
                  );
                })
              )}

              {cities.filter(c => c.x >= camX && c.x < camX + VIEW_WIDTH && c.y >= camY && c.y < camY + VIEW_HEIGHT).map(city => {
                const owner = players.find(p => p.id === city.ownerId);
                return (
                  <div
                    key={city.id}
                    className="absolute flex items-center justify-center pointer-events-none"
                    style={{
                      left: (city.x - camX) * TILE_SIZE,
                      top: (city.y - camY) * TILE_SIZE,
                      width: TILE_SIZE,
                      height: TILE_SIZE,
                      backgroundColor: owner?.civ.color || '#FFF',
                      border: '2px solid white'
                    }}
                  >
                    <span className="text-black font-bold text-[10px]">C</span>
                  </div>
                );
              })}

              {units.filter(u => u.x >= camX && u.x < camX + VIEW_WIDTH && u.y >= camY && u.y < camY + VIEW_HEIGHT).map(unit => {
                const owner = players.find(p => p.id === unit.ownerId);
                const uType = UNIT_TYPES[unit.type];
                return (
                  <div
                    key={unit.id}
                    className={`absolute flex items-center justify-center pointer-events-none ${selectedUnitId === unit.id ? 'animate-pulse ring-2 ring-yellow-400 z-10' : ''}`}
                    style={{
                      left: (unit.x - camX) * TILE_SIZE + 4,
                      top: (unit.y - camY) * TILE_SIZE + 4,
                      width: 16,
                      height: 16,
                      backgroundColor: owner?.civ.color || '#FFF',
                      borderRadius: unit.type === 'settler' ? '50%' : '0%',
                      border: '1px solid white'
                    }}
                  >
                    <span className="text-black font-bold text-[8px]">{uType.symbol}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* On-screen touch gamepad overlay */}
          {showGamepad && (
            <div className="absolute inset-x-0 bottom-2 z-30 pointer-events-none pb-1">
              <VirtualGamepad 
                compact={true}
                keyMap={{
                  up: 'w',
                  down: 's',
                  left: 'a',
                  right: 'd'
                }}
                showActions={false}
              />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-48 bg-gray-800 border-l-2 border-white p-2 flex flex-col gap-2 overflow-y-auto">
          <div className="border border-white p-2 bg-black">
            <div className="text-center font-bold mb-2 border-b border-white pb-1">COMMANDS</div>
            <button 
              onClick={endTurn}
              className="w-full py-1 mb-2 bg-blue-800 hover:bg-blue-700 border border-white"
            >
              END TURN
            </button>
            <button 
              onClick={() => setShowTechTree(true)}
              className="w-full py-1 mb-2 bg-purple-900 hover:bg-purple-800 border border-white"
            >
              TECH TREE
            </button>
            
            {selectedUnit && selectedUnit.ownerId === humanPlayer?.id && (
              <div className="mt-4 text-[10px]">
                <div className="text-yellow-400 mb-1">SELECTED UNIT:</div>
                <div>TYPE: {UNIT_TYPES[selectedUnit.type].name.toUpperCase()}</div>
                <div>MOVES: {selectedUnit.movesLeft}/{UNIT_TYPES[selectedUnit.type].moves}</div>
                <div>HP: {selectedUnit.hp}</div>
                
                {selectedUnit.type === 'settler' && selectedUnit.movesLeft > 0 && (
                  <button 
                    onClick={buildCity}
                    className="w-full py-1 mt-2 bg-green-800 hover:bg-green-700 border border-white"
                  >
                    BUILD CITY
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="border border-white p-2 bg-black flex-1">
            <div className="text-center font-bold mb-2 border-b border-white pb-1">PRODUCTION</div>
            {Object.entries(UNIT_TYPES).map(([id, u]) => {
              const canBuild = !u.reqTech || humanPlayer?.techs.includes(u.reqTech);
              if (!canBuild) return null;
              return (
                <button 
                  key={id}
                  onClick={() => buyUnit(id)}
                  disabled={(humanPlayer?.gold || 0) < u.cost}
                  className="w-full py-1 mb-1 bg-gray-700 hover:bg-gray-600 border border-white disabled:opacity-50 text-[10px]"
                >
                  {u.name.toUpperCase()} ({u.cost}G)
                </button>
              );
            })}
            <div className="text-[9px] text-gray-400 mt-2">
              * Units spawn at your first city.
            </div>
          </div>
        </div>
      </div>

      {/* Tech Tree Modal */}
      {showTechTree && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-40 p-8">
          <div className="bg-gray-900 border-2 border-white p-4 w-full max-w-2xl max-h-full overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b border-white pb-2">
              <h2 className="text-xl font-bold text-yellow-400">TECHNOLOGY TREE</h2>
              <button onClick={() => setShowTechTree(false)} className="px-2 py-1 bg-red-900 border border-white">CLOSE</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(TECHS).map(([id, tech]) => {
                const isResearched = humanPlayer?.techs.includes(id);
                const isResearching = humanPlayer?.currentTech === id;
                const canResearch = !isResearched && tech.req.every(r => humanPlayer?.techs.includes(r));
                
                return (
                  <div key={id} className={`p-2 border ${isResearched ? 'border-green-500 bg-green-900/30' : isResearching ? 'border-yellow-400 bg-yellow-900/30' : canResearch ? 'border-white bg-gray-800' : 'border-gray-600 bg-gray-900 opacity-50'}`}>
                    <div className="font-bold">{tech.name}</div>
                    <div className="text-[10px] text-gray-400">COST: {tech.cost} SCI</div>
                    {tech.req.length > 0 && <div className="text-[9px] text-red-300">REQ: {tech.req.map(r => TECHS[r].name).join(', ')}</div>}
                    {!isResearched && canResearch && !isResearching && (
                      <button onClick={() => selectTech(id)} className="mt-2 px-2 py-1 bg-blue-900 border border-white text-[10px] w-full">
                        RESEARCH
                      </button>
                    )}
                    {isResearched && <div className="mt-2 text-green-400 text-[10px]">RESEARCHED</div>}
                    {isResearching && <div className="mt-2 text-yellow-400 text-[10px]">RESEARCHING...</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-blue-900 border-4 border-white p-8 text-center max-w-md">
            <h2 className="text-2xl font-bold text-yellow-400 mb-4">{gameOverMsg}</h2>
            <button 
              onClick={() => setGameState('splash')}
              className="px-4 py-2 bg-black border-2 border-white hover:bg-white hover:text-black transition-colors"
            >
              MAIN MENU
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
