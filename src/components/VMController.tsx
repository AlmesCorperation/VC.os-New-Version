import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, StepForward, RotateCcw, Monitor, Cpu, Globe, HardDrive, 
  Terminal, Shield, Activity, Volume2, VolumeX, Sparkles, Send, RefreshCw, 
  Layers, Code, Bug, Eye, EyeOff, Radio, RadioTower, CheckCircle2, AlertCircle,
  Clock, Gauge, Sliders, Zap, ShieldAlert, Network, Wifi, WifiOff, Timer, ArrowDownUp
} from 'lucide-react';
import { vm } from '../services/vm/motherboard';
import { CPUMode, CPURingLevel, Instruction, P2PPacket, VMLatencyConfig } from '../services/vm/types';
import { LATENCY_PRESETS, LATENCY_PRESET_LIST } from '../services/vm/latencyPresets';

interface VMControllerProps {
  onClose?: () => void;
}

const SAMPLE_PROGRAMS: Record<string, { title: string, code: string }> = {
  vga_rainbow: {
    title: '🎨 VGA 256-Color Rainbow Pattern',
    code: `; VGA 256-Color Palette Demo
; Writes color gradient bars directly to VRAM (0xA0000)

START:
    CLI                 ; Disable Interrupts
    MOV EAX, 0x0013     ; AL=0x13 Mode 13h (320x200 256 colors)
    INT 0x10            ; Switch Video Mode

    MOV EAX, 0x000000FF ; Color loop counter
    MOV EBX, 0x000A0000 ; VRAM Base Address
    MOV ECX, 0x00000000 ; Pixel index

DRAW_LOOP:
    ; Write pixel colors to VRAM
    MOV EAX, 0x00000042
    OUT 0x3C8, AL       ; VGA DAC palette port
    MOV EAX, 0x0000003F
    OUT 0x3C9, AL

    ; Push instruction
    PUSH EAX
    POP EAX

    HLT                 ; Wait for next cycle
`
  },
  p2p_ping: {
    title: '🌐 P2P Packet Broadcast & IRQ',
    code: `; P2P Virtual Network Packet Injector
; Crafts and sends raw packet across P2P mesh via I/O Port 0x300/0x302

START:
    CLI
    ; Reset Virtual NIC (Command 0x01)
    MOV EAX, 0x01
    OUT 0x300, AL

    ; Write ASCII string "HELLO_P2P" into TX buffer (Port 0x302)
    MOV EAX, 0x48       ; 'H'
    OUT 0x302, AL
    MOV EAX, 0x45       ; 'E'
    OUT 0x302, AL
    MOV EAX, 0x4C       ; 'L'
    OUT 0x302, AL
    MOV EAX, 0x4C       ; 'L'
    OUT 0x302, AL
    MOV EAX, 0x4F       ; 'O'
    OUT 0x302, AL
    MOV EAX, 0x5F       ; '_'
    OUT 0x302, AL
    MOV EAX, 0x50       ; 'P'
    OUT 0x302, AL
    MOV EAX, 0x32       ; '2'
    OUT 0x302, AL
    MOV EAX, 0x50       ; 'P'
    OUT 0x302, AL

    ; Trigger Transmission (Command 0x02)
    MOV EAX, 0x02
    OUT 0x300, AL

    ; Sound notification (Port 0x388)
    MOV EAX, 0x50
    OUT 0x388, AL

    STI
    HLT
`
  },
  chiptune_synth: {
    title: '🔊 SoundBlaster Chiptune Synthesizer',
    code: `; SoundBlaster / AdLib FM Synthesizer Test
; Plays melodic arpeggios through I/O Port 0x388 & PC Speaker Port 0x42

START:
    CLI
    ; Note 1 (C4)
    MOV EAX, 0x3C
    OUT 0x388, AL
    MOV EAX, 0x18
    OUT 0x42, AL

    ; Note 2 (E4)
    MOV EAX, 0x40
    OUT 0x388, AL
    MOV EAX, 0x24
    OUT 0x42, AL

    ; Note 3 (G4)
    MOV EAX, 0x43
    OUT 0x388, AL
    MOV EAX, 0x30
    OUT 0x42, AL

    ; Note 4 (C5)
    MOV EAX, 0x48
    OUT 0x388, AL
    MOV EAX, 0x36
    OUT 0x42, AL

    STI
    HLT
`
  },
  latency_stress_benchmark: {
    title: '⚡ Hardware Bus & Wait-State Stress Test',
    code: `; Hardware Latency & Memory Wait-State Benchmark
; Tests DRAM, VRAM, and I/O Port Bus contention stalls

START:
    CLI
    MOV ECX, 0x00000064 ; 100 Iterations

BENCH_LOOP:
    ; 1. DRAM Access (Triggers DRAM Wait States)
    MOV EAX, [0x00100000]
    
    ; 2. VRAM Access (Triggers VRAM Bus Wait States)
    MOV EBX, 0x000A0000
    MOV EAX, 0x0000000F
    MOV [EBX], EAX
    
    ; 3. I/O Port Bus Write (Triggers I/O Port Wait States)
    MOV EAX, 0x55
    OUT 0x302, AL
    
    ; Math operation
    ADD EAX, EBX
    XOR EAX, ECX
    
    DEC ECX
    JNZ BENCH_LOOP

    STI
    HLT
`
  }
};

