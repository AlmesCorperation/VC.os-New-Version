import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, Play, Download, Check, Star, Info, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { SPECTRUM_GRADIENT } from '../constants';
import { kernel } from '../services/kernel';

export interface GameListing {
  id: string;
  title: string;
  developer: string;
  description: string;
  rating: number;
  trailerUrl: string;
  iconColor: string;
  script?: string;
  isMultiplayer?: boolean;
  engineMode?: string;
  sceneObjects?: any[];
}

export const GameStore: React.FC<{ 
  listings: GameListing[],
  installedGames: string[], 
  onInstall: (id: string) => void 
}> = ({ listings, installedGames, onInstall }) => {
  const [selectedGame, setSelectedGame] = useState<GameListing | null>(null);
  const [isInstalling, setIsInstalling] = useState<string | null>(null);
  const [showScript, setShowScript] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const handleInstall = (id: string) => {
    setIsInstalling(id);
    kernel.emitEvent('TASK', `STORE: INSTALLING (${id})`);
    setTimeout(() => {
      onInstall(id);
      setIsInstalling(null);
      kernel.emitEvent('TASK', `STORE: INSTALLED (${id})`);
    }, 2000);
  };

  // Arrow key navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!listings.length) return;
      
      const currentIndex = selectedGame ? listings.findIndex(g => g.id === selectedGame.id) : -1;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = Math.min(currentIndex + 1, listings.length - 1);
        const nextGame = listings[nextIndex === -1 ? 0 : nextIndex];
        setSelectedGame(nextGame);
        setShowScript(false);
        
        // Auto-scroll
        const element = document.getElementById(`game-item-${nextGame.id}`);
        element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = Math.max(currentIndex - 1, 0);
        const prevGame = listings[prevIndex];
        setSelectedGame(prevGame);
        setShowScript(false);

        // Auto-scroll
        const element = document.getElementById(`game-item-${prevGame.id}`);
        element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [listings, selectedGame]);

  return (
    <div className="h-full flex flex-col font-sans text-[11px] bg-win95-gray">
      {/* Store Header */}
      <div className="bg-win95-blue text-white p-1 flex items-center justify-between m-0.5">
        <div className="flex items-center gap-2">
          <ShoppingBag size={14} className="text-yellow-400" />
          <span className="font-bold uppercase">VC_STORE_v1.0</span>
        </div>
        <div className="flex items-center gap-4 opacity-70 text-[9px]">
          <div className="flex items-center gap-1">
            <ChevronUp size={10} />
            <ChevronDown size={10} />
            <span>NAV_KEYS_ACTIVE</span>
          </div>
          <span>GAMES</span>
          <span>APPS</span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden p-1 gap-1">
        {/* Game List */}
        <div 
          ref={listRef}
          className="w-1/3 border-inset overflow-y-auto p-1 space-y-1 bg-white relative outline-none"
          tabIndex={0}
        >
          {listings.map((game, idx) => (
            <div 
              key={game.id}
              id={`game-item-${game.id}`}
              onClick={() => {
                setSelectedGame(game);
                setShowScript(false);
              }}
              className={`p-1 border cursor-pointer transition-all relative ${
                selectedGame?.id === game.id ? 'bg-win95-blue text-white border-dotted border-win95-white' : 'border-transparent hover:bg-zinc-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-bold uppercase truncate">{game.title}</div>
                {game.isMultiplayer && <Globe size={10} className={selectedGame?.id === game.id ? 'text-blue-400' : 'opacity-50'} />}
              </div>
              <div className="text-[9px] opacity-50 truncate">by {game.developer}</div>
            </div>
          ))}
        </div>

        {/* Game Details */}
        <div className="flex-1 border-inset overflow-y-auto p-4 bg-white">
          <AnimatePresence mode="wait">
            {selectedGame ? (
              <motion.div 
                key={selectedGame.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                {/* Trailer Simulation */}
                <div className="aspect-video bg-black border-2 border-black relative group overflow-hidden flex items-center justify-center">
                  {showScript ? (
                    <div className="w-full h-full bg-zinc-900 p-4 text-[9px] text-green-400 overflow-auto font-mono whitespace-pre">
                      {selectedGame.script || '; VC.os Assembly Source\n; No raw source text attached to this package.'}
                    </div>
                  ) : (
                    <>
                      {selectedGame.trailerUrl && selectedGame.trailerUrl.startsWith('data:video/') ? (
                        <video 
                          src={selectedGame.trailerUrl} 
                          className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform"
                          autoPlay
                          loop
                          muted
                          playsInline
                        />
                      ) : selectedGame.trailerUrl ? (
                        <img 
                          src={selectedGame.trailerUrl} 
                          alt="Trailer" 
                          className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-cyan-400 p-4 text-center">
                          <ShoppingBag size={32} className="mb-2 opacity-40 text-blue-400" />
                          <div className="font-bold text-xs uppercase">{selectedGame.title || 'User Creation'}</div>
                          <div className="text-[9px] text-gray-400 mt-1">VC.os Native Executable Package</div>
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/40">
                          <Play size={24} className="text-white fill-white ml-1" />
                        </div>
                      </div>
                    </>
                  )}
                  <div className="absolute bottom-2 left-2 bg-black/80 text-[8px] px-1 text-white border border-white/20">
                    {showScript ? 'SOURCE_CODE_VIEW' : 'SIMULATED_TRAILER_STREAMING...'}
                  </div>
                  <button 
                    onClick={() => setShowScript(!showScript)}
                    className="absolute top-2 right-2 bg-black/80 text-[8px] px-2 py-1 text-white border border-white/20 hover:bg-white hover:text-black transition-all"
                  >
                    {showScript ? 'VIEW_TRAILER' : 'VIEW_SOURCE'}
                  </button>
                </div>

                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold uppercase tracking-tighter">{selectedGame.title || 'Untitled Creation'}</h2>
                      {selectedGame.isMultiplayer && (
                        <div className="bg-blue-600 text-white text-[8px] px-1.5 py-0.5 font-bold rounded flex items-center gap-1">
                          <Globe size={10} />
                          MULTIPLAYER
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex text-yellow-500">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={10} fill={i < Math.floor(Number(selectedGame.rating) || 5) ? "currentColor" : "none"} />
                        ))}
                      </div>
                      <span className="opacity-50 text-[9px]">{(Number(selectedGame.rating) || 5.0).toFixed(1)} (1.2k reviews)</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => handleInstall(selectedGame.id)}
                    disabled={installedGames.includes(selectedGame.id) || isInstalling === selectedGame.id}
                    className={`px-4 py-1 font-bold uppercase border-outset flex items-center gap-2 transition-all ${
                      installedGames.includes(selectedGame.id) 
                        ? 'bg-win95-gray text-win95-dark-gray cursor-default' 
                        : 'bg-win95-gray text-black hover:bg-zinc-200 active:border-inset'
                    }`}
                  >
                    {isInstalling === selectedGame.id ? (
                      <>
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                          className="w-3 h-3 border-2 border-white border-t-transparent rounded-full"
                        />
                        GETTING...
                      </>
                    ) : installedGames.includes(selectedGame.id) ? (
                      <>
                        <Check size={14} />
                        INSTALLED
                      </>
                    ) : (
                      <>
                        <Download size={14} />
                        GET FREE
                      </>
                    )}
                  </button>
                </div>

                <div className="p-3 bg-black/5 border border-black/10 leading-relaxed italic">
                  {selectedGame.description}
                </div>

                <div className="grid grid-cols-2 gap-4 text-[9px]">
                  <div className="space-y-1">
                    <div className="opacity-50">DEVELOPER</div>
                    <div className="font-bold">{selectedGame.developer}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="opacity-50">CATEGORY</div>
                    <div className="font-bold uppercase">Game / Simulation</div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-black/20 text-center">
                <ShoppingBag size={48} className="mb-4 opacity-10" />
                <div className="font-bold text-lg uppercase italic">Select a game to view details</div>
                <div className="text-[10px] mt-2">VC_STORE_v1.0.4 // SPECTRUM_NETWORK_ONLINE</div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
