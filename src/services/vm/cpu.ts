import { CPUMode, CPURegisters, CPURingLevel, Instruction } from './types';

export class VirtualCPU {
  public registers: CPURegisters;
  public mode: CPUMode = CPUMode.PROTECTED_32;
  public ring: CPURingLevel = CPURingLevel.RING_0;

  // Clock and Execution state
  public isRunning: boolean = false;
  public clockFrequencyHz: number = 1000; // 1 kHz default
  public totalCycles: number = 0;
  public totalWaitCycles: number = 0;
  public busStallCycles: number = 0;
  public lastInstructionCycles: number = 1;
  public instructionsExecuted: number = 0;
  public breakpoints: Set<number> = new Set();
  
  // Artificial Latency & Throttling
  public enableInstructionCycleWeights: boolean = true;
  public cpuLoadThrottlingPct: number = 0; // 0% - 90%

  // Execution loop timer
  private timer: any = null;
  private listeners: Set<() => void> = new Set();

  // Stack Memory pointers
  public stackBase: number = 0x00090000;
  public stackTop: number = 0x0009FFFF;

  // External Bus Callbacks
  public readMem8!: (addr: number) => number;
  public writeMem8!: (addr: number, val: number) => void;
  public readIO8!: (port: number) => number;
  public writeIO8!: (port: number, val: number) => void;
  public triggerInterruptHandler?: (vector: number) => void;

  constructor() {
    this.registers = this.getInitialRegisters();
  }

  public getInitialRegisters(): CPURegisters {
    return {
      eax: 0x00000000,
      ebx: 0x00000000,
      ecx: 0x00000000,
      edx: 0x00000000,
      esi: 0x00000000,
      edi: 0x00000000,
      esp: 0x00000000,
      ebp: 0x00000000,
      eip: 0xFFFFFFF0, // x86 Reset Vector
      eflags: 0x00000002, // Reserved bit 1=1
      cs: 0xF000, // CS Base is secretly 0xFFFF0000 on real hardware, effectively starts at 0xFFFFFFF0
      ds: 0x0000,
      ss: 0x0000,
      es: 0x0000,
      fs: 0x0000,
      gs: 0x0000,
      cr0: 0x60000010, // CD=1, NW=1, ET=1
      cr2: 0x00000000,
      cr3: 0x00000000,
      cr4: 0x00000000
    };
  }

  public reset() {
    this.stop();
    this.registers = this.getInitialRegisters();
    this.mode = CPUMode.REAL_16;
    this.ring = CPURingLevel.RING_0;
    this.totalCycles = 0;
    this.totalWaitCycles = 0;
    this.busStallCycles = 0;
    this.lastInstructionCycles = 1;
    this.instructionsExecuted = 0;
    this.notify();
  }

  public getFlags() {
    const f = this.registers.eflags;
    const carry = !!(f & (1 << 0));
    const parity = !!(f & (1 << 2));
    const zero = !!(f & (1 << 6));
    const sign = !!(f & (1 << 7));
    const trap = !!(f & (1 << 8));
    const interrupt = !!(f & (1 << 9));
    const direction = !!(f & (1 << 10));
    const overflow = !!(f & (1 << 11));
    return {
      carry,
      cf: carry,
      parity,
      pf: parity,
      zero,
      zf: zero,
      sign,
      sf: sign,
      trap,
      tf: trap,
      interrupt,
      if: interrupt,
      direction,
      df: direction,
      overflow,
      of: overflow
    };
  }

  public setFlag(bit: number, val: boolean) {
    if (val) {
      this.registers.eflags |= (1 << bit);
    } else {
      this.registers.eflags &= ~(1 << bit);
    }
  }

  public addWaitCycles(cycles: number) {
    if (cycles <= 0) return;
    this.totalCycles += cycles;
    this.totalWaitCycles += cycles;
    this.busStallCycles += cycles;
    this.lastInstructionCycles += cycles;
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleExecution();
    this.notify();
  }

