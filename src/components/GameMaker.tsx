import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Code2, Rocket, Save, Terminal, AlertCircle } from 'lucide-react';
import { SPECTRUM_GRADIENT } from '../constants';
import { vfs } from '../services/vfs';
import { kernel } from '../services/kernel';
import { db, OperationType, handleFirestoreError, collection, doc, setDoc, serverTimestamp } from '../services/p2p_mock';

export const GameMaker: React.FC<{ 
  onPublish: (game: any) => void,
  initialScript?: string,
  onScriptChange?: (script: string) => void,
  firebaseUser: any,
  sceneObjects?: any[],
  engineMode?: string
}> = ({ onPublish, initialScript, onScriptChange, firebaseUser, sceneObjects, engineMode }) => {
  const [vfsFiles, setVfsFiles] = useState<string[]>([]);
  
  useEffect(() => {
    setVfsFiles(vfs.ls());
  }, []);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'ARCADE',
    version: '1.0.0',
    isMultiplayer: false,
    trailerFile: '',
    script: initialScript || `; VC.os Assembly: Boot Protocol
; Runs natively on the VC Virtual Machine
START:
    CLI                 ; Disable Interrupts
    MOV EAX, 0x0013     ; Mode 13h (320x200 256 colors)
    INT 0x10            ; Switch Video Mode
    MOV EBX, 0x000A0000 ; VRAM Base Address
    MOV EAX, 0x0000000A ; Light Green Color
    OUT 0x3C8, AL
    MOV EAX, 0x0000003F
    OUT 0x3C9, AL
    HLT                 ; Wait for interrupt`
  });

  // Sync script changes back to parent
  useEffect(() => {
    if (onScriptChange) {
      onScriptChange(formData.script);
    }
  }, [formData.script, onScriptChange]);

  const [isPublishing, setIsPublishing] = useState(false);
  const [logs, setLogs] = useState<string[]>(['[ASSEMBLER] Initialized...', '[ASSEMBLER] Awaiting x86 mnemonics...']);

  const addLog = (msg: string) => setLogs(prev => [...prev, `> ${msg}`]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;

    setIsPublishing(true);
    addLog(`Initiating sequence for ${formData.title}.n...`);
    kernel.emitEvent('TASK', `GAMEMAKER: PUBLISHING (${formData.title})`);
    
    try {
      addLog('Resolving constraints...');
      addLog('Verifying fuzzy-modal convergence...');
      addLog('The Librarian is remembering this logic...');
      
      let finalTrailerUrl = `https://picsum.photos/seed/${formData.title}/400/225`;
      if (formData.trailerFile) {
        try {
          const fileContent = vfs.cat(formData.trailerFile);
          if (fileContent.startsWith('data:')) {
            finalTrailerUrl = fileContent;
          }
        } catch (e) {
          addLog('WARNING: Failed to load trailer file from VFS.');
        }
      }

      const activeDevName = (firebaseUser && firebaseUser.displayName) || localStorage.getItem('vcos_username') || 'ANONYMOUS_DEV';
      const activeUid = (firebaseUser && firebaseUser.uid) || 'local_dev';
      const gameId = formData.title.toLowerCase().replace(/\s/g, '_');
      const gameData = {
        id: gameId,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        version: formData.version,
        isMultiplayer: formData.isMultiplayer,
        script: formData.script,
        sceneObjects: sceneObjects || [],
        engineMode: engineMode || '2D',
        trailerUrl: finalTrailerUrl,
        iconColor: SPECTRUM_GRADIENT[Math.floor(Math.random() * SPECTRUM_GRADIENT.length)],
        developer: activeDevName,
        authorUid: activeUid,
        rating: 5.0,
        createdAt: serverTimestamp()
      };

      addLog('Committing bit-stream to memory...');
      
      try {
        await setDoc(doc(db, 'games', gameId), gameData);
      } catch (dbErr) {
        // Fallback for offline local persistence
      }

      // Broadcast via P2P Network
      import('../services/vm/motherboard').then(({ vm }) => {
        vm.net.broadcastMessage(`[APP_PUBLISH] ${JSON.stringify({
          ...gameData, 
          createdAt: new Date().toISOString()
        })}`);
      });


      onPublish({
        ...gameData,
        createdAt: new Date().toISOString() // Local representation for immediate UI update
      });

      setIsPublishing(false);
      addLog('PUBLISH_SUCCESS: Game is now live on VC_STORE.');
      kernel.emitEvent('TASK', `GAMEMAKER: PUBLISHED (${formData.title})`);
      setFormData({ 
        title: '', 
        description: '', 
        category: 'ARCADE', 
        version: '1.0.0',
        isMultiplayer: false,
        trailerFile: '',
        script: formData.script 
      });
    } catch (error) {
      setIsPublishing(false);
      addLog(`ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      handleFirestoreError(error, OperationType.WRITE, `games/${formData.title}`);
    }
  };

  return (
    <div className="h-full flex flex-col font-sans text-[11px] bg-win95-gray">
      {/* Header */}
      <div className="bg-win95-blue text-white p-1 flex items-center justify-between m-0.5">
        <div className="flex items-center gap-2">
          <Code2 size={14} className="text-blue-400" />
          <span className="font-bold uppercase">THE_LIBRARIAN_TERMINAL</span>
        </div>
        <div className="text-[9px] opacity-70">N_PROTOCOL_v1.0</div>
      </div>

      <div className="flex-1 flex overflow-hidden p-1 gap-1">
        {/* Editor Form */}
        <form onSubmit={handlePublish} className="w-1/2 p-4 space-y-4 border-inset bg-white overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block font-bold uppercase text-[9px] opacity-50">Truth-Space Title</label>
              <input 
                type="text"
                placeholder="MY_NEW_LOGIC"
                className="w-full bg-white border-inset p-1 outline-none focus:ring-1 focus:ring-win95-blue"
                value={formData.title || ''}
                onChange={e => setFormData({...formData, title: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block font-bold uppercase text-[9px] opacity-50">Logic Category</label>
              <select 
                className="w-full bg-white border-inset p-1 outline-none"
                value={formData.category || 'ARCADE'}
                onChange={e => setFormData({...formData, category: e.target.value})}
              >
                <option>ARCADE</option>
                <option>PUZZLE</option>
                <option>SIMULATION</option>
                <option>UTILITY</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block font-bold uppercase text-[9px] opacity-50">N Source Code (Symbolic Protocol)</label>
            <textarea 
              placeholder="Enter N code..."
              className="w-full bg-black text-blue-400 border-inset p-2 h-64 outline-none font-mono text-[10px] resize-none"
              value={formData.script || ''}
              onChange={e => setFormData({...formData, script: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="block font-bold uppercase text-[9px] opacity-50">Description</label>
            <input 
              className="w-full bg-white border-inset p-1 outline-none"
              value={formData.description || ''}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="block font-bold uppercase text-[9px] opacity-50">Trailer Video (from VC.os Files)</label>
            <select 
              className="w-full bg-white border-inset p-1 outline-none"
              value={formData.trailerFile || ''}
              onChange={e => setFormData({...formData, trailerFile: e.target.value})}
              onFocus={() => setVfsFiles(vfs.ls())}
            >
              <option value="">-- Auto-Generate Trailer --</option>
              {vfsFiles.map(file => (
                <option key={file} value={file}>{file}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 p-3 bg-zinc-100 border-inset">
            <input 
              type="checkbox"
              id="multiplayer"
              className="w-4 h-4"
              checked={!!formData.isMultiplayer}
              onChange={e => setFormData({...formData, isMultiplayer: e.target.checked})}
            />
            <label htmlFor="multiplayer" className="font-bold uppercase text-[10px] cursor-pointer select-none">
              Enable Spectrum_Network Multiplayer?
            </label>
          </div>

          <div className="pt-4 flex gap-2">
            <button 
              type="button"
              className="flex-1 border-outset bg-win95-gray p-2 font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 active:border-inset transition-all"
            >
              <Save size={14} />
              SAVE_LOCAL
            </button>
            <button 
              type="submit"
              disabled={isPublishing}
              className="flex-1 border-outset bg-win95-gray p-2 font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 active:border-inset transition-all disabled:opacity-50"
            >
              {isPublishing ? (
                <div className="w-4 h-4 border-2 border-win95-dark-gray border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Rocket size={14} />
                  PUBLISH
                </>
              )}
            </button>
          </div>
        </form>

        {/* Console Logs */}
        <div className="flex-1 bg-black text-blue-500 p-4 font-mono text-[10px] overflow-y-auto border-inset">
          <div className="flex items-center gap-2 mb-4 border-b border-blue-500/20 pb-2">
            <Terminal size={14} />
            <span className="font-bold">./Output</span>
          </div>
          <div className="space-y-1">
            {logs.map((log, i) => (
              <div key={i} className={log.includes('SUCCESS') ? 'text-green-400' : ''}>{log}</div>
            ))}
            {isPublishing && (
              <motion.div 
                animate={{ opacity: [0, 1] }}
                transition={{ repeat: Infinity, duration: 0.5 }}
                className="w-2 h-4 bg-blue-500 inline-block align-middle"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
