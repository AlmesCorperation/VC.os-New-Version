import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Music, Cpu, Loader2, AlertCircle } from 'lucide-react';
import { kernel } from '../services/kernel';

const MUSIC_URL = 'https://www.dropbox.com/scl/fi/hqy30l6cgy5pxjbt65rrl/Screen-recording-2026-03-04-5.36.39-PM.webm?rlkey=rlzzu9zmj7nimnkcpkjxerhhp&st=qv3u0rp8&raw=1';

export const BackgroundMusic: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isChiptune, setIsChiptune] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  
  // Refs for audio processing loop
  const isChiptuneRef = useRef(isChiptune);
  const phaserRef = useRef(0);
  const lastSampleRef = useRef(0);

  useEffect(() => {
    isChiptuneRef.current = isChiptune;
  }, [isChiptune]);

  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = isMuted ? 0 : 0.4;
    }
    if (audioElementRef.current && useFallback) {
      audioElementRef.current.muted = isMuted;
    }
  }, [isMuted, useFallback]);

  useEffect(() => {
    const initAudio = async () => {
      try {
        setIsLoading(true);

        // Try loading external audio with graceful fallback
        const audio = new Audio();
        audio.crossOrigin = "anonymous";
        audio.loop = true;
        audioElementRef.current = audio;

        let loaded = false;
        try {
          audio.src = MUSIC_URL;
          await new Promise<void>((resolve, reject) => {
            const onMeta = () => {
              loaded = true;
              audio.removeEventListener('error', onErr);
              resolve();
            };
            const onErr = () => {
              audio.removeEventListener('loadedmetadata', onMeta);
              reject(new Error("Audio load failed"));
            };
            audio.addEventListener('loadedmetadata', onMeta, { once: true });
            audio.addEventListener('error', onErr, { once: true });
            setTimeout(() => {
              if (!loaded) {
                audio.removeEventListener('loadedmetadata', onMeta);
                audio.removeEventListener('error', onErr);
                resolve(); // Fallback smoothly on slow networks
              }
            }, 3000);
          });
        } catch {
          // Graceful fallback to synthetic chiptune
          setUseFallback(true);
        }

        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            audioCtxRef.current = ctx;

            if (loaded && audioElementRef.current) {
              const source = ctx.createMediaElementSource(audioElementRef.current);
              const gainNode = ctx.createGain();
              gainNode.gain.value = isMuted ? 0 : 0.4;
              gainRef.current = gainNode;

              const scriptNode = ctx.createScriptProcessor(4096, 1, 1);
              scriptNode.onaudioprocess = (e) => {
                const input = e.inputBuffer.getChannelData(0);
                const output = e.outputBuffer.getChannelData(0);

                if (!isChiptuneRef.current) {
                  output.set(input);
                  return;
                }

                const bits = 4;
                const norm = Math.pow(2, bits);
                const step = 0.15;

                for (let i = 0; i < input.length; i++) {
                  phaserRef.current += step;
                  if (phaserRef.current >= 1.0) {
                    phaserRef.current -= 1.0;
                    lastSampleRef.current = Math.round(input[i] * norm) / norm;
                  }
                  output[i] = lastSampleRef.current;
                }
              };

              source.connect(scriptNode);
              scriptNode.connect(gainNode);
              gainNode.connect(ctx.destination);
            }
          }
        } catch {
          setUseFallback(true);
        }

        setIsLoading(false);
      } catch {
        setUseFallback(true);
        setIsLoading(false);
      }
    };

    initAudio();

    return () => {
      // Cleanup
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.src = '';
      }
    };
  }, []);

  const togglePlay = () => {
    if (!audioElementRef.current) return;

    if (isPlaying) {
      audioElementRef.current.pause();
      setIsPlaying(false);
      kernel.emitEvent('TASK', 'BGM: PAUSED');
    } else {
      // Resume context if needed
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      
      audioElementRef.current.play()
        .then(() => {
          setIsPlaying(true);
          kernel.emitEvent('TASK', 'BGM: PLAYING');
        })
        .catch(e => console.error("Play failed:", e));
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  if (error) {
    return (
      <div className="fixed bottom-4 right-4 z-[9999] bg-red-900/80 p-2 rounded border border-red-500 text-white text-[10px] font-mono flex items-center gap-2">
        <AlertCircle size={12} />
        <span>AUDIO_ERR</span>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex items-center gap-3 bg-black/90 p-2 rounded-lg border border-win95-gray shadow-xl text-green-400 font-mono select-none backdrop-blur-md">
      <div className="flex flex-col border-r border-green-900/50 pr-3 mr-1">
        <span className="text-[8px] text-green-600 uppercase tracking-wider">
          System Audio
        </span>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <Loader2 size={12} className="animate-spin text-green-400" />
          ) : (
            <Music size={12} className={isPlaying ? "animate-pulse text-green-400" : "text-green-800"} />
          )}
          <span className="text-[10px] font-bold truncate max-w-[100px] text-green-400">
            {isLoading ? "LOADING..." : (isPlaying ? "OS_THEME.MOD" : "PAUSED")}
          </span>
        </div>
      </div>

      {!useFallback && (
        <button 
          onClick={() => setIsChiptune(!isChiptune)}
          disabled={isLoading}
          className={`flex items-center gap-1 text-[9px] px-2 py-1 border rounded transition-all ${
            isChiptune 
              ? 'bg-green-500/20 border-green-500 text-green-400 shadow-[0_0_10px_rgba(74,222,128,0.2)]' 
              : 'border-green-900/30 text-green-800 hover:text-green-600'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="Toggle 8-Bit Mode"
        >
          <Cpu size={10} />
          8-BIT
        </button>
      )}

      {useFallback && (
        <div className="text-[8px] text-yellow-500 px-2 border border-yellow-900/50 rounded bg-yellow-900/10">
          HQ_MODE
        </div>
      )}

      <div className="flex gap-1">
        <button 
          onClick={togglePlay} 
          disabled={isLoading}
          className={`p-1.5 hover:bg-green-500/10 rounded text-green-400 transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isPlaying ? (
            <div className="w-3 h-3 flex gap-0.5 justify-center items-center">
              <div className="w-1 h-3 bg-current" />
              <div className="w-1 h-3 bg-current" />
            </div>
          ) : (
             <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-current border-b-[5px] border-b-transparent ml-0.5" />
          )}
        </button>

        <button 
          onClick={toggleMute} 
          className="p-1.5 hover:bg-green-500/10 rounded text-green-400 transition-colors"
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>
    </div>
  );
};
