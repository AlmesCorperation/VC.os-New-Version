import { kernel } from './kernel';

export interface VFSFile {
  name: string;
  content: string;
  type: 'file' | 'dir';
  isCritical?: boolean;
  isCorrupted?: boolean;
}

export const INITIAL_VFS: Record<string, VFSFile> = {
  'kernel.sys': {
    name: 'kernel.sys',
    type: 'file',
    isCritical: true,
    content: `[VC.OS KERNEL v1.2.0]
MAGIC: 0x56434F53
ENTRY: 0x00100000
FLAGS: 0x00000001
---
void kernel_main() {
    init_vga();
    init_gdt();
    init_idt();
    while(1) {
        asm("hlt");
    }
}`
  },
  'boot.s': {
    name: 'boot.s',
    type: 'file',
    isCritical: true,
    content: `; boot.s - Almes Corp Multiboot2 Entry (NASM Syntax)
section .multiboot
align 8
multiboot_header:
    dd 0xE85250D6                ; MAGIC
    dd 0                         ; ARCH (i386)
    dd (multiboot_header_end - multiboot_header) ; LENGTH
    dd -(0xE85250D6 + 0 + (multiboot_header_end - multiboot_header)) ; CHECKSUM
    dw 0, 0
    dd 8
multiboot_header_end:

section .bss
align 16
stack_bottom:
    resb 16384
stack_top:

section .text
global _start
extern kernel_main

_start:
    mov esp, stack_top
    cli
    call kernel_main
.hang:
    hlt
    jmp .hang

global gdt_flush
gdt_flush:
    mov eax, [esp + 4]
    lgdt [eax]
    mov ax, 0x10
    mov ds, ax
    mov es, ax
    mov fs, ax
    mov gs, ax
    mov ss, ax
    jmp 0x08:.flush
.flush:
    ret`
  },
  'vcos_web_bridge.cpp': {
    name: 'vcos_web_bridge.cpp',
    type: 'file',
    isCritical: true,
    content: `/* vcos_web_bridge.cpp - Browser UI Handshake Layer */
#include <stdint.h>

extern "C" void draw_string(int x, int y, const char* str, uint8_t color);
extern "C" void draw_rect(int x, int y, int w, int h, uint8_t color, bool double_border = false);

extern "C" void init_web_bridge() {
    // Simulated Microkernel Bridge to Browser Assets
    draw_string(10, 20, "[ BRIDGE ] Mounting Browser Assets (2.1GB VFS Partition)...", 0x0B);
    
    // Busy loop to simulate "loading"
    for(volatile int i = 0; i < 50000000; i++); 

    draw_string(10, 21, "[ BRIDGE ] JS_ENGINE: Chromium V124 Native Runtime Sync...", 0x0B);
    draw_string(10, 22, "[ BRIDGE ] Alarm Subsystem: Initializing RTC Interrupts...", 0x0E);
    
    for(volatile int i = 0; i < 30000000; i++);

    draw_string(10, 23, "[ BRIDGE ] Asset Map: 14,204 files cached in RAM.", 0x07);
    draw_string(10, 24, "[ BRIDGE ] SPECTRUM_UI_FULL_VERSION: READY", 0x0A);
    
    // Overdraw the "Loading" message with a success button in the UI window
    draw_string(12, 14, "[ START WEB_OS_SESSION ]", 0xE0); // Yellow highlight
}
`
  },
  'kernel.cpp': {
    name: 'kernel.cpp',
    type: 'file',
    isCritical: true,
    content: `/* kernel.cpp - VC.os Graphical Microkernel Port */
#include <stdint.h>

extern "C" void init_gdt();
extern "C" void init_idt();
extern "C" void init_web_bridge();

// VGA Hardware Constants
const int WIDTH = 80;
const int HEIGHT = 25;
uint16_t* const VIDEO_RAM = (uint16_t*)0xB8000;

// CP437 Block Characters for "Graphics"
const char BLOCK_FULL = (char)219;
const char BLOCK_SHADE = (char)176;
const char WIN_CORNER_TL = (char)201;
const char WIN_CORNER_TR = (char)187;
const char WIN_CORNER_BL = (char)200;
const char WIN_CORNER_BR = (char)188;
const char WIN_LINE_H = (char)205;
const char WIN_LINE_V = (char)186;

void draw_char(int x, int y, char c, uint8_t color) {
    if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) {
        VIDEO_RAM[y * WIDTH + x] = (uint16_t)c | (uint16_t)color << 8;
    }
}

void draw_rect(int x, int y, int w, int h, uint8_t color, bool double_border = false) {
    // Fill interior
    for (int i = y; i < y + h; i++) {
        for (int j = x; j < x + w; j++) {
            draw_char(j, i, ' ', color << 4);
        }
    }

    if (double_border) {
        // Top and Bottom
        for (int j = x + 1; j < x + w - 1; j++) {
            draw_char(j, y, WIN_LINE_H, (color << 4) | 0x0F);
            draw_char(j, y + h - 1, WIN_LINE_H, (color << 4) | 0x0F);
        }
        // Sides
        for (int i = y + 1; i < y + h - 1; i++) {
            draw_char(x, i, WIN_LINE_V, (color << 4) | 0x0F);
            draw_char(x + w - 1, i, WIN_LINE_V, (color << 4) | 0x0F);
        }
        // Corners
        draw_char(x, y, WIN_CORNER_TL, (color << 4) | 0x0F);
        draw_char(x + w - 1, y, WIN_CORNER_TR, (color << 4) | 0x0F);
        draw_char(x, y + h - 1, WIN_CORNER_BL, (color << 4) | 0x0F);
        draw_char(x + w - 1, y + h - 1, WIN_CORNER_BR, (color << 4) | 0x0F);
    }

    // Shadow (using the shade character)
    for (int j = x + 1; j <= x + w; j++) draw_char(j, y + h, (char)177, 0x08);
    for (int i = y + 1; i <= y + h; i++) draw_char(x + w, i, (char)177, 0x08);
}

void draw_string(int x, int y, const char* str, uint8_t color) {
    for (int i = 0; str[i] != '\0'; i++) {
        draw_char(x + i, y, str[i], color);
    }
}

void render_desktop() {
    // 1. Draw Background (Teal)
    for (int i = 0; i < WIDTH * HEIGHT; i++) VIDEO_RAM[i] = (uint16_t)176 | (uint16_t)0x13 << 8;

    // 2. Draw Taskbar
    for (int j = 0; j < WIDTH; j++) draw_char(j, HEIGHT - 1, ' ', 0x70);
    draw_string(2, HEIGHT - 1, "[ START ]", 0x70);
    draw_string(WIDTH - 12, HEIGHT - 1, " 05:28 PM ", 0x70);

    // 3. Draw Application Window
    int wx = 8, wy = 3, ww = 64, wh = 16;
    draw_rect(wx, wy, ww, wh, 0x7, true); // Gray background with double border
    
    // Title Bar
    for(int j = wx + 1; j < wx + ww - 1; j++) draw_char(j, wy + 1, ' ', 0x1F);
    draw_string(wx + 2, wy + 1, " HYBRID_WEB_OS_BRIDGE ", 0x1F);
    draw_string(wx + ww - 6, wy + 1, "[_][X]", 0x1F);

    // Terminal Area
    draw_rect(wx + 2, wy + 3, ww - 4, wh - 5, 0x0, false);
    draw_string(wx + 4, wy + 4, "VC.os Hybrid Kernel Port", 0x0B);
    draw_string(wx + 4, wy + 5, "==============================", 0x08);
    draw_string(wx + 4, wy + 7, "OS MODE: WEB_HYBRID (Path A)", 0x0A);
    draw_string(wx + 4, wy + 8, "VFS:     [ MOUNTED @ /dev/sda2 ]", 0x0A);
    draw_string(wx + 4, wy + 9, "SIZE:    2,147,483,648 BYTES", 0x07);
    
    draw_string(wx + 4, wy + 11, "Handing over to Web Bridge...", 0x0E);
    draw_string(wx + 4, wy + 13, "root@vcos:/# _", 0x0F);

    // Draw an Icon
    draw_char(2, 2, (char)2, 0x0E); // Smiley face
    draw_string(1, 3, "OS_CORE", 0x0F);
}

extern "C" void kernel_main() {
    init_gdt();
    init_idt();

    render_desktop();
    init_web_bridge();

    while (1) {
        asm volatile("hlt");
    }
}
`

  },
  'linker.ld': {
    name: 'linker.ld',
    type: 'file',
    isCritical: true,
    content: `/* linker.ld - Almes Corp Linker Script */
ENTRY(_start)
SECTIONS {
    . = 1M;
    .text : { *(.multiboot) *(.text) }
    .rodata : { *(.rodata) }
    .data : { *(.data) }
    .bss : { *(COMMON) *(.bss) }
}`
  },
  'README.md': {
    name: 'README.md',
    type: 'file',
    content: '# VC.os v1.0.4\n\n**(c) 2026 Keo Doolish**\n\nVC.os stands for **Vibe code.operating system**.  \nThe code is completely generated by **AI**.\n\nWelcome to the **Spectrum Gradient**.\n\n---\n\n### 🚀 NEW IN VC.linux\n- **Native support** for `.tar.xz` archives is now active.\n\n### 📦 VISUAL INSTALLER\n1. Open **VC.linux**.\n2. Click "Software Center".\n3. Import and install software visually.\n\n### 💻 COMMAND LINE\n```bash\nwget <url>\ntar -xvf Downloads/<file>.tar.xz\n./<folder>/<binary>\n```'
  },
  'sys_logs.dat': {
    name: 'sys_logs.dat',
    type: 'file',
    isCritical: true,
    content: 'BOOT_OK\nMEM_CHECK_PASS\nIRQ_INIT_0x20\nCRASH_PREVENT_OFF'
  },
  'memory_map.h': {
    name: 'memory_map.h',
    type: 'file',
    isCritical: true,
    content: `#ifndef ALMES_MEMORY_MAP_H
#define ALMES_MEMORY_MAP_H

#include <stdint.h>

/**
 * VC.os MEMORY MAPPING PROFILE (v1.0.4)
 * This file is the "Law of the Land" for AI-driven memory management.
 * DO NOT modify these addresses without a full system re-index.
 */

namespace Almes {

    // --- CRITICAL SYSTEM ZONES (READ-ONLY/LOCKED) ---
    const uintptr_t IVT_START          = 0x00000000; // Interrupt Vector Table
    const uintptr_t BDA_START          = 0x00000400; // BIOS Data Area
    const uintptr_t BOOTLOADER_ENTRY   = 0x00007C00; // Entry point for .asm
    const uintptr_t KERNEL_CORE_START  = 0x00100000; // The Heart of VC.os

    // --- VISUAL & UI ZONES (WRITE-ONLY/RW) ---
    const uintptr_t VGA_BUFFER_START   = 0x000B8000; // Text Mode / RSOD Logic
    const uintptr_t SPECTRUM_UI_BUFFER = 0x01000000; // React/TSX Visual Layers

    // --- APPLICATION & ENGINE HEAPS ---
    const uintptr_t VC_ENGINE_HEAP     = 0x20000000; // 3D Data & Asset Pipeline
    const uintptr_t VC_STORE_HEAP      = 0x40000000; // Dynamic App Allocation
    const uintptr_t VC_LINUX_BRIDGE    = 0x80000000; // Virtualized Subsystem

    /**
     * @brief Check if a memory address is safe for AI-writing.
     * @return true if the address is in a RW (Read-Write) zone.
     */
    inline bool is_safe_zone(uintptr_t address) {
        if (address >= SPECTRUM_UI_BUFFER && address < 0xFFFFFFFF) {
            return true; // Safe for UI and Engine operations
        }
        return false; // Potentially triggers RSOD (Kernel/BIOS Protection)
    }

} // namespace Almes

#endif // ALMES_MEMORY_MAP_H`
  },
  'Makefile': {
    name: 'Makefile',
    type: 'file',
    isCritical: true,
    content: `# VC.os Bare-metal Makefile (Optimized for Debian/Linux)
# --------------------------------------------------------
# 1. Install dependencies:
#    sudo apt install nasm build-essential vmware-workstation-player gcc-i686-linux-gnu binutils-i686-linux-gnu
#
# 2. Build:
#    make
# --------------------------------------------------------

# Use the Debian cross-compiler by default
CC = i686-linux-gnu-g++
AS = nasm
LD = i686-linux-gnu-ld

CFLAGS = -m32 -std=c++11 -ffreestanding -O2 -Wall -Wextra -fno-exceptions -fno-rtti -fno-use-cxa-atexit -fno-pie -fno-stack-protector -fno-pic -fno-asynchronous-unwind-tables
LDFLAGS = -m32 -ffreestanding -O2 -nostdlib -lgcc -T linker.ld -no-pie -static

OBJ = boot.o kernel.o gdt.o idt.o vcos_web_bridge.o

all: VC_OS.iso

kernel.bin: $(OBJ)
	$(LD) $(LDFLAGS) -o kernel.bin $(OBJ)

VC_OS.iso: kernel.bin
	mkdir -p isodir/boot/grub
	cp kernel.bin isodir/boot/kernel.bin
	echo 'set timeout=0' > isodir/boot/grub/grub.cfg
	echo 'set default=0' >> isodir/boot/grub/grub.cfg
	echo 'menuentry "VC.os" {' >> isodir/boot/grub/grub.cfg
	echo '	multiboot2 /boot/kernel.bin' >> isodir/boot/grub/grub.cfg
	echo '	boot' >> isodir/boot/grub/grub.cfg
	echo '}' >> isodir/boot/grub/grub.cfg
	grub-mkrescue -o $@ isodir

kernel.o: kernel.cpp
	$(CC) -c $< -o $@ $(CFLAGS)

gdt.o: gdt.cpp
	$(CC) -c $< -o $@ $(CFLAGS)

idt.o: idt.cpp
	$(CC) -c $< -o $@ $(CFLAGS)

boot.o: boot.s
	$(AS) -f elf32 $< -o $@

vcos_web_bridge.o: vcos_web_bridge.cpp
	$(CC) -c $< -o $@ $(CFLAGS)

clean:
	rm -rf *.o kernel.bin isodir VC_OS.iso`
  },
  'gdt.cpp': {
    name: 'gdt.cpp',
    type: 'file',
    isCritical: true,
    content: `/* gdt.cpp - Global Descriptor Table Implementation */
#include <stdint.h>

struct gdt_entry_struct {
    uint16_t limit_low;
    uint16_t base_low;
    uint8_t  base_middle;
    uint8_t  access;
    uint8_t  granularity;
    uint8_t  base_high;
} __attribute__((packed));

struct gdt_ptr_struct {
    uint16_t limit;
    uint32_t base;
} __attribute__((packed));

gdt_entry_struct gdt_entries[5];
gdt_ptr_struct   gdt_ptr;

extern "C" void gdt_flush(uint32_t);

extern "C" void gdt_set_gate(int32_t num, uint32_t base, uint32_t limit, uint8_t access, uint8_t gran) {
    gdt_entries[num].base_low    = (base & 0xFFFF);
    gdt_entries[num].base_middle = (base >> 16) & 0xFF;
    gdt_entries[num].base_high   = (base >> 24) & 0xFF;

    gdt_entries[num].limit_low   = (limit & 0xFFFF);
    gdt_entries[num].granularity = (limit >> 16) & 0x0F;

    gdt_entries[num].granularity |= gran & 0xF0;
    gdt_entries[num].access      = access;
}

extern "C" void init_gdt() {
    gdt_ptr.limit = (sizeof(gdt_entry_struct) * 5) - 1;
    gdt_ptr.base  = (uint32_t)&gdt_entries;

    gdt_set_gate(0, 0, 0, 0, 0);                // Null segment
    gdt_set_gate(1, 0, 0xFFFFFFFF, 0x9A, 0xCF); // Code segment
    gdt_set_gate(2, 0, 0xFFFFFFFF, 0x92, 0xCF); // Data segment
    gdt_set_gate(3, 0, 0xFFFFFFFF, 0xFA, 0xCF); // User mode code segment
    gdt_set_gate(4, 0, 0xFFFFFFFF, 0xF2, 0xCF); // User mode data segment

    gdt_flush((uint32_t)&gdt_ptr);
}`
  },
  'idt.cpp': {
    name: 'idt.cpp',
    type: 'file',
    isCritical: true,
    content: `/* idt.cpp - Interrupt Descriptor Table Implementation */
#include <stdint.h>

struct idt_entry_struct {
    uint16_t base_lo;
    uint16_t sel;
    uint8_t  always0;
    uint8_t  flags;
    uint16_t base_hi;
} __attribute__((packed));

struct idt_ptr_struct {
    uint16_t limit;
    uint32_t base;
} __attribute__((packed));

idt_entry_struct idt_entries[256];
idt_ptr_struct   idt_ptr;

extern "C" void idt_set_gate(uint8_t num, uint32_t base, uint16_t sel, uint8_t flags) {
    idt_entries[num].base_lo = base & 0xFFFF;
    idt_entries[num].base_hi = (base >> 16) & 0xFFFF;
    idt_entries[num].sel     = sel;
    idt_entries[num].always0 = 0;
    idt_entries[num].flags   = flags;
}

extern "C" void init_idt() {
    idt_ptr.limit = sizeof(idt_entry_struct) * 256 - 1;
    idt_ptr.base  = (uint32_t)&idt_entries;

    // Zero out the IDT
    for(int i = 0; i < 256; i++) {
        idt_set_gate(i, 0, 0, 0);
    }

    // Load IDT (simulated)
    // asm volatile("lidt (%0)" : : "r" (&idt_ptr));
}`
  },
  'Almes_DOS.iso': {
    name: 'Almes_DOS.iso',
    type: 'file',
    content: JSON.stringify({
      magic: 'CD001_VCOS',
      version: '1.0',
      format: 'iso',
      compression: 'none',
      files: {
        'command.com': 'Almes-DOS command interpreter',
        'dino.exe': 'Retro Dino Jump Game executable',
        'autoexec.bat': '@ECHO OFF\nPROMPT $P$G\nPATH C:\\DOS\nLH MSCDEX.EXE /D:mscd001',
        'config.sys': 'DEVICE=C:\\DOS\\HIMEM.SYS\nFILES=30\nBUFFERS=15'
      },
      timestamp: Date.now()
    }, null, 2)
  },
  'VCOS_Linux_Baremetal.iso': {
    name: 'VCOS_Linux_Baremetal.iso',
    type: 'file',
    content: JSON.stringify({
      magic: 'CD001_VCOS',
      version: '3.0',
      format: 'iso',
      compression: 'none',
      files: {
        'vmlinuz-vcos': 'VCOS-Native Linux Kernel v5.19',
        'initrd-vcos.img': 'VCOS Initial RAM Disk & Drivers',
        'vcos_bridge.ko': 'VCOS Microkernel Bridge Driver',
        'vfs_mount.sh': 'Mount VCOS Virtual File System Root',
        'neofetch': 'VCOS System Information Tool',
        'rootfs': 'VCOS Native Root Filesystem'
      },
      timestamp: Date.now()
    }, null, 2)
  },
  'TempleOS_Lite.iso': {
    name: 'TempleOS_Lite.iso',
    type: 'file',
    content: JSON.stringify({
      magic: 'CD001_VCOS',
      version: '1.0',
      format: 'iso',
      compression: 'none',
      files: {
        'kernel.hc': 'TempleOS Kernel Source in HolyC',
        'templeos.sys': 'TempleOS System Executable',
        'oracle.hc': 'Query God\'s words'
      },
      timestamp: Date.now()
    }, null, 2)
  },
  'Win95_Rescue.iso': {
    name: 'Win95_Rescue.iso',
    type: 'file',
    content: JSON.stringify({
      magic: 'CD001_VCOS',
      version: '1.0',
      format: 'iso',
      compression: 'none',
      files: {
        'setup.exe': 'Microsoft Windows 95 Setup Wizard',
        'minesweeper.exe': 'Vintage Minesweeper Game',
        'win95.sys': 'Windows 95 System File'
      },
      timestamp: Date.now()
    }, null, 2)
  }
};

