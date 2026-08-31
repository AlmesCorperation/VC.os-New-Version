import { MemoryMap } from './memoryMap';

export type KernelEventType = 'IRQ' | 'SYSCALL' | 'MEM' | 'TASK' | 'CRITICAL' | 'ASM' | 'INT' | 'RING' | 'IPC' | 'SERVER';

export enum CPURing {
  RING_0 = 0, // Microkernel Core (IPC, Scheduling, VM)
  RING_1 = 1, // High-performance device drivers
  RING_2 = 2, // Standard device drivers
  RING_3 = 3  // User Mode & Microkernel Servers (VFS, Net, GUI)
}

export interface KernelEvent {
  time: string;
  type: KernelEventType;
  message: string;
  vector?: number;
  ring?: CPURing;
}

export interface IDTEntry {
  vector: number;
  handler: string;
  description: string;
  count: number;
}

export interface RegisterState {
  EAX: string; EBX: string; ECX: string; EDX: string;
  ESI: string; EDI: string; ESP: string; EBP: string;
  EIP: string; EFLAGS: string;
}

export interface IPCMessage {
  source_pid: number;
  dest_pid: number;
  type: string;
  buffer_ptr: string;
}

export interface MicrokernelServer {
  pid: number;
  name: string;
  ring: CPURing;
  status: 'ACTIVE' | 'WAITING_IPC' | 'BLOCKED';
}

class Microkernel {
  private listeners: Set<() => void> = new Set();
  
  public events: KernelEvent[] = [];
  public cpuLoad: number[] = new Array(20).fill(0);
  public memUsage: number = 42;
  public idt: IDTEntry[] = [];
  public currentRing: CPURing = CPURing.RING_0;
  
  public servers: MicrokernelServer[] = [
    { pid: 100, name: 'VFS_SERVER', ring: CPURing.RING_3, status: 'ACTIVE' },
    { pid: 101, name: 'NET_SERVER', ring: CPURing.RING_3, status: 'WAITING_IPC' },
    { pid: 102, name: 'GUI_SERVER', ring: CPURing.RING_3, status: 'ACTIVE' },
    { pid: 103, name: 'INPUT_DRIVER', ring: CPURing.RING_2, status: 'WAITING_IPC' }
  ];

  public registers: RegisterState = {
    EAX: '0x00000000', EBX: '0x00000000', ECX: '0x00000000', EDX: '0x00000000',
    ESI: '0x00000000', EDI: '0x00000000', ESP: '0xFFFF0000', EBP: '0xFFFF0000',
    EIP: '0x' + MemoryMap.KERNEL_CORE_START.toString(16).padStart(8, '0').toUpperCase(), EFLAGS: '0x00000202'
  };

  private interval: any;
  private isKernelCorrupted: boolean = false;
  public glitchLevel: number = 0;
  private onPanicCallback: ((reason: string) => void) | null = null;
  public activeLegacyIso: { name: string, content?: string | Uint8Array } | null = null;

  public bootLegacyIso(payload: { name: string, content?: string | Uint8Array }) {
    this.activeLegacyIso = payload;
    this.emitEvent('CRITICAL', `LEGACY_BIOS: BOOT_ISO_REQUEST [${payload.name}]`);
    this.notify();
  }

  public exitLegacyIso() {
    this.activeLegacyIso = null;
    this.emitEvent('CRITICAL', `LEGACY_BIOS: EXIT_TO_DESKTOP`);
    this.notify();
  }

  constructor() {
    this.initIDT();
    this.startMicrokernelLoop();
  }

  private initIDT() {
    // Initialize 256 IDT entries for microkernel
    const handlers = [
      { v: 0x00, h: 'DIV_BY_ZERO', d: 'Division by Zero Exception' },
      { v: 0x01, h: 'DEBUG', d: 'Debug Exception' },
      { v: 0x03, h: 'BREAKPOINT', d: 'Breakpoint Exception' },
      { v: 0x06, h: 'INVALID_OP', d: 'Invalid Opcode' },
      { v: 0x08, h: 'DOUBLE_FAULT', d: 'Double Fault' },
      { v: 0x0D, h: 'GP_FAULT', d: 'General Protection Fault' },
      { v: 0x0E, h: 'PAGE_FAULT', d: 'Page Fault' },
      { v: 0x20, h: 'TIMER', d: 'System Timer Tick (Scheduling)' },
      { v: 0x21, h: 'KEYBOARD', d: 'Keyboard Input Event' },
      { v: 0x22, h: 'MOUSE', d: 'Mouse Pointer Event' },
      { v: 0x80, h: 'SYSCALL_IPC', d: 'Microkernel IPC System Call' },
      { v: 0xBB, h: 'KERNEL_PANIC', d: 'Manual Kernel Panic Trigger' },
      { v: 0xCC, h: 'UI_EVENT', d: 'User Interface Interaction' },
      { v: 0xDD, h: 'SYS_DAEMON', d: 'System Daemon Background Event' }
    ];

    for (let i = 0; i < 256; i++) {
      const handler = handlers.find(h => h.v === i);
      this.idt.push({
        vector: i,
        handler: handler ? handler.h : 'RESERVED',
        description: handler ? handler.d : 'Reserved for future use',
        count: 0
      });
    }
  }

