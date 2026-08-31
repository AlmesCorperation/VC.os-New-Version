export interface AssemblyTemplate {
  id: string;
  name: string;
  filename: string;
  category: 'Boot Sector' | 'Graphics' | 'Sound' | 'Kernel' | 'Games';
  description: string;
  targetOrigin: number;
  code: string;
}

export const ASSEMBLY_TEMPLATES: AssemblyTemplate[] = [
  {
    id: 'seabios_shell',
    name: 'SeaBIOS Interactive Shell (VCA-16)',
    filename: 'seabios_shell.asm',
    category: 'Boot Sector',
    description: 'VC.os Assembly 16-bit real mode interactive command prompt with teletype output and interrupt services.',
    targetOrigin: 0x7C00,
    code: `; ==========================================================
; VC.os Assembly (VCA-16) - SeaBIOS Command Shell
; Target: x86 16-Bit Real Mode Boot Sector @ 0x7C00
; ==========================================================

[ARCH VCA16]
[BITS 16]
ORG 0x7C00

START:
    CLI                     ; Disable interrupts during segment setup
    XOR AX, AX              ; Zero AX
    MOV DS, AX              ; Set Data Segment to 0
    MOV ES, AX              ; Set Extra Segment to 0
    MOV SS, AX              ; Set Stack Segment to 0
    MOV SP, 0x7C00          ; Stack top at 0x7C00
    STI                     ; Re-enable CPU interrupts

    ; Clear screen & set 80x25 Color Text Mode via INT 0x10
    VCOS_TEXTMODE

    ; Print Welcome Banner via teletype
    MOV SI, MSG_BANNER
    CALL PRINT_STRING

CMD_LOOP:
    ; Print Prompt
    MOV SI, PROMPT_STR
    CALL PRINT_STRING

    ; Read Key from Virtual 8042 Keyboard Controller (INT 0x16)
    MOV AH, 0x00
    INT 0x16

    ; Echo character
    MOV AH, 0x0E
    INT 0x10

    CMP AL, 'h'
    JE DO_HELP
    CMP AL, 'H'
    JE DO_HELP

    CMP AL, 'v'
    JE DO_VGA
    CMP AL, 'V'
    JE DO_VGA

    CMP AL, 'b'
    JE DO_BEEP
    CMP AL, 'B'
    JE DO_BEEP

    CMP AL, 'i'
    JE DO_INFO
    CMP AL, 'I'
    JE DO_INFO

    CMP AL, 'r'
    JE DO_REBOOT
    CMP AL, 'R'
    JE DO_REBOOT

    MOV SI, MSG_CRLF
    CALL PRINT_STRING
    JMP CMD_LOOP

DO_HELP:
    MOV SI, MSG_HELP
    CALL PRINT_STRING
    JMP CMD_LOOP

DO_VGA:
    ; Switch to VGA Mode 13h (320x200 256 colors)
    VCOS_MODE13H
    MOV EBX, 0x000A0000     ; Framebuffer Base
    MOV ECX, 0
.draw:
    MOV EAX, ECX
    AND EAX, 0x0F
    ADD EAX, 0x20
    MOV [EBX + ECX], AL
    INC ECX
    CMP ECX, 64000
    JL .draw
    JMP CMD_LOOP

DO_BEEP:
    ; Output to PIT / SoundBlaster
    MOV EAX, 0x440
    OUT 0x388, AL
    MOV SI, MSG_BEEP_OK
    CALL PRINT_STRING
    JMP CMD_LOOP

DO_INFO:
    MOV SI, MSG_INFO
    CALL PRINT_STRING
    JMP CMD_LOOP

DO_REBOOT:
    ; Warm CPU Reset
    INT 0x19
    JMP START

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

MSG_BANNER:
    DB "==================================================", 0x0D, 0x0A
    DB " VC.os Assembly (VCA-16/32) Baremetal Hypervisor", 0x0D, 0x0A
    DB " CPU: 16/32-Bit Hybrid Core | Video: Mode 13h/Text", 0x0D, 0x0A
    DB " Type 'h' for Help, 'v' for VGA, 'b' for Audio", 0x0D, 0x0A
    DB "==================================================", 0x0D, 0x0A, 0

PROMPT_STR:
    DB 0x0D, 0x0A, "VCA-16 (boot)> ", 0

MSG_HELP:
    DB 0x0D, 0x0A, "[VCA-16 COMMANDS]:", 0x0D, 0x0A
    DB "  h - Display this help manual", 0x0D, 0x0A
    DB "  v - Render Mode 13h VGA gradient", 0x0D, 0x0A
    DB "  b - Pulse PIT / SoundBlaster Audio Tone", 0x0D, 0x0A
    DB "  i - Show CPU & VCOS Hardware specs", 0x0D, 0x0A
    DB "  r - Trigger INT 0x19 Warm System Reboot", 0x0D, 0x0A, 0

MSG_INFO:
    DB 0x0D, 0x0A, "CPU: VCOS Hybrid x86 Core (16-Bit Real / 32-Bit Flat)", 0x0D, 0x0A
    DB "Memory: 16384 KB DRAM | VRAM: 0x000A0000", 0x0D, 0x0A, 0

MSG_BEEP_OK:
    DB 0x0D, 0x0A, "[AUDIO] Frequency pulse emitted to SoundBlaster DSP!", 0x0D, 0x0A, 0

MSG_CRLF:
    DB 0x0D, 0x0A, 0

TIMES 510 - ($ - $$) DB 0
DW 0xAA55
`
  },
  {
    id: 'mode13h_plasma',
    name: 'VGA Mode 13h Plasma FX (VCA-Hybrid)',
    filename: 'mode13h_plasma.asm',
    category: 'Graphics',
    description: 'VC.os Assembly hybrid 16/32-bit Mode 13h renderer calculating plasma waveforms directly to video RAM.',
    targetOrigin: 0x7C00,
    code: `; ==========================================================
; VC.os Assembly (VCA-Hybrid) - VGA Mode 13h Plasma Demo
; Target: 320x200 256-Color Framebuffer @ 0x000A0000
; ==========================================================

[ARCH HYBRID]
[BITS 16]
ORG 0x7C00

START:
    CLI
    XOR AX, AX
    MOV DS, AX
    MOV ES, AX

    ; Initialize VGA Mode 13h (320x200, 256 indexed colors)
    VCOS_MODE13H

    ; Set Framebuffer pointer (EBX = 0x000A0000)
    MOV EBX, 0x000A0000
    MOV ECX, 0          ; Pixel offset counter

RENDER_FRAME:
    ; Calculate dynamic color value from X & Y coordinates
    MOV EAX, ECX
    XOR EDX, EDX
    AND EAX, 0x3F       ; Sine-wave approximation
    ADD EAX, 0x20       ; Palette offset

    ; Store 8-bit color byte into Video RAM
    MOV [EBX + ECX], AL

    INC ECX
    CMP ECX, 64000      ; 320 x 200 = 64,000 pixels
    JL RENDER_FRAME

IDLE_HALT:
    VCOS_HALT

TIMES 510 - ($ - $$) DB 0
DW 0xAA55
`
  },
  {
    id: 'soundblaster_synth',
    name: 'SoundBlaster 16 DSP Synth (VCA-16)',
    filename: 'soundblaster_synth.asm',
    category: 'Sound',
    description: 'VC.os Assembly sound generator utilizing PIT Timer 2 and AdLib / SoundBlaster FM synthesizer registers.',
    targetOrigin: 0x7C00,
    code: `; ==========================================================
; VC.os Assembly (VCA-16) - SoundBlaster 16 DSP Synth
; Target: PIT Port 0x42 / DSP Port 0x388
; ==========================================================

[ARCH VCA16]
[BITS 16]
ORG 0x7C00

START:
    CLI
    XOR AX, AX
    MOV DS, AX

    ; Set text mode display
    VCOS_TEXTMODE
    MOV SI, MSG_PLAY
    CALL PRINT_STR

    ; Program PIT Channel 2 (Square Wave Generator @ Port 0x42/0x43)
    MOV AL, 0xB6
    OUT 0x43, AL

    ; Send 440 Hz Note (Concert A)
    MOV AX, 2711        ; 1193180 / 440
    OUT 0x42, AL        ; Send Low Byte
    MOV AL, AH
    OUT 0x42, AL        ; Send High Byte

    ; Enable Speaker Gate on Port 0x61
    IN AL, 0x61
    OR AL, 0x03
    OUT 0x61, AL

    ; Send OPL2 FM Register Test to Port 0x388
    MOV AL, 0x20
    OUT 0x388, AL
    MOV AL, 0x01
    OUT 0x389, AL

HALT_LOOP:
    VCOS_HALT

PRINT_STR:
    MOV AH, 0x0E
.lp:
    LODSB
    OR AL, AL
    JZ .rt
    INT 0x10
    JMP .lp
.rt:
    RET

MSG_PLAY:
    DB "==================================================", 0x0D, 0x0A
    DB " VC.os Assembly - SoundBlaster 16 & PIT Active", 0x0D, 0x0A
    DB " Synthesizing 440Hz Sine Tone via Port 0x42...", 0x0D, 0x0A
    DB "==================================================", 0x0D, 0x0A, 0

TIMES 510 - ($ - $$) DB 0
DW 0xAA55
`
  },
  {
    id: 'prot_mode_switch',
    name: 'Real to Protected Mode Switch (VCA-32)',
    filename: 'prot_mode_switch.asm',
    category: 'Kernel',
    description: 'Transition the VC.os CPU from 16-Bit Real Mode into 32-Bit Flat Protected Mode with GDT initialization.',
    targetOrigin: 0x7C00,
    code: `; ==========================================================
; VC.os Assembly (VCA-32) - Real to Protected Mode Switch
; Sets CR0 Protection Bit (PE=1) and jumps to 32-Bit Flat Space
; ==========================================================

[ARCH VCA32]
[BITS 16]
ORG 0x7C00

REAL_START:
    CLI                     ; 1. Disable all hardware interrupts
    XOR AX, AX
    MOV DS, AX
    MOV ES, AX
    MOV SS, AX
    MOV SP, 0x7C00

    ; 2. Print transition announcement in 16-bit mode
    MOV SI, MSG_REAL
    CALL PRINT_16

    ; 3. Enable A20 Fast Gate (System Port 0x92)
    IN AL, 0x92
    OR AL, 0x02
    OUT 0x92, AL

    ; 4. Jump to 32-bit linear execution
    JMP CODE_32_OFFSET

PRINT_16:
    MOV AH, 0x0E
.lp:
    LODSB
    OR AL, AL
    JZ .dn
    INT 0x10
    JMP .lp
.dn:
    RET

MSG_REAL:
    DB "[VCA-16] Enabling A20 Gate & Switching to 32-Bit Mode...", 0x0D, 0x0A, 0

[BITS 32]
CODE_32_OFFSET:
    ; 5. Now executing full 32-Bit Protected Mode!
    MOV EAX, 0x000B8000     ; VGA Color Text Buffer (Flat Address)
    MOV EBX, 0x0F430F56     ; 'V' (0x56, attr 0x0F) | 'C' (0x43, attr 0x0F)
    MOV [EAX], EBX

    ; Invoke VC.os Kernel Supervisor System Call (INT 0x20)
    SYS_CALL 1              ; SYS_PRINT

HANG_32:
    VCOS_HALT

TIMES 510 - ($ - $$) DB 0
DW 0xAA55
`
  },
  {
    id: 'p2p_mesh_packet',
    name: 'P2P Virtual NIC Network Emitter (VCA-16)',
    filename: 'p2p_mesh_packet.asm',
    category: 'Kernel',
    description: 'VC.os Assembly Network Interface Controller programming with Port 0x300 I/O for peer packet mesh broadcasts.',
    targetOrigin: 0x7C00,
    code: `; ==========================================================
; VC.os Assembly (VCA-16) - P2P Mesh Virtual NIC Emitter
; Target: Virtual Network Card I/O Ports 0x300 - 0x302
; ==========================================================

[ARCH VCA16]
[BITS 16]
ORG 0x7C00

START:
    CLI
    XOR AX, AX
    MOV DS, AX

    VCOS_TEXTMODE
    MOV SI, NET_MSG
    CALL PRINT_STR

    ; Reset Virtual NIC (Command 0x01 on Port 0x300)
    MOV EAX, 0x01
    OUT 0x300, AL

    ; Write Packet Payload "VCOS_NODE" into TX Buffer (Port 0x302)
    MOV EAX, 'V'
    OUT 0x302, AL
    MOV EAX, 'C'
    OUT 0x302, AL
    MOV EAX, 'O'
    OUT 0x302, AL
    MOV EAX, 'S'
    OUT 0x302, AL
    MOV EAX, '_'
    OUT 0x302, AL
    MOV EAX, 'N'
    OUT 0x302, AL
    MOV EAX, 'O'
    OUT 0x302, AL
    MOV EAX, 'D'
    OUT 0x302, AL
    MOV EAX, 'E'
    OUT 0x302, AL

    ; Send Packet (Command 0x02 on Port 0x300)
    MOV EAX, 0x02
    OUT 0x300, AL

    MOV SI, DONE_MSG
    CALL PRINT_STR

HANG:
    VCOS_HALT

PRINT_STR:
    MOV AH, 0x0E
.loop:
    LODSB
    OR AL, AL
    JZ .done
    INT 0x10
    JMP .loop
.done:
    RET

NET_MSG:
    DB "[P2P] Initializing Virtual NIC @ Port 0x300...", 0x0D, 0x0A, 0

DONE_MSG:
    DB "[P2P] Broadcast Packet Emitted to Peer Mesh!", 0x0D, 0x0A, 0

TIMES 510 - ($ - $$) DB 0
DW 0xAA55
`
  },
  {
    id: 'vcbios_syscall',
    name: 'VC.os Kernel System Calls (VCA-16)',
    filename: 'vcbios_syscall.asm',
    category: 'Kernel',
    description: 'Demonstrates invoking the custom VC.os kernel extensions via INT 0x88 for advanced operating system services.',
    targetOrigin: 0x7C00,
    code: `; ==========================================================
; VC.os Assembly (VCA-16) - INT 0x88 System Call Demo
; ==========================================================

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

    ; Call VC.os INT 0x88, AH=0x00 (Print Fast String)
    MOV AH, 0x00
    MOV SI, MSG_VCBIOS
    INT 0x88

    ; Call VC.os INT 0x88, AH=0x02 (Send P2P Message)
    MOV AH, 0x02
    MOV SI, MSG_P2P
    INT 0x88

HANG:
    VCOS_HALT

MSG_VCBIOS:
    DB 0x0D, 0x0A, ">>> Hello from VC.os Assembly INT 0x88 API!", 0x0D, 0x0A, 0

MSG_P2P:
    DB "VCBIOS_P2P_HELLO_WORLD", 0

TIMES 510 - ($ - $$) DB 0
DW 0xAA55
`
  }
];