  public stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.notify();
  }

  public setFrequency(hz: number) {
    this.clockFrequencyHz = Math.max(1, Math.min(5000000, hz));
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  private scheduleExecution() {
    if (!this.isRunning) return;

    // Calculate throttle multiplier (0% - 90% load throttling delay)
    const throttleFactor = 1 + (this.cpuLoadThrottlingPct / 100) * 4;
    const baseIntervalMs = 20;
    const effectiveIntervalMs = Math.round(baseIntervalMs * throttleFactor);

    // Calculate batch size per tick based on frequency and throttling
    const baseInstructionsPerTick = (this.clockFrequencyHz * baseIntervalMs) / 1000;
    const instructionsPerTick = Math.max(1, Math.floor(baseInstructionsPerTick / (this.enableInstructionCycleWeights ? 3 : 1)));

    
    try {
      for (let i = 0; i < instructionsPerTick; i++) {
        if (!this.isRunning) break;
        this.step();
        
        if (this.breakpoints.has(this.registers.eip)) {
          this.stop();
          break;
        }
      }
    } catch (e: any) {
      this.stop();
      console.error("[CPU EXCEPTION in Execution Loop]: " + e.message);
      if (typeof window !== 'undefined' && (window as any).seaBios) {
         (window as any).seaBios.log(`[CPU HALTED] ${e.message}`, 'error');
         (window as any).seaBios.pause();
      }
      // Or we can just log to motherboard serial
    }


    if (this.isRunning) {
      this.timer = setTimeout(() => this.scheduleExecution(), effectiveIntervalMs);
    }
  }

  public readMem16(addr: number): number {
    return this.readMem8(addr) | (this.readMem8(addr + 1) << 8);
  }

  public writeMem16(addr: number, val: number) {
    this.writeMem8(addr, val & 0xFF);
    this.writeMem8(addr + 1, (val >> 8) & 0xFF);
  }

  public readMem32(addr: number): number {
    return (
      this.readMem8(addr) |
      (this.readMem8(addr + 1) << 8) |
      (this.readMem8(addr + 2) << 16) |
      ((this.readMem8(addr + 3) << 24) >>> 0)
    );
  }

  public writeMem32(addr: number, val: number) {
    this.writeMem8(addr, val & 0xFF);
    this.writeMem8(addr + 1, (val >> 8) & 0xFF);
    this.writeMem8(addr + 2, (val >> 16) & 0xFF);
    this.writeMem8(addr + 3, (val >> 24) & 0xFF);
  }

  public push32(val: number) {
    this.registers.esp = (this.registers.esp - 4) >>> 0;
    this.writeMem32(this.registers.esp, val);
  }

  public pop32(): number {
    const val = this.readMem32(this.registers.esp);
    this.registers.esp = (this.registers.esp + 4) >>> 0;
    return val;
  }

  // Update Zero and Sign flags based on 32-bit result
  private updateZeroSignFlags(val32: number) {
    const isZero = (val32 & 0xFFFFFFFF) === 0;
    const isSign = !!(val32 & 0x80000000);
    this.setFlag(6, isZero); // ZF
    this.setFlag(7, isSign); // SF
  }

  // Single step execution of one instruction with authentic cycle latency
  
  // ModR/M Decoder Helper
  public decodeModRM16(mod: number, rm: number, pc: number): { addr: number, length: number } {
    let addr = 0;
    let length = 0;
    
    if (mod === 0 && rm === 6) {
      addr = this.readMem16(pc);
      length = 2;
    } else {
      let base = 0;
      switch(rm) {
        case 0: base = (this.registers.ebx & 0xFFFF) + (this.registers.esi & 0xFFFF); break;
        case 1: base = (this.registers.ebx & 0xFFFF) + (this.registers.edi & 0xFFFF); break;
        case 2: base = (this.registers.ebp & 0xFFFF) + (this.registers.esi & 0xFFFF); break;
        case 3: base = (this.registers.ebp & 0xFFFF) + (this.registers.edi & 0xFFFF); break;
        case 4: base = this.registers.esi & 0xFFFF; break;
        case 5: base = this.registers.edi & 0xFFFF; break;
        case 6: base = this.registers.ebp & 0xFFFF; break;
        case 7: base = this.registers.ebx & 0xFFFF; break;
      }
      if (mod === 1) {
        let disp = this.readMem8(pc);
        if (disp & 0x80) disp |= 0xFFFFFF00; // Sign extend 8-bit
        addr = (base + disp) & 0xFFFF;
        length = 1;
      } else if (mod === 2) {
        let disp = this.readMem16(pc);
        addr = (base + disp) & 0xFFFF;
        length = 2;
      } else {
        addr = base & 0xFFFF;
        length = 0;
      }
    }
    return { addr, length };
  }

  
  public step(): boolean {
    let pc = this.registers.eip;
    
    // Instruction Prefixes
    let operandSize32 = (this.mode === CPUMode.PROTECTED_32);
    let addressSize32 = (this.mode === CPUMode.PROTECTED_32);
    let segmentOverride = -1; // Default segment based on RM/BP

    let opcode = this.readMem8(pc);
    let prefixesLength = 0;
    
    while (true) {
      if (opcode === 0x66) { operandSize32 = !operandSize32; }
      else if (opcode === 0x67) { addressSize32 = !addressSize32; }
      else if (opcode === 0x2E) { segmentOverride = this.registers.cs; }
      else if (opcode === 0x3E) { segmentOverride = this.registers.ds; }
      else if (opcode === 0x26) { segmentOverride = this.registers.es; }
      else if (opcode === 0x36) { segmentOverride = this.registers.ss; }
      // FS and GS not heavily tracked in our simple CPU right now
      else { break; }
      
      pc = (pc + 1) >>> 0;
      prefixesLength++;
      opcode = this.readMem8(pc);
    }

    let baseCycleCost = 1;
    this.instructionsExecuted += 1;

    switch (opcode) {
      case 0x83: { // Grp1 Ev, Ib (Arithmetic with 8-bit sign-extended immediate)
        const modrm = this.readMem8(pc + 1);
        const mod = (modrm >> 6) & 3;
        const regOp = (modrm >> 3) & 7;
        const rm = modrm & 7;
        
        let val1 = 0;
        let addr = 0;
        let instLen = 2; // opcode + modrm
        
        if (mod === 3) {
          // Register
          val1 = operandSize32 ? this.getRegByIndex(rm) : (this.getRegByIndex(rm) & 0xFFFF);
        } else {
          // Memory
          if (addressSize32) {
             throw new Error("32-bit ModRM addressing not implemented yet for 0x83");
          } else {
             const dec = this.decodeModRM16(mod, rm, pc + 2);
             instLen += dec.length;
             let seg = (segmentOverride !== -1) ? segmentOverride : this.registers.ds; // default DS (except BP which is SS)
             if (segmentOverride === -1 && (rm === 2 || rm === 3 || (mod !== 0 && rm === 6))) seg = this.registers.ss;
             addr = ((seg << 4) + dec.addr) >>> 0;
             val1 = operandSize32 ? (this.readMem16(addr) | (this.readMem16(addr+2)<<16)) : this.readMem16(addr);
          }
        }
        
        let imm8 = this.readMem8(pc + instLen);
        instLen += 1;
        if (imm8 & 0x80) imm8 |= 0xFFFFFF00; // sign extend
        
        let res = 0;
        if (regOp === 7) { // CMP
           res = (val1 - imm8) >>> 0;
           this.updateZeroSignFlags(res); // Needs proper CF/OF update, simplified here
        } else {
           throw new Error("Opcode 0x83 Sub-Op " + regOp + " not implemented");
        }
        
        this.registers.eip = (this.registers.eip + prefixesLength + instLen) >>> 0;
        break;
      }

      case 0xEA: { // JMP FAR ptr16:16
        const offset = this.readMem16(pc + 1);
        const segment = this.readMem16(pc + 3);
        this.registers.cs = segment;
        
        // In real mode, a far jump typically re-establishes the CS base.
        // For our simplified emulator, we'll just set EIP to the linear address.
        this.registers.eip = ((segment << 4) + offset) >>> 0;
        break;
      }

      case 0x90: // NOP
        baseCycleCost = 1;
        this.registers.eip = (pc + 1) >>> 0;
        break;

      case 0xF4: // HLT
        baseCycleCost = 1;
        this.stop();
        break;

      case 0xFA: // CLI
        baseCycleCost = 1;
        this.setFlag(9, false);
        this.registers.eip = (pc + 1) >>> 0;
        break;

      case 0xFB: // STI
        baseCycleCost = 1;
        this.setFlag(9, true);
        this.registers.eip = (pc + 1) >>> 0;
        break;

      case 0xF8: // CLC
        baseCycleCost = 1;
        this.setFlag(0, false);
        this.registers.eip = (pc + 1) >>> 0;
        break;

      case 0xF9: // STC
        baseCycleCost = 1;
        this.setFlag(0, true);
        this.registers.eip = (pc + 1) >>> 0;
        break;

      case 0xCD: { // INT imm8
        baseCycleCost = 25;
        const vector = this.readMem8(pc + 1);
        this.registers.eip = (pc + 2) >>> 0;
        this.handleInterrupt(vector);
        break;
      }

      case 0xCF: { // IRET
        baseCycleCost = 15;
        this.registers.eip = this.pop32();
        this.registers.cs = this.pop32() & 0xFFFF;
        this.registers.eflags = this.pop32();
        break;
      }

      case 0xE9: { // JMP rel32
        baseCycleCost = 3;
        const rel = this.readMem32(pc + 1);
        const signedRel = (rel << 0);
        this.registers.eip = (pc + 5 + signedRel) >>> 0;
        break;
      }

      case 0xEB: { // JMP rel8
        baseCycleCost = 2;
        const rel = this.readMem8(pc + 1);
        const signedRel = (rel << 24) >> 24;
        this.registers.eip = (pc + 2 + signedRel) >>> 0;
        break;
      }

      case 0x74: { // JZ / JE rel8
        baseCycleCost = this.getFlags().zero ? 3 : 1;
        const rel = this.readMem8(pc + 1);
        const signedRel = (rel << 24) >> 24;
        if (this.getFlags().zero) {
          this.registers.eip = (pc + 2 + signedRel) >>> 0;
        } else {
          this.registers.eip = (pc + 2) >>> 0;
        }
        break;
      }

      case 0x75: { // JNZ / JNE rel8
        baseCycleCost = !this.getFlags().zero ? 3 : 1;
        const rel = this.readMem8(pc + 1);
        const signedRel = (rel << 24) >> 24;
        if (!this.getFlags().zero) {
          this.registers.eip = (pc + 2 + signedRel) >>> 0;
        } else {
          this.registers.eip = (pc + 2) >>> 0;
        }
        break;
      }

      case 0x72: { // JC / JB rel8
        baseCycleCost = this.getFlags().carry ? 3 : 1;
        const rel = this.readMem8(pc + 1);
        const signedRel = (rel << 24) >> 24;
        if (this.getFlags().carry) {
          this.registers.eip = (pc + 2 + signedRel) >>> 0;
        } else {
          this.registers.eip = (pc + 2) >>> 0;
        }
        break;
      }

      case 0x73: { // JNC / JNB rel8
        baseCycleCost = !this.getFlags().carry ? 3 : 1;
        const rel = this.readMem8(pc + 1);
        const signedRel = (rel << 24) >> 24;
        if (!this.getFlags().carry) {
          this.registers.eip = (pc + 2 + signedRel) >>> 0;
        } else {
          this.registers.eip = (pc + 2) >>> 0;
        }
        break;
      }

      case 0xE8: { // CALL rel32
        baseCycleCost = 4;
        const rel = this.readMem32(pc + 1);
        const signedRel = (rel << 0);
        this.push32((pc + 5) >>> 0);
        this.registers.eip = (pc + 5 + signedRel) >>> 0;
        break;
      }

      case 0xC3: { // RET
        baseCycleCost = 4;
        this.registers.eip = this.pop32();
        break;
      }

      case 0xB8: case 0xB9: case 0xBA: case 0xBB: // MOV reg32, imm32
      case 0xBC: case 0xBD: case 0xBE: case 0xBF: {
        baseCycleCost = 1;
        const regIdx = opcode - 0xB8;
        const val = this.readMem32(pc + 1);
        this.setRegByIndex(regIdx, val);
        this.registers.eip = (pc + 5) >>> 0;
        break;
      }

      case 0x50: case 0x51: case 0x52: case 0x53: // PUSH reg32
      case 0x54: case 0x55: case 0x56: case 0x57: {
        baseCycleCost = 2;
        const regIdx = opcode - 0x50;
        this.push32(this.getRegByIndex(regIdx));
        this.registers.eip = (pc + 1) >>> 0;
        break;
      }

      case 0x58: case 0x59: case 0x5A: case 0x5B: // POP reg32
      case 0x5C: case 0x5D: case 0x5E: case 0x5F: {
        baseCycleCost = 2;
        const regIdx = opcode - 0x58;
        this.setRegByIndex(regIdx, this.pop32());
        this.registers.eip = (pc + 1) >>> 0;
        break;
      }

      case 0x40: case 0x41: case 0x42: case 0x43: // INC reg32
      case 0x44: case 0x45: case 0x46: case 0x47: {
        baseCycleCost = 1;
        const regIdx = opcode - 0x40;
        const res = (this.getRegByIndex(regIdx) + 1) >>> 0;
        this.setRegByIndex(regIdx, res);
        this.updateZeroSignFlags(res);
        this.registers.eip = (pc + 1) >>> 0;
        break;
      }

      case 0x48: case 0x49: case 0x4A: case 0x4B: // DEC reg32
      case 0x4C: case 0x4D: case 0x4E: case 0x4F: {
        baseCycleCost = 1;
        const regIdx = opcode - 0x48;
        const res = (this.getRegByIndex(regIdx) - 1) >>> 0;
        this.setRegByIndex(regIdx, res);
        this.updateZeroSignFlags(res);
        this.registers.eip = (pc + 1) >>> 0;
        break;
      }

      case 0x01: { // ADD reg32_dst (EAX), reg32_src (EBX)
        baseCycleCost = 1;
        const res = (this.registers.eax + this.registers.ebx) >>> 0;
        this.registers.eax = res;
        this.updateZeroSignFlags(res);
        this.registers.eip = (pc + 1) >>> 0;
        break;
      }

      case 0x29: { // SUB reg32_dst (EAX), reg32_src (EBX)
        baseCycleCost = 1;
        const res = (this.registers.eax - this.registers.ebx) >>> 0;
        this.registers.eax = res;
        this.updateZeroSignFlags(res);
        this.registers.eip = (pc + 1) >>> 0;
        break;
      }

      case 0x31: { // XOR reg32_dst (EAX), reg32_src (EAX/EBX)
        baseCycleCost = 1;
        const res = (this.registers.eax ^ this.registers.ebx) >>> 0;
        this.registers.eax = res;
        this.updateZeroSignFlags(res);
        this.registers.eip = (pc + 1) >>> 0;
        break;
      }

      case 0x21: { // AND EAX, EBX
        baseCycleCost = 1;
        const res = (this.registers.eax & this.registers.ebx) >>> 0;
        this.registers.eax = res;
        this.updateZeroSignFlags(res);
        this.registers.eip = (pc + 1) >>> 0;
        break;
      }

      case 0x09: { // OR EAX, EBX
        baseCycleCost = 1;
        const res = (this.registers.eax | this.registers.ebx) >>> 0;
        this.registers.eax = res;
        this.updateZeroSignFlags(res);
        this.registers.eip = (pc + 1) >>> 0;
        break;
      }

      case 0x39: { // CMP EAX, EBX
        baseCycleCost = 1;
        const diff = (this.registers.eax - this.registers.ebx) >>> 0;
        this.updateZeroSignFlags(diff);
        this.setFlag(0, this.registers.eax < this.registers.ebx); // Carry if borrow
        this.registers.eip = (pc + 1) >>> 0;
        break;
      }

      case 0xF7: { // MUL EBX (EAX = EAX * EBX)
        baseCycleCost = 10;
        const res = (this.registers.eax * this.registers.ebx) >>> 0;
        this.registers.eax = res;
        this.updateZeroSignFlags(res);
        this.registers.eip = (pc + 1) >>> 0;
        break;
      }

      case 0x89: { // MOV [EBX], EAX (Write to memory at address in EBX)
        baseCycleCost = 2;
        const targetAddr = this.registers.ebx;
        this.writeMem32(targetAddr, this.registers.eax);
        this.registers.eip = (pc + 1) >>> 0;
        break;
      }

      case 0x8B: { // MOV EAX, [EBX] (Read from memory at address in EBX)
        baseCycleCost = 2;
        const targetAddr = this.registers.ebx;
        this.registers.eax = this.readMem32(targetAddr);
        this.registers.eip = (pc + 1) >>> 0;
        break;
      }

      case 0xE4: { // IN AL, imm8 (I/O Port read)
        baseCycleCost = 12;
        const port = this.readMem8(pc + 1);
        const val = this.readIO8(port);
        this.registers.eax = ((this.registers.eax & 0xFFFFFF00) | (val & 0xFF)) >>> 0;
        this.registers.eip = (pc + 2) >>> 0;
        break;
      }

      case 0xE6: { // OUT imm8, AL (I/O Port write)
        baseCycleCost = 12;
        const port = this.readMem8(pc + 1);
        const val = this.registers.eax & 0xFF;
        this.writeIO8(port, val);
        this.registers.eip = (pc + 2) >>> 0;
        break;
      }

      case 0xED: { // IN EAX, DX
        baseCycleCost = 14;
        const port = this.registers.edx & 0xFFFF;
        const val = this.readIO8(port);
        this.registers.eax = val >>> 0;
        this.registers.eip = (pc + 1) >>> 0;
        break;
      }

      case 0xEF: { // OUT DX, EAX
        baseCycleCost = 14;
        const port = this.registers.edx & 0xFFFF;
        const val = this.registers.eax & 0xFF;
        this.writeIO8(port, val);
        this.registers.eip = (pc + 1) >>> 0;
        break;
      }

      case 0xAC: { // LODSB: Load byte at [ESI/SI] into AL
        baseCycleCost = 5;
        const srcAddr = (this.registers.ds << 4) + (this.registers.esi & 0xFFFF);
        const val = this.readMem8(srcAddr);
        this.registers.eax = (this.registers.eax & 0xFFFFFF00) | (val & 0xFF);
        const df = this.getFlags().direction;
        this.registers.esi = df ? ((this.registers.esi - 1) >>> 0) : ((this.registers.esi + 1) >>> 0);
        this.updateZeroSignFlags(val);
        this.registers.eip = (pc + 1) >>> 0;
        break;
      }

      case 0xAA: { // STOSB: Store AL at [ES:EDI/DI]
        baseCycleCost = 5;
        const dstAddr = (this.registers.es << 4) + (this.registers.edi & 0xFFFF);
        this.writeMem8(dstAddr, this.registers.eax & 0xFF);
        const df = this.getFlags().direction;
        this.registers.edi = df ? ((this.registers.edi - 1) >>> 0) : ((this.registers.edi + 1) >>> 0);
        this.registers.eip = (pc + 1) >>> 0;
        break;
      }

      case 0xA4: { // MOVSB: Move byte [DS:SI] to [ES:DI]
        baseCycleCost = 7;
        const s = (this.registers.ds << 4) + (this.registers.esi & 0xFFFF);
        const d = (this.registers.es << 4) + (this.registers.edi & 0xFFFF);
        this.writeMem8(d, this.readMem8(s));
        const df = this.getFlags().direction;
        this.registers.esi = df ? ((this.registers.esi - 1) >>> 0) : ((this.registers.esi + 1) >>> 0);
        this.registers.edi = df ? ((this.registers.edi - 1) >>> 0) : ((this.registers.edi + 1) >>> 0);
        this.registers.eip = (pc + 1) >>> 0;
        break;
      }

      case 0xFC: { // CLD (Clear Direction Flag)
        baseCycleCost = 2;
        this.setFlag(10, false); // DF = 0
        this.registers.eip = (pc + 1) >>> 0;
        break;
      }

      case 0xFD: { // STD (Set Direction Flag)
        baseCycleCost = 2;
        this.setFlag(10, true); // DF = 1
        this.registers.eip = (pc + 1) >>> 0;
        break;
      }

      case 0x60: { // PUSHA: Push all general purpose registers
        baseCycleCost = 18;
        const sp = this.registers.esp;
        this.push32(this.registers.eax);
        this.push32(this.registers.ecx);
        this.push32(this.registers.edx);
        this.push32(this.registers.ebx);
        this.push32(sp);
        this.push32(this.registers.ebp);
        this.push32(this.registers.esi);
        this.push32(this.registers.edi);
        this.registers.eip = (pc + 1) >>> 0;
        break;
      }

      case 0x61: { // POPA: Pop all general purpose registers
        baseCycleCost = 24;
        this.registers.edi = this.pop32();
        this.registers.esi = this.pop32();
        this.registers.ebp = this.pop32();
        this.pop32(); // discard SP
        this.registers.ebx = this.pop32();
        this.registers.edx = this.pop32();
        this.registers.ecx = this.pop32();
        this.registers.eax = this.pop32();
        this.registers.eip = (pc + 1) >>> 0;
        break;
      }

      case 0xE2: { // LOOP rel8 (ECX--)
        baseCycleCost = 3;
        this.registers.ecx = (this.registers.ecx - 1) >>> 0;
        const rel = this.readMem8(pc + 1);
        const signedRel = (rel << 24) >> 24;
        if (this.registers.ecx !== 0) {
          this.registers.eip = (pc + 2 + signedRel) >>> 0;
        } else {
          this.registers.eip = (pc + 2) >>> 0;
        }
        break;
      }

      case 0x78: { // JS rel8 (Jump if sign)
        baseCycleCost = 2;
        const rel = this.readMem8(pc + 1);
        const signedRel = (rel << 24) >> 24;
        if (this.getFlags().sign) {
          this.registers.eip = (pc + 2 + signedRel) >>> 0;
        } else {
          this.registers.eip = (pc + 2) >>> 0;
        }
        break;
      }

      case 0x79: { // JNS rel8 (Jump if not sign)
        baseCycleCost = 2;
        const rel = this.readMem8(pc + 1);
        const signedRel = (rel << 24) >> 24;
        if (!this.getFlags().sign) {
          this.registers.eip = (pc + 2 + signedRel) >>> 0;
        } else {
          this.registers.eip = (pc + 2) >>> 0;
        }
        break;
      }

      case 0x3C: { // CMP AL, imm8
        baseCycleCost = 1;
        const val = this.readMem8(pc + 1);
        const al = this.registers.eax & 0xFF;
        const diff = (al - val) & 0xFF;
        this.setFlag(6, diff === 0); // ZF
        this.setFlag(7, (diff & 0x80) !== 0); // SF
        this.setFlag(0, al < val); // CF
        this.registers.eip = (pc + 2) >>> 0;
        break;
      }

      case 0x05: { // ADD EAX, imm32
        baseCycleCost = 1;
        const imm = this.readMem32(pc + 1);
        this.registers.eax = (this.registers.eax + imm) >>> 0;
        this.updateZeroSignFlags(this.registers.eax);
        this.registers.eip = (pc + 5) >>> 0;
        break;
      }

      case 0x2D: { // SUB EAX, imm32
        baseCycleCost = 1;
        const imm = this.readMem32(pc + 1);
        this.registers.eax = (this.registers.eax - imm) >>> 0;
        this.updateZeroSignFlags(this.registers.eax);
        this.registers.eip = (pc + 5) >>> 0;
        break;
      }

      // 8-bit MOV reg8, imm8 (0xB0 .. 0xB7)
      case 0xB0: case 0xB1: case 0xB2: case 0xB3:
      case 0xB4: case 0xB5: case 0xB6: case 0xB7: {
        baseCycleCost = 1;
        const regIdx = opcode - 0xB0;
        const val = this.readMem8(pc + 1);
        if (regIdx < 4) { // AL, CL, DL, BL
          const shift = 0;
          const mask = 0xFF;
          if (regIdx === 0) this.registers.eax = (this.registers.eax & ~mask) | (val << shift);
          if (regIdx === 1) this.registers.ecx = (this.registers.ecx & ~mask) | (val << shift);
          if (regIdx === 2) this.registers.edx = (this.registers.edx & ~mask) | (val << shift);
          if (regIdx === 3) this.registers.ebx = (this.registers.ebx & ~mask) | (val << shift);
        } else { // AH, CH, DH, BH
          const shift = 8;
          const mask = 0xFF00;
          if (regIdx === 4) this.registers.eax = (this.registers.eax & ~mask) | (val << shift);
          if (regIdx === 5) this.registers.ecx = (this.registers.ecx & ~mask) | (val << shift);
          if (regIdx === 6) this.registers.edx = (this.registers.edx & ~mask) | (val << shift);
          if (regIdx === 7) this.registers.ebx = (this.registers.ebx & ~mask) | (val << shift);
        }
        this.registers.eip = (pc + 2) >>> 0;
        break;
      }

      case 0x8E: { // MOV SegReg, Reg
        baseCycleCost = 2;
        const modrm = this.readMem8(pc + 1);
        const segIdx = (modrm >> 3) & 0x07;
        const regIdx = modrm & 0x07;
        const val = this.getRegByIndex(regIdx) & 0xFFFF;
        if (segIdx === 0) this.registers.es = val;
        if (segIdx === 1) this.registers.cs = val;
        if (segIdx === 2) this.registers.ss = val;
        if (segIdx === 3) this.registers.ds = val;
        this.registers.eip = (pc + 2) >>> 0;
        break;
      }

      case 0x8C: { // MOV Reg, SegReg
        baseCycleCost = 2;
        const modrm = this.readMem8(pc + 1);
        const segIdx = (modrm >> 3) & 0x07;
        const regIdx = modrm & 0x07;
        let val = 0;
        if (segIdx === 0) val = this.registers.es;
        if (segIdx === 1) val = this.registers.cs;
        if (segIdx === 2) val = this.registers.ss;
        if (segIdx === 3) val = this.registers.ds;
        this.setRegByIndex(regIdx, val);
        this.registers.eip = (pc + 2) >>> 0;
        break;
      }

      
      default:
        const hexOp = opcode.toString(16).padStart(2, '0').toUpperCase();
        const hexEip = this.registers.eip.toString(16).padStart(8, '0').toUpperCase();
        throw new Error(`Unimplemented CPU Opcode 0x${hexOp} at EIP=0x${hexEip}`);


    }

    const effectiveCycles = this.enableInstructionCycleWeights ? baseCycleCost : 1;
    this.totalCycles += effectiveCycles;
    this.lastInstructionCycles = effectiveCycles;

    this.notify();
    return true;
  }

  public handleInterrupt(vector: number) {
    if (this.triggerInterruptHandler) {
      this.triggerInterruptHandler(vector);
    }
  }

  public getRegByIndex(idx: number): number {
    switch (idx) {
      case 0: return this.registers.eax;
      case 1: return this.registers.ecx;
      case 2: return this.registers.edx;
      case 3: return this.registers.ebx;
      case 4: return this.registers.esp;
      case 5: return this.registers.ebp;
      case 6: return this.registers.esi;
      case 7: return this.registers.edi;
      default: return 0;
    }
  }

  public setRegByIndex(idx: number, val: number) {
    const val32 = val >>> 0;
    switch (idx) {
      case 0: this.registers.eax = val32; break;
      case 1: this.registers.ecx = val32; break;
      case 2: this.registers.edx = val32; break;
      case 3: this.registers.ebx = val32; break;
      case 4: this.registers.esp = val32; break;
      case 5: this.registers.ebp = val32; break;
      case 6: this.registers.esi = val32; break;
      case 7: this.registers.edi = val32; break;
    }
  }

  // Built-in Assembler: Converts simple assembly text into machine code in VM RAM
  public assembleAndLoad(source: string, loadAddress: number = 0x00100000): { success: boolean, byteCount: number, error?: string } {
    try {
      const lines = source.split('\n');
      const machineCode: number[] = [];
      const labels: Record<string, number> = {};
      const pendingJumps: { index: number, target: string, type: 'rel8' | 'rel32' }[] = [];

      let currentAddr = loadAddress;

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (line.includes(';')) line = line.split(';')[0].trim();
        if (line.includes('#')) line = line.split('#')[0].trim();
        if (!line) continue;

        if (line.endsWith(':')) {
          const labelName = line.slice(0, -1).trim();
          labels[labelName] = currentAddr;
          continue;
        }

        const parts = line.split(/\s+/);
        const mnemonic = parts[0].toUpperCase();
        const argsStr = line.substring(parts[0].length).trim();
        const args = argsStr ? argsStr.split(',').map(a => a.trim()) : [];

        switch (mnemonic) {
          case 'NOP':
            machineCode.push(0x90);
            currentAddr += 1;
            break;

          case 'HLT':
            machineCode.push(0xF4);
            currentAddr += 1;
            break;

          case 'CLI':
            machineCode.push(0xFA);
            currentAddr += 1;
            break;

          case 'STI':
            machineCode.push(0xFB);
            currentAddr += 1;
            break;

          case 'CLC':
            machineCode.push(0xF8);
            currentAddr += 1;
            break;

          case 'STC':
            machineCode.push(0xF9);
            currentAddr += 1;
            break;

          case 'RET':
            machineCode.push(0xC3);
            currentAddr += 1;
            break;

          case 'IRET':
            machineCode.push(0xCF);
            currentAddr += 1;
            break;

          case 'INT': {
            const vec = parseInt(args[0], 16) || parseInt(args[0], 10) || 0x80;
            machineCode.push(0xCD, vec & 0xFF);
            currentAddr += 2;
            break;
          }

          case 'MOV': {
            const regMap: Record<string, number> = {
              'EAX': 0, 'ECX': 1, 'EDX': 2, 'EBX': 3,
              'ESP': 4, 'EBP': 5, 'ESI': 6, 'EDI': 7
            };
            const dst = args[0]?.toUpperCase();
            const src = args[1]?.toUpperCase();

            if (dst === '[EBX]' && src === 'EAX') {
              machineCode.push(0x89);
              currentAddr += 1;
            } else if (dst === 'EAX' && src === '[EBX]') {
              machineCode.push(0x8B);
              currentAddr += 1;
            } else if (dst in regMap) {
              const regIdx = regMap[dst];
              const val = this.parseImmOrValue(args[1], labels);
              machineCode.push(0xB8 + regIdx, val & 0xFF, (val >> 8) & 0xFF, (val >> 16) & 0xFF, (val >> 24) & 0xFF);
              currentAddr += 5;
            }
            break;
          }

          case 'ADD': {
            machineCode.push(0x01);
            currentAddr += 1;
            break;
          }

          case 'SUB': {
            machineCode.push(0x29);
            currentAddr += 1;
            break;
          }

          case 'XOR': {
            machineCode.push(0x31);
            currentAddr += 1;
            break;
          }

          case 'AND': {
            machineCode.push(0x21);
            currentAddr += 1;
            break;
          }

          case 'OR': {
            machineCode.push(0x09);
            currentAddr += 1;
            break;
          }

          case 'CMP': {
            machineCode.push(0x39);
            currentAddr += 1;
            break;
          }

          case 'MUL': {
            machineCode.push(0xF7);
            currentAddr += 1;
            break;
          }

          case 'INC': {
            const regMap: Record<string, number> = {
              'EAX': 0, 'ECX': 1, 'EDX': 2, 'EBX': 3,
              'ESP': 4, 'EBP': 5, 'ESI': 6, 'EDI': 7
            };
            const reg = args[0]?.toUpperCase();
            if (reg in regMap) {
              machineCode.push(0x40 + regMap[reg]);
              currentAddr += 1;
            }
            break;
          }

          case 'DEC': {
            const regMap: Record<string, number> = {
              'EAX': 0, 'ECX': 1, 'EDX': 2, 'EBX': 3,
              'ESP': 4, 'EBP': 5, 'ESI': 6, 'EDI': 7
            };
            const reg = args[0]?.toUpperCase();
            if (reg in regMap) {
              machineCode.push(0x48 + regMap[reg]);
              currentAddr += 1;
            }
            break;
          }

          case 'PUSH': {
            const regMap: Record<string, number> = {
              'EAX': 0, 'ECX': 1, 'EDX': 2, 'EBX': 3,
              'ESP': 4, 'EBP': 5, 'ESI': 6, 'EDI': 7
            };
            const reg = args[0]?.toUpperCase();
            if (reg in regMap) {
              machineCode.push(0x50 + regMap[reg]);
              currentAddr += 1;
            }
            break;
          }

          case 'POP': {
            const regMap: Record<string, number> = {
              'EAX': 0, 'ECX': 1, 'EDX': 2, 'EBX': 3,
              'ESP': 4, 'EBP': 5, 'ESI': 6, 'EDI': 7
            };
            const reg = args[0]?.toUpperCase();
            if (reg in regMap) {
              machineCode.push(0x58 + regMap[reg]);
              currentAddr += 1;
            }
            break;
          }

          case 'IN': {
            if (args[1]?.toUpperCase() === 'DX') {
              machineCode.push(0xED);
              currentAddr += 1;
            } else {
              const port = this.parseImmOrValue(args[1], labels);
              machineCode.push(0xE4, port & 0xFF);
              currentAddr += 2;
            }
            break;
          }

          case 'OUT': {
            if (args[0]?.toUpperCase() === 'DX') {
              machineCode.push(0xEF);
              currentAddr += 1;
            } else {
              const port = this.parseImmOrValue(args[0], labels);
              machineCode.push(0xE6, port & 0xFF);
              currentAddr += 2;
            }
            break;
          }

          case 'JMP': {
            const target = args[0];
            machineCode.push(0xEB, 0x00);
            pendingJumps.push({ index: machineCode.length - 1, target, type: 'rel8' });
            currentAddr += 2;
            break;
          }

          case 'JZ': case 'JE': {
            const target = args[0];
            machineCode.push(0x74, 0x00);
            pendingJumps.push({ index: machineCode.length - 1, target, type: 'rel8' });
            currentAddr += 2;
            break;
          }

          case 'JNZ': case 'JNE': {
            const target = args[0];
            machineCode.push(0x75, 0x00);
            pendingJumps.push({ index: machineCode.length - 1, target, type: 'rel8' });
            currentAddr += 2;
            break;
          }

          case 'JC': case 'JB': {
            const target = args[0];
            machineCode.push(0x72, 0x00);
            pendingJumps.push({ index: machineCode.length - 1, target, type: 'rel8' });
            currentAddr += 2;
            break;
          }

          case 'JNC': case 'JNB': {
            const target = args[0];
            machineCode.push(0x73, 0x00);
            pendingJumps.push({ index: machineCode.length - 1, target, type: 'rel8' });
            currentAddr += 2;
            break;
          }

          case 'DB': {
            args.forEach(arg => {
              if (arg.startsWith('"') && arg.endsWith('"')) {
                const str = arg.slice(1, -1);
                for (let c = 0; c < str.length; c++) {
                  machineCode.push(str.charCodeAt(c));
                  currentAddr++;
                }
              } else {
                const val = this.parseImmOrValue(arg, labels);
                machineCode.push(val & 0xFF);
                currentAddr++;
              }
            });
            break;
          }

          default:
            machineCode.push(0x90);
            currentAddr += 1;
            break;
        }
      }

      // Second pass: resolve jumps
      pendingJumps.forEach(pj => {
        const targetAddr = labels[pj.target] ?? (this.parseImmOrValue(pj.target, labels));
        const instrEndAddr = loadAddress + pj.index + 1;
        const rel = (targetAddr - instrEndAddr) & 0xFF;
        machineCode[pj.index] = rel;
      });

      for (let i = 0; i < machineCode.length; i++) {
        this.writeMem8(loadAddress + i, machineCode[i]);
      }

      this.registers.eip = loadAddress;
      this.notify();
      return { success: true, byteCount: machineCode.length };
    } catch (e: any) {
      return { success: false, byteCount: 0, error: e.message };
    }
  }

  private parseImmOrValue(valStr: string, labels: Record<string, number>): number {
    if (!valStr) return 0;
    if (valStr in labels) return labels[valStr];
    if (valStr.startsWith('0x') || valStr.startsWith('0X')) {
      return parseInt(valStr, 16) || 0;
    }
    if (valStr.endsWith('h') || valStr.endsWith('H')) {
      return parseInt(valStr.slice(0, -1), 16) || 0;
    }
    return parseInt(valStr, 10) || 0;
  }

  // Disassemble memory starting at given address
  public disassemble(startAddr: number, count: number = 10): Instruction[] {
    const list: Instruction[] = [];
    let pc = startAddr;

    for (let i = 0; i < count; i++) {
      const addr = pc;
      const op = this.readMem8(pc);
      let mnemonic = 'NOP';
      let operands = '';
      let bytes = [op];

      switch (op) {
        case 0x90:
          mnemonic = 'NOP';
          pc += 1;
          break;
        case 0xF4:
          mnemonic = 'HLT';
          pc += 1;
          break;
        case 0xFA:
          mnemonic = 'CLI';
          pc += 1;
          break;
        case 0xFB:
          mnemonic = 'STI';
          pc += 1;
          break;
        case 0xF8:
          mnemonic = 'CLC';
          pc += 1;
          break;
        case 0xF9:
          mnemonic = 'STC';
          pc += 1;
          break;
        case 0xC3:
          mnemonic = 'RET';
          pc += 1;
          break;
        case 0xCF:
          mnemonic = 'IRET';
          pc += 1;
          break;
        case 0x01:
          mnemonic = 'ADD';
          operands = 'EAX, EBX';
          pc += 1;
          break;
        case 0x29:
          mnemonic = 'SUB';
          operands = 'EAX, EBX';
          pc += 1;
          break;
        case 0x31:
          mnemonic = 'XOR';
          operands = 'EAX, EBX';
          pc += 1;
          break;
        case 0x21:
          mnemonic = 'AND';
          operands = 'EAX, EBX';
          pc += 1;
          break;
        case 0x09:
          mnemonic = 'OR';
          operands = 'EAX, EBX';
          pc += 1;
          break;
        case 0x39:
          mnemonic = 'CMP';
          operands = 'EAX, EBX';
          pc += 1;
          break;
        case 0xF7:
          mnemonic = 'MUL';
          operands = 'EBX';
          pc += 1;
          break;
        case 0x89:
          mnemonic = 'MOV';
          operands = '[EBX], EAX';
          pc += 1;
          break;
        case 0x8B:
          mnemonic = 'MOV';
          operands = 'EAX, [EBX]';
          pc += 1;
          break;
        case 0xCD: {
          const vec = this.readMem8(pc + 1);
          bytes.push(vec);
          mnemonic = 'INT';
          operands = `0x${vec.toString(16).toUpperCase()}`;
          pc += 2;
          break;
        }
        case 0xEB: {
          const rel = this.readMem8(pc + 1);
          bytes.push(rel);
          const signedRel = (rel << 24) >> 24;
          mnemonic = 'JMP';
          operands = `0x${((pc + 2 + signedRel) >>> 0).toString(16).toUpperCase()}`;
          pc += 2;
          break;
        }
        case 0x74: {
          const rel = this.readMem8(pc + 1);
          bytes.push(rel);
          const signedRel = (rel << 24) >> 24;
          mnemonic = 'JZ';
          operands = `0x${((pc + 2 + signedRel) >>> 0).toString(16).toUpperCase()}`;
          pc += 2;
          break;
        }
        case 0x75: {
          const rel = this.readMem8(pc + 1);
          bytes.push(rel);
          const signedRel = (rel << 24) >> 24;
          mnemonic = 'JNZ';
          operands = `0x${((pc + 2 + signedRel) >>> 0).toString(16).toUpperCase()}`;
          pc += 2;
          break;
        }
        case 0x72: {
          const rel = this.readMem8(pc + 1);
          bytes.push(rel);
          const signedRel = (rel << 24) >> 24;
          mnemonic = 'JC';
          operands = `0x${((pc + 2 + signedRel) >>> 0).toString(16).toUpperCase()}`;
          pc += 2;
          break;
        }
        case 0x73: {
          const rel = this.readMem8(pc + 1);
          bytes.push(rel);
          const signedRel = (rel << 24) >> 24;
          mnemonic = 'JNC';
          operands = `0x${((pc + 2 + signedRel) >>> 0).toString(16).toUpperCase()}`;
          pc += 2;
          break;
        }
        case 0xE4: {
          const port = this.readMem8(pc + 1);
          bytes.push(port);
          mnemonic = 'IN';
          operands = `AL, 0x${port.toString(16).toUpperCase()}`;
          pc += 2;
          break;
        }
        case 0xE6: {
          const port = this.readMem8(pc + 1);
          bytes.push(port);
          mnemonic = 'OUT';
          operands = `0x${port.toString(16).toUpperCase()}, AL`;
          pc += 2;
          break;
        }
        case 0xED: {
          mnemonic = 'IN';
          operands = 'EAX, DX';
          pc += 1;
          break;
        }
        case 0xEF: {
          mnemonic = 'OUT';
          operands = 'DX, EAX';
          pc += 1;
          break;
        }
        default:
          if (op >= 0xB8 && op <= 0xBF) {
            const regNames = ['EAX', 'ECX', 'EDX', 'EBX', 'ESP', 'EBP', 'ESI', 'EDI'];
            const val = this.readMem32(pc + 1);
            bytes.push(
              this.readMem8(pc + 1),
              this.readMem8(pc + 2),
              this.readMem8(pc + 3),
              this.readMem8(pc + 4)
            );
            mnemonic = 'MOV';
            operands = `${regNames[op - 0xB8]}, 0x${val.toString(16).toUpperCase()}`;
            pc += 5;
          } else if (op >= 0x40 && op <= 0x47) {
            const regNames = ['EAX', 'ECX', 'EDX', 'EBX', 'ESP', 'EBP', 'ESI', 'EDI'];
            mnemonic = 'INC';
            operands = regNames[op - 0x40];
            pc += 1;
          } else if (op >= 0x48 && op <= 0x4F) {
            const regNames = ['EAX', 'ECX', 'EDX', 'EBX', 'ESP', 'EBP', 'ESI', 'EDI'];
            mnemonic = 'DEC';
            operands = regNames[op - 0x48];
            pc += 1;
          } else if (op >= 0x50 && op <= 0x57) {
            const regNames = ['EAX', 'ECX', 'EDX', 'EBX', 'ESP', 'EBP', 'ESI', 'EDI'];
            mnemonic = 'PUSH';
            operands = regNames[op - 0x50];
            pc += 1;
          } else if (op >= 0x58 && op <= 0x5F) {
            const regNames = ['EAX', 'ECX', 'EDX', 'EBX', 'ESP', 'EBP', 'ESI', 'EDI'];
            mnemonic = 'POP';
            operands = regNames[op - 0x58];
            pc += 1;
          } else {
            mnemonic = `DB 0x${op.toString(16).padStart(2, '0').toUpperCase()}`;
            pc += 1;
          }
          break;
      }

      list.push({
        address: addr,
        bytes,
        mnemonic,
        operands
      });
    }

    return list;
  }

  public subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }
}