  public triggerInterrupt(vector: number, message: string = '') {
    if (vector < 0 || vector > 255) return;
    
    const entry = this.idt[vector];
    entry.count++;
    
    // Interrupts transition to Ring 0 (Microkernel Core)
    const previousRing = this.currentRing;
    if (this.currentRing !== CPURing.RING_0) {
      this.setRing(CPURing.RING_0);
    }

    this.emitEvent('INT', `INT 0x${vector.toString(16).toUpperCase()}: ${entry.handler} ${message}`, vector);
    
    this.cpuLoad = [...this.cpuLoad.slice(1), Math.min(100, this.cpuLoad[this.cpuLoad.length - 1] + 2)];
    
    this.registers = {
      ...this.registers,
      EIP: `0x${(vector * 8).toString(16).padStart(8, '0').toUpperCase()}`,
      EAX: `0x${vector.toString(16).padStart(8, '0').toUpperCase()}`,
      EFLAGS: '0x' + (parseInt(this.registers.EFLAGS, 16) | 0x200).toString(16).padStart(8, '0').toUpperCase()
    };

    if (entry.handler === 'KERNEL_PANIC') {
      this.panic(message || 'INTERRUPT_DRIVEN_PANIC');
    }

    // Microkernel returns to userspace quickly
    this.setRing(previousRing);
    this.notify();
  }

  public setRing(ring: CPURing) {
    if (this.currentRing === ring) return;
    const oldRing = this.currentRing;
    this.currentRing = ring;
    this.emitEvent('RING', `CPU_TRANSITION: RING_${oldRing} -> RING_${ring}`);
    this.notify();
  }

  // IPC Syscalls
  public async syscallIPC(method: 'SEND' | 'RECEIVE' | 'CALL', srcPid: number, destPid: number, payload: string) {
    const previousRing = this.currentRing;
    this.setRing(CPURing.RING_0);
    this.emitEvent('IPC', `IPC_${method}: PID ${srcPid} -> PID ${destPid} [${payload}]`);
    
    this.triggerInterrupt(0x80, 'IPC'); // Trigger syscall int
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    this.setRing(previousRing);
    return { status: 'OK' };
  }