export class VirtualFileSystem {
  private files: Record<string, VFSFile> = { ...INITIAL_VFS };
  private readonly MAX_MEMORY = 1024 * 1024 * 1024; // 1 GB in bytes
  private readonly MAX_FILE_SIZE = 512 * 1024 * 1024; // 512 MB limit per file

  getUsedMemory() {
    return Object.values(this.files).reduce((acc, file) => acc + (file.content?.length || 0), 0);
  }

  getFreeMemory() {
    return this.MAX_MEMORY - this.getUsedMemory();
  }

  ls() {
    return Object.keys(this.files);
  }

  repair() {
    kernel.emitEvent('TASK', 'VFS: REPAIRING_SYSTEM_FILES...');
    Object.entries(INITIAL_VFS).forEach(([name, file]) => {
      if (file.isCritical) {
        this.files[name] = { ...file };
      }
    });
    this.save();
    kernel.emitEvent('TASK', 'VFS: SYSTEM_REPAIRED_SUCCESS');
  }

  make() {
    kernel.emitEvent('TASK', 'MAKE: STARTING_BUILD');
    const files = this.ls();
    const sourceFiles = files.filter(f => f.endsWith('.cpp') || f.endsWith('.s'));
    
    kernel.emitEvent('TASK', `MAKE: COMPILING ${sourceFiles.length} FILES...`);
    
    // Simulate compilation steps
    sourceFiles.forEach(f => {
      kernel.emitEvent('TASK', `CC -c ${f} -o ${f.replace(/\.(cpp|s)$/, '.o')}`);
    });

    const kernelCpp = this.getFile('kernel.cpp')?.content || '';
    const webBridgeCpp = this.getFile('vcos_web_bridge.cpp')?.content || '';

    const kernelBinContent = `[VC.os KERNEL BINARY]
TYPE: MULTIBOOT2_ELF
ARCH: i386
SECTIONS: .text, .rodata, .data, .bss
---
EMBEDDED_SOURCE_CODES:
=== kernel.cpp ===
${kernelCpp}
=== vcos_web_bridge.cpp ===
${webBridgeCpp}
`;
    this.write('kernel.bin', kernelBinContent);
    kernel.emitEvent('TASK', 'MAKE: LINKING kernel.bin');

    // Automatically package VC_OS.iso like grub-mkrescue does
    const filesToInclude = ['kernel.bin', 'boot.s', 'linker.ld', 'kernel.cpp', 'vcos_web_bridge.cpp', 'Makefile'];
    const archiveData: Record<string, string> = {};
    filesToInclude.forEach(p => {
      const file = this.getFile(p);
      if (file && file.type === 'file') {
        archiveData[p] = file.content;
      }
    });

    const archiveObject = {
      magic: 'CD001_VCOS',
      version: '1.0',
      format: 'iso',
      compression: 'none',
      files: archiveData,
      timestamp: Date.now()
    };

    this.write('VC_OS.iso', JSON.stringify(archiveObject, null, 2));
    kernel.emitEvent('TASK', 'MAKE: GENERATING VC_OS.iso (grub-mkrescue)');
    kernel.emitEvent('TASK', 'MAKE: BUILD_SUCCESSFUL');
    return 'kernel.bin and VC_OS.iso created successfully.';
  }

