import { vm } from '../vm/motherboard';
import { CPUMode, CPURingLevel, Instruction } from '../vm/types';

export interface SeaBiosEvent {
  type: 'post' | 'boot' | 'cmd' | 'output' | 'error' | 'reboot';
  text: string;
  timestamp: number;
}

export class SeaBiosRunner {
  public isBooted: boolean = false;
  public isRunning: boolean = false;
  public postCompleted: boolean = false;
  public bootSectorAddress: number = 0x00007C00;
  public lastError: string | null = null;
  public bootDrive: number = 0x80; // Standard Hard Disk 0
  public history: SeaBiosEvent[] = [];
  public commandHistory: string[] = [];
  public commandHistoryIndex: number = -1;

  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") (window as any).seaBios = this;
    // Subscribe to VM motherboard updates
    vm.subscribe(() => {
      this.notify();
    });
  }

  public log(text: string, type: SeaBiosEvent['type'] = 'output') {
    const event: SeaBiosEvent = {
      type,
      text,
      timestamp: Date.now()
    };
    this.history.push(event);
    if (this.history.length > 200) this.history.shift();

    // Also print to VM GPU text buffer if in text mode
    if (vm.gpu.isTextMode) {
      vm.gpu.printText(text + '\n');
    }
    this.notify();
  }

  public bootSector(binary: Uint8Array, origin: number = 0x7C00, nativeMode: boolean = false) {
    this.lastError = null;
    this.bootSectorAddress = origin;
    this.history = [];

    if (nativeMode) {
      this.log(`[VC.bios] Starting NATIVE Direct Execution from Hardware Reset Vector (0xFFFFFFF0).`);
      this.log(`[VC.bios] WARNING: SeaBIOS expects full i440FX PCI bridge, virtio-blk, 8259 PIC, and 8253 PIT emulation!`);
      this.log(`[VC.bios] The minimalist TS CPU emulator will likely encounter unknown opcodes.`);
      
      vm.cpu.stop();
      vm.cpu.mode = CPUMode.REAL_16;
      vm.cpu.ring = CPURingLevel.RING_0;
      
      // Hardware Reset Vector for x86 (Top of 4GB address space)
      vm.cpu.registers.eax = 0x00000000;
      vm.cpu.registers.ebx = 0x00000000;
      vm.cpu.registers.ecx = 0x00000000;
      vm.cpu.registers.edx = 0x00000000;
      vm.cpu.registers.esi = 0x00000000;
      vm.cpu.registers.edi = 0x00000000;
      vm.cpu.registers.esp = 0x00000000;
      vm.cpu.registers.ebp = 0x00000000;
      vm.cpu.registers.eip = 0xFFFFFFF0; // The magic reset vector!
      vm.cpu.registers.cs = 0xF000;      // Maps to 0xFFFF0000 base
      vm.cpu.registers.ds = 0x0000;
      vm.cpu.registers.ss = 0x0000;
      vm.cpu.registers.es = 0x0000;
      vm.cpu.registers.eflags = 0x00000002;
      vm.cpu.registers.cr0 = 0x00000000;

      vm.gpu.setMode(0x03);
      vm.gpu.clear(0);

      // We still write the boot sector payload to RAM so if the user writes an IDE intercept 
      // or SeaBIOS manages to fallback to RAM, it's there.
      for (let i = 0; i < binary.length; i++) {
        vm.writeMem8(origin + i, binary[i]);
      }

      this.isBooted = true;
      this.postCompleted = false;
      this.notify();
      vm.cpu.start();
      return;
    }

    // Print authentic SeaBIOS POST messages augmented by VC.bios
    this.log(`VC.bios Extensions Active (powered by SeaBIOS 1.16.2)\n`);
    this.log(`Machine UUID ${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6'}`);
    this.log(`VC.bios (version 1.0.0-vcos)`);
    this.log(`Found 1 cpu(s), max supported 1`);
    this.log(`Ram Size=16 MB (0x0000000001000000)`);
    this.log(`Relocating init from 0x000e0000 to 0x00fdd210 (size 40400)`);
    this.log(`Found 1 PCI devices (max PCI buses 1)`);
    this.log(`Booting from Hard Disk...`);
    this.log(`Booting from 0000:7c00`);

    // 1. Reset CPU & VM State
    vm.cpu.stop();
    vm.cpu.mode = CPUMode.REAL_16;
    vm.cpu.ring = CPURingLevel.RING_0;

    // Reset Registers for Authentic 16-Bit Real Mode Boot
    vm.cpu.registers.eax = 0x00000000;
    vm.cpu.registers.ebx = 0x00000000;
    vm.cpu.registers.ecx = 0x00000000;
    vm.cpu.registers.edx = 0x00000080; // DL = 0x80 (Drive 0)
    vm.cpu.registers.esi = 0x00007C00;
    vm.cpu.registers.edi = 0x00000000;
    vm.cpu.registers.esp = 0x00007C00; // Stack grows downward below boot sector
    vm.cpu.registers.ebp = 0x00007C00;
    vm.cpu.registers.eip = origin >>> 0;
    vm.cpu.registers.cs = 0x0000;
    vm.cpu.registers.ds = 0x0000;
    vm.cpu.registers.ss = 0x0000;
    vm.cpu.registers.es = 0x0000;
    vm.cpu.registers.eflags = 0x00000202; // IF=1
    vm.cpu.registers.cr0 = 0x00000000;   // Real Mode (PE=0)

    // 2. Clear VRAM & set Text Mode 0x03
    vm.gpu.setMode(0x03);
    vm.gpu.clear(0);

    // 3. Write Boot Sector Binary to RAM at 0x7C00
    for (let i = 0; i < binary.length; i++) {
      vm.writeMem8(origin + i, binary[i]);
    }

    // Verify MBR Signature (0x55, 0xAA)
    const hasSignature = binary.length >= 512 &&
      vm.readMem8(origin + 510) === 0x55 &&
      vm.readMem8(origin + 511) === 0xAA;

    // 4. Output Authentic SeaBIOS POST Sequence
    this.log('SeaBIOS (version 1.16.3-vcos-rel)', 'post');
    this.log('Build Date: 2026-08-30 | VCOS Baremetal Virtual Machine', 'post');
    this.log('CPU: 1x VCOS x86 Virtual Core @ ' + (vm.cpu.clockFrequencyHz >= 1000000 ? `${(vm.cpu.clockFrequencyHz / 1000000).toFixed(1)} MHz` : `${vm.cpu.clockFrequencyHz} Hz`), 'post');
    this.log('RAM: 16384 KiB Physical DRAM Available', 'post');
    this.log('Floppy Drive A: [Not Installed]', 'post');
    this.log(`ATA Drive 0: VCOS-MBR-DISK (512 Bytes at 0x${origin.toString(16).toUpperCase()})`, 'post');
    this.log('PCI Bus: Intel 82441FX PMC / VCOS P2P NIC @ Port 0x300', 'post');
    this.log('Sound: SoundBlaster 16 DSP / 8253 PIT @ Port 0x388 / 0x42', 'post');

    if (hasSignature) {
      this.log(`[OK] Valid MBR Boot Signature detected (0xAA55).`, 'post');
    } else {
      this.log(`[WARN] Boot sector does not end with standard 0xAA55 signature (${binary.length} bytes loaded).`, 'post');
    }

    this.log(`Booting from Hard Disk 0 (Sector 0x${origin.toString(16).toUpperCase()})...\n`, 'boot');

    this.postCompleted = true;
    this.isBooted = true;

    // 5. Start Execution
    vm.cpu.start();
    this.isRunning = true;
    this.notify();
  }

  public executeCommand(input: string): string {
    const raw = input.trim();
    if (!raw) return '';

    this.commandHistory.push(raw);
    this.commandHistoryIndex = this.commandHistory.length;
    this.log(`SeaBIOS (vcos)> ${raw}`, 'cmd');

    const parts = raw.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
      case '?':
        return this.cmdHelp();

      case 'boot': {
        const addr = args[0] ? parseInt(args[0], 16) || parseInt(args[0], 10) || 0x7C00 : 0x7C00;
        vm.cpu.stop();
        vm.cpu.registers.eip = addr;
        vm.cpu.start();
        this.log(`Booting from address 0x${addr.toString(16).toUpperCase()}...`, 'boot');
        return `[BOOT] CPU running at 0x${addr.toString(16).toUpperCase()}`;
      }

      case 'run':
        vm.cpu.start();
        this.isRunning = true;
        this.log('CPU execution started/resumed.', 'output');
        return '[CPU] Running';

      case 'step':
        vm.cpu.step();
        this.log(`Single step executed. EIP = 0x${vm.cpu.registers.eip.toString(16).toUpperCase()}`, 'output');
        return this.formatRegisters();

      case 'halt':
      case 'stop':
      case 'pause':
        vm.cpu.stop();
        this.isRunning = false;
        this.log('CPU execution paused.', 'output');
        return '[CPU] Stopped';

      case 'regs':
      case 'registers':
        return this.formatRegisters();

      case 'disasm':
      case 'u': {
        const start = args[0] ? parseInt(args[0], 16) || parseInt(args[0], 10) || vm.cpu.registers.eip : vm.cpu.registers.eip;
        const count = args[1] ? parseInt(args[1], 10) || 8 : 8;
        return this.cmdDisassemble(start, count);
      }

      case 'dump':
      case 'd': {
        const addr = args[0] ? parseInt(args[0], 16) || parseInt(args[0], 10) || 0x7C00 : 0x7C00;
        const len = args[1] ? parseInt(args[1], 10) || 64 : 64;
        return this.cmdHexDump(addr, len);
      }

      case 'write':
      case 'w': {
        if (args.length < 2) {
          return 'Usage: write <addr_hex> <val_hex>';
        }
        const addr = parseInt(args[0], 16) || parseInt(args[0], 10);
        const val = parseInt(args[1], 16) || parseInt(args[1], 10);
        vm.writeMem8(addr, val);
        this.log(`[MEM] Written 0x${(val & 0xFF).toString(16).toUpperCase()} to 0x${addr.toString(16).toUpperCase()}`);
        return `OK: Memory[0x${addr.toString(16).toUpperCase()}] = 0x${(val & 0xFF).toString(16).toUpperCase()}`;
      }

      case 'vga': {
        if (args[0]) {
          const mode = parseInt(args[0], 16) || parseInt(args[0], 10) || 0x13;
          vm.gpu.setMode(mode);
          this.log(`Switched VGA mode to 0x${mode.toString(16).toUpperCase()}`, 'output');
          return `VGA Mode: 0x${mode.toString(16).toUpperCase()}`;
        }
        const info = vm.gpu.getModeInfo();
        return `Current VGA Mode: 0x${info.mode.toString(16).toUpperCase()} (${info.name}) - ${info.width}x${info.height} (${info.colors} colors)`;
      }

      case 'pit':
      case 'beep': {
        const freq = args[0] ? parseInt(args[0], 10) || 440 : 440;
        vm.audio.handleIOWrite(0x388, Math.min(255, Math.floor(freq / 10)));
        this.log(`PIT 8253 Speaker Beep: ${freq} Hz`, 'output');
        return `Beep: ${freq} Hz`;
      }

      case 'p2p': {
        const msg = args.join(' ') || 'VCOS_SEABIOS_BROADCAST';
        vm.net.broadcastMessage(msg);
        this.log(`[P2P] Broadcast: "${msg}"`, 'output');
        return `P2P Broadcast Sent: ${msg}`;
      }

      case 'cls':
      case 'clear':
        vm.gpu.clear(0);
        this.history = [];
        this.notify();
        return 'Screen Cleared';

      case 'reboot':
      case 'reset':
        this.reboot();
        return 'SeaBIOS Rebooted.';

      case 'sysinfo':
        return this.cmdSysInfo();

      default: {
        const msg = `Unknown SeaBIOS command: '${cmd}'. Type 'help' for command listing.`;
        this.log(msg, 'error');
        return msg;
      }
    }
  }

  public reboot() {
    this.log('Performing SeaBIOS Warm Reset (INT 0x19)...', 'reboot');
    vm.cpu.reset();
    vm.gpu.setMode(0x03);
    vm.gpu.clear(0);
    this.isBooted = false;
    this.postCompleted = false;
    this.notify();
  }

  public pause() {
    vm.cpu.stop();
    this.isRunning = false;
    this.notify();
  }

  public resume() {
    vm.cpu.start();
    this.isRunning = true;
    this.notify();
  }

  public step() {
    try {
      vm.cpu.step();
    } catch (e: any) {
      this.log(`[CPU EXCEPTION] ${e.message}`, 'error');
      this.pause();
    }
    this.notify();
  }

  public pushKey(key: string, keyCode: number) {
    vm.pushKey(keyCode);
    if (key.length === 1) {
      vm.pushKey(key.charCodeAt(0));
    }
  }

  private cmdHelp(): string {
    const text = [
      '==============================================================',
      '           SeaBIOS Interactive Command Reference              ',
      '==============================================================',
      '  boot [addr]         - Boot x86 sector at address (default 0x7C00)',
      '  run                 - Resume CPU execution cycle loop',
      '  step                - Step single instruction',
      '  halt / pause        - Stop/pause CPU execution',
      '  regs                - Display registers (EAX, EBX, ECX, EDX, EIP, etc.)',
      '  disasm [addr] [cnt] - Disassemble instructions from memory',
      '  dump [addr] [len]   - Hex dump memory buffer with ASCII view',
      '  write <addr> <val>  - Write single byte to RAM',
      '  vga [mode]          - Get or switch VGA Mode (0x03 text, 0x13 256c)',
      '  pit [freq]          - Generate tone via 8253 PIT / SoundBlaster',
      '  p2p <message>       - Send packet across P2P virtual network mesh',
      '  sysinfo             - Display VM hardware configuration and devices',
      '  cls / clear         - Clear terminal and CRT screen',
      '  reboot              - Warm reboot SeaBIOS and reset CPU state',
      '=============================================================='
    ].join('\n');
    this.log(text, 'output');
    return text;
  }

  private formatRegisters(): string {
    const r = vm.cpu.registers;
    const f = vm.cpu.getFlags();
    const flagsStr = [
      f.carry ? 'CF' : 'cf',
      f.zero ? 'ZF' : 'zf',
      f.sign ? 'SF' : 'sf',
      f.interrupt ? 'IF' : 'if',
      f.overflow ? 'OF' : 'of',
      f.parity ? 'PF' : 'pf',
      f.direction ? 'DF' : 'df'
    ].join(' ');

    const text = [
      `EAX: 0x${r.eax.toString(16).padStart(8, '0').toUpperCase()}  EBX: 0x${r.ebx.toString(16).padStart(8, '0').toUpperCase()}  ECX: 0x${r.ecx.toString(16).padStart(8, '0').toUpperCase()}  EDX: 0x${r.edx.toString(16).padStart(8, '0').toUpperCase()}`,
      `ESI: 0x${r.esi.toString(16).padStart(8, '0').toUpperCase()}  EDI: 0x${r.edi.toString(16).padStart(8, '0').toUpperCase()}  ESP: 0x${r.esp.toString(16).padStart(8, '0').toUpperCase()}  EBP: 0x${r.ebp.toString(16).padStart(8, '0').toUpperCase()}`,
      `EIP: 0x${r.eip.toString(16).padStart(8, '0').toUpperCase()}  CS: 0x${r.cs.toString(16).padStart(4, '0').toUpperCase()}   DS: 0x${r.ds.toString(16).padStart(4, '0').toUpperCase()}   SS: 0x${r.ss.toString(16).padStart(4, '0').toUpperCase()}   ES: 0x${r.es.toString(16).padStart(4, '0').toUpperCase()}`,
      `CR0: 0x${r.cr0.toString(16).padStart(8, '0').toUpperCase()}  MODE: ${vm.cpu.mode}  FLAGS: [ ${flagsStr} ]`
    ].join('\n');
    this.log(text, 'output');
    return text;
  }

  private cmdDisassemble(startAddr: number, count: number): string {
    const list = vm.cpu.disassemble(startAddr, count);
    const lines = list.map(inst => {
      const isCurrent = inst.address === vm.cpu.registers.eip;
      const ptr = isCurrent ? '=>' : '  ';
      const hex = inst.bytes.map(b => (b & 0xFF).toString(16).padStart(2, '0').toUpperCase()).join(' ').padEnd(14, ' ');
      return `${ptr} 0x${inst.address.toString(16).padStart(8, '0').toUpperCase()}:  ${hex}  ${inst.mnemonic.padEnd(6, ' ')} ${inst.operands}`;
    });
    const result = `Disassembly at 0x${startAddr.toString(16).toUpperCase()}:\n` + lines.join('\n');
    this.log(result, 'output');
    return result;
  }

  private cmdHexDump(startAddr: number, length: number): string {
    const lines: string[] = [];
    for (let addr = startAddr; addr < startAddr + length; addr += 16) {
      const bytes: number[] = [];
      let ascii = '';
      for (let offset = 0; offset < 16; offset++) {
        if (addr + offset < startAddr + length) {
          const b = vm.readMem8(addr + offset);
          bytes.push(b);
          ascii += (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
        }
      }
      const hexStr = bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ').padEnd(48, ' ');
      lines.push(`0x${addr.toString(16).padStart(8, '0').toUpperCase()}:  ${hexStr}  |${ascii}|`);
    }
    const result = `Memory Hex Dump [0x${startAddr.toString(16).toUpperCase()} - 0x${(startAddr + length - 1).toString(16).toUpperCase()}]:\n` + lines.join('\n');
    this.log(result, 'output');
    return result;
  }

  private cmdSysInfo(): string {
    const stats = vm.getSystemStats();
    const text = [
      '==============================================================',
      '               VCOS Virtual Hardware System Info              ',
      '==============================================================',
      `CPU Clock: ${stats.cpuFrequencyHz} Hz | Instructions Executed: ${stats.instructionsExecuted}`,
      `Total Clock Cycles: ${stats.totalCycles} | Mode: ${stats.currentMode}`,
      `RAM: 16 MB DRAM | VRAM: 128 KB (0xA0000 - 0xBFFFF)`,
      `VGA Mode: 0x${vm.gpu.mode.toString(16).toUpperCase()} (${vm.gpu.width}x${vm.gpu.height}) @ ${stats.vramFps} FPS`,
      `P2P Mesh NIC: Port 0x300-0x302 (Peers: ${stats.p2pPeersCount}, TX: ${stats.p2pTxBytes}B, RX: ${stats.p2pRxBytes}B)`,
      `Sound: SoundBlaster 16 (0x388) & PIT 8253 (0x42, 0x43, 0x61)`,
      `Interrupts Dispatched: ${stats.interruptsHandled} | I/O Reads: ${stats.ioPortReads} | Writes: ${stats.ioPortWrites}`,
      '=============================================================='
    ].join('\n');
    this.log(text, 'output');
    return text;
  }

  public subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }
}

export const seaBios = new SeaBiosRunner();
