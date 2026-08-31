import { VirtualCPU } from './cpu';
import { VirtualGPU } from './gpu';
import { VirtualP2PNetwork } from './p2pNetwork';
import { VirtualAudioDSP } from './audio';
import { CPUMode, CPURingLevel, VMLatencyConfig, VMLatencyStats, VMSystemStats } from './types';
import { LATENCY_PRESETS } from './latencyPresets';

import { seabiosBinBase64 } from '../vcode/seabios_bin';
import { vcBios } from '../vcode/vcbios';

export class VirtualMotherboard {
  public memory: Uint8Array; // 16 MB Physical RAM
  public biosRom: Uint8Array = new Uint8Array(256 * 1024); // 256 KB SeaBIOS Image
  private cmosIndex: number = 0;
  private cmosData: Uint8Array = new Uint8Array(128);
  public cpu: VirtualCPU;
  public gpu: VirtualGPU;
  public net: VirtualP2PNetwork;
  public audio: VirtualAudioDSP;

  // I/O Port access counters
  public ioPortReads: number = 0;
  public ioPortWrites: number = 0;
  public interruptsHandled: number = 0;

  // Artificial Latency Configuration (CPU, Memory Bus, VRAM, I/O, IRQ & P2P)
  public latencyConfig: VMLatencyConfig = { ...LATENCY_PRESETS.retro_486 };

  // Keyboard Buffer (Port 0x60 / 0x64)
  public keyBuffer: number[] = [];

  // Serial Port Buffer (Port 0x3F8)
  public serialTxBuffer: string = '';
  public serialLog: string[] = [];

  private listeners: Set<() => void> = new Set();

  constructor() {
    this.memory = new Uint8Array(16 * 1024 * 1024); // 16 MB
    this.cpu = new VirtualCPU();
    this.gpu = new VirtualGPU();
    this.net = new VirtualP2PNetwork();
    this.audio = new VirtualAudioDSP();

    // Propagate initial latency configuration
    this.applyLatencyConfig(this.latencyConfig);

    // Hook CPU Memory & I/O Bus
    this.cpu.readMem8 = (addr) => this.readMem8(addr);
    this.cpu.writeMem8 = (addr, val) => this.writeMem8(addr, val);
    this.cpu.readIO8 = (port) => this.readIO8(port);
    this.cpu.writeIO8 = (port, val) => this.writeIO8(port, val);
    this.cpu.triggerInterruptHandler = (vector) => this.handleInterrupt(vector);

    // Hook NIC Interrupt
    this.net.onInterrupt = (irq, msg) => {
      this.interruptsHandled++;
      this.logSerial(`[IRQ ${irq}] ${msg}`);
      // Vector 0x20 + IRQ (0x2B for IRQ 11)
      this.handleInterrupt(0x20 + irq);
    };

    this.initBiosRom();
    this.loadDefaultProgram();
  }

  public setLatencyPreset(presetKey: string) {
    if (presetKey in LATENCY_PRESETS) {
      this.applyLatencyConfig(LATENCY_PRESETS[presetKey]);
    }
  }

  public updateLatencyConfig(partial: Partial<VMLatencyConfig>) {
    this.applyLatencyConfig({
      ...this.latencyConfig,
      ...partial,
      profileName: partial.profileName || '⚙️ Custom User Hardware Profile'
    });
  }

  private applyLatencyConfig(config: VMLatencyConfig) {
    this.latencyConfig = { ...config };
    this.cpu.cpuLoadThrottlingPct = config.cpuLoadThrottlingPct;
    this.cpu.enableInstructionCycleWeights = config.enableInstructionCycleWeights;
    this.net.setLatencyConfig(this.latencyConfig);
    this.notify();
  }

