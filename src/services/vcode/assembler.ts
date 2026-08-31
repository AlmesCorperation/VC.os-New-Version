export interface AssembleResult {
  success: boolean;
  bytes: Uint8Array;
  hexListing: string[];
  lineMap: { line: number; address: number; bytes: number[]; text: string }[];
  labels: Record<string, number>;
  errors: { line: number; message: string }[];
  warnings: { line: number; message: string }[];
  origin: number;
  bootSectorValid: boolean;
  bootSignaturePresent: boolean;
  sectorBytesCount: number;
  arch: 'VCA-16' | 'VCA-32' | 'VCA-HYBRID';
}

export class VCodeAssembler {
  // 32-bit Registers & VC.os General Purpose aliases (R0-R7)
  private static REG_32: Record<string, number> = {
    EAX: 0, ECX: 1, EDX: 2, EBX: 3, ESP: 4, EBP: 5, ESI: 6, EDI: 7,
    R0: 0, R1: 1, R2: 2, R3: 3, R4: 4, R5: 5, R6: 6, R7: 7
  };

  // 16-bit Registers & VC.os Word aliases (R0W-R7W)
  private static REG_16: Record<string, number> = {
    AX: 0, CX: 1, DX: 2, BX: 3, SP: 4, BP: 5, SI: 6, DI: 7,
    R0W: 0, R1W: 1, R2W: 2, R3W: 3, R4W: 4, R5W: 5, R6W: 6, R7W: 7
  };

  // 8-bit Low Registers & VC.os Byte aliases (R0B-R3B)
  private static REG_8_LOW: Record<string, number> = {
    AL: 0, CL: 1, DL: 2, BL: 3,
    R0B: 0, R1B: 1, R2B: 2, R3B: 3
  };

  // 8-bit High Registers & VC.os Byte High aliases (R4B-R7B)
  private static REG_8_HIGH: Record<string, number> = {
    AH: 4, CH: 5, DH: 6, BH: 7,
    R4B: 4, R5B: 5, R6B: 6, R7B: 7
  };

  // Segment Registers
  private static SEG_REGS: Record<string, number> = {
    ES: 0, CS: 1, SS: 2, DS: 3, FS: 4, GS: 5
  };

  // Built-in VC.os Hardware Constants
  public static readonly VCOS_HARDWARE_CONSTANTS: Record<string, number> = {
    VRAM_VGA: 0x000A0000,
    VRAM_TEXT: 0x000B8000,
    PORT_PIT_DATA: 0x42,
    PORT_PIT_CMD: 0x43,
    PORT_KBD_DATA: 0x60,
    PORT_KBD_CMD: 0x64,
    PORT_RTC_ADDR: 0x70,
    PORT_RTC_DATA: 0x71,
    PORT_NIC_BASE: 0x300,
    PORT_SB_DSP: 0x388,
    PORT_VGA_PAL: 0x3C8,
    PORT_VGA_DATA: 0x3C9,
    PORT_SERIAL: 0x3F8,
    INT_VIDEO: 0x10,
    INT_DISK: 0x13,
    INT_KBD: 0x16,
    INT_VCOS_SYS: 0x20,
    INT_DOS_API: 0x21
  };

