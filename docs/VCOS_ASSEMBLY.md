# VC.os Assembly Language Reference

VC.os utilizes a custom instruction set architecture (ISA) designed for low-level system operations, running within a virtual environment. This document details the registers, directives, and instruction set supported by the VC.os assembler (`vcaAssembler`).

## 1. Registers

VC.os supports 32-bit, 16-bit, and 8-bit registers, providing flexible access to data.

| Size | Registers |
| :--- | :--- |
| **32-bit** | `EAX`, `ECX`, `EDX`, `EBX`, `ESP`, `EBP`, `ESI`, `EDI` (`R0`-`R7` aliases) |
| **16-bit** | `AX`, `CX`, `DX`, `BX`, `SP`, `BP`, `SI`, `DI` (`R0W`-`R7W` aliases) |
| **8-bit Low** | `AL`, `CL`, `DL`, `BL` (`R0B`-`R3B` aliases) |
| **8-bit High**| `AH`, `CH`, `DH`, `BH` (`R4B`-`R7B` aliases) |
| **Segment** | `ES`, `CS`, `SS`, `DS`, `FS`, `GS` |

## 2. Directives

Directives control the assembly process rather than generating machine code directly.

*   `ORG <addr>`: Sets the origin address for the code.
*   `[BITS 16]` / `[BITS 32]`: Sets the operating mode (16-bit vs 32-bit).
*   `[ARCH VCA-16]` / `[ARCH VCA-32]` / `[ARCH HYBRID]`: Sets the architecture target.
*   `EQU`: Defines a constant value.
*   `DB <data>`: Define Byte(s). Accepts numbers or quoted strings.
*   `DW <data>`: Define Word(s) (16-bit).
*   `DD <data>`: Define Doubleword(s) (32-bit).
*   `TIMES <count> <instr>`: Repeats the instruction `<count>` times.

## 3. Instruction Set

### Control & System
*   `NOP`, `HLT`, `CLI`, `STI`, `CLC`, `STC`, `CMC`, `CLD`, `STD`
*   `RET`, `IRET`, `CALL <addr>`
*   `INT <vector>`
*   `SYS_CALL <id>`: Performs a system call via interrupt 0x20.

### Data Movement
*   `MOV <dst>, <src>`: Supports register-to-register, immediate-to-register, and register-to-memory operations.
*   `PUSH <reg>`, `POP <reg>`
*   `PUSHA`/`PUSHAD`, `POPA`/`POPAD`: Stack operations for general purpose registers.
*   `LEA <reg>, <addr>`: Load Effective Address.
*   `XCHG <r1>, <r2>`: Exchange register contents.

### Arithmetic & Logic
*   `ADD`, `SUB`, `XOR`, `AND`, `OR`, `CMP`, `TEST`
*   `MUL`, `DIV`
*   `INC`, `DEC`
*   `NOT`, `NEG`
*   `SHL`, `SHR`, `ROL`, `ROR`

### Branching & Looping
*   `JMP <addr>`
*   `JZ`/`JE` (Zero/Equal), `JNZ`/`JNE` (Not Zero/Not Equal)
*   `JC`/`JB` (Carry/Below), `JNC`/`JNB`/`JAE` (Not Carry/Not Below/Above Equal)
*   `JS` (Sign), `JNS` (Not Sign)
*   `LOOP`, `LOOPE`/`LOOPZ`, `LOOPNE`/`LOOPNZ`

### I/O
*   `IN <reg>, <port>` / `IN AL, DX`
*   `OUT <port>, <reg>` / `OUT DX, AL`

### VC.os Specific Hardware Macros
*   `VCOS_CLS`: Clear screen.
*   `VCOS_PRINT`: Print string.
*   `VCOS_MODE13H`: Set VGA Mode 13h.
*   `VCOS_TEXTMODE`: Set Text Mode.
*   `VCOS_HALT`: Halt CPU with endless loop.
*   `VCOS_BOOT_SIG`: Adds padding to 512 bytes and sets boot signature (0x55, 0xAA).

## 4. Hardware Constants

The assembler includes built-in constants for interacting with VC.os hardware:
`VRAM_VGA` (0xA0000), `VRAM_TEXT` (0xB8000), `PORT_KBD_DATA` (0x60), `PORT_SERIAL` (0x3F8), and various interrupt vectors (e.g., `INT_VIDEO` 0x10, `INT_VCOS_SYS` 0x20).