  getFile(name: string) {
    return this.files[name];
  }

  cat(name: string) {
    const file = this.files[name];
    if (!file) return `Error: File '${name}' not found.`;
    if (file.isCorrupted) throw new Error(`CRITICAL_FILE_CORRUPTION: ${name}`);
    return file.content;
  }

  write(name: string, content: string) {
    let finalContent = content;
    
    // 1. Limit individual file size
    if (finalContent.length > this.MAX_FILE_SIZE) {
      finalContent = finalContent.substring(0, this.MAX_FILE_SIZE);
    }

    // 2. Limit based on remaining total memory
    const currentSize = this.files[name] ? (this.files[name].content?.length || 0) : 0;
    const newSize = finalContent.length;
    const sizeDiff = newSize - currentSize;

    if (this.getUsedMemory() + sizeDiff > this.MAX_MEMORY) {
      const available = this.MAX_MEMORY - (this.getUsedMemory() - currentSize);
      if (available > 0) {
        finalContent = finalContent.substring(0, available);
      } else {
        kernel.emitEvent('CRITICAL', `VFS_OOM: ${name}`);
        throw new Error(`OUT_OF_MEMORY: Cannot write '${name}'. VFS is full.`);
      }
    }

    this.files[name] = { name, content: finalContent, type: 'file' };
    this.save();
    kernel.emitEvent('SYSCALL', `SYS_WRITE: ${name}`);
    
    if (name === 'kernel.sys') {
      kernel.onKernelUpdate(finalContent);
    }

    if (sizeDiff > 0) {
      kernel.allocateMemory(sizeDiff / (1024 * 1024));
    } else if (sizeDiff < 0) {
      kernel.freeMemory(Math.abs(sizeDiff) / (1024 * 1024));
    }
  }