  public static assemble(source: string, defaultOrigin: number = 0x7C00): AssembleResult {
    const lines = source.split('\n');
    const errors: { line: number; message: string }[] = [];
    const warnings: { line: number; message: string }[] = [];
    const labels: Record<string, number> = {};
    const constants: Record<string, number> = { ...this.VCOS_HARDWARE_CONSTANTS };
    let origin = defaultOrigin;
    let is16Bit = true;
    let explicitArch: 'VCA-16' | 'VCA-32' | 'VCA-HYBRID' = 'VCA-16';

    // Structure for intermediate representation
    interface ParsedLine {
      rawLineIndex: number;
      text: string;
      label?: string;
      mnemonic?: string;
      args: string[];
      address: number;
      estimatedSize: number;
      emittedBytes?: number[];
    }

    const intermediate: ParsedLine[] = [];

    // --- PASS 1: Parse structure, collect labels, estimate byte offsets ---
    let currentAddress = origin;

    for (let i = 0; i < lines.length; i++) {
      let rawText = lines[i];
      let clean = rawText;
      // Strip comments
      if (clean.includes(';')) clean = clean.split(';')[0];
      if (clean.includes('#')) clean = clean.split('#')[0];
      clean = clean.trim();

      if (!clean) {
        intermediate.push({
          rawLineIndex: i + 1,
          text: rawText,
          args: [],
          address: currentAddress,
          estimatedSize: 0,
          emittedBytes: []
        });
        continue;
      }

      // Check directives like ORG, [BITS 16], [BITS 32], [ARCH VCA-16], [ARCH VCA-32]
      const upperClean = clean.toUpperCase();
      if (upperClean.startsWith('[BITS 16]') || upperClean.startsWith('BITS 16') || upperClean.startsWith('[ARCH VCA16]') || upperClean.startsWith('[ARCH VCA-16]')) {
        is16Bit = true;
        explicitArch = 'VCA-16';
        continue;
      }
      if (upperClean.startsWith('[BITS 32]') || upperClean.startsWith('BITS 32') || upperClean.startsWith('[ARCH VCA32]') || upperClean.startsWith('[ARCH VCA-32]')) {
        is16Bit = false;
        explicitArch = 'VCA-32';
        continue;
      }
      if (upperClean.startsWith('[ARCH HYBRID]') || upperClean.startsWith('ARCH HYBRID') || upperClean.startsWith('[VCOS_ARCH 16_32]')) {
        is16Bit = true;
        explicitArch = 'VCA-HYBRID';
        continue;
      }
      if (upperClean.startsWith('ORG ')) {
        const orgStr = clean.substring(4).trim();
        origin = this.evaluateSimpleExpr(orgStr, constants, currentAddress, origin);
        currentAddress = origin;
        continue;
      }
      if (upperClean.startsWith('SECTION ') || upperClean.startsWith('GLOBAL ') || upperClean.startsWith('EXTERN ') || upperClean.startsWith('[VCOS_ASM]')) {
        continue;
      }

      // Check EQU
      if (clean.includes(' EQU ') || clean.includes(' equ ')) {
        const parts = clean.split(/\s+EQU\s+|\s+equ\s+/i);
        if (parts.length === 2) {
          const name = parts[0].trim();
          const val = this.evaluateSimpleExpr(parts[1].trim(), constants, currentAddress, origin);
          constants[name] = val;
          labels[name] = val;
          continue;
        }
      }

      // Check label definition
      let labelName: string | undefined;
      let rest = clean;

      if (clean.includes(':')) {
        const colonIdx = clean.indexOf(':');
        labelName = clean.substring(0, colonIdx).trim();
        labels[labelName] = currentAddress;
        rest = clean.substring(colonIdx + 1).trim();
      } else if (!clean.includes(' ') && !clean.includes('\t') && !clean.includes(',')) {
        // Standalone word might be a label without colon if not an opcode
        const word = clean.toUpperCase();
        if (!this.isOpcode(word)) {
          labelName = clean;
          labels[labelName] = currentAddress;
          rest = '';
        }
      }

      if (!rest) {
        intermediate.push({
          rawLineIndex: i + 1,
          text: rawText,
          label: labelName,
          args: [],
          address: currentAddress,
          estimatedSize: 0,
          emittedBytes: []
        });
        continue;
      }

      // Parse mnemonic and arguments
      const spaceIdx = rest.search(/\s/);
      let mnemonic = '';
      let argsStr = '';
      if (spaceIdx === -1) {
        mnemonic = rest.toUpperCase();
        argsStr = '';
      } else {
        mnemonic = rest.substring(0, spaceIdx).trim().toUpperCase();
        argsStr = rest.substring(spaceIdx).trim();
      }

      const args = this.splitArgs(argsStr);

      // Estimate byte length
      const estSize = this.estimateInstructionSize(mnemonic, args, currentAddress, origin, labels);

      intermediate.push({
        rawLineIndex: i + 1,
        text: rawText,
        label: labelName,
        mnemonic,
        args,
        address: currentAddress,
        estimatedSize: estSize
      });

      currentAddress += estSize;
    }

    // --- PASS 2: Encode machine code bytes with resolved labels ---
    const allBytes: number[] = [];
    const lineMap: { line: number; address: number; bytes: number[]; text: string }[] = [];
    const hexListing: string[] = [];
    currentAddress = origin;

    for (const item of intermediate) {
      if (!item.mnemonic) {
        lineMap.push({
          line: item.rawLineIndex,
          address: currentAddress,
          bytes: [],
          text: item.text
        });
        continue;
      }

      item.address = currentAddress;
      if (item.label) {
        labels[item.label] = currentAddress;
      }

      try {
        const bytes = this.encodeInstruction(
          item.mnemonic,
          item.args,
          currentAddress,
          origin,
          labels,
          constants,
          is16Bit
        );

        item.emittedBytes = bytes;
        for (const b of bytes) {
          allBytes.push(b & 0xFF);
        }

        const hexStr = bytes.map(b => (b & 0xFF).toString(16).padStart(2, '0').toUpperCase()).join(' ');
        const addrStr = currentAddress.toString(16).padStart(4, '0').toUpperCase();
        hexListing.push(`0x${addrStr}: ${hexStr.padEnd(20, ' ')} | ${item.text}`);

        lineMap.push({
          line: item.rawLineIndex,
          address: currentAddress,
          bytes: bytes,
          text: item.text
        });

        currentAddress += bytes.length;
      } catch (err: any) {
        errors.push({
          line: item.rawLineIndex,
          message: err.message || `Syntax error in instruction '${item.mnemonic}'`
        });
      }
    }

    const outputBytes = new Uint8Array(allBytes);
    const sectorBytesCount = outputBytes.length;
    const bootSignaturePresent = sectorBytesCount >= 512 &&
      outputBytes[510] === 0x55 &&
      outputBytes[511] === 0xAA;
    const bootSectorValid = sectorBytesCount === 512 && bootSignaturePresent;

    return {
      success: errors.length === 0,
      bytes: outputBytes,
      hexListing,
      lineMap,
      labels,
      errors,
      warnings,
      origin,
      bootSectorValid,
      bootSignaturePresent,
      sectorBytesCount,
      arch: explicitArch
    };
  }