export const VMController: React.FC<VMControllerProps> = ({ onClose }) => {
  // Navigation & Active tab state
  const [activeTab, setActiveTab] = useState<'display' | 'cpu' | 'network' | 'latency' | 'memory'>('display');
  
  // Trigger re-render on VM tick
  const [, setTick] = useState(0);

  // Assembler editor state
  const [asmSource, setAsmSource] = useState<string>(SAMPLE_PROGRAMS.vga_rainbow.code);
  const [selectedSample, setSelectedSample] = useState<string>('vga_rainbow');
  const [asmError, setAsmError] = useState<string | null>(null);
  const [asmSuccess, setAsmSuccess] = useState<string | null>(null);

  // Network injector state
  const [injectTargetIp, setInjectTargetIp] = useState<string>('255.255.255.255');
  const [injectProtocol, setInjectProtocol] = useState<'ICMP' | 'ARP' | 'UDP' | 'VCOS_RAW'>('ICMP');
  const [injectPayload, setInjectPayload] = useState<string>('PING_VCOS_TEST_PACKET');

  // Latency probe tool state
  const [latencyProbeIp, setLatencyProbeIp] = useState<string>('192.168.1.1');
  const [latencyProbeResult, setLatencyProbeResult] = useState<{
    target: string;
    rttMs: number;
    jitterMs: number;
    cpuStallCycles: number;
    dramWaitCycles: number;
    vramWaitCycles: number;
    dropped: boolean;
    timestamp: string;
  } | null>(null);
  const [isProbing, setIsProbing] = useState<boolean>(false);

  // Memory inspector state
  const [memDumpAddress, setMemDumpAddress] = useState<string>('0x00100000');
  const [ioPortInput, setIoPortInput] = useState<string>('0x3C8');
  const [ioValInput, setIoValInput] = useState<string>('0x12');
  const [ioReadResult, setIoReadResult] = useState<string | null>(null);

  // Screen Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Subscribe to VM updates
  useEffect(() => {
    const unsubMotherboard = vm.subscribe(() => setTick(t => t + 1));
    const unsubGPU = vm.gpu.subscribe(() => setTick(t => t + 1));
    const unsubNet = vm.net.subscribe(() => setTick(t => t + 1));

    // Render loop for GPU framebuffer to canvas
    let animId: number;
    const renderLoop = () => {
      if (canvasRef.current) {
        vm.gpu.renderToCanvas(canvasRef.current);
      }
      animId = requestAnimationFrame(renderLoop);
    };
    animId = requestAnimationFrame(renderLoop);

    return () => {
      unsubMotherboard();
      unsubGPU();
      unsubNet();
      cancelAnimationFrame(animId);
    };
  }, []);

  const handleAssemble = () => {
    setAsmError(null);
    setAsmSuccess(null);
    const res = vm.cpu.assembleAndLoad(asmSource, 0x00100000);
    if (res.success) {
      setAsmSuccess(`Assembly Successful: ${res.byteCount} bytes loaded to EIP 0x00100000`);
      vm.logSerial(`[ASSEMBLER] Built binary (${res.byteCount} bytes) loaded to memory.`);
    } else {
      setAsmError(res.error || 'Assembly failed');
    }
  };

  const handleLoadSample = (key: string) => {
    setSelectedSample(key);
    if (SAMPLE_PROGRAMS[key]) {
      setAsmSource(SAMPLE_PROGRAMS[key].code);
      setAsmError(null);
      setAsmSuccess(null);
    }
  };

  const handleRunLatencyProbe = () => {
    setIsProbing(true);
    const target = latencyProbeIp;
    
    // Simulate real hardware + bus + network transit delay calculation
    const transit = vm.net.calculateArtificialTransitDelay(64);
    const cpuStall = vm.latencyConfig.irqDispatchDelayCycles + vm.latencyConfig.ioPortWaitStatesCycles * 2;
    const dramWait = vm.latencyConfig.dramWaitStatesCycles * 4;
    const vramWait = vm.latencyConfig.vramWaitStatesCycles;

    setTimeout(() => {
      setIsProbing(false);
      setLatencyProbeResult({
        target,
        rttMs: transit.delayMs * 2, // Round-trip
        jitterMs: transit.jitter,
        cpuStallCycles: cpuStall,
        dramWaitCycles: dramWait,
        vramWaitCycles: vramWait,
        dropped: transit.isDropped,
        timestamp: new Date().toLocaleTimeString()
      });

      if (!transit.isDropped) {
        vm.net.ping(target);
      }
    }, Math.min(1000, Math.max(100, transit.delayMs)));
  };

  // Disassembly helper
  const disassembled: Instruction[] = vm.cpu.disassemble(0x00100000, 16);

  // Hex Memory slice helper
  const currentDumpAddr = parseInt(memDumpAddress, 16) || 0x00100000;
  const memorySlice = Array.from(vm.memory.slice(currentDumpAddr, currentDumpAddr + 64));

  const stats = vm.getSystemStats();
  const latencyStats = stats.latencyStats;
  const latencyConfig = stats.latencyConfig;

  return (
    <div className="flex flex-col h-full bg-[#1e1e2e] text-[#cdd6f4] font-mono select-none overflow-hidden">
      {/* Top Hardware Control Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#181825] border-b border-[#313244] gap-2 flex-wrap">
        {/* Left: CPU Mode & State Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${vm.cpu.isRunning ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="font-bold text-[12px] text-white tracking-wider">
              {vm.cpu.isRunning ? 'VCOS CPU: RUNNING' : 'VCOS CPU: HALTED'}
            </span>
          </div>

          <span className="text-[#45475a]">|</span>

          {/* Mode Pill */}
          <div className="flex items-center gap-1 bg-[#11111b] px-2 py-0.5 rounded text-[11px] border border-[#313244]">
            <Shield size={12} className="text-yellow-400" />
            <span className="text-yellow-400 font-bold">{vm.cpu.mode}</span>
            <span className="text-[#6c7086]">({vm.cpu.ring})</span>
          </div>

          {/* Clock Rate */}
          <div className="flex items-center gap-1 text-[11px] text-[#89dceb] bg-[#11111b] px-2 py-0.5 rounded border border-[#313244]">
            <Activity size={12} />
            <span>{(vm.cpu.clockFrequencyHz / 1000).toFixed(0)} kHz</span>
          </div>

          {/* Hardware Latency / MIPS Live Badge */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] bg-[#11111b] px-2 py-0.5 rounded border border-amber-900/50 text-amber-300">
            <Timer size={12} className="text-amber-400" />
            <span>MIPS: <strong>{latencyStats.effectiveMips.toFixed(2)}</strong></span>
            <span className="text-[#585b70]">·</span>
            <span>Bus Stalls: <strong>{latencyStats.busUtilizationPct}%</strong></span>
          </div>
        </div>

        {/* Center/Right: Execution Action Buttons */}
        <div className="flex items-center gap-1.5">
          {vm.cpu.isRunning ? (
            <button
              onClick={() => vm.cpu.stop()}
              className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded font-bold text-[11px] transition-all shadow"
            >
              <Pause size={12} />
              <span>Halt (HLT)</span>
            </button>
          ) : (
            <button
              onClick={() => vm.cpu.start()}
              className="flex items-center gap-1 px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded font-bold text-[11px] transition-all shadow"
            >
              <Play size={12} />
              <span>Resume (RUN)</span>
            </button>
          )}

          <button
            onClick={() => vm.cpu.step()}
            disabled={vm.cpu.isRunning}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] disabled:opacity-40 rounded text-[11px] transition-all"
            title="Single Step CPU Instruction (Trace)"
          >
            <StepForward size={12} />
            <span>Step</span>
          </button>

          <button
            onClick={() => vm.cpu.reset()}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] rounded text-[11px] transition-all"
            title="Hardware Hard Reset"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>

          {/* Speed Preset Selector */}
          <div className="ml-2 flex items-center gap-1">
            <span className="text-[10px] text-[#6c7086]">Clock:</span>
            <select
              value={vm.cpu.clockFrequencyHz}
              onChange={(e) => vm.cpu.setFrequency(Number(e.target.value))}
              className="bg-[#11111b] border border-[#313244] px-1.5 py-0.5 rounded text-[11px] text-yellow-300 outline-none"
            >
              <option value="1">1 Hz (Single-Step)</option>
              <option value="100">100 Hz</option>
              <option value="1000">1 kHz (Normal)</option>
              <option value="50000">50 kHz (Fast)</option>
              <option value="500000">500 kHz (Turbo)</option>
              <option value="1000000">1 MHz (Max Speed)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#313244] bg-[#11111b] px-2 gap-1 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveTab('display')}
          className={`flex items-center gap-2 px-3 py-2 border-b-2 font-bold text-[11px] uppercase tracking-wider transition-colors ${
            activeTab === 'display' 
              ? 'border-purple-400 text-purple-300 bg-[#181825]' 
              : 'border-transparent text-[#6c7086] hover:text-[#cdd6f4]'
          }`}
        >
          <Monitor size={14} />
          <span>VGA Display</span>
        </button>

        <button
          onClick={() => setActiveTab('cpu')}
          className={`flex items-center gap-2 px-3 py-2 border-b-2 font-bold text-[11px] uppercase tracking-wider transition-colors ${
            activeTab === 'cpu' 
              ? 'border-yellow-400 text-yellow-300 bg-[#181825]' 
              : 'border-transparent text-[#6c7086] hover:text-[#cdd6f4]'
          }`}
        >
          <Cpu size={14} />
          <span>CPU & Assembler</span>
        </button>

        <button
          onClick={() => setActiveTab('latency')}
          className={`flex items-center gap-2 px-3 py-2 border-b-2 font-bold text-[11px] uppercase tracking-wider transition-colors ${
            activeTab === 'latency' 
              ? 'border-amber-400 text-amber-300 bg-[#181825]' 
              : 'border-transparent text-[#6c7086] hover:text-[#cdd6f4]'
          }`}
        >
          <Clock size={14} />
          <span>Hardware & Network Latency</span>
          <span className="px-1.5 py-0.2 text-[9px] bg-amber-500/20 text-amber-300 rounded font-bold">
            {latencyConfig.p2pBaseLatencyMs}ms
          </span>
        </button>

        <button
          onClick={() => setActiveTab('network')}
          className={`flex items-center gap-2 px-3 py-2 border-b-2 font-bold text-[11px] uppercase tracking-wider transition-colors ${
            activeTab === 'network' 
              ? 'border-blue-400 text-blue-300 bg-[#181825]' 
              : 'border-transparent text-[#6c7086] hover:text-[#cdd6f4]'
          }`}
        >
          <Globe size={14} />
          <span>P2P Network Mesh ({vm.net.peers.size})</span>
        </button>

        <button
          onClick={() => setActiveTab('memory')}
          className={`flex items-center gap-2 px-3 py-2 border-b-2 font-bold text-[11px] uppercase tracking-wider transition-colors ${
            activeTab === 'memory' 
              ? 'border-green-400 text-green-300 bg-[#181825]' 
              : 'border-transparent text-[#6c7086] hover:text-[#cdd6f4]'
          }`}
        >
          <HardDrive size={14} />
          <span>Memory & I/O Ports</span>
        </button>
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* ================= TAB 1: VGA DISPLAY & FRAMEBUFFER ================= */}
        {activeTab === 'display' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 h-full">
            {/* Main VGA Monitor Screen */}
            <div className="lg:col-span-3 flex flex-col bg-[#11111b] p-3 rounded-lg border border-[#313244] shadow-inner">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#313244] text-[11px] text-[#9399b2]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  <span>CRT VIDEO OUTPUT: <strong>{vm.gpu.getModeInfo().name}</strong></span>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => vm.gpu.scanlinesEnabled = !vm.gpu.scanlinesEnabled}
                    className={`px-2 py-0.5 rounded text-[10px] border ${vm.gpu.scanlinesEnabled ? 'bg-purple-900/40 border-purple-500 text-purple-300' : 'bg-transparent border-[#45475a] text-[#6c7086]'}`}
                  >
                    Scanlines {vm.gpu.scanlinesEnabled ? 'ON' : 'OFF'}
                  </button>
                  <span className="text-[#a6e3a1]">FPS: {vm.gpu.fps}</span>
                </div>
              </div>

              {/* CRT Monitor Frame & Canvas */}
              <div className="flex-1 flex items-center justify-center p-2 bg-[#09090d] rounded border border-[#232433] relative overflow-hidden group">
                <canvas
                  ref={canvasRef}
                  width={320}
                  height={200}
                  className="w-full max-w-[640px] aspect-[4/3] rounded bg-black shadow-2xl image-rendering-pixelated border border-[#313244]"
                  style={{ imageRendering: 'pixelated' }}
                />

                {/* CRT Screen Glow overlay */}
                <div className="absolute inset-0 pointer-events-none bg-radial-gradient from-transparent via-transparent to-black/40" />
              </div>

              {/* Mode Controls Bar */}
              <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#313244] flex-wrap gap-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="text-[#6c7086]">Video Mode:</span>
                  <select
                    value={vm.gpu.mode}
                    onChange={(e) => vm.gpu.setMode(Number(e.target.value))}
                    className="bg-[#181825] border border-[#313244] px-2 py-0.5 rounded text-purple-300 outline-none text-[11px]"
                  >
                    <option value={0x03}>Mode 03h (80x25 Color Text)</option>
                    <option value={0x13}>Mode 13h (320x200 256 Colors)</option>
                    <option value={0x12}>Mode 12h (640x480 16 Colors)</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => vm.gpu.clear()}
                    className="px-2.5 py-1 bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] rounded text-[10px]"
                  >
                    Clear Screen
                  </button>
                  <button
                    onClick={() => {
                      vm.gpu.setMode(0x13);
                      for (let y = 0; y < 200; y++) {
                        for (let x = 0; x < 320; x++) {
                          vm.gpu.setPixel(x, y, (x + y) % 256);
                        }
                      }
                    }}
                    className="px-2.5 py-1 bg-purple-700 hover:bg-purple-600 text-white rounded text-[10px] flex items-center gap-1"
                  >
                    <Sparkles size={11} />
                    <span>Draw Test Gradient</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar Hardware Telemetry */}
            <div className="flex flex-col gap-3">
              {/* Quick Telemetry Card */}
              <div className="bg-[#181825] p-3 rounded-lg border border-[#313244]">
                <h4 className="font-bold text-[11px] text-[#f9e2af] mb-2 flex items-center gap-1.5">
                  <Activity size={13} /> Real-time Telemetry
                </h4>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between text-[#9399b2] border-b border-[#313244]/60 pb-1">
                    <span>Instructions Executed:</span>
                    <span className="text-white font-bold">{vm.cpu.instructionsExecuted.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[#9399b2] border-b border-[#313244]/60 pb-1">
                    <span>Total CPU Cycles:</span>
                    <span className="text-yellow-400 font-bold">{vm.cpu.totalCycles.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[#9399b2] border-b border-[#313244]/60 pb-1">
                    <span>Bus Stall Wait Cycles:</span>
                    <span className="text-amber-400 font-bold">{latencyStats.totalWaitCycles.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[#9399b2] border-b border-[#313244]/60 pb-1">
                    <span>Network P2P Latency:</span>
                    <span className="text-blue-400 font-bold">{latencyStats.currentNetworkLatencyMs} ms</span>
                  </div>
                  <div className="flex justify-between text-[#9399b2] border-b border-[#313244]/60 pb-1">
                    <span>Hardware IRQs Handled:</span>
                    <span className="text-purple-400 font-bold">{vm.interruptsHandled}</span>
                  </div>
                  <div className="flex justify-between text-[#9399b2] pb-1">
                    <span>I/O Port Bus Cycles:</span>
                    <span className="text-green-400 font-bold">{vm.ioPortReads + vm.ioPortWrites}</span>
                  </div>
                </div>
              </div>

              {/* SoundBlaster / DSP Audio */}
              <div className="bg-[#181825] p-3 rounded-lg border border-[#313244] flex-1 flex flex-col">
                <div className="flex items-center justify-between pb-1 mb-2 border-b border-[#313244]">
                  <h4 className="font-bold text-[11px] text-[#f5c2e7] flex items-center gap-1.5">
                    <Volume2 size={13} /> SoundBlaster 16 / DSP
                  </h4>
                  <button
                    onClick={() => vm.audio.toggleMute()}
                    className={`p-1 rounded ${vm.audio.isMuted ? 'text-red-400 bg-red-900/30' : 'text-green-400 bg-green-900/30'}`}
                  >
                    {vm.audio.isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  </button>
                </div>
                <div className="text-[10px] text-[#9399b2] space-y-1.5 flex-1">
                  <div>DSP Port: <span className="text-yellow-400 font-bold">0x388 / 0x42</span></div>
                  <div>Waveform: <span className="text-purple-300 font-bold">FM Square + Sine</span></div>
                  <div>Master Volume: <span className="text-green-400 font-bold">{(vm.audio.masterVolume * 100).toFixed(0)}%</span></div>
                  <div className="pt-2 flex gap-1">
                    <button
                      onClick={() => vm.audio.playTone(440, 0.2)}
                      className="flex-1 py-1 bg-[#313244] hover:bg-[#45475a] text-white text-[10px] rounded"
                    >
                      A4 (440Hz)
                    </button>
                    <button
                      onClick={() => vm.audio.playTone(880, 0.2)}
                      className="flex-1 py-1 bg-[#313244] hover:bg-[#45475a] text-white text-[10px] rounded"
                    >
                      A5 (880Hz)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: CPU REGISTERS & ASSEMBLER ================= */}
        {activeTab === 'cpu' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 h-full">
            {/* CPU Registers & Flags */}
            <div className="flex flex-col gap-3">
              {/* General Purpose Registers */}
              <div className="bg-[#181825] p-3 rounded-lg border border-[#313244]">
                <h4 className="font-bold text-[11px] text-[#f9e2af] mb-2 flex items-center gap-1.5">
                  <Cpu size={13} /> 32-Bit General Registers
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {Object.entries(vm.cpu.registers).slice(0, 8).map(([reg, val]) => (
                    <div key={reg} className="flex justify-between bg-[#11111b] px-2 py-1 rounded border border-[#313244]">
                      <span className="text-yellow-400 font-bold">{reg.toUpperCase()}</span>
                      <span className="text-[#a6e3a1]">0x{val.toString(16).padStart(8, '0').toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Segment & Control Registers */}
              <div className="bg-[#181825] p-3 rounded-lg border border-[#313244]">
                <h4 className="font-bold text-[11px] text-[#89b4fa] mb-2 flex items-center gap-1.5">
                  <Layers size={13} /> Pointers & Segments
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex justify-between bg-[#11111b] px-2 py-1 rounded border border-[#313244]">
                    <span className="text-red-400 font-bold">EIP</span>
                    <span className="text-white font-bold">0x{vm.cpu.registers.eip.toString(16).padStart(8, '0').toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between bg-[#11111b] px-2 py-1 rounded border border-[#313244]">
                    <span className="text-blue-400 font-bold">ESP</span>
                    <span className="text-white">0x{vm.cpu.registers.esp.toString(16).padStart(8, '0').toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between bg-[#11111b] px-2 py-1 rounded border border-[#313244]">
                    <span className="text-green-400 font-bold">CS</span>
                    <span className="text-[#cdd6f4]">0x{vm.cpu.registers.cs.toString(16).padStart(4, '0').toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between bg-[#11111b] px-2 py-1 rounded border border-[#313244]">
                    <span className="text-green-400 font-bold">DS</span>
                    <span className="text-[#cdd6f4]">0x{vm.cpu.registers.ds.toString(16).padStart(4, '0').toUpperCase()}</span>
                  </div>
                </div>

                {/* EFLAGS Bits */}
                <div className="mt-2 pt-2 border-t border-[#313244]">
                  <div className="text-[9px] text-[#6c7086] mb-1">EFLAGS REGISTER: 0x{vm.cpu.registers.eflags.toString(16).padStart(8, '0').toUpperCase()}</div>
                  <div className="flex gap-1 flex-wrap text-[10px]">
                    {[
                      { name: 'ZF', val: vm.cpu.getFlags().zf },
                      { name: 'CF', val: vm.cpu.getFlags().cf },
                      { name: 'SF', val: vm.cpu.getFlags().sf },
                      { name: 'OF', val: vm.cpu.getFlags().of },
                      { name: 'IF', val: vm.cpu.getFlags().if },
                      { name: 'PF', val: vm.cpu.getFlags().pf }
                    ].map(f => (
                      <div
                        key={f.name}
                        className={`px-1.5 py-0.5 rounded font-bold ${f.val ? 'bg-green-600 text-white' : 'bg-[#11111b] text-[#585b70] border border-[#313244]'}`}
                      >
                        {f.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Real-time Disassembly Inspector */}
              <div className="bg-[#181825] p-3 rounded-lg border border-[#313244] flex-1">
                <h4 className="font-bold text-[11px] text-[#a6e3a1] mb-2 flex items-center gap-1.5">
                  <Terminal size={13} /> Disassembly Stream
                </h4>
                <div className="space-y-1 font-mono text-[10px]">
                  {disassembled.map((ins, i) => {
                    const isCurrent = ins.address === vm.cpu.registers.eip;
                    return (
                      <div
                        key={i}
                        className={`p-1 rounded flex items-center justify-between ${
                          isCurrent ? 'bg-purple-900/60 border border-purple-400 font-bold text-white' : 'hover:bg-[#313244]/40 text-[#a6adc8]'
                        }`}
                      >
                        <span className="text-yellow-400/80">0x{ins.address.toString(16).padStart(8, '0').toUpperCase()}</span>
                        <span className="text-purple-300 font-bold">{ins.mnemonic}</span>
                        <span className="text-[#cdd6f4]">{ins.operands}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Assembly Source Editor & Preset Selector */}
            <div className="lg:col-span-2 flex flex-col bg-[#181825] p-3 rounded-lg border border-[#313244]">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#313244]">
                <div className="flex items-center gap-2">
                  <Code size={14} className="text-[#89dceb]" />
                  <span className="font-bold text-[12px] text-[#cdd6f4]">Interactive x86 Assembly Unit</span>
                </div>
                {/* Preset dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#6c7086]">Preset:</span>
                  <select
                    value={selectedSample}
                    onChange={(e) => handleLoadSample(e.target.value)}
                    className="bg-[#11111b] border border-[#313244] px-2 py-1 rounded text-purple-300 text-[11px] outline-none"
                  >
                    {Object.entries(SAMPLE_PROGRAMS).map(([k, v]) => (
                      <option key={k} value={k}>{v.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Code Textarea */}
              <div className="flex-1 flex flex-col relative">
                <textarea
                  value={asmSource}
                  onChange={(e) => setAsmSource(e.target.value)}
                  spellCheck={false}
                  className="flex-1 bg-[#11111b] text-green-400 font-mono text-[12px] p-3 rounded border border-[#313244] outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                />
              </div>

              {/* Assembly Output and Action Button */}
              <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#313244]">
                <div>
                  {asmError && (
                    <div className="flex items-center gap-1 text-red-400 text-[11px]">
                      <AlertCircle size={13} />
                      <span>{asmError}</span>
                    </div>
                  )}
                  {asmSuccess && (
                    <div className="flex items-center gap-1 text-green-400 text-[11px]">
                      <CheckCircle2 size={13} />
                      <span>{asmSuccess}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleAssemble}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded flex items-center gap-1.5 transition-all shadow-md"
                  >
                    <Layers size={13} />
                    <span>Assemble & Load to EIP</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: ARTIFICIAL HARDWARE & NETWORK LATENCY ================= */}
        {activeTab === 'latency' && (
          <div className="flex flex-col gap-3 h-full">
            {/* Top Hardware Preset Selector */}
            <div className="bg-[#181825] p-3 rounded-lg border border-[#313244]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sliders size={14} className="text-amber-400" />
                  <span className="font-bold text-[12px] text-white">
                    Simulated Hardware & Network Latency Profile
                  </span>
                </div>
                <span className="text-[10px] text-amber-300 font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
                  {latencyConfig.profileName}
                </span>
              </div>

              {/* Preset Quick Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {LATENCY_PRESET_LIST.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => vm.setLatencyPreset(preset.id)}
                    className={`p-2 rounded border text-left flex flex-col justify-between transition-all ${
                      latencyConfig.profileName === preset.profileName
                        ? 'bg-amber-950/40 border-amber-400 text-amber-200 ring-1 ring-amber-400'
                        : 'bg-[#11111b] border-[#313244] text-[#a6adc8] hover:bg-[#313244]/40 hover:text-white'
                    }`}
                  >
                    <div className="font-bold text-[11px] truncate">{preset.profileName}</div>
                    <div className="text-[9px] text-[#6c7086] mt-1 line-clamp-2">{preset.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Middle Grid: Detailed Hardware & Network Sliders */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* Box 1: CPU & Bus Stall Wait States */}
              <div className="bg-[#181825] p-3 rounded-lg border border-[#313244] flex flex-col gap-3">
                <h4 className="font-bold text-[11px] text-[#f9e2af] flex items-center gap-1.5 pb-1 border-b border-[#313244]">
                  <Cpu size={13} /> CPU & Memory Bus Wait States
                </h4>

                {/* DRAM Wait States */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#9399b2]">DRAM Memory Wait States:</span>
                    <span className="text-yellow-400 font-bold">{latencyConfig.dramWaitStatesCycles} cycles</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="16"
                    value={latencyConfig.dramWaitStatesCycles}
                    onChange={(e) => vm.updateLatencyConfig({ dramWaitStatesCycles: Number(e.target.value) })}
                    className="w-full accent-yellow-400 bg-[#11111b] h-1.5 rounded cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-[#585b70]">
                    <span>0 (0-Wait Cache)</span>
                    <span>4 (70ns DRAM)</span>
                    <span>16 (Slow RAM)</span>
                  </div>
                </div>

                {/* VRAM Access Wait States */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#9399b2]">VRAM (0xA0000) Bus Contention:</span>
                    <span className="text-purple-400 font-bold">{latencyConfig.vramWaitStatesCycles} cycles</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="32"
                    value={latencyConfig.vramWaitStatesCycles}
                    onChange={(e) => vm.updateLatencyConfig({ vramWaitStatesCycles: Number(e.target.value) })}
                    className="w-full accent-purple-400 bg-[#11111b] h-1.5 rounded cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-[#585b70]">
                    <span>0 (Dual-Ported VRAM)</span>
                    <span>8 (ISA VGA)</span>
                    <span>32 (Slow Refresh)</span>
                  </div>
                </div>

                {/* I/O Port Wait States */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#9399b2]">I/O Port Bus Latency (IN/OUT):</span>
                    <span className="text-green-400 font-bold">{latencyConfig.ioPortWaitStatesCycles} cycles</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="64"
                    value={latencyConfig.ioPortWaitStatesCycles}
                    onChange={(e) => vm.updateLatencyConfig({ ioPortWaitStatesCycles: Number(e.target.value) })}
                    className="w-full accent-green-400 bg-[#11111b] h-1.5 rounded cursor-pointer"
                  />
                </div>

                {/* IRQ Dispatch Latency */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#9399b2]">PIC 8259 IRQ Vector Delay:</span>
                    <span className="text-blue-400 font-bold">{latencyConfig.irqDispatchDelayCycles} cycles</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={latencyConfig.irqDispatchDelayCycles}
                    onChange={(e) => vm.updateLatencyConfig({ irqDispatchDelayCycles: Number(e.target.value) })}
                    className="w-full accent-blue-400 bg-[#11111b] h-1.5 rounded cursor-pointer"
                  />
                </div>

                {/* Cycle weights toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-[#313244] text-[11px]">
                  <span className="text-[#9399b2]">Cycle Weight Costs:</span>
                  <button
                    onClick={() => vm.updateLatencyConfig({ enableInstructionCycleWeights: !latencyConfig.enableInstructionCycleWeights })}
                    className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      latencyConfig.enableInstructionCycleWeights ? 'bg-green-800/40 text-green-300 border border-green-600' : 'bg-[#11111b] text-[#6c7086] border border-[#313244]'
                    }`}
                  >
                    {latencyConfig.enableInstructionCycleWeights ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>
              </div>

              {/* Box 2: P2P Network Artificial Latency & Packet Loss */}
              <div className="bg-[#181825] p-3 rounded-lg border border-[#313244] flex flex-col gap-3">
                <h4 className="font-bold text-[11px] text-[#89b4fa] flex items-center gap-1.5 pb-1 border-b border-[#313244]">
                  <Globe size={13} /> P2P Network Mesh Latency
                </h4>

                {/* Base Latency (Propagation Delay) */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#9399b2]">Base Propagation RTT:</span>
                    <span className="text-blue-400 font-bold">{latencyConfig.p2pBaseLatencyMs} ms</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    step="5"
                    value={latencyConfig.p2pBaseLatencyMs}
                    onChange={(e) => vm.updateLatencyConfig({ p2pBaseLatencyMs: Number(e.target.value) })}
                    className="w-full accent-blue-400 bg-[#11111b] h-1.5 rounded cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-[#585b70]">
                    <span>0 ms (Local Loopback)</span>
                    <span>150 ms (WAN)</span>
                    <span>1000 ms (Interplanetary)</span>
                  </div>
                </div>

                {/* Network Jitter */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#9399b2]">Network Jitter Variance:</span>
                    <span className="text-yellow-400 font-bold">±{latencyConfig.p2pJitterMs} ms</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={latencyConfig.p2pJitterMs}
                    onChange={(e) => vm.updateLatencyConfig({ p2pJitterMs: Number(e.target.value) })}
                    className="w-full accent-yellow-400 bg-[#11111b] h-1.5 rounded cursor-pointer"
                  />
                </div>

                {/* Bandwidth Speed Select */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#9399b2]">Link Bandwidth (Serialization Delay):</span>
                    <span className="text-green-400 font-bold">
                      {latencyConfig.p2pBandwidthKbps === 0 ? 'Unlimited' : `${latencyConfig.p2pBandwidthKbps} Kbps`}
                    </span>
                  </div>
                  <select
                    value={latencyConfig.p2pBandwidthKbps}
                    onChange={(e) => vm.updateLatencyConfig({ p2pBandwidthKbps: Number(e.target.value) })}
                    className="w-full bg-[#11111b] border border-[#313244] px-2 py-1 rounded text-green-300 text-[11px] outline-none"
                  >
                    <option value="0">⚡ Unlimited (Optical Fiber 10 Gbps)</option>
                    <option value="100000">🚀 100 Mbps (Fast Ethernet)</option>
                    <option value="10000">📟 10 Mbps (10BASE-T Ethernet)</option>
                    <option value="2048">📡 2 Mbps (T1 Carrier / 3G)</option>
                    <option value="56">📞 56 Kbps (V.90 Dial-up Modem)</option>
                    <option value="9.6">📻 9600 Baud (RS-232 Serial Link)</option>
                  </select>
                </div>

                {/* Simulated Packet Loss */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#9399b2]">Packet Loss Probability:</span>
                    <span className={`font-bold ${latencyConfig.p2pPacketLossPct > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {latencyConfig.p2pPacketLossPct}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={latencyConfig.p2pPacketLossPct}
                    onChange={(e) => vm.updateLatencyConfig({ p2pPacketLossPct: Number(e.target.value) })}
                    className="w-full accent-red-400 bg-[#11111b] h-1.5 rounded cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-[#585b70]">
                    <span>0% (Lossless)</span>
                    <span>10% (Lossy WiFi)</span>
                    <span>50% (Hostile Mesh)</span>
                  </div>
                </div>
              </div>

              {/* Box 3: CPU Load Throttling & Live Telemetry Meter */}
              <div className="bg-[#181825] p-3 rounded-lg border border-[#313244] flex flex-col gap-3">
                <h4 className="font-bold text-[11px] text-[#a6e3a1] flex items-center gap-1.5 pb-1 border-b border-[#313244]">
                  <Activity size={13} /> Live Hardware Telemetry
                </h4>

                {/* CPU Thermal Throttling Slider */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#9399b2]">Thermal / Host CPU Throttling:</span>
                    <span className="text-amber-400 font-bold">{latencyConfig.cpuLoadThrottlingPct}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="90"
                    value={latencyConfig.cpuLoadThrottlingPct}
                    onChange={(e) => vm.updateLatencyConfig({ cpuLoadThrottlingPct: Number(e.target.value) })}
                    className="w-full accent-amber-400 bg-[#11111b] h-1.5 rounded cursor-pointer"
                  />
                </div>

                {/* Telemetry Gauge Cards */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-[#11111b] p-2 rounded border border-[#313244]">
                    <div className="text-[9px] text-[#6c7086]">Effective MIPS:</div>
                    <div className="text-[14px] font-bold text-yellow-300">{latencyStats.effectiveMips.toFixed(2)}</div>
                  </div>

                  <div className="bg-[#11111b] p-2 rounded border border-[#313244]">
                    <div className="text-[9px] text-[#6c7086]">Bus Stall Ratio:</div>
                    <div className="text-[14px] font-bold text-red-300">{latencyStats.busUtilizationPct}%</div>
                  </div>

                  <div className="bg-[#11111b] p-2 rounded border border-[#313244]">
                    <div className="text-[9px] text-[#6c7086]">Current P2P Ping:</div>
                    <div className="text-[14px] font-bold text-blue-300">{latencyStats.currentNetworkLatencyMs} ms</div>
                  </div>

                  <div className="bg-[#11111b] p-2 rounded border border-[#313244]">
                    <div className="text-[9px] text-[#6c7086]">Dropped Packets:</div>
                    <div className="text-[14px] font-bold text-pink-300">{latencyStats.droppedPacketsCount}</div>
                  </div>
                </div>

                {/* Total Wasted Cycles Bar */}
                <div className="bg-[#11111b] p-2 rounded border border-[#313244]">
                  <div className="flex justify-between text-[10px] text-[#9399b2] mb-1">
                    <span>Accumulated Bus Stall Wait:</span>
                    <span className="text-yellow-400 font-bold">{latencyStats.totalWaitCycles.toLocaleString()} cycles</span>
                  </div>
                  <div className="w-full bg-[#1e1e2e] h-2 rounded overflow-hidden">
                    <div 
                      className="bg-amber-500 h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, latencyStats.busUtilizationPct)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Interactive Latency Probe & Ping Tool */}
            <div className="bg-[#181825] p-3 rounded-lg border border-[#313244]">
              <h4 className="font-bold text-[11px] text-[#cdd6f4] mb-2 flex items-center gap-1.5">
                <ArrowDownUp size={13} className="text-blue-400" /> Multi-Stage Hardware & Transit Latency Probe
              </h4>

              <div className="flex gap-2 items-center mb-3">
                <input
                  type="text"
                  value={latencyProbeIp}
                  onChange={(e) => setLatencyProbeIp(e.target.value)}
                  placeholder="Target IP (e.g., 192.168.1.1)"
                  className="bg-[#11111b] border border-[#313244] px-3 py-1.5 rounded text-white text-[12px] flex-1 max-w-xs outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={handleRunLatencyProbe}
                  disabled={isProbing}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded flex items-center gap-1.5 text-[11px]"
                >
                  <Timer size={13} />
                  <span>{isProbing ? 'Probing Latency Pipeline...' : 'Measure Latency Pipeline'}</span>
                </button>
              </div>

              {latencyProbeResult && (
                <div className="bg-[#11111b] p-3 rounded border border-[#313244] text-[11px]">
                  <div className="flex items-center justify-between pb-2 border-b border-[#313244] mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${latencyProbeResult.dropped ? 'bg-red-400' : 'bg-green-400'}`} />
                      <span className="font-bold text-white">Target: {latencyProbeResult.target}</span>
                    </div>
                    <span className="text-[#6c7086] text-[10px]">{latencyProbeResult.timestamp}</span>
                  </div>

                  {latencyProbeResult.dropped ? (
                    <div className="text-red-400 font-bold">
                      ❌ PACKET LOSS DETECTED: Frame dropped by simulated network loss filter ({latencyConfig.p2pPacketLossPct}% configured drop rate).
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-[#181825] p-2 rounded">
                        <span className="text-[#6c7086] block text-[9px]">Total Round-Trip (RTT)</span>
                        <span className="text-green-400 font-bold text-[14px]">{latencyProbeResult.rttMs} ms</span>
                      </div>
                      <div className="bg-[#181825] p-2 rounded">
                        <span className="text-[#6c7086] block text-[9px]">Jitter Deviation</span>
                        <span className="text-yellow-400 font-bold text-[14px]">{latencyProbeResult.jitterMs} ms</span>
                      </div>
                      <div className="bg-[#181825] p-2 rounded">
                        <span className="text-[#6c7086] block text-[9px]">CPU / IRQ Dispatch Cost</span>
                        <span className="text-purple-400 font-bold text-[14px]">{latencyProbeResult.cpuStallCycles} cycles</span>
                      </div>
                      <div className="bg-[#181825] p-2 rounded">
                        <span className="text-[#6c7086] block text-[9px]">DRAM / Bus Wait Stalls</span>
                        <span className="text-amber-400 font-bold text-[14px]">{latencyProbeResult.dramWaitCycles} cycles</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 4: P2P VIRTUAL NETWORK & PACKET SNIFFER ================= */}
        {activeTab === 'network' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 h-full">
            {/* NIC Status & Peer Mesh List */}
            <div className="flex flex-col gap-3">
              <div className="bg-[#181825] p-3 rounded-lg border border-[#313244]">
                <h4 className="font-bold text-[11px] text-[#89b4fa] mb-2 flex items-center gap-1.5">
                  <RadioTower size={13} /> Virtual NIC Hardware
                </h4>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between border-b border-[#313244] pb-1">
                    <span className="text-[#6c7086]">Virtual MAC:</span>
                    <span className="text-yellow-400 font-bold">{vm.net.virtualMac}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#313244] pb-1">
                    <span className="text-[#6c7086]">Virtual IPv4:</span>
                    <span className="text-green-400 font-bold">{vm.net.virtualIp}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#313244] pb-1">
                    <span className="text-[#6c7086]">Subnet Mask:</span>
                    <span className="text-[#cdd6f4]">255.255.255.0</span>
                  </div>
                  <div className="flex justify-between border-b border-[#313244] pb-1">
                    <span className="text-[#6c7086]">Hardware IRQ / Port:</span>
                    <span className="text-purple-400">IRQ 11 (0x2B) / Port 0x300</span>
                  </div>
                  <div className="flex justify-between pb-1">
                    <span className="text-[#6c7086]">Link Status:</span>
                    <span className="text-green-400 font-bold">ONLINE (P2P Mesh Active)</span>
                  </div>
                </div>
              </div>

              {/* Connected Peers Table */}
              <div className="bg-[#181825] p-3 rounded-lg border border-[#313244] flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-[11px] text-[#f5c2e7] flex items-center gap-1.5">
                    <Radio size={13} /> Discovered Mesh Peers ({vm.net.peers.size})
                  </h4>
                  <span className="text-[9px] text-[#6c7086]">Auto-synced</span>
                </div>

                {vm.net.peers.size === 0 ? (
                  <div className="text-center py-6 text-[#6c7086] text-[11px]">
                    <Globe size={24} className="mx-auto mb-1 opacity-30" />
                    <span>No remote peers detected yet.</span>
                    <p className="text-[9px] mt-1">Open this app in another browser tab to simulate instant local P2P networking!</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {Array.from(vm.net.peers.values()).map(peer => (
                      <div key={peer.nodeId} className="bg-[#11111b] p-2 rounded border border-[#313244] flex items-center justify-between text-[11px]">
                        <div>
                          <div className="font-bold text-[#cdd6f4]">{peer.name}</div>
                          <div className="text-[9px] text-[#6c7086]">{peer.virtualIp} ({peer.virtualMac})</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-green-400 text-[10px]">{peer.pingMs} ms</span>
                          <button
                            onClick={() => vm.net.ping(peer.virtualIp)}
                            className="px-2 py-0.5 bg-[#313244] hover:bg-[#45475a] text-[10px] rounded text-white"
                          >
                            Ping
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Packet Sniffer Feed & Custom Packet Injector */}
            <div className="lg:col-span-2 flex flex-col gap-3">
              {/* Packet Injector Box */}
              <div className="bg-[#181825] p-3 rounded-lg border border-[#313244]">
                <h4 className="font-bold text-[11px] text-[#f9e2af] mb-2 flex items-center gap-1.5">
                  <Send size={13} /> Low-Level Packet Injector
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-2 text-[11px]">
                  <div>
                    <label className="text-[9px] text-[#6c7086] block">Target IPv4</label>
                    <input
                      type="text"
                      value={injectTargetIp}
                      onChange={(e) => setInjectTargetIp(e.target.value)}
                      className="w-full bg-[#11111b] border border-[#313244] px-2 py-1 rounded text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#6c7086] block">Protocol</label>
                    <select
                      value={injectProtocol}
                      onChange={(e) => setInjectProtocol(e.target.value as any)}
                      className="w-full bg-[#11111b] border border-[#313244] px-2 py-1 rounded text-yellow-300 outline-none"
                    >
                      <option value="ICMP">ICMP (Ping)</option>
                      <option value="ARP">ARP Query</option>
                      <option value="UDP">UDP Broadcast</option>
                      <option value="VCOS_RAW">VCOS Raw Packet</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[9px] text-[#6c7086] block">Payload Text / Command</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={injectPayload}
                        onChange={(e) => setInjectPayload(e.target.value)}
                        className="flex-1 bg-[#11111b] border border-[#313244] px-2 py-1 rounded text-white outline-none"
                      />
                      <button
                        onClick={() => {
                          vm.net.sendRawPacket(injectTargetIp, 'FF:FF:FF:FF:FF:FF', injectProtocol, injectPayload);
                        }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded flex items-center gap-1 text-[11px]"
                      >
                        <Send size={11} />
                        <span>Send</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-time Packet Sniffer Table */}
              <div className="bg-[#181825] p-3 rounded-lg border border-[#313244] flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#313244]">
                  <h4 className="font-bold text-[11px] text-[#a6e3a1] flex items-center gap-1.5">
                    <Activity size={13} /> Live Ethernet / IP Packet Sniffer ({vm.net.packetLog.length})
                  </h4>
                  <button
                    onClick={() => vm.net.clearLogs()}
                    className="text-[10px] text-[#6c7086] hover:text-white"
                  >
                    Clear Feed
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[10px]">
                  {vm.net.packetLog.length === 0 ? (
                    <div className="text-center py-8 text-[#6c7086]">
                      No packets captured yet. Send a packet or execute a network program!
                    </div>
                  ) : (
                    vm.net.packetLog.map((pkt) => (
                      <div
                        key={pkt.id}
                        className={`p-1.5 rounded border flex items-center justify-between gap-2 ${
                          pkt.dropped ? 'bg-red-950/40 border-red-800' : 'bg-[#11111b] hover:bg-[#313244]/40 border-[#313244]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${
                            pkt.dropped ? 'bg-red-800 text-red-100' :
                            pkt.protocol === 'ICMP' ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700' :
                            pkt.protocol === 'ARP' ? 'bg-purple-900/50 text-purple-300 border border-purple-700' :
                            'bg-blue-900/50 text-blue-300 border border-blue-700'
                          }`}>
                            {pkt.dropped ? 'DROPPED' : pkt.protocol}
                          </span>
                          <span className="text-green-400">{pkt.sourceIp}</span>
                          <span className="text-[#6c7086]">➔</span>
                          <span className="text-purple-400">{pkt.destIp}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[#9399b2] truncate">
                          <span className="truncate max-w-[200px] text-[#cdd6f4]">"{pkt.payload}"</span>
                          {pkt.latencyMs !== undefined && !pkt.dropped && (
                            <span className="text-amber-400 font-bold text-[9px]">{pkt.latencyMs}ms</span>
                          )}
                          <span className="text-[9px]">{pkt.payloadLength} B</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: PHYSICAL MEMORY & I/O PORTS ================= */}
        {activeTab === 'memory' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 h-full">
            {/* Hex Memory Dump View */}
            <div className="lg:col-span-2 bg-[#181825] p-3 rounded-lg border border-[#313244] flex flex-col">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#313244] flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <HardDrive size={14} className="text-green-400" />
                  <span className="font-bold text-[12px] text-[#cdd6f4]">16 MB Physical RAM Inspector</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#6c7086]">Jump Address:</span>
                  <input
                    type="text"
                    value={memDumpAddress}
                    onChange={(e) => setMemDumpAddress(e.target.value)}
                    className="bg-[#11111b] border border-[#313244] px-2 py-0.5 rounded text-yellow-300 font-bold text-[11px] w-28 outline-none"
                  />
                </div>
              </div>

              {/* Quick Jump Shortcuts */}
              <div className="flex gap-1 mb-2 flex-wrap text-[10px]">
                <button onClick={() => setMemDumpAddress('0x00000000')} className="px-2 py-0.5 bg-[#313244] hover:bg-[#45475a] rounded text-white">
                  0x00000000 (IVT)
                </button>
                <button onClick={() => setMemDumpAddress('0x000A0000')} className="px-2 py-0.5 bg-[#313244] hover:bg-[#45475a] rounded text-purple-300">
                  0x000A0000 (VRAM)
                </button>
                <button onClick={() => setMemDumpAddress('0x00090000')} className="px-2 py-0.5 bg-[#313244] hover:bg-[#45475a] rounded text-yellow-300">
                  0x00090000 (Stack)
                </button>
                <button onClick={() => setMemDumpAddress('0x00100000')} className="px-2 py-0.5 bg-[#313244] hover:bg-[#45475a] rounded text-green-300">
                  0x00100000 (Kernel)
                </button>
                <button onClick={() => setMemDumpAddress('0x000F0000')} className="px-2 py-0.5 bg-[#313244] hover:bg-[#45475a] rounded text-blue-300">
                  0x000F0000 (BIOS ROM)
                </button>
              </div>

              {/* Hex Dump Grid */}
              <div className="flex-1 bg-[#11111b] p-2 rounded border border-[#313244] font-mono text-[11px] overflow-y-auto">
                <div className="grid grid-cols-1 gap-1">
                  {Array.from({ length: 8 }).map((_, row) => {
                    const rowAddr = currentDumpAddr + row * 8;
                    const rowBytes = memorySlice.slice(row * 8, (row + 1) * 8);
                    const ascii = rowBytes.map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('');

                    return (
                      <div key={row} className="flex items-center justify-between hover:bg-[#313244]/30 px-1 py-0.5 rounded">
                        <span className="text-yellow-400/80 font-bold">0x{rowAddr.toString(16).padStart(8, '0').toUpperCase()}</span>
                        <div className="flex gap-2 text-green-400">
                          {rowBytes.map((b, bi) => (
                            <span key={bi} className={b !== 0 ? 'text-green-300 font-bold' : 'text-[#45475a]'}>
                              {b.toString(16).padStart(2, '0').toUpperCase()}
                            </span>
                          ))}
                        </div>
                        <span className="text-[#89dceb] tracking-widest">{ascii}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* I/O Port Bus Tester & COM1 Serial Terminal */}
            <div className="flex flex-col gap-3">
              {/* I/O Port Read/Write */}
              <div className="bg-[#181825] p-3 rounded-lg border border-[#313244]">
                <h4 className="font-bold text-[11px] text-[#f9e2af] mb-2 flex items-center gap-1.5">
                  <Layers size={13} /> I/O Port Bus Interface
                </h4>
                <div className="grid grid-cols-2 gap-2 mb-2 text-[11px]">
                  <div>
                    <label className="text-[9px] text-[#6c7086] block">Port (Hex)</label>
                    <input
                      type="text"
                      value={ioPortInput}
                      onChange={(e) => setIoPortInput(e.target.value)}
                      className="w-full bg-[#11111b] border border-[#313244] px-2 py-1 rounded text-yellow-300 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#6c7086] block">Data Byte (Hex)</label>
                    <input
                      type="text"
                      value={ioValInput}
                      onChange={(e) => setIoValInput(e.target.value)}
                      className="w-full bg-[#11111b] border border-[#313244] px-2 py-1 rounded text-green-300 outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const port = parseInt(ioPortInput, 16) || 0;
                      const val = parseInt(ioValInput, 16) || 0;
                      vm.writeIO8(port, val);
                      setIoReadResult(`WROTE 0x${val.toString(16).toUpperCase()} TO PORT 0x${port.toString(16).toUpperCase()}`);
                    }}
                    className="flex-1 py-1 bg-green-700 hover:bg-green-600 text-white font-bold rounded text-[11px]"
                  >
                    OUT (Write)
                  </button>
                  <button
                    onClick={() => {
                      const port = parseInt(ioPortInput, 16) || 0;
                      const val = vm.readIO8(port);
                      setIoReadResult(`READ 0x${val.toString(16).padStart(2, '0').toUpperCase()} FROM PORT 0x${port.toString(16).toUpperCase()}`);
                    }}
                    className="flex-1 py-1 bg-blue-700 hover:bg-blue-600 text-white font-bold rounded text-[11px]"
                  >
                    IN (Read)
                  </button>
                </div>

                {ioReadResult && (
                  <div className="mt-2 p-1 bg-[#11111b] rounded text-[10px] text-yellow-300 border border-[#313244] text-center">
                    {ioReadResult}
                  </div>
                )}
              </div>

              {/* COM1 Serial Log */}
              <div className="bg-[#181825] p-3 rounded-lg border border-[#313244] flex-1 flex flex-col">
                <h4 className="font-bold text-[11px] text-[#89dceb] mb-2 flex items-center gap-1.5">
                  <Terminal size={13} /> COM1 Serial Log (Port 0x3F8)
                </h4>
                <div className="flex-1 bg-[#11111b] p-2 rounded border border-[#313244] overflow-y-auto space-y-1 font-mono text-[10px] text-[#a6adc8]">
                  {vm.serialLog.length === 0 ? (
                    <div className="text-center py-6 text-[#6c7086]">
                      No COM1 serial messages logged yet.
                    </div>
                  ) : (
                    vm.serialLog.map((line, i) => (
                      <div key={i} className="leading-tight">{line}</div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
