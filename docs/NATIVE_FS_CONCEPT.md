# VC.os Native File System (".file" & ".picture")

This document outlines the design and implementation of a native, raw C++ file system for a true bare-metal version of VC.os. It supports standard data files (`.file`), image files (`.picture`), and a hierarchical directory structure.

## 1. Boot Sector Code (`boot.asm`)

To load the VC.os kernel and initialize the file system, we need a 16-bit real-mode boot sector. This code is written in NASM, fits in the first 512 bytes of the disk, and uses BIOS interrupts to load the kernel from the disk into memory before jumping to it.

```nasm
[BITS 16]
[ORG 0x7C00]

start:
    ; Set up segments and stack
    cli
    xor ax, ax
    mov ds, ax
    mov es, ax
    mov ss, ax
    mov sp, 0x7C00
    sti

    ; Print loading message
    mov si, msg_loading
    call print_string

    ; Load Kernel from disk (LBA 1, reading 50 sectors)
    ; Assuming kernel is immediately after boot sector
    mov ah, 0x02      ; BIOS read sector function
    mov al, 50        ; Number of sectors to read
    mov ch, 0         ; Cylinder 0
    mov cl, 2         ; Sector 2 (1-indexed, sector 1 is bootloader)
    mov dh, 0         ; Head 0
    mov bx, 0x1000    ; Load kernel to 0x1000:0000 (0x10000)
    mov es, bx
    xor bx, bx
    int 0x13
    jc disk_error

    ; Jump to kernel
    jmp 0x1000:0000

disk_error:
    mov si, msg_error
    call print_string
    jmp $

print_string:
    mov ah, 0x0E
.loop:
    lodsb
    test al, al
    jz .done
    int 0x10
    jmp .loop
.done:
    ret

msg_loading db "Loading VC.os...", 0x0D, 0x0A, 0
msg_error   db "Disk read error!", 0x0D, 0x0A, 0

times 510-($-$$) db 0
dw 0xAA55 ; Boot signature
```

## 2. File System Design & C++ Implementation (`fs.cpp`)

The file system uses a contiguous-allocation strategy. It supports directories by assigning each entry a `parent_id`.