  private static isOpcode(word: string): boolean {
    const list = [
      'MOV', 'ADD', 'SUB', 'XOR', 'AND', 'OR', 'NOT', 'NEG', 'INC', 'DEC',
      'CMP', 'TEST', 'MUL', 'DIV', 'JMP', 'JZ', 'JE', 'JNZ', 'JNE', 'JC',
      'JB', 'JNC', 'JNB', 'JAE', 'JS', 'JNS', 'JO', 'JNO', 'CALL', 'RET',
      'PUSH', 'POP', 'PUSHA', 'POPA', 'PUSHAD', 'POPAD', 'INT', 'IRET', 'HLT', 'NOP', 'CLI',
      'STI', 'CLC', 'STC', 'CMC', 'IN', 'OUT', 'LODSB', 'STOSB', 'MOVSB',
      'CLD', 'STD', 'LOOP', 'LOOPE', 'LOOPNE', 'LEA', 'XCHG', 'SHL', 'SHR',
      'ROL', 'ROR', 'SYS_CALL', 'VCOS_CLS', 'VCOS_PRINT', 'VCOS_MODE13H',
      'VCOS_TEXTMODE', 'VCOS_HALT', 'VCOS_BOOT_SIG',
      'DB', 'DW', 'DD', 'TIMES'
    ];
    return list.includes(word.toUpperCase());
  }

  private static splitArgs(argsStr: string): string[] {
    if (!argsStr) return [];
    const args: string[] = [];
    let current = '';
    let inQuote: string | null = null;

    for (let i = 0; i < argsStr.length; i++) {
      const c = argsStr[i];
      if (inQuote) {
        current += c;
        if (c === inQuote) {
          inQuote = null;
        }
      } else if (c === '"' || c === "'") {
        inQuote = c;
        current += c;
      } else if (c === ',') {
        args.push(current.trim());
        current = '';
      } else {
        current += c;
      }
    }
    if (current.trim()) {
      args.push(current.trim());
    }
    return args;
  }

  private static estimateInstructionSize(
    mnemonic: string,
    args: string[],
    currentAddr: number,
    origin: number,
    labels: Record<string, number>
  ): number {
    switch (mnemonic) {
      case 'NOP':
      case 'HLT':
      case 'CLI':
      case 'STI':
      case 'CLC':
      case 'STC':
      case 'CMC':
      case 'CLD':
      case 'STD':
      case 'RET':
      case 'IRET':
      case 'PUSHA':
      case 'POPA':
      case 'PUSHAD':
      case 'POPAD':
      case 'LODSB':
      case 'STOSB':
      case 'MOVSB':
        return 1;

      case 'INT':
        return 2;

      case 'SYS_CALL':
        return 7; // MOV EAX, val (5) + INT 0x20 (2)

      case 'VCOS_MODE13H':
      case 'VCOS_TEXTMODE':
      case 'VCOS_CLS':
        return 5; // MOV AX, mode (3) + INT 0x10 (2)

      case 'VCOS_HALT':
        return 3; // HLT (1) + JMP $-1 (2)

      case 'VCOS_BOOT_SIG': {
        const offset = (currentAddr - origin) % 512;
        return (510 >= offset) ? (512 - offset) : 2;
      }

      case 'PUSH':
      case 'POP':
      case 'INC':
      case 'DEC':
        return 1;

      case 'LEA':
        return 5;

      case 'XCHG':
        return 2;

      case 'SHL':
      case 'SHR':
      case 'ROL':
      case 'ROR':
        return 3;

      case 'NOT':
      case 'NEG':
        return 2;

      case 'ADD':
      case 'SUB':
      case 'XOR':
      case 'AND':
      case 'OR':
      case 'CMP':
      case 'TEST':
      case 'MUL':
      case 'DIV':
        if (args.length === 2 && this.isImmediate(args[1])) {
          return 5;
        }
        return 2;

      case 'MOV':
        if (args.length === 2) {
          const dst = args[0].toUpperCase();
          const src = args[1].toUpperCase();
          if (dst in this.REG_8_LOW || dst in this.REG_8_HIGH) return 2;
          if (dst in this.REG_16) return 3;
          if (dst in this.REG_32) return 5;
          if (dst.startsWith('[') || src.startsWith('[')) return 3;
        }
        return 5;

      case 'IN':
      case 'OUT':
        return 2;

      case 'JMP':
      case 'JZ': case 'JE':
      case 'JNZ': case 'JNE':
      case 'JC': case 'JB':
      case 'JNC': case 'JNB': case 'JAE':
      case 'JS': case 'JNS':
      case 'JO': case 'JNO':
      case 'LOOP': case 'LOOPE': case 'LOOPNE':
        return 2; // rel8 jump default

      case 'CALL':
        return 5;

      case 'DB': {
        let count = 0;
        args.forEach(a => {
          if ((a.startsWith('"') && a.endsWith('"')) || (a.startsWith("'") && a.endsWith("'"))) {
            count += a.slice(1, -1).length;
          } else {
            count += 1;
          }
        });
        return count;
      }

      case 'DW':
        return args.length * 2;

      case 'DD':
        return args.length * 4;

      case 'TIMES': {
        if (args.length >= 2) {
          const countExpr = args[0];
          const count = this.evaluateSimpleExpr(countExpr, labels, currentAddr, origin);
          const subMnemonic = args[1].toUpperCase();
          if (subMnemonic === 'DB') return Math.max(0, count);
          if (subMnemonic === 'DW') return Math.max(0, count * 2);
          if (subMnemonic === 'DD') return Math.max(0, count * 4);
        }
        return 0;
      }

      default:
        return 1;
    }
  }

