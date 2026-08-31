/* VC.os | (c) 2026 Keo Doolish | CC BY-NC-ND 4.0 | FULL BARE-BONES OS */
/* x86_64 Freestanding C++ Kernel */

#define VIDEO_MEMORY 0xB8000
#define SCREEN_WIDTH 80
#define SCREEN_HEIGHT 25
#define ERROR_STATE_ADDR 0xBB000

typedef unsigned char uint8_t;
typedef unsigned short uint16_t;
typedef unsigned int uint32_t;

void clear_screen() {
    uint16_t* video = (uint16_t*)VIDEO_MEMORY;
    for (int i = 0; i < SCREEN_WIDTH * SCREEN_HEIGHT; i++) {
        video[i] = (uint16_t)0x0720; // Light grey on black space
    }
}

void print(const char* str, uint8_t color, int x, int y) {
    uint16_t* video = (uint16_t*)VIDEO_MEMORY;
    int offset = y * SCREEN_WIDTH + x;
    for (int i = 0; str[i] != '\0'; i++) {
        video[offset + i] = (uint16_t)((color << 8) | str[i]);
    }
}

void kernel_panic(const char* message) {
    clear_screen();
    print("!!! KERNEL PANIC !!!", 0x4F, 30, 10); // White on Red
    print(message, 0x0F, 30, 12);
    while (1) {
        asm volatile("hlt");
    }
}

extern "C" void kernel_main() {
    clear_screen();
    
    // Check for error state at 0xBB000
    volatile uint32_t* error_state = (volatile uint32_t*)ERROR_STATE_ADDR;
    if (*error_state != 0) {
        kernel_panic("CRITICAL ERROR DETECTED AT 0xBB000");
    }

    // Spectrum Gradient Palette Simulation (Text Mode)
    print("VC.os KERNEL v1.0.4 ONLINE", 0x0E, 0, 0); // Yellow
    print("--------------------------", 0x04, 0, 1); // Red
    print("BOOT MODE: MULTIBOOT2 x86_64", 0x0B, 0, 2); // Cyan
    print("STATUS: NOMINAL", 0x0A, 0, 3);    // Light Green
    print("READY.", 0x02, 0, 4);             // Green

    while (1) {
        // Halt CPU until next interrupt
        asm volatile("hlt");
    }
}