```cpp
#include <stdint.h>
#include <string.h>

extern void ata_read_sectors(uint32_t lba, uint8_t sectors, void* buffer);
extern void ata_write_sectors(uint32_t lba, uint8_t sectors, void* buffer);
extern void print_string(const char* str);

#define FS_MAGIC 0x56434F53 // "VCOS"
#define MAX_ENTRIES 256
#define MAX_FILENAME 28
#define BLOCK_SIZE 512
#define FS_START_LBA 100

enum EntryType {
    TYPE_FREE = 0,
    TYPE_FILE = 1,      // .file
    TYPE_PICTURE = 2,   // .picture
    TYPE_DIR = 3        // Directory
};

struct FSEntry {
    uint8_t type;
    uint8_t parent_id; // 0 = root
    char name[MAX_FILENAME];
    uint32_t start_block;
    uint32_t size_bytes;
} __attribute__((packed));

struct Superblock {
    uint32_t magic;
    uint32_t total_blocks;
    uint32_t next_free_block;
    FSEntry entries[MAX_ENTRIES];
} __attribute__((packed));

class VCOSFileSystem {
private:
    Superblock sb;

    void saveSuperblock() {
        ata_write_sectors(FS_START_LBA, sizeof(Superblock) / BLOCK_SIZE + 1, &sb);
    }

    int findFreeEntry() {
        for (int i = 1; i < MAX_ENTRIES; i++) { // 0 is reserved for root
            if (sb.entries[i].type == TYPE_FREE) return i;
        }
        return -1;
    }

public:
    void init() {
        ata_read_sectors(FS_START_LBA, sizeof(Superblock) / BLOCK_SIZE + 1, &sb);
        if (sb.magic != FS_MAGIC) {
            format();
        }
    }

    void format() {
        sb.magic = FS_MAGIC;
        sb.total_blocks = 20480; // 10MB
        sb.next_free_block = FS_START_LBA + (sizeof(Superblock) / BLOCK_SIZE) + 1;
        
        for (int i = 0; i < MAX_ENTRIES; i++) sb.entries[i].type = TYPE_FREE;
        
        // Setup Root Directory
        sb.entries[0].type = TYPE_DIR;
        sb.entries[0].parent_id = 0;
        strcpy(sb.entries[0].name, "root");
        
        saveSuperblock();
    }

    // CREATE FILE OR PICTURE
    bool createFile(const char* name, uint8_t parent_id, EntryType type, const uint8_t* data, uint32_t size) {
        int idx = findFreeEntry();
        if (idx == -1) return false;

        uint32_t blocks_needed = (size + BLOCK_SIZE - 1) / BLOCK_SIZE;
        ata_write_sectors(sb.next_free_block, blocks_needed, (void*)data);

        sb.entries[idx].type = type;
        sb.entries[idx].parent_id = parent_id;
        strncpy(sb.entries[idx].name, name, MAX_FILENAME - 1);
        sb.entries[idx].start_block = sb.next_free_block;
        sb.entries[idx].size_bytes = size;

        sb.next_free_block += blocks_needed;
        saveSuperblock();
        return true;
    }

    // CREATE DIRECTORY
    bool createDir(const char* name, uint8_t parent_id) {
        int idx = findFreeEntry();
        if (idx == -1) return false;

        sb.entries[idx].type = TYPE_DIR;
        sb.entries[idx].parent_id = parent_id;
        strncpy(sb.entries[idx].name, name, MAX_FILENAME - 1);
        sb.entries[idx].size_bytes = 0;
        
        saveSuperblock();
        return true;
    }

    // READ FILE
    bool readFile(const char* name, uint8_t parent_id, uint8_t* buffer) {
        for (int i = 0; i < MAX_ENTRIES; i++) {
            if (sb.entries[i].type != TYPE_FREE && 
                sb.entries[i].parent_id == parent_id && 
                strcmp(sb.entries[i].name, name) == 0) {
                
                uint32_t blocks = (sb.entries[i].size_bytes + BLOCK_SIZE - 1) / BLOCK_SIZE;
                ata_read_sectors(sb.entries[i].start_block, blocks, buffer);
                return true;
            }
        }
        return false;
    }

    // DELETE FILE OR DIRECTORY
    bool deleteEntry(const char* name, uint8_t parent_id) {
        for (int i = 0; i < MAX_ENTRIES; i++) {
            if (sb.entries[i].type != TYPE_FREE && 
                sb.entries[i].parent_id == parent_id && 
                strcmp(sb.entries[i].name, name) == 0) {
                
                // If it's a directory, we should ideally check if it's empty first
                // For simplicity, we just mark the entry as free
                sb.entries[i].type = TYPE_FREE;
                saveSuperblock();
                return true;
            }
        }
        return false;
    }

    // LIST DIRECTORY
    void listDir(uint8_t dir_id) {
        print_string("--- Directory Listing ---\n");
        for (int i = 0; i < MAX_ENTRIES; i++) {
            if (sb.entries[i].type != TYPE_FREE && sb.entries[i].parent_id == dir_id && i != 0) {
                print_string(sb.entries[i].name);
                if (sb.entries[i].type == TYPE_DIR) print_string(" [DIR]\n");
                else if (sb.entries[i].type == TYPE_PICTURE) print_string(" [.picture]\n");
                else print_string(" [.file]\n");
            }
        }
    }
};

VCOSFileSystem fs;
```

## 3. Framebuffer Integration

In a bare-metal environment, the bootloader (or GRUB/Multiboot) sets up a VESA Linear Framebuffer (LFB). This is a raw chunk of memory where each pixel is represented by bytes (e.g., 32-bit ARGB).

To integrate `.picture` files with the framebuffer:
1. The OS allocates a memory buffer.
2. The OS calls `fs.readFile("bg.picture", 0, buffer)`.
3. The `.picture` file format is parsed (e.g., a raw array of 32-bit pixels or a simple header + RGB data).
4. The OS copies the pixel data directly to the LFB address.

```cpp
// Assuming VESA LFB is at 0xFD000000 and screen is 1024x768 32-bit
uint32_t* framebuffer = (uint32_t*)0xFD000000;

void draw_picture(const char* filename, uint8_t parent_id, int start_x, int start_y) {
    // Allocate 1MB buffer for the image
    uint8_t* img_buffer = (uint8_t*)0x2000000; 
    
    if (fs.readFile(filename, parent_id, img_buffer)) {
        // Assume .picture format: [Width: 4 bytes] [Height: 4 bytes] [Pixel Data...]
        uint32_t width = *((uint32_t*)img_buffer);
        uint32_t height = *((uint32_t*)(img_buffer + 4));
        uint32_t* pixels = (uint32_t*)(img_buffer + 8);

        for (uint32_t y = 0; y < height; y++) {
            for (uint32_t x = 0; x < width; x++) {
                int screen_x = start_x + x;
                int screen_y = start_y + y;
                
                // Bounds checking
                if (screen_x >= 0 && screen_x < 1024 && screen_y >= 0 && screen_y < 768) {
                    framebuffer[screen_y * 1024 + screen_x] = pixels[y * width + x];
                }
            }
        }
    } else {
        print_string("Failed to load .picture file!\n");
    }
}
```
