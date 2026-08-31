const fs = require('fs');
let code = fs.readFileSync('src/services/vcode/templates.ts', 'utf8');
code = code.replace(/export const NEW_TEMPLATE = true;\n?/, '');

const newTemplate = `  {
    id: 'vcbios_syscall',
    name: 'VC.bios Custom System Calls',
    filename: 'vcbios_syscall.asm',
    category: 'Kernel',
    description: 'Demonstrates invoking the custom VC.bios extensions via INT 0x88 for advanced features.',
    targetOrigin: 0x7C00,
    code: \`; ==========================================================
; VC.code - VC.bios Custom INT 0x88 System Call Demo
; ==========================================================
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

    ; Call VC.bios INT 0x88, AH=0x00 (Print Fast String)
    MOV AH, 0x00
    MOV SI, MSG_VCBIOS
    INT 0x88

    ; Call VC.bios INT 0x88, AH=0x02 (Send P2P Message)
    MOV AH, 0x02
    MOV SI, MSG_P2P
    INT 0x88

HANG:
    HLT
    JMP HANG

MSG_VCBIOS:
    DB 0x0D, 0x0A, ">>> Hello from VC.bios INT 0x88 System Call API!", 0x0D, 0x0A, 0

MSG_P2P:
    DB "VCBIOS_P2P_HELLO_WORLD", 0

TIMES 510 - ($ - $$) DB 0
DW 0xAA55\`
  }`;

code = code.replace(/\];\s*$/, ',\n' + newTemplate + '\n];\n');
fs.writeFileSync('src/services/vcode/templates.ts', code);
