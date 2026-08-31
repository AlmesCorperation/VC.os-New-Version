# VC.os Master Makefile
# Handles Bare-Metal Kernel, Rust/Wasm Nolona Engine, and TypeScript Frontend

# --- Toolchain Settings ---
# Bare-metal
CC = i686-elf-gcc
AS = nasm
LD = i686-elf-ld

# Web
WASM_PACK = wasm-pack
NPM = npm

# --- Compiler Flags ---
CFLAGS = -ffreestanding -O2 -Wall -Wextra -fno-exceptions -fno-rtti
LDFLAGS = -ffreestanding -O2 -nostdlib

# --- Directories ---
KERNEL_SRC = src
NOLONA_DIR = nolona-engine
APP_ROOT = . 

# --- Phony Targets ---
.PHONY: all kernel nolona app clean

all: kernel nolona app

# Build the Bare-Metal Kernel
kernel:
	@echo "--- Building Kernel ---"
	$(AS) -f bin $(KERNEL_SRC)/boot.asm -o bios.bin
	$(CC) $(CFLAGS) -c $(KERNEL_SRC)/kernel.cpp -o kernel.o
	$(CC) $(CFLAGS) -c $(KERNEL_SRC)/bios_interface.cpp -o bios_interface.o
	$(LD) $(LDFLAGS) -T linker.ld -o kernel.bin kernel.o bios_interface.o

# Build the Nolona Rust/Wasm Engine
nolona:
	@echo "--- Building Nolona Wasm ---"
	cd $(NOLONA_DIR) && $(WASM_PACK) build --target web

# Build the TypeScript/React Frontend
app:
	@echo "--- Building Web App ---"
	$(NPM) install
	$(NPM) run build

# Clean everything
clean:
	@echo "--- Cleaning ---"
	rm -f *.o *.bin
	cd $(NOLONA_DIR) && rm -rf pkg target
	# Adjust 'build' to 'dist' if you changed your output directory
	rm -rf build dist node_modules