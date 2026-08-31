# VC.os Build and Run Instructions

## Prerequisites
- `nasm` (for assembly)
- `x86_64-elf-gcc` (for kernel)
- `vmware-workstation-player`

## Build Steps
1. Assemble the bootloader:
   `nasm -f bin boot.asm -o boot.bin`

2. Compile the kernel:
   `x86_64-elf-gcc -ffreestanding -c kernel.sys -o kernel.o`

3. Link:
   `x86_64-elf-ld -o os.bin -Ttext 0x1000 kernel.o --oformat binary`

4. Create floppy image:
   `cat boot.bin os.bin > vc_os.img`

## Run Command (Simulated)
1. Open VMware Workstation Player.
2. Load the vc_os.img as a raw disk or mount the VC_OS.iso.

---

## Multiboot2 (Bare Metal) x86_64 Build
For modern x86_64 systems using Multiboot2:

1. Assemble the Multiboot header and entry point:
   `nasm -f elf64 multiboot_header.asm -o multiboot_header.o`
   `nasm -f elf64 boot.asm -o boot.o`

2. Compile the kernel:
   `x86_64-elf-gcc -c kernel.cpp -o kernel.o -ffreestanding -O2 -Wall -Wextra -fno-exceptions -fno-rtti`

3. Link with the custom script:
   `x86_64-elf-ld -n -T linker.ld -o vc_os.bin multiboot_header.o boot.o kernel.o`

4. Verify Multiboot2 header:
   `grub-file --is-x86-multiboot2 vc_os.bin`

5. Run with VMware:
   Mount the resulting ISO in VMware Workstation Player.