  private static isImmediate(arg: string): boolean {
    if (!arg) return false;
    const clean = arg.trim();
    if (clean.startsWith('0x') || clean.startsWith('0X') || clean.startsWith('$')) return true;
    if (clean.endsWith('h') || clean.endsWith('H') || clean.endsWith('b') || clean.endsWith('B')) return true;
    if (!isNaN(Number(clean))) return true;
    if (clean.startsWith("'") || clean.startsWith('"')) return true;
    return false;
  }

  public static evaluateSimpleExpr(
    expr: string,
    symbols: Record<string, number>,
    currentAddress: number = 0,
    origin: number = 0x7C00
  ): number {
    let clean = expr.trim();
    // Replace '$' with current address and '$$' with origin
    clean = clean.replace(/\$\$/g, origin.toString());
    clean = clean.replace(/\$/g, currentAddress.toString());

    // Replace symbol identifiers with their values
    Object.keys(symbols).forEach(sym => {
      const regex = new RegExp(`\\b${sym}\\b`, 'g');
      clean = clean.replace(regex, symbols[sym].toString());
    });

    // Handle hex like 0x123 or 123h
    clean = clean.replace(/0x([0-9a-fA-F]+)/g, (_, hex) => parseInt(hex, 16).toString());
    clean = clean.replace(/([0-9a-fA-F]+)h\b/g, (_, hex) => parseInt(hex, 16).toString());
    // Handle binary like 1010b
    clean = clean.replace(/([01]+)b\b/g, (_, bin) => parseInt(bin, 2).toString());

    // Handle char literal like 'A' or "A"
    clean = clean.replace(/'(.)'/g, (_, ch) => ch.charCodeAt(0).toString());
    clean = clean.replace(/"(.)"/g, (_, ch) => ch.charCodeAt(0).toString());

    try {
      // Safe math evaluator (only numbers and arithmetic operators)
      if (/^[0-9+\-*/%() \t.<>|&^~]+$/.test(clean)) {
        // eslint-disable-next-line no-eval
        const result = Function(`'use strict'; return (${clean})`)();
        return isNaN(result) ? 0 : Math.floor(result);
      }
      const num = parseInt(clean, 10);
      return isNaN(num) ? 0 : num;
    } catch {
      return 0;
    }
  }

