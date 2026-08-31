import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  RotateCcw, Power, Play, Pause, Disc, Cpu, Monitor, Zap, 
  Terminal, Shield, Radio, Sparkles, Sliders, ArrowLeft, RefreshCw
} from 'lucide-react';
import { vm } from '../services/vm/motherboard';
import { seaBios } from '../services/vcode/seabios';
import { VCodeAssembler } from '../services/vcode/assembler';
import { vfs } from '../services/vfs';
import { usePIT } from '../hooks/useAudio';
import { kernel } from '../services/kernel';
import { CPUMode, CPURingLevel } from '../services/vm/types';

interface LegacyBiosRunnerProps {
  isoName: string;
  isoContent?: string | Uint8Array;
  onResetToOS: () => void;
}

export const LegacyBiosRunner: React.FC<LegacyBiosRunnerProps> = ({
  isoName,
  isoContent,
  onResetToOS
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { playTone } = usePIT();
  
  const [phase, setPhase] = useState<'post' | 'booting' | 'running' | 'halted'>('post');
  const [postLines, setPostLines] = useState<string[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [scanlines, setScanlines] = useState(true);
  const [crtGlow, setCrtGlow] = useState(true);
  const [cpuStats, setCpuStats] = useState({ eip: '0x00007C00', eax: '0x00000000', mips: '5.0', cycles: 0 });
  const [videoMode, setVideoMode] = useState('Mode 13h (320x200 256c)');
  const [activeIsoName, setActiveIsoName] = useState(isoName || 'VC_OS.iso');
  const [terminalLog, setTerminalLog] = useState<string[]>([]);
  const [showHardwareHUD, setShowHardwareHUD] = useState(true);
  const [isKeyboardCaptured, setIsKeyboardCaptured] = useState(true);

  // Initialize and Boot ISO on Mount
  const bootMachine = useCallback(async () => {
    setPhase('post');
    setPostLines([]);
    setTerminalLog([]);
    
    // Stop CPU and reset state
    vm.cpu.stop();
    vm.gpu.clear(0);

    // BIOS Beep tone
    try {
      playTone(900, 0.12, 'square');
    } catch {}

    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '8f34-vcos-i440fx';
    const postSteps = [
      "SeaBIOS (version 1.16.3-vcos-legacy-rel)",
      "VCOS Bare-metal Virtual Machine Subsystem",
      "i440FX PMC / Intel 82371SB (PIIX3) Bus Master IDE Controller",
      `Machine UUID: ${uuid}`,
      "CPU: VCOS Hybrid x86 Core @ 25.0 MHz (16-Bit Real / 32-Bit Flat)",
      "Ram Size: 16384 KiB Physical DRAM (0x0000000001000000)",
      "VGA BIOS: VCOS Mode 13h & 80x25 Color Text Adapter @ 0x000A0000",
      "Audio: SoundBlaster 16 DSP @ Port 0x388 / 8253 PIT @ Port 0x42",
      "Floppy Drive A: [Not Installed]",
      `ATA Drive 0 (CD-ROM): ${activeIsoName} [Bootable ISO 9660 Image]`,
      "Loading El Torito MBR Sector @ 0000:7C00...",
      "Verifying Boot Catalog & x86 Boot Signature (0xAA55)..."
    ];

    for (let i = 0; i < postSteps.length; i++) {
      await new Promise(r => setTimeout(r, 60));
      setPostLines(prev => [...prev, postSteps[i]]);
    }

    // Load ISO or Assembly Binary into RAM
    let bootBinary: Uint8Array;
    let targetOrigin = 0x7C00;

    try {
      let rawSource = isoContent;
      if (!rawSource && activeIsoName) {
        if (vfs.ls().includes(activeIsoName)) {
          rawSource = vfs.cat(activeIsoName);
        }
      }

      if (typeof rawSource === 'string' && (activeIsoName.endsWith('.asm') || activeIsoName.endsWith('.s') || rawSource.includes('ORG ') || rawSource.includes('START:'))) {
        // Assembly source file
        const asmRes = VCodeAssembler.assemble(rawSource, 0x7C00);
        if (asmRes.errors.length > 0 && asmRes.bytes.length === 0) {
          throw new Error(asmRes.errors[0].message);
        }
        bootBinary = asmRes.bytes;
        targetOrigin = asmRes.origin;
      } else if (rawSource instanceof Uint8Array) {
        bootBinary = rawSource;
      } else if (typeof rawSource === 'string' && rawSource.startsWith('{')) {
        // VFS JSON archive ISO
        try {
          const parsed = JSON.parse(rawSource);
          if (parsed.files && parsed.files['boot.s']) {
            const asmRes = VCodeAssembler.assemble(parsed.files['boot.s'], 0x7C00);
            bootBinary = asmRes.bytes;
          } else {
            // Generate standard boot sector
            const defaultBootCode = `
[ARCH VCA16]
[BITS 16]
ORG 0x7C00

START:
    CLI
    XOR AX, AX
    MOV DS, AX
    MOV ES, AX
    MOV SS, AX
    MOV SP, 0x7C00
    STI

    VCOS_TEXTMODE
    MOV SI, MSG_TITLE
    CALL PRINT_STR

    ; Switch to VGA Mode 13h
    VCOS_MODE13H
    MOV EBX, 0x000A0000
    MOV ECX, 0
.draw:
    MOV EAX, ECX
    AND EAX, 0x1F
    ADD EAX, 0x20
    MOV [EBX + ECX], AL
    INC ECX
    CMP ECX, 64000
    JL .draw

HANG:
    VCOS_HALT

PRINT_STR:
    MOV AH, 0x0E
.lp:
    LODSB
    OR AL, AL
    JZ .dn
    INT 0x10
    JMP .lp
.dn:
    RET

MSG_TITLE:
    DB "=== Booted from ${activeIsoName} in Legacy BIOS ===", 0x0D, 0x0A, 0

TIMES 510 - ($ - $$) DB 0
DW 0xAA55
`;
            const asmRes = VCodeAssembler.assemble(defaultBootCode, 0x7C00);
            bootBinary = asmRes.bytes;
          }
        } catch {
          bootBinary = new Uint8Array([0xB8, 0x13, 0x00, 0xCD, 0x10, 0xF4, 0xEB, 0xFE]);
        }
      } else {
        // Default standalone boot sector for baremetal execution
        const defaultAsm = `
[ARCH VCA16]
[BITS 16]
ORG 0x7C00

START:
    CLI
    XOR AX, AX
    MOV DS, AX
    MOV ES, AX
    MOV SS, AX
    MOV SP, 0x7C00
    STI

    VCOS_TEXTMODE
    MOV SI, BANNER_MSG
    CALL PRINT_STRING

CMD_LOOP:
    MOV SI, PROMPT_MSG
    CALL PRINT_STRING

    MOV AH, 0x00
    INT 0x16

    MOV AH, 0x0E
    INT 0x10

    CMP AL, 'v'
    JE DO_VGA
    CMP AL, 'V'
    JE DO_VGA
    CMP AL, 'b'
    JE DO_BEEP
    CMP AL, 'B'
    JE DO_BEEP
    CMP AL, 'h'
    JE DO_HELP
    CMP AL, 'H'
    JE DO_HELP

    JMP CMD_LOOP

DO_VGA:
    VCOS_MODE13H
    MOV EBX, 0x000A0000
    MOV ECX, 0
.draw:
    MOV EAX, ECX
    XOR EDX, EDX
    AND EAX, 0x3F
    ADD EAX, 0x20
    MOV [EBX + ECX], AL
    INC ECX
    CMP ECX, 64000
    JL .draw
    JMP CMD_LOOP

DO_BEEP:
    MOV EAX, 0x440
    OUT 0x388, AL
    MOV SI, BEEP_MSG
    CALL PRINT_STRING
    JMP CMD_LOOP

DO_HELP:
    MOV SI, HELP_MSG
    CALL PRINT_STRING
    JMP CMD_LOOP

PRINT_STRING:
    MOV AH, 0x0E
.loop:
    LODSB
    OR AL, AL
    JZ .done
    INT 0x10
    JMP .loop
.done:
    RET

BANNER_MSG:
    DB "==================================================", 0x0D, 0x0A
    DB " VC.os Legacy BIOS ISO Hardware Environment", 0x0D, 0x0A
    DB " Booted Image: ${activeIsoName}", 0x0D, 0x0A
    DB " Press 'v' for Mode 13h VGA, 'b' for Sound, 'h' Help", 0x0D, 0x0A
    DB "==================================================", 0x0D, 0x0A, 0

PROMPT_MSG:
    DB 0x0D, 0x0A, "legacy-iso> ", 0

HELP_MSG:
    DB 0x0D, 0x0A, "Available ISO Commands:", 0x0D, 0x0A
    DB "  v - Render VGA Mode 13h 256-color plasma", 0x0D, 0x0A
    DB "  b - Pulse SoundBlaster / AdLib FM audio tone", 0x0D, 0x0A
    DB "  h - Display this help manual", 0x0D, 0x0A, 0

BEEP_MSG:
    DB 0x0D, 0x0A, "[AUDIO] Emitted 440Hz tone to SoundBlaster DSP!", 0x0D, 0x0A, 0

TIMES 510 - ($ - $$) DB 0
DW 0xAA55
`;
        const asmRes = VCodeAssembler.assemble(defaultAsm, 0x7C00);
        bootBinary = asmRes.bytes;
      }
    } catch (e: any) {
      setPostLines(prev => [...prev, `[ERROR] Failed to assemble/load ISO: ${e.message}`]);
      bootBinary = new Uint8Array([0xB8, 0x13, 0x00, 0xCD, 0x10, 0xF4, 0xEB, 0xFE]);
    }

    await new Promise(r => setTimeout(r, 200));
    setPhase('running');

    // Boot sector via SeaBIOS runner
    seaBios.bootSector(bootBinary, targetOrigin, false);
    setIsPaused(false);
  }, [activeIsoName, isoContent, playTone]);

  useEffect(() => {
    bootMachine();
    return () => {
      vm.cpu.stop();
    };
  }, [bootMachine]);

  // RequestAnimationFrame rendering loop
  useEffect(() => {
    let animationId: number;

    const renderLoop = () => {
      if (canvasRef.current) {
        vm.gpu.scanlinesEnabled = scanlines;
        vm.gpu.renderToCanvas(canvasRef.current, canvasRef.current.width, canvasRef.current.height);
      }

      setCpuStats({
        eip: '0x' + (vm.cpu.registers.eip >>> 0).toString(16).padStart(8, '0').toUpperCase(),
        eax: '0x' + (vm.cpu.registers.eax >>> 0).toString(16).padStart(8, '0').toUpperCase(),
        mips: '5.00',
        cycles: vm.cpu.totalCycles
      });

      setVideoMode(vm.gpu.isTextMode ? '80x25 Text Mode (0x03)' : 'VGA Mode 13h (320x200x256)');

      animationId = requestAnimationFrame(renderLoop);
    };

    animationId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationId);
  }, [scanlines]);

  // Handle global keyboard strokes when Legacy BIOS is active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape or Ctrl+Alt+Del exits to Desktop
      if (e.key === 'Escape') {
        onResetToOS();
        return;
      }

      if (e.ctrlKey && e.altKey && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        bootMachine();
        return;
      }

      if (isKeyboardCaptured && phase === 'running') {
        let charCode = e.key.charCodeAt(0);
        if (e.key === 'Enter') charCode = 0x0D;
        if (e.key === 'Backspace') charCode = 0x08;
        if (e.key === 'Tab') charCode = 0x09;

        if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Tab') {
          seaBios.pushKey(e.key === 'Enter' ? '\n' : e.key, charCode);
          vm.keyBuffer.push(charCode);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isKeyboardCaptured, phase, onResetToOS, bootMachine]);

  const handleWarmReboot = () => {
    bootMachine();
  };

  const handleTogglePause = () => {
    if (isPaused) {
      vm.cpu.start();
      setIsPaused(false);
    } else {
      vm.cpu.stop();
      setIsPaused(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-[99999] flex flex-col font-mono select-none overflow-hidden text-gray-200">
      {/* Retro Legacy BIOS Top Bar */}
      <div className="h-10 bg-neutral-900 border-b border-neutral-700 px-4 flex items-center justify-between text-xs z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2 py-0.5 bg-red-950/80 border border-red-500/50 rounded text-red-400 font-bold tracking-wider animate-pulse text-[11px]">
            <Disc size={13} />
            <span>LEGACY BIOS ISO RUNNER</span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-neutral-400 text-[11px]">
            <span>IMAGE:</span>
            <span className="text-amber-400 font-bold">{activeIsoName}</span>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-neutral-400 text-[11px]">
            <span>MODE:</span>
            <span className="text-green-400">{videoMode}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleWarmReboot}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-600 rounded text-[11px] font-semibold transition-colors"
            title="Warm Reboot Machine (Ctrl+Alt+Del)"
          >
            <RotateCcw size={12} className="text-yellow-400" />
            <span className="hidden sm:inline">WARM REBOOT</span>
          </button>

          <button
            onClick={handleTogglePause}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-600 rounded text-[11px] font-semibold transition-colors"
          >
            {isPaused ? <Play size={12} className="text-green-400" /> : <Pause size={12} className="text-blue-400" />}
            <span className="hidden sm:inline">{isPaused ? 'RESUME' : 'PAUSE'}</span>
          </button>

          <button
            onClick={() => setScanlines(!scanlines)}
            className={`px-2 py-1 border rounded text-[11px] transition-colors ${
              scanlines ? 'bg-purple-950/60 border-purple-500 text-purple-300' : 'bg-neutral-800 border-neutral-600 text-neutral-400'
            }`}
            title="Toggle CRT Scanlines"
          >
            CRT
          </button>

          <button
            onClick={onResetToOS}
            className="flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow-[0_0_12px_rgba(239,68,68,0.4)] text-[11px] transition-all ml-2"
            title="Reset OS & return to VC.os Desktop (Esc)"
          >
            <Power size={13} />
            <span>RESET OS TO DESKTOP</span>
            <span className="text-[9px] bg-red-800 px-1 py-0.2 rounded opacity-90 hidden sm:inline">Esc</span>
          </button>
        </div>
      </div>

      {/* Main CRT Canvas Area */}
      <div className="flex-1 relative flex items-center justify-center p-4 bg-black overflow-hidden">
        {/* Ambient CRT Frame */}
        <div 
          className="relative max-w-5xl w-full h-full max-h-[85vh] bg-black border-4 border-neutral-800 rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col items-center justify-center overflow-hidden"
          style={{
            boxShadow: crtGlow ? 'inset 0 0 80px rgba(0,255,100,0.06), 0 0 40px rgba(0,0,0,0.8)' : 'none'
          }}
        >
          {phase === 'post' ? (
            /* SeaBIOS POST Initializing Stage */
            <div className="w-full h-full p-6 text-gray-300 font-mono text-sm overflow-y-auto bg-black flex flex-col justify-start">
              <div className="text-green-400 font-bold mb-3 border-b border-neutral-800 pb-1 flex items-center justify-between">
                <span>SeaBIOS / Legacy BIOS v1.16.3-vcos</span>
                <span className="text-xs text-neutral-500">POST IN PROGRESS</span>
              </div>
              <div className="space-y-1">
                {postLines.map((line, idx) => (
                  <div key={idx} className="leading-relaxed">
                    {line.startsWith('[ERROR]') ? (
                      <span className="text-red-400 font-bold">{line}</span>
                    ) : line.includes('Loading') || line.includes('Verifying') ? (
                      <span className="text-yellow-300">{line}</span>
                    ) : (
                      <span>{line}</span>
                    )}
                  </div>
                ))}
                <div className="w-2 h-4 bg-green-400 animate-pulse mt-2" />
              </div>
            </div>
          ) : (
            /* Active Hardware VGA Canvas */
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <canvas
                ref={canvasRef}
                width={640}
                height={400}
                className="w-full h-full object-contain cursor-crosshair"
                style={{ imageRendering: 'pixelated' }}
                onClick={() => setIsKeyboardCaptured(true)}
              />

              {/* Pause Overlay */}
              {isPaused && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                  <div className="bg-neutral-900 border border-yellow-500/60 p-4 rounded-lg text-center font-mono shadow-2xl">
                    <div className="text-yellow-400 font-bold text-base mb-1">CPU EXECUTION PAUSED</div>
                    <div className="text-xs text-neutral-400 mb-3">Press Resume or Space to continue execution</div>
                    <button
                      onClick={handleTogglePause}
                      className="px-4 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs rounded"
                    >
                      RESUME CPU
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CRT Scanline Overlay */}
          {scanlines && (
            <div 
              className="absolute inset-0 pointer-events-none opacity-25"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.8) 0px, rgba(0,0,0,0.8) 1px, transparent 1px, transparent 2px)',
                backgroundSize: '100% 2px'
              }}
            />
          )}
        </div>
      </div>

      {/* Retro Hardware Status Bottom Bar */}
      <div className="h-8 bg-neutral-950 border-t border-neutral-800 px-4 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
        <div className="flex items-center gap-4 truncate">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-neutral-300">CORE: RUNNING</span>
          </div>

          <div className="hidden sm:inline">
            <span className="text-neutral-500">EIP:</span> <span className="text-cyan-400 font-mono">{cpuStats.eip}</span>
          </div>

          <div className="hidden md:inline">
            <span className="text-neutral-500">EAX:</span> <span className="text-cyan-400 font-mono">{cpuStats.eax}</span>
          </div>

          <div className="hidden sm:inline">
            <span className="text-neutral-500">SPEED:</span> <span className="text-green-400">{cpuStats.mips} MIPS</span>
          </div>

          <div className="hidden lg:inline">
            <span className="text-neutral-500">CYCLES:</span> <span className="text-neutral-200">{cpuStats.cycles.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-neutral-500 text-[10px]">
          <span>Type inside canvas to send keys</span>
          <span className="text-neutral-600">|</span>
          <span>Press <kbd className="px-1 py-0.5 bg-neutral-800 text-neutral-300 rounded text-[9px] border border-neutral-700">Esc</kbd> to Exit to Desktop</span>
        </div>
      </div>
    </div>
  );
};
