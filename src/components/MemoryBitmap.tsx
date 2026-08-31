import React, { useState, useEffect, useRef } from 'react';
import { db, auth, doc, getDoc, setDoc, serverTimestamp } from '../services/p2p_mock';
import { Cpu, Save, RefreshCw, AlertTriangle, HardDrive } from 'lucide-react';
import { kernel } from '../services/kernel';
import { memoryManager, TOTAL_PAGES, PAGE_SIZE, TOTAL_RAM, BITMAP_SIZE } from '../services/memoryManager';

export const MemoryBitmap: React.FC<{ firebaseUser: any }> = ({ firebaseUser }) => {
  const [bitmap, setBitmap] = useState<Uint8Array>(memoryManager.bitmap);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [stats, setStats] = useState({ used: 0, free: TOTAL_PAGES });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const unsub = memoryManager.subscribe(() => {
      setBitmap(new Uint8Array(memoryManager.bitmap));
      setStats(memoryManager.getStats());
    });
    setStats(memoryManager.getStats());
    return () => { unsub(); };
  }, []);

  // Initialize bitmap
  useEffect(() => {
    if (firebaseUser) {
      loadFromCloud();
    }
  }, [firebaseUser]);

  const loadFromCloud = async () => {
    if (!firebaseUser) return;
    setIsSyncing(true);
    try {
      const docRef = doc(db, 'memoryMaps', firebaseUser.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        const binaryString = atob(data.bitmap);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        memoryManager.setBitmap(bytes);
      } else {
        // Create initial map
        const initial = new Uint8Array(BITMAP_SIZE);
        // Mark some system memory as used (first 2MB)
        for (let i = 0; i < (1024 * 1024 * 2 / PAGE_SIZE / 8); i++) {
          initial[i] = 0xFF;
        }
        memoryManager.setBitmap(initial);
        saveToCloud(initial);
      }
      setLastSync(new Date());
    } catch (e) {
      console.error('Failed to load memory map', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const saveToCloud = async (currentBitmap: Uint8Array) => {
    if (!firebaseUser) return;
    setIsSyncing(true);
    try {
      let binary = '';
      for (let i = 0; i < currentBitmap.length; i++) {
        binary += String.fromCharCode(currentBitmap[i]);
      }
      const base64 = btoa(binary);
      
      await setDoc(doc(db, 'memoryMaps', firebaseUser.uid), {
        uid: firebaseUser.uid,
        totalRam: TOTAL_RAM,
        pageSize: PAGE_SIZE,
        bitmap: base64,
        updatedAt: serverTimestamp()
      });
      setLastSync(new Date());
      kernel.emitEvent('TASK', 'MEMORY_MAP: CLOUD_SYNC_SUCCESS');
    } catch (e) {
      console.error('Failed to save memory map', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const allocatePage = () => {
    try {
      memoryManager.allocatePages('Manual Alloc', 1);
      kernel.syscall('SYS_MALLOC', { size: PAGE_SIZE / (1024 * 1024) });
    } catch (e) {
      kernel.emitEvent('CRITICAL', 'OUT_OF_MEMORY: MANUAL_OVERRIDE_FAILED');
    }
  };

  const freePage = () => {
    // Just find a manual one and free it if possible, else free whatever
    // But memoryManager frees by ID. Let's trace back from highest bit.
    const newBitmap = new Uint8Array(memoryManager.bitmap);
    for (let i = newBitmap.length - 1; i >= 0; i--) {
      if (newBitmap[i] !== 0x00) {
        for (let bit = 7; bit >= 0; bit--) {
          if (newBitmap[i] & (1 << bit)) {
            // Don't free system memory (first 2MB = 512 pages)
            if (i * 8 + bit < 512) return;
            
            newBitmap[i] &= ~(1 << bit);
            memoryManager.setBitmap(newBitmap);
            kernel.syscall('SYS_FREE', { size: PAGE_SIZE / (1024 * 1024) });
            return;
          }
        }
      }
    }
  };

  // Draw bitmap to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.createImageData(width, height);
    
    // Each pixel represents one 4KB page
    // 32,768 pages = 256x128 grid
    for (let i = 0; i < TOTAL_PAGES; i++) {
      const byteIdx = Math.floor(i / 8);
      const bitIdx = i % 8;
      const isAllocated = bitmap[byteIdx] & (1 << bitIdx);
      
      const pixelIdx = i * 4;
      if (isAllocated) {
        // System memory vs User memory
        if (i < 512) { // 2MB kernel logic
          imageData.data[pixelIdx] = 255;   // R
          imageData.data[pixelIdx + 1] = 0; // G
          imageData.data[pixelIdx + 2] = 0; // B
        } else {
          imageData.data[pixelIdx] = 0;     // R
          imageData.data[pixelIdx + 1] = 255; // G
          imageData.data[pixelIdx + 2] = 0;   // B
        }
        imageData.data[pixelIdx + 3] = 255; // A
      } else {
        imageData.data[pixelIdx] = 40;    // R
        imageData.data[pixelIdx + 1] = 40;  // G
        imageData.data[pixelIdx + 2] = 40;  // B
        imageData.data[pixelIdx + 3] = 255; // A
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [bitmap]);

  return (
    <div className="flex flex-col h-full bg-win95-gray font-sans text-[11px]">
      <div className="p-2 bg-win95-dark-gray text-white font-bold flex items-center justify-between border-b border-white">
        <div className="flex items-center gap-2">
          <HardDrive size={16} />
          PHYSICAL_MEMORY_BITMAP.SYS
        </div>
        {isSyncing && <RefreshCw size={14} className="animate-spin" />}
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4 overflow-auto">
        <div className="bg-black p-1 border-inset inline-block self-center">
          <canvas 
            ref={canvasRef} 
            width={256} 
            height={128} 
            className="w-[512px] h-[256px] image-pixelated border border-win95-dark-gray"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="border-inset bg-white p-3 space-y-2">
            <div className="font-bold border-b border-win95-gray pb-1 flex items-center gap-2">
              <Cpu size={14} className="text-blue-600" />
              MEMORY_STATS
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total RAM:</span>
              <span className="font-mono">128.00 MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Page Size:</span>
              <span className="font-mono">4.00 KB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Pages:</span>
              <span className="font-mono">32,768</span>
            </div>
            <div className="flex justify-between text-green-600 font-bold">
              <span>Used Pages:</span>
              <span className="font-mono">{stats.used.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-blue-600 font-bold">
              <span>Free Pages:</span>
              <span className="font-mono">{stats.free.toLocaleString()}</span>
            </div>
          </div>

          <div className="border-inset bg-white p-3 space-y-4">
            <div className="font-bold border-b border-win95-gray pb-1">CONTROLS</div>
            <div className="flex flex-col gap-2">
              <button 
                onClick={allocatePage}
                className="px-4 py-1 bg-win95-gray border-outset font-bold hover:bg-zinc-200 active:border-inset"
              >
                ALLOCATE_PAGE (4KB)
              </button>
              <button 
                onClick={freePage}
                className="px-4 py-1 bg-win95-gray border-outset font-bold hover:bg-zinc-200 active:border-inset"
              >
                FREE_PAGE (4KB)
              </button>
              <button 
                onClick={() => saveToCloud(bitmap)}
                disabled={isSyncing || !firebaseUser || firebaseUser.isAnonymous}
                className="px-4 py-1 bg-win95-gray border-outset font-bold hover:bg-zinc-200 active:border-inset flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save size={14} />
                COMMIT_TO_CLOUD
              </button>
            </div>
            {(!firebaseUser || firebaseUser.isAnonymous) && (
              <div className="text-red-600 flex items-center gap-1 text-[9px] uppercase">
                <AlertTriangle size={10} />
                log in to use online features!
              </div>
            )}
          </div>
        </div>

        <div className="mt-auto p-2 bg-win95-gray border-inset text-[9px] text-win95-dark-gray font-mono">
          LAST_SYNC: {lastSync ? lastSync.toLocaleString() : 'NEVER'}<br/>
          BITMAP_HASH: {Array.from(bitmap.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('')}...
        </div>
      </div>
    </div>
  );
};