  rm(name: string) {
    const file = this.files[name];
    if (file) {
      const size = file.content?.length || 0;
      if (file.isCritical) {
        delete this.files[name];
        this.save();
        kernel.emitEvent('CRITICAL', `SYS_UNLINK: ${name}`);
        throw new Error(`CRITICAL_FILE_REMOVED: ${name}`);
      }
      delete this.files[name];
      this.save();
      kernel.emitEvent('SYSCALL', `SYS_UNLINK: ${name}`);
      kernel.freeMemory(size / (1024 * 1024));
    }
  }

  corrupt(name: string) {
    if (this.files[name]) {
      this.files[name].isCorrupted = true;
      this.save();
      kernel.emitEvent('CRITICAL', `VFS_CORRUPT: ${name}`);
    }
  }

  tar(name: string, filePaths: string[]) {
    const archiveData: Record<string, string> = {};
    filePaths.forEach(path => {
      const file = this.files[path];
      if (file && file.type === 'file') {
        archiveData[path] = file.content;
      }
    });
    const content = JSON.stringify({
      magic: 'VCOS_TAR_XZ',
      version: '1.0',
      files: archiveData
    });
    this.write(name, content);
  }

  untar(name: string) {
    const content = this.cat(name);
    try {
      // Try to parse as our simulated JSON format
      if (content.trim().startsWith('{')) {
        const data = JSON.parse(content);
        if (data.magic === 'VCOS_TAR_XZ') {
          const extractedFiles: string[] = [];
          Object.entries(data.files).forEach(([path, fileContent]) => {
            this.write(path as string, fileContent as string);
            extractedFiles.push(path as string);
          });
          return extractedFiles;
        }
      }
      
      // Fallback: If it's a "real" file (binary or unknown text), 
      // simulate a successful extraction of a single binary
      const baseName = name.split('/').pop()?.split('.')[0] || 'app';
      const binPath = `bin/${baseName}`;
      this.write(binPath, `#!/bin/bash\necho "Executing native Linux binary: ${baseName}..."\n# Simulated execution of raw buffer`);
      return [binPath];
    } catch (e) {
      // Even if JSON parsing fails, we fallback to the binary simulation
      const baseName = name.split('/').pop()?.split('.')[0] || 'app';
      const binPath = `bin/${baseName}`;
      this.write(binPath, `#!/bin/bash\necho "Executing native Linux binary: ${baseName}..."\n# Simulated execution of raw buffer`);
      return [binPath];
    }
  }