  private initBiosRom() {
    // Decode and load the real SeaBIOS binary
    try {
      const binaryString = atob(seabiosBinBase64);
      for (let i = 0; i < binaryString.length && i < this.biosRom.length; i++) {
        this.biosRom[i] = binaryString.charCodeAt(i);
      }
    } catch (e) {
      console.error("Failed to load real SeaBIOS binary", e);
    }
    
    // Set up standard CMOS values for SeaBIOS (memory size, boot order)
    this.cmosData[0x14] = 0x00; // Equipment byte
    
    // Extended memory above 1MB (in 1KB blocks)
    // We have 16MB total. 15MB extended = 15360 KB = 0x3C00
    this.cmosData[0x30] = 0x00; // Low byte
    this.cmosData[0x31] = 0x3C; // High byte
    
    // Boot sequence (0x3D) - Hard Disk first (0x02)
    this.cmosData[0x3D] = 0x02;

    // Run custom VC.bios extensions on top of SeaBIOS
    vcBios.init(this);
  }

  public readMem8(addr: number): number {
    const cleanAddr = addr >>> 0;
    
    // High Memory Map: SeaBIOS at reset vector (0xFFFC0000 - 0xFFFFFFFF for 256KB)
    if (cleanAddr >= 0xFFFC0000 && cleanAddr <= 0xFFFFFFFF) {
      return this.biosRom[cleanAddr - 0xFFFC0000];
    }

    // Low Memory Shadowing: Top 128KB of SeaBIOS (0x000E0000 - 0x000FFFFF)
    if (cleanAddr >= 0x000E0000 && cleanAddr <= 0x000FFFFF) {
      return this.biosRom[(cleanAddr - 0x000E0000) + 0x20000];
    }

    // Route VRAM: 0x000A0000 - 0x000BFFFF (128 KB)
    if (cleanAddr >= 0x000A0000 && cleanAddr < 0x000C0000) {
      this.cpu.addWaitCycles(this.latencyConfig.vramWaitStatesCycles);
      const vramOffset = cleanAddr - 0x000A0000;
      return this.gpu.vram[vramOffset] || 0;
    }

    // System DRAM Access Latency
    this.cpu.addWaitCycles(this.latencyConfig.dramWaitStatesCycles);

    if (cleanAddr < this.memory.length) {
      return this.memory[cleanAddr];
    }
    return 0xFF;
  }

  public writeMem8(addr: number, val: number) {
    const cleanAddr = addr >>> 0;
    const val8 = val & 0xFF;

    // Route VRAM: 0x000A0000 - 0x000BFFFF
    if (cleanAddr >= 0x000A0000 && cleanAddr < 0x000C0000) {
      this.cpu.addWaitCycles(this.latencyConfig.vramWaitStatesCycles);
      const vramOffset = cleanAddr - 0x000A0000;
      this.gpu.vram[vramOffset] = val8;
      return;
    }

    // System DRAM Access Latency
    this.cpu.addWaitCycles(this.latencyConfig.dramWaitStatesCycles);

    if (cleanAddr < this.memory.length) {
      this.memory[cleanAddr] = val8;
    }
  }

  public readIO8(port: number): number {
    this.ioPortReads++;
    this.cpu.addWaitCycles(this.latencyConfig.ioPortWaitStatesCycles);
    const p = port & 0xFFFF;

    // VGA Ports (0x3C0 - 0x3DA)
    if (p >= 0x3C0 && p <= 0x3DA) {
      return this.gpu.handleIORead(p);
    }

    // P2P Virtual NIC (0x300 - 0x30F)
    if (p >= 0x300 && p <= 0x30F) {
      return this.net.handleIORead(p);
    }

    // Keyboard Controller (Port 0x60 / 0x64)
    if (p === 0x60) {
      return this.keyBuffer.length > 0 ? (this.keyBuffer.shift() || 0) : 0;
    }
    if (p === 0x64) {
      return this.keyBuffer.length > 0 ? 0x01 : 0x00;
    }

    // CMOS Read (0x70 / 0x71)
    if (p === 0x71) {
      return this.cmosData[this.cmosIndex & 0x7F];
    }

    // Legacy PIC / PIT Dummy Handlers
    if (p === 0x20 || p === 0xA0) return 0x00; // PIC
    if (p === 0x40 || p === 0x43) return 0x00; // PIT

    // Serial COM1 Port 0x3F8
    if (p === 0x3F8) {
      return 0x00;
    }
    if (p === 0x3FD) {
      return 0x20;
    }

    return 0xFF;
  }

