/* boot.s - Almes Corp Multiboot2 Entry */

/* Multiboot2 Header Constants */
.set MAGIC,    0xE85250D6                /* Multiboot2 Magic Number */
.set ARCH,     0                         /* i386 (32-bit) */
.set LENGTH,   (multiboot_header_end - multiboot_header)
.set CHECKSUM, -(MAGIC + ARCH + LENGTH)

.section .multiboot
.align 8
multiboot_header:
    .long MAGIC
    .long ARCH
    .long LENGTH
    .long CHECKSUM

    /* Multiboot2 Tags */
    .short 0    /* Type: End Tag */
    .short 0    /* Flags */
    .long 8     /* Size */
multiboot_header_end:

.section .bss
.align 16
stack_bottom:
    .skip 16384 /* 16 KiB Stack */
stack_top:

.section .text
.global _start
.type _start, @function
_start:
    /* 1. Setup Stack */
    mov $stack_top, %esp

    /* 2. Disable Interrupts (CLI) */
    cli

    /* 3. Jump to C++ Kernel Main */
    call kernel_main

    /* 4. Halt if kernel returns */
hang:
    hlt
    jmp hang

.size _start, . - _start