  private currentUser: string | null = null;

  setCurrentUser(user: string | null) {
    this.currentUser = user;
    if (user === 'Guest') {
      this.files = { ...INITIAL_VFS };
    } else if (user) {
      this.load(user);
    } else {
        this.files = { ...INITIAL_VFS };
    }
  }

  save() {
    if (!this.currentUser || this.currentUser === 'Guest') return;
    localStorage.setItem(`vcos_vfs_data_${this.currentUser}`, JSON.stringify(this.files));
  }

  load(user?: string) {
    const targetUser = user || this.currentUser;
    if (!targetUser || targetUser === 'Guest') return;

    const saved = localStorage.getItem(`vcos_vfs_data_${targetUser}`);
    if (saved) {
      try {
        const loadedFiles = JSON.parse(saved);
        this.files = { ...INITIAL_VFS, ...loadedFiles };
        
        // Ensure essential (critical) files from INITIAL_VFS are always present and up-to-date
        Object.entries(INITIAL_VFS).forEach(([name, file]) => {
          if (file.isCritical) {
            // Force reset critical files to ensure latest system updates (Makefile, boot.s, etc)
            this.files[name] = { ...file };
          }
        });

        if (this.files['kernel.sys']) {
          const isValid = kernel.onKernelUpdate(this.files['kernel.sys'].content);
          if (!isValid) {
            // If the kernel is invalid, restore it from INITIAL_VFS
            this.files['kernel.sys'] = { ...INITIAL_VFS['kernel.sys'] };
            this.save();
            kernel.onKernelUpdate(this.files['kernel.sys'].content);
          }
        }
      } catch (e) {
        console.error('Failed to load VFS from localStorage', e);
        this.files = { ...INITIAL_VFS };
      }
    } else {
      this.files = { ...INITIAL_VFS };
    }
  }
}

export const vfs = new VirtualFileSystem();
vfs.load();