  public writeIO8(port: number, val: number) {
    this.ioPortWrites++;
    this.cpu.addWaitCycles(this.latencyConfig.ioPortWaitStatesCycles);
    const p = port & 0xFFFF;
    const v = val & 0xFF;

    // VGA Ports (0x3C8, 0x3C9, 0x3D4, etc.)
    if (p >= 0x3C0 && p <= 0x3DA) {
      this.gpu.handleIOWrite(p, v);
      return;
    }

    // P2P Virtual NIC (0x300 - 0x30F)
    if (p >= 0x300 && p <= 0x30F) {
      this.net.handleIOWrite(p, v);
      return;
    }

    // Audio DSP / SoundBlaster / PC Speaker (0x42, 0x43, 0x61, 0x388)
    if (p === 0x42 || p === 0x43 || p === 0x61 || p === 0x388) {
      this.audio.handleIOWrite(p, v);
      return;
    }

    // SeaBIOS Debug / QEMU fw_cfg Port
    if (p === 0x402 || p === 0x3F8) {
      // Send raw char to serial logger
      this.logSerial(String.fromCharCode(v));
      return;
    }

    // CMOS Write (0x70 / 0x71)
    if (p === 0x70) {
      this.cmosIndex = v;
      return;
    }
    if (p === 0x71) {
      this.cmosData[this.cmosIndex & 0x7F] = v;
      return;
    }
    
    // Legacy PIC Dummy Handlers
    if (p === 0x20 || p === 0xA0) return;

    // Serial COM1 (0x3F8)
    if (p === 0x3F8) {
      const ch = String.fromCharCode(v);
      if (ch === '\n') {
        this.logSerial(this.serialTxBuffer);
        this.serialTxBuffer = '';
      } else {
        this.serialTxBuffer += ch;
      }
      return;
    }
  }