  public async syscall(name: string, params: any = {}) {
    const previousRing = this.currentRing;
    this.setRing(CPURing.RING_0);
    this.emitEvent('SYSCALL', `EXEC_SYSCALL: ${name}`);
    
    if (name === 'SYS_MALLOC') {
      this.memUsage = Math.min(128, this.memUsage + (params.size || 0));
      this.emitEvent('MEM', `ALLOC_PAGE_VM: ${(params.size || 0).toFixed(1)}MB`);
    } else if (name === 'SYS_FREE') {
      this.memUsage = Math.max(10, this.memUsage - (params.size || 0));
      this.emitEvent('MEM', `FREE_PAGE_VM: ${(params.size || 0).toFixed(1)}MB`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.setRing(previousRing);
    return { status: 'OK' };
  }

  public setOnPanic(callback: (reason: string) => void) {
    this.onPanicCallback = callback;
  }

  public onKernelUpdate(content: string): boolean {
    const hasMagic = content.includes('MAGIC: 0x56434F53');
    const hasEntry = content.includes('ENTRY: 0x00100000');
    const hasMain = content.includes('void kernel_main()');

    if (!hasMagic || !hasEntry || !hasMain) {
      this.isKernelCorrupted = true;
      this.emitEvent('CRITICAL', 'MICROKERNEL_INTEGRITY_FAILED');
      this.glitchLevel = 0.5;
      this.notify();
      
      setTimeout(() => {
        if (this.isKernelCorrupted) {
          this.glitchLevel = 1.0;
          this.notify();
          setTimeout(() => {
            if (this.isKernelCorrupted) {
              this.panic('MICROKERNEL_CORRUPTED: INVALID_ENTRY');
            }
          }, 1500);
        }
      }, 2000);
      return false;
    } else {
      this.isKernelCorrupted = false;
      this.glitchLevel = 0;
      this.emitEvent('SYSCALL', 'MICROKERNEL_RELOADED_SUCCESSFULLY');
      this.notify();
      return true;
    }
  }

  public panic(reason: string) {
    this.emitEvent('CRITICAL', `MICROKERNEL_PANIC: ${reason}`);
    if (this.onPanicCallback) {
      this.onPanicCallback(reason);
    }
  }

  public emitEvent(type: KernelEventType, message: string, vector?: number) {
    const newEvent: KernelEvent = {
      time: new Date().getTime().toString(16).slice(-6).toUpperCase(),
      type,
      message,
      vector,
      ring: this.currentRing
    };
    this.events = [...this.events.slice(-40), newEvent];
    this.notify();
  }

  public allocateMemory(mb: number) {
    if (this.currentRing !== CPURing.RING_0) {
      this.emitEvent('CRITICAL', `PRIVILEGE_VIOLATION: RING_${this.currentRing} ATTEMPTED MEM_ALLOC`);
      this.triggerInterrupt(0x0D, 'GP_FAULT: MEM_ALLOC_FROM_USERSPACE');
      return;
    }
    this.memUsage = Math.min(128, this.memUsage + mb);
    this.emitEvent('MEM', `ALLOC_PAGE_VM: ${mb.toFixed(1)}MB`);
    this.notify();
  }

  public freeMemory(mb: number) {
    if (this.currentRing !== CPURing.RING_0) {
      this.emitEvent('CRITICAL', `PRIVILEGE_VIOLATION: RING_${this.currentRing} ATTEMPTED MEM_FREE`);
      this.triggerInterrupt(0x0D, 'GP_FAULT: MEM_FREE_FROM_USERSPACE');
      return;
    }
    this.memUsage = Math.max(10, this.memUsage - mb);
    this.emitEvent('MEM', `FREE_PAGE_VM: ${mb.toFixed(1)}MB`);
    this.notify();
  }

  public executeTask(name: string, load: number) {
    this.emitEvent('TASK', `EXEC_SERVER: ${name}`);
    this.cpuLoad = [...this.cpuLoad.slice(1), Math.min(100, this.cpuLoad[this.cpuLoad.length - 1] + load)];
    this.notify();
  }

  private startMicrokernelLoop() {
    const messages = {
      IRQ: ['IRQ_0x20: TIMER_TICK (SCHED_RR)', 'IRQ_0x21: KBD_EVENT -> INPUT_SRV', 'IRQ_0x2E: DISK_IO -> VFS_SRV', 'IRQ_0x27: NET_INT -> NET_SRV'],
      IPC: ['IPC_SEND: VFS_SRV -> GUI_SRV (DATA)', 'IPC_RECV: NET_SRV <- PID_42', 'IPC_SYNC: GUI_SRV', 'IPC_FAULT: PID_100 -> INVALID_DEST'],
      MEM: [`PAGE_FAULT @ 0x${MemoryMap.IVT_START.toString(16).toUpperCase()} (VM_PAGER)`, `COW_FAULT @ 0x${MemoryMap.SPECTRUM_UI_BUFFER.toString(16).toUpperCase()}`],
      TASK: ['CTX_SWITCH: RING_0 -> RING_3 (GUI_SRV)', 'SPAWN_SERVER: NET_SRV', 'YIELD: VFS_SRV'],
      SERVER: ['SRV_REGISTER: AUDIO_SRV', 'SRV_HEARTBEAT: VFS_SRV (OK)', 'SRV_BLOCKED: NET_SRV (I/O)', 'DISPLAY: Enabling High-Density TUI Modes (CP437)'],
      ASM: ['MOV EAX, 0x01', 'SYSENTER', 'INT 0x80', `CALL 0x${MemoryMap.KERNEL_CORE_START.toString(16).toUpperCase()}`, 'IRET', 'GUI: Rasterizing Window Shadows']
    };

    this.interval = setInterval(() => {
      const currentLoad = this.cpuLoad[this.cpuLoad.length - 1];
      const targetLoad = 12;
      const drift = (targetLoad - currentLoad) * 0.1;
      const noise = (Math.random() - 0.5) * 15;
      this.cpuLoad = [...this.cpuLoad.slice(1), Math.max(0, Math.min(100, currentLoad + drift + noise))];
      
      const targetMem = 35;
      const memDrift = (targetMem - this.memUsage) * 0.1;
      const memNoise = (Math.random() - 0.5) * 2;
      this.memUsage = Math.max(10, Math.min(128, this.memUsage + memDrift + memNoise));

      if (Math.random() > 0.3) {
        const types: KernelEventType[] = ['IRQ', 'IPC', 'MEM', 'TASK', 'SERVER', 'ASM'];
        const type = types[Math.floor(Math.random() * types.length)];
        const msg = messages[type as keyof typeof messages][Math.floor(Math.random() * messages[type as keyof typeof messages].length)];
        this.emitEvent(type, msg);
      }
      
      // Periodically ping servers
      if (Math.random() > 0.8) {
         const srv = this.servers[Math.floor(Math.random() * this.servers.length)];
         srv.status = Math.random() > 0.5 ? 'ACTIVE' : 'WAITING_IPC';
      }

      this.registers = {
        ...this.registers,
        EAX: '0x' + Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0').toUpperCase(),
        EIP: '0x' + (parseInt(this.registers.EIP, 16) + Math.floor(Math.random() * 0x100)).toString(16).padStart(8, '0').toUpperCase(),
        ESP: '0x' + (parseInt(this.registers.ESP, 16) - (Math.random() > 0.5 ? 4 : -4)).toString(16).padStart(8, '0').toUpperCase()
      };

      this.notify();
    }, 800);
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }
}

export const kernel = new Microkernel();