  private static encodeInstruction(
    mnemonic: string,
    args: string[],
    currentAddr: number,
    origin: number,
    labels: Record<string, number>,
    constants: Record<string, number>,
    is16Bit: boolean
  ): number[] {
    const bytes: number[] = [];
    const symbols = { ...constants, ...labels };

    switch (mnemonic) {
      case 'NOP':
        return [0x90];

      case 'HLT':
        return [0xF4];

      case 'CLI':
        return [0xFA];

      case 'STI':
        return [0xFB];

      case 'CLC':
        return [0xF8];

      case 'STC':
        return [0xF9];

      case 'CMC':
        return [0xF5];

      case 'CLD':
        return [0xFC];

      case 'STD':
        return [0xFD];

      case 'RET':
        return [0xC3];

      case 'IRET':
        return [0xCF];

      case 'PUSHA':
      case 'PUSHAD':
        return [0x60];

      case 'POPA':
      case 'POPAD':
        return [0x61];

      case 'LODSB':
        return [0xAC];

      case 'STOSB':
        return [0xAA];

      case 'MOVSB':
        return [0xA4];

      case 'SYS_CALL': {
        const sysId = args[0] ? this.evaluateSimpleExpr(args[0], symbols, currentAddr, origin) : 0;
        return [
          0xB8,
          sysId & 0xFF,
          (sysId >> 8) & 0xFF,
          (sysId >> 16) & 0xFF,
          (sysId >> 24) & 0xFF,
          0xCD, 0x20
        ];
      }

      case 'VCOS_MODE13H':
      case 'VCOS_CLS':
        return [0xB8, 0x13, 0x00, 0xCD, 0x10];

      case 'VCOS_TEXTMODE':
        return [0xB8, 0x03, 0x00, 0xCD, 0x10];

      case 'VCOS_HALT':
        return [0xF4, 0xEB, 0xFE];

      case 'VCOS_BOOT_SIG': {
        const offset = (currentAddr - origin) % 512;
        const padCount = (510 >= offset) ? (510 - offset) : 0;
        const res: number[] = [];
        for (let i = 0; i < padCount; i++) res.push(0);
        res.push(0x55, 0xAA);
        return res;
      }

      case 'LEA': {
        if (args.length < 2) throw new Error('LEA requires 2 operands: LEA reg, [addr]');
        const dst = args[0].toUpperCase();
        let targetStr = args[1].trim();
        if (targetStr.startsWith('[') && targetStr.endsWith(']')) {
          targetStr = targetStr.slice(1, -1).trim();
        }
        const targetAddr = this.evaluateSimpleExpr(targetStr, symbols, currentAddr, origin);
        if (dst in this.REG_16) {
          const regIdx = this.REG_16[dst];
          return [0xB8 + regIdx, targetAddr & 0xFF, (targetAddr >> 8) & 0xFF];
        }
        if (dst in this.REG_32) {
          const regIdx = this.REG_32[dst];
          return [
            0xB8 + regIdx,
            targetAddr & 0xFF,
            (targetAddr >> 8) & 0xFF,
            (targetAddr >> 16) & 0xFF,
            (targetAddr >> 24) & 0xFF
          ];
        }
        throw new Error(`Unsupported LEA destination: ${dst}`);
      }

      case 'XCHG': {
        if (args.length < 2) throw new Error('XCHG requires 2 operands');
        const r1 = args[0].toUpperCase();
        const r2 = args[1].toUpperCase();
        if (r1 === 'EAX' && r2 in this.REG_32) return [0x90 + this.REG_32[r2]];
        if (r2 === 'EAX' && r1 in this.REG_32) return [0x90 + this.REG_32[r1]];
        if (r1 === 'AX' && r2 in this.REG_16) return [0x90 + this.REG_16[r2]];
        if (r2 === 'AX' && r1 in this.REG_16) return [0x90 + this.REG_16[r1]];
        if (r1 in this.REG_32 && r2 in this.REG_32) return [0x87, 0xC0 + (this.REG_32[r1] << 3) + this.REG_32[r2]];
        if (r1 in this.REG_16 && r2 in this.REG_16) return [0x87, 0xC0 + (this.REG_16[r1] << 3) + this.REG_16[r2]];
        if (r1 in this.REG_8_LOW && r2 in this.REG_8_LOW) return [0x86, 0xC0 + (this.REG_8_LOW[r1] << 3) + this.REG_8_LOW[r2]];
        return [0x87, 0xC0];
      }

      case 'SHL': {
        const reg = args[0]?.toUpperCase();
        const count = args[1] ? this.evaluateSimpleExpr(args[1], symbols, currentAddr, origin) : 1;
        if (reg in this.REG_32) {
          return count === 1 ? [0xD1, 0xE0 + this.REG_32[reg]] : [0xC1, 0xE0 + this.REG_32[reg], count & 0xFF];
        }
        if (reg in this.REG_16) {
          return count === 1 ? [0xD1, 0xE0 + this.REG_16[reg]] : [0xC1, 0xE0 + this.REG_16[reg], count & 0xFF];
        }
        if (reg in this.REG_8_LOW) {
          return count === 1 ? [0xD0, 0xE0 + this.REG_8_LOW[reg]] : [0xC0, 0xE0 + this.REG_8_LOW[reg], count & 0xFF];
        }
        return [0xD1, 0xE0];
      }

      case 'SHR': {
        const reg = args[0]?.toUpperCase();
        const count = args[1] ? this.evaluateSimpleExpr(args[1], symbols, currentAddr, origin) : 1;
        if (reg in this.REG_32) {
          return count === 1 ? [0xD1, 0xE8 + this.REG_32[reg]] : [0xC1, 0xE8 + this.REG_32[reg], count & 0xFF];
        }
        if (reg in this.REG_16) {
          return count === 1 ? [0xD1, 0xE8 + this.REG_16[reg]] : [0xC1, 0xE8 + this.REG_16[reg], count & 0xFF];
        }
        if (reg in this.REG_8_LOW) {
          return count === 1 ? [0xD0, 0xE8 + this.REG_8_LOW[reg]] : [0xC0, 0xE8 + this.REG_8_LOW[reg], count & 0xFF];
        }
        return [0xD1, 0xE8];
      }

      case 'ROL': {
        const reg = args[0]?.toUpperCase();
        const count = args[1] ? this.evaluateSimpleExpr(args[1], symbols, currentAddr, origin) : 1;
        if (reg in this.REG_32) return [0xC1, 0xC0 + this.REG_32[reg], count & 0xFF];
        return [0xD1, 0xC0];
      }

      case 'ROR': {
        const reg = args[0]?.toUpperCase();
        const count = args[1] ? this.evaluateSimpleExpr(args[1], symbols, currentAddr, origin) : 1;
        if (reg in this.REG_32) return [0xC1, 0xC8 + this.REG_32[reg], count & 0xFF];
        return [0xD1, 0xC8];
      }

      case 'NOT': {
        const reg = args[0]?.toUpperCase();
        if (reg in this.REG_32) return [0xF7, 0xD0 + this.REG_32[reg]];
        if (reg in this.REG_16) return [0xF7, 0xD0 + this.REG_16[reg]];
        if (reg in this.REG_8_LOW) return [0xF6, 0xD0 + this.REG_8_LOW[reg]];
        return [0xF7, 0xD0];
      }

      case 'NEG': {
        const reg = args[0]?.toUpperCase();
        if (reg in this.REG_32) return [0xF7, 0xD8 + this.REG_32[reg]];
        if (reg in this.REG_16) return [0xF7, 0xD8 + this.REG_16[reg]];
        if (reg in this.REG_8_LOW) return [0xF6, 0xD8 + this.REG_8_LOW[reg]];
        return [0xF7, 0xD8];
      }

      case 'INT': {
        if (!args[0]) throw new Error('INT requires vector argument');
        const vec = this.evaluateSimpleExpr(args[0], symbols, currentAddr, origin) & 0xFF;
        return [0xCD, vec];
      }

      case 'MOV': {
        if (args.length < 2) throw new Error('MOV requires 2 operands: MOV dst, src');
        const dst = args[0].toUpperCase();
        const src = args[1].toUpperCase();

        // 8-bit Register Immediate: MOV AL, imm8 / MOV AH, imm8 etc.
        if (dst in this.REG_8_LOW) {
          const regIdx = this.REG_8_LOW[dst];
          if (src in this.REG_8_LOW) {
            return [0x88, 0xC0 + (this.REG_8_LOW[src] << 3) + regIdx];
          }
          if (src in this.REG_8_HIGH) {
            return [0x88, 0xC0 + (this.REG_8_HIGH[src] << 3) + regIdx];
          }
          if (src.startsWith('[') && src.endsWith(']')) {
            const inner = src.slice(1, -1).trim();
            if (inner === 'SI' || inner === 'ESI') return [0x8A, 0x06];
            if (inner === 'DI' || inner === 'EDI') return [0x8A, 0x07];
            if (inner === 'BX' || inner === 'EBX') return [0x8A, 0x03];
            const memAddr = this.evaluateSimpleExpr(inner, symbols, currentAddr, origin);
            return [0xA0, memAddr & 0xFF, (memAddr >> 8) & 0xFF];
          }
          const val = this.evaluateSimpleExpr(args[1], symbols, currentAddr, origin) & 0xFF;
          return [0xB0 + regIdx, val];
        }

        if (dst in this.REG_8_HIGH) {
          const regIdx = this.REG_8_HIGH[dst];
          if (src in this.REG_8_LOW) {
            return [0x88, 0xC0 + (this.REG_8_LOW[src] << 3) + regIdx];
          }
          if (src in this.REG_8_HIGH) {
            return [0x88, 0xC0 + (this.REG_8_HIGH[src] << 3) + regIdx];
          }
          const val = this.evaluateSimpleExpr(args[1], symbols, currentAddr, origin) & 0xFF;
          return [0xB0 + regIdx, val];
        }

        // Memory write: MOV [EBX + ECX], AL or MOV [EBX], EAX or MOV [BX], AL or MOV [addr], AL
        if (dst.startsWith('[') && dst.endsWith(']')) {
          const inner = dst.slice(1, -1).trim().toUpperCase();

          // Indexed addressing: [EBX + ECX] or [EBX + ESI]
          if (inner.includes('+')) {
            const parts = inner.split('+').map(p => p.trim());
            if (parts.length === 2) {
              const base = parts[0];
              const idx = parts[1];
              if (base === 'EBX' && idx === 'ECX') {
                return (src === 'AL' || src === 'CL' || src === 'DL' || src === 'BL')
                  ? [0x88, 0x04, 0x0B] // SIB: base EBX (3), index ECX (1)
                  : [0x89, 0x04, 0x0B];
              }
              if (base === 'EBX' && idx === 'ESI') {
                return [0x88, 0x04, 0x33];
              }
              if (base === 'BX' && idx === 'SI') {
                return [0x88, 0x00];
              }
              if (base === 'BX' && idx === 'DI') {
                return [0x88, 0x01];
              }
            }
          }

          if (inner === 'EBX' && src === 'EAX') {
            return [0x89, 0x03];
          }
          if ((inner === 'BX' || inner === 'EBX') && (src === 'AL' || src === 'EAX')) {
            return [0x88, 0x03];
          }
          if ((inner === 'DI' || inner === 'EDI') && (src === 'AL' || src === 'EAX')) {
            return [0x88, 0x07];
          }
          if ((inner === 'SI' || inner === 'ESI') && (src === 'AL' || src === 'EAX')) {
            return [0x88, 0x04];
          }
          const memAddr = this.evaluateSimpleExpr(inner, symbols, currentAddr, origin);
          if (src === 'AL') {
            return [0xA2, memAddr & 0xFF, (memAddr >> 8) & 0xFF];
          }
          const val = this.evaluateSimpleExpr(args[1], symbols, currentAddr, origin);
          return [0xC6, 0x06, memAddr & 0xFF, (memAddr >> 8) & 0xFF, val & 0xFF];
        }

        // 16-bit Register: MOV AX, imm16 / MOV DS, AX / MOV AX, [mem]
        if (dst in this.REG_16) {
          const regIdx = this.REG_16[dst];
          if (src in this.REG_16) {
            return [0x89, 0xC0 + (this.REG_16[src] << 3) + regIdx];
          }
          if (src in this.SEG_REGS) {
            return [0x8C, 0xC0 + (this.SEG_REGS[src] << 3) + regIdx];
          }
          if (src.startsWith('[') && src.endsWith(']')) {
            const inner = src.slice(1, -1).trim();
            const memAddr = this.evaluateSimpleExpr(inner, symbols, currentAddr, origin);
            return [0xA1, memAddr & 0xFF, (memAddr >> 8) & 0xFF];
          }
          const val = this.evaluateSimpleExpr(args[1], symbols, currentAddr, origin) & 0xFFFF;
          return [0xB8 + regIdx, val & 0xFF, (val >> 8) & 0xFF];
        }

        // Segment Registers: MOV DS, AX
        if (dst in this.SEG_REGS) {
          const segIdx = this.SEG_REGS[dst];
          if (src in this.REG_16) {
            const regIdx = this.REG_16[src];
            return [0x8E, 0xC0 + (segIdx << 3) + regIdx];
          }
          if (src in this.REG_32) {
            const regIdx = this.REG_32[src];
            return [0x8E, 0xC0 + (segIdx << 3) + regIdx];
          }
        }

        // 32-bit Register: MOV EAX, imm32 / MOV EAX, [EBX]
        if (dst in this.REG_32) {
          const regIdx = this.REG_32[dst];
          if (src === '[EBX]') {
            return [0x8B];
          }
          if (src in this.REG_32) {
            return [0x89, 0xC0 + (this.REG_32[src] << 3) + regIdx];
          }
          const val = this.evaluateSimpleExpr(args[1], symbols, currentAddr, origin) >>> 0;
          return [
            0xB8 + regIdx,
            val & 0xFF,
            (val >> 8) & 0xFF,
            (val >> 16) & 0xFF,
            (val >> 24) & 0xFF
          ];
        }

        throw new Error(`Unsupported MOV operands: ${dst}, ${src}`);
      }

      case 'PUSH': {
        const reg = args[0]?.toUpperCase();
        if (reg in this.REG_32) return [0x50 + this.REG_32[reg]];
        if (reg in this.REG_16) return [0x50 + this.REG_16[reg]];
        if (reg in this.SEG_REGS) return [0x06 + (this.SEG_REGS[reg] << 3)];
        if (this.isImmediate(args[0])) {
          const val = this.evaluateSimpleExpr(args[0], symbols, currentAddr, origin);
          return [0x68, val & 0xFF, (val >> 8) & 0xFF, (val >> 16) & 0xFF, (val >> 24) & 0xFF];
        }
        return [0x50];
      }

      case 'POP': {
        const reg = args[0]?.toUpperCase();
        if (reg in this.REG_32) return [0x58 + this.REG_32[reg]];
        if (reg in this.REG_16) return [0x58 + this.REG_16[reg]];
        if (reg in this.SEG_REGS) return [0x07 + (this.SEG_REGS[reg] << 3)];
        return [0x58];
      }

      case 'INC': {
        const reg = args[0]?.toUpperCase();
        if (reg in this.REG_32) return [0x40 + this.REG_32[reg]];
        if (reg in this.REG_16) return [0x40 + this.REG_16[reg]];
        if (reg in this.REG_8_LOW) return [0xFE, 0xC0 + this.REG_8_LOW[reg]];
        if (reg in this.REG_8_HIGH) return [0xFE, 0xC0 + this.REG_8_HIGH[reg]];
        return [0x40];
      }

      case 'DEC': {
        const reg = args[0]?.toUpperCase();
        if (reg in this.REG_32) return [0x48 + this.REG_32[reg]];
        if (reg in this.REG_16) return [0x48 + this.REG_16[reg]];
        if (reg in this.REG_8_LOW) return [0xFE, 0xC8 + this.REG_8_LOW[reg]];
        if (reg in this.REG_8_HIGH) return [0xFE, 0xC8 + this.REG_8_HIGH[reg]];
        return [0x48];
      }

      case 'ADD': {
        if (args.length === 2 && this.isImmediate(args[1])) {
          const val = this.evaluateSimpleExpr(args[1], symbols, currentAddr, origin);
          return [0x05, val & 0xFF, (val >> 8) & 0xFF, (val >> 16) & 0xFF, (val >> 24) & 0xFF];
        }
        return [0x01];
      }

      case 'SUB': {
        if (args.length === 2 && this.isImmediate(args[1])) {
          const val = this.evaluateSimpleExpr(args[1], symbols, currentAddr, origin);
          return [0x2D, val & 0xFF, (val >> 8) & 0xFF, (val >> 16) & 0xFF, (val >> 24) & 0xFF];
        }
        return [0x29];
      }

      case 'XOR':
        return [0x31];

      case 'AND':
        return [0x21];

      case 'OR':
        return [0x09];

      case 'CMP': {
        if (args.length === 2 && (args[0].toUpperCase() === 'AL' || args[0].toUpperCase() === 'AH')) {
          const val = this.evaluateSimpleExpr(args[1], symbols, currentAddr, origin) & 0xFF;
          return [0x3C, val];
        }
        return [0x39];
      }

      case 'TEST':
        return [0x85];

      case 'MUL':
        return [0xF7];

      case 'DIV':
        return [0xF7];

      case 'IN': {
        if (args[1]?.toUpperCase() === 'DX') {
          return [0xED];
        }
        const port = this.evaluateSimpleExpr(args[1], symbols, currentAddr, origin) & 0xFF;
        return [0xE4, port];
      }

      case 'OUT': {
        if (args[0]?.toUpperCase() === 'DX') {
          return [0xEF];
        }
        const port = this.evaluateSimpleExpr(args[0], symbols, currentAddr, origin) & 0xFF;
        return [0xE6, port];
      }

      case 'JMP': {
        const target = this.evaluateSimpleExpr(args[0], symbols, currentAddr, origin);
        const rel = target - (currentAddr + 2);
        if (rel >= -128 && rel <= 127) {
          return [0xEB, rel & 0xFF];
        }
        const rel32 = target - (currentAddr + 5);
        return [0xE9, rel32 & 0xFF, (rel32 >> 8) & 0xFF, (rel32 >> 16) & 0xFF, (rel32 >> 24) & 0xFF];
      }

      case 'JZ': case 'JE': {
        const target = this.evaluateSimpleExpr(args[0], symbols, currentAddr, origin);
        const rel = target - (currentAddr + 2);
        return [0x74, rel & 0xFF];
      }

      case 'JNZ': case 'JNE': {
        const target = this.evaluateSimpleExpr(args[0], symbols, currentAddr, origin);
        const rel = target - (currentAddr + 2);
        return [0x75, rel & 0xFF];
      }

      case 'JC': case 'JB': {
        const target = this.evaluateSimpleExpr(args[0], symbols, currentAddr, origin);
        const rel = target - (currentAddr + 2);
        return [0x72, rel & 0xFF];
      }

      case 'JNC': case 'JNB': case 'JAE': {
        const target = this.evaluateSimpleExpr(args[0], symbols, currentAddr, origin);
        const rel = target - (currentAddr + 2);
        return [0x73, rel & 0xFF];
      }

      case 'JS': {
        const target = this.evaluateSimpleExpr(args[0], symbols, currentAddr, origin);
        const rel = target - (currentAddr + 2);
        return [0x78, rel & 0xFF];
      }

      case 'JNS': {
        const target = this.evaluateSimpleExpr(args[0], symbols, currentAddr, origin);
        const rel = target - (currentAddr + 2);
        return [0x79, rel & 0xFF];
      }

      case 'LOOP': {
        const target = this.evaluateSimpleExpr(args[0], symbols, currentAddr, origin);
        const rel = target - (currentAddr + 2);
        return [0xE2, rel & 0xFF];
      }

      case 'LOOPE': case 'LOOPZ': {
        const target = this.evaluateSimpleExpr(args[0], symbols, currentAddr, origin);
        const rel = target - (currentAddr + 2);
        return [0xE1, rel & 0xFF];
      }

      case 'LOOPNE': case 'LOOPNZ': {
        const target = this.evaluateSimpleExpr(args[0], symbols, currentAddr, origin);
        const rel = target - (currentAddr + 2);
        return [0xE0, rel & 0xFF];
      }

      case 'CALL': {
        const target = this.evaluateSimpleExpr(args[0], symbols, currentAddr, origin);
        const rel = target - (currentAddr + 5);
        return [0xE8, rel & 0xFF, (rel >> 8) & 0xFF, (rel >> 16) & 0xFF, (rel >> 24) & 0xFF];
      }

      case 'DB': {
        args.forEach(arg => {
          if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
            const str = arg.slice(1, -1);
            for (let c = 0; c < str.length; c++) {
              bytes.push(str.charCodeAt(c));
            }
          } else {
            const val = this.evaluateSimpleExpr(arg, symbols, currentAddr, origin);
            bytes.push(val & 0xFF);
          }
        });
        return bytes;
      }

      case 'DW': {
        args.forEach(arg => {
          const val = this.evaluateSimpleExpr(arg, symbols, currentAddr, origin);
          bytes.push(val & 0xFF, (val >> 8) & 0xFF);
        });
        return bytes;
      }

      case 'DD': {
        args.forEach(arg => {
          const val = this.evaluateSimpleExpr(arg, symbols, currentAddr, origin);
          bytes.push(
            val & 0xFF,
            (val >> 8) & 0xFF,
            (val >> 16) & 0xFF,
            (val >> 24) & 0xFF
          );
        });
        return bytes;
      }

      case 'TIMES': {
        if (args.length < 2) throw new Error('TIMES directive format: TIMES <count> <instruction/db>');
        const count = Math.max(0, this.evaluateSimpleExpr(args[0], symbols, currentAddr, origin));
        const subMnemonic = args[1].toUpperCase();
        const subArgs = args.slice(2);

        if (subMnemonic === 'DB') {
          const fillVal = subArgs.length > 0
            ? this.evaluateSimpleExpr(subArgs[0], symbols, currentAddr, origin) & 0xFF
            : 0;
          for (let i = 0; i < count; i++) {
            bytes.push(fillVal);
          }
          return bytes;
        }
        if (subMnemonic === 'DW') {
          const fillVal = subArgs.length > 0
            ? this.evaluateSimpleExpr(subArgs[0], symbols, currentAddr, origin) & 0xFFFF
            : 0;
          for (let i = 0; i < count; i++) {
            bytes.push(fillVal & 0xFF, (fillVal >> 8) & 0xFF);
          }
          return bytes;
        }
        return bytes;
      }

      default:
        throw new Error(`Unknown instruction or directive: ${mnemonic}`);
    }
  }
}

export const vcaAssembler = new VCodeAssembler();
export const assembler = vcaAssembler;