  public handleInterrupt(vector: number) {
    this.interruptsHandled++;
    // IRQ Dispatch Latency in CPU Cycles
    this.cpu.addWaitCycles(this.latencyConfig.irqDispatchDelayCycles);

    // Let VC.bios extensions intercept the interrupt first
    if (vcBios.handleInterrupt(vector, this)) {
      return;
    }

    // Fallback: Default TS implementations (Video, Keyboard)
    // BIOS Video Services (INT 0x10)
    if (vector === 0x10) {
      const ah = (this.cpu.registers.eax >> 8) & 0xFF;
      const al = this.cpu.registers.eax & 0xFF;

      if (ah === 0x00) {
        this.gpu.setMode(al);
        this.logSerial(`[INT 0x10] Set Video Mode: 0x${al.toString(16).toUpperCase()}`);
      } else if (ah === 0x0E) {
        // Teletype output
        const char = String.fromCharCode(al);
        this.gpu.printText(char);
      } else if (ah === 0x0C) {
        // Set pixel
        const x = this.cpu.registers.ecx & 0xFFFF;
        const y = this.cpu.registers.edx & 0xFFFF;
        this.gpu.setPixel(x, y, al);
      } else if (ah === 0x02) {
        // Set cursor position (DH = row, DL = col)
        const row = (this.cpu.registers.edx >> 8) & 0xFF;
        const col = this.cpu.registers.edx & 0xFF;
        this.gpu.cursorY = Math.min(24, Math.max(0, row));
        this.gpu.cursorX = Math.min(79, Math.max(0, col));
      } else if (ah === 0x03) {
        // Get cursor position -> returns DH = cursorY, DL = cursorX
        const dh = this.gpu.cursorY & 0xFF;
        const dl = this.gpu.cursorX & 0xFF;
        this.cpu.registers.edx = ((dh << 8) | dl) >>> 0;
      } else if (ah === 0x06) {
        // Scroll window up / clear
        if (al === 0) {
          this.gpu.clear(0);
        } else {
          this.gpu.scrollTextUp();
        }
      }
      return;
    }

    // BIOS Keyboard Services (INT 0x16)
    if (vector === 0x16) {
      const ah = (this.cpu.registers.eax >> 8) & 0xFF;
      if (ah === 0x00) {
        // Read keystroke (blocking / return character in AL, scan code in AH)
        const code = this.keyBuffer.shift() || 0;
        this.cpu.registers.eax = (this.cpu.registers.eax & 0xFFFF0000) | (code & 0xFF);
      } else if (ah === 0x01) {
        // Check keystroke buffer status: ZF = 1 if empty, ZF = 0 if key available
        const hasKey = this.keyBuffer.length > 0;
        this.cpu.setFlag(6, !hasKey); // ZF=1 if NO key
        if (hasKey) {
          const nextKey = this.keyBuffer[0] || 0;
          this.cpu.registers.eax = (this.cpu.registers.eax & 0xFFFF0000) | (nextKey & 0xFF);
        }
      }
      return;
    }

    // BIOS Disk Services (INT 0x13)
    if (vector === 0x13) {
      const ah = (this.cpu.registers.eax >> 8) & 0xFF;
      if (ah === 0x00) { // Reset disk system
        this.cpu.setFlag(0, false); // CF = 0 (Success)
        this.cpu.registers.eax = (this.cpu.registers.eax & 0xFFFF00FF) | 0x0000; // AH = 0 (Success)
      } else if (ah === 0x02) { // Read sectors
        this.cpu.setFlag(0, false);
        this.cpu.registers.eax = (this.cpu.registers.eax & 0xFFFF00FF) | 0x0000;
        this.logSerial(`[INT 0x13] Read Disk Sectors Success (Drive 0x${(this.cpu.registers.edx & 0xFF).toString(16).toUpperCase()})`);
      } else if (ah === 0x08) { // Get drive parameters
        this.cpu.setFlag(0, false);
        this.cpu.registers.eax = (this.cpu.registers.eax & 0xFFFF00FF) | 0x0000;
        this.cpu.registers.ecx = 0x4F12; // 80 cylinders, 18 sectors
        this.cpu.registers.edx = 0x0101; // 2 heads, 1 drive
      }
      return;
    }

    // SeaBIOS Warm Reboot (INT 0x19)
    if (vector === 0x19) {
      this.logSerial('[INT 0x19] SeaBIOS Warm Reboot Initiated.');
      this.cpu.registers.eip = 0x00007C00;
      this.cpu.registers.cs = 0x0000;
      this.cpu.registers.ds = 0x0000;
      this.cpu.registers.ss = 0x0000;
      this.cpu.registers.esp = 0x00007C00;
      return;
    }

    // DOS / SeaBIOS Terminate Program (INT 0x20)
    if (vector === 0x20) {
      this.logSerial('[INT 0x20] Program Terminated via DOS INT 0x20.');
      this.cpu.stop();
      return;
    }

    // VCOS Native Syscalls (INT 0x80)
    if (vector === 0x80) {
      const sysNum = this.cpu.registers.eax;
      this.logSerial(`[SYSCALL 0x80] Call #${sysNum}`);
      if (sysNum === 1) { // sys_exit
        this.cpu.stop();
      } else if (sysNum === 4) { // sys_write
        const len = this.cpu.registers.edx;
        const ptr = this.cpu.registers.ecx;
        let str = '';
        for (let i = 0; i < len; i++) {
          str += String.fromCharCode(this.readMem8(ptr + i));
        }
        this.logSerial(`[STDOUT] ${str}`);
        this.gpu.printText(str);
      } else if (sysNum === 10) { // sys_p2p_broadcast
        const len = this.cpu.registers.edx;
        const ptr = this.cpu.registers.ecx;
        let msg = '';
        for (let i = 0; i < len; i++) {
          msg += String.fromCharCode(this.readMem8(ptr + i));
        }
        this.net.broadcastMessage(msg);
      }
      return;
    }
  }

