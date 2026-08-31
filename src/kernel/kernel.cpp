/* kernel.cpp - Almes Corp Bare Metal Core */

/**
 * VC.os v1.0.4 - Bare Metal Implementation
 * This code is 'freestanding' (no standard library).
 * It writes directly to the VGA text buffer at 0xB8000.
 */

// The VGA buffer is a fixed memory address on all x86 PCs
// Writing here displays text on the physical monitor.
static short* const vga_buffer = (short*)0xB8000;

// Color codes for the "Vibe-code" look (Light Purple on Black)
// 0x0D: Light Purple (Foreground), 0x0: Black (Background)
static const unsigned char vcos_color = 0x0D; 

/**
 * @brief Write a single character to the VGA buffer.
 * @param c The character to write.
 * @param x The column (0-79).
 * @param y The row (0-24).
 */
void terminal_put_char(char c, int x, int y) {
    const int index = y * 80 + x;
    // Each character on screen takes 2 bytes: [Character][Color]
    vga_buffer[index] = (vcos_color << 8) | c;
}

/**
 * @brief Entry point for the Almes Corp Kernel.
 * This is called from boot.s after the Multiboot2 header is verified.
 */
extern "C" void kernel_main() {
    // 1. Disable Interrupts (Redundant but safe)
    asm volatile("cli");

    // 2. Clear the screen (Resetting the simulated 'Health' state)
    for (int i = 0; i < 80 * 25; i++) {
        vga_buffer[i] = (vcos_color << 8) | ' ';
    }

    // 3. Write the System Identity
    const char* msg = "ALMES CORP - VC.os v1.0.4 [REAL METAL]";
    for (int i = 0; msg[i] != '\0'; i++) {
        terminal_put_char(msg[i], i, 0);
    }

    // 4. Write Status Message
    const char* status = "VC.os v1.0.4 Online - System Integrity: NOMINAL";
    for (int i = 0; status[i] != '\0'; i++) {
        terminal_put_char(status[i], i, 1);
    }

    // 5. Enter the Infinite Health-Check Loop
    // In a real OS, we never "return" or "exit"
    while (1) {
        // Diagnostic Logic / Idle Loop
        asm volatile("hlt");
    }
}