  public pushKey(keyCode: number) {
    this.keyBuffer.push(keyCode);
    if (this.keyBuffer.length > 32) this.keyBuffer.shift();
  }

  public logSerial(msg: string) {
    this.serialLog.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`);
    if (this.serialLog.length > 80) this.serialLog.pop();
    this.notify();
  }

  public getLatencyStats(): VMLatencyStats {
    const elapsedSeconds = this.cpu.totalCycles / (this.cpu.clockFrequencyHz || 1);
    const mips = elapsedSeconds > 0 
      ? Math.round(((this.cpu.instructionsExecuted / elapsedSeconds) / 1000000) * 1000) / 1000 
      : 0;

    return {
      lastInstructionCycles: this.cpu.lastInstructionCycles,
      totalWaitCycles: this.cpu.totalWaitCycles,
      simulatedTimeUs: Math.round(elapsedSeconds * 1000000),
      busStallCycles: this.cpu.busStallCycles,
      effectiveMips: mips,
      busUtilizationPct: this.cpu.totalCycles > 0 
        ? Math.min(100, Math.round((this.cpu.totalWaitCycles / this.cpu.totalCycles) * 100)) 
        : 0,
      currentNetworkLatencyMs: this.net.currentNetworkLatencyMs,
      networkJitterMs: this.net.networkJitterMs,
      droppedPacketsCount: this.net.droppedPacketsCount
    };
  }

  public getSystemStats(): VMSystemStats {
    return {
      cpuFrequencyHz: this.cpu.clockFrequencyHz,
      totalCycles: this.cpu.totalCycles,
      instructionsExecuted: this.cpu.instructionsExecuted,
      currentMode: this.cpu.mode,
      currentRing: this.cpu.ring,
      vramFps: this.gpu.fps,
      p2pTxBytes: this.net.txBytes,
      p2pRxBytes: this.net.rxBytes,
      p2pPeersCount: this.net.peers.size,
      interruptsHandled: this.interruptsHandled,
      ioPortReads: this.ioPortReads,
      ioPortWrites: this.ioPortWrites,
      latencyConfig: this.latencyConfig,
      latencyStats: this.getLatencyStats()
    };
  }

  public loadDefaultProgram() {
    const code = `
; VCOS Native Assembly Microkernel
; Mode 13h 256-Color & P2P Broadcast Demo

START:
    CLI                 ; Disable Interrupts
    MOV EAX, 0x0013     ; AL=0x13 (Mode 13h 320x200), AH=0 (Set Video Mode)
    INT 0x10            ; BIOS Video Interrupt

    ; Write initial test values to registers
    MOV EAX, 0x1337BEEF ; Set Magic Flag
    MOV EBX, 0x0000002A ; Answer to Universe (42)
    MOV ECX, 0x00000100 ; Loop counter
    MOV EDX, 0x00000300 ; NIC Port Address

    ; Send Low-Level P2P Announcement via Port 0x302 & 0x300
    MOV EAX, 0x56       ; 'V'
    OUT 0x302, AL
    MOV EAX, 0x4D       ; 'M'
    OUT 0x302, AL
    MOV EAX, 0x02       ; Transmit Command
    OUT 0x300, AL

    ; Sound Blaster Beep (Port 0x388)
    MOV EAX, 0x3C       ; Note pitch
    OUT 0x388, AL

    STI                 ; Enable Interrupts
    HLT                 ; Halt until next interrupt
`;
    this.cpu.assembleAndLoad(code, 0x00100000);
  }

  public subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }
}

// Global Singleton Virtual Motherboard
export const vm = new VirtualMotherboard();
