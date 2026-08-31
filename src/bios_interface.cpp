#include "bios_interface.h"

extern "C" {

    void bios_print_char(char c) {
        // BIOS Teletype output (INT 0x10, AH=0x0E)
        asm volatile (
            "mov $0x0E, %%ah\n"
            "mov %0, %%al\n"
            "int $0x10"
            : : "r" (c) : "eax"
        );
    }

    void bios_print_string(const char* str) {
        while (*str) {
            bios_print_char(*str++);
        }
    }

    uint16_t bios_get_memory_size() {
        uint16_t mem_size = 0;
        // BIOS Get Memory Size (INT 0x12)
        asm volatile (
            "int $0x12\n"
            "mov %%ax, %0"
            : "=r" (mem_size) : : "ax"
        );
        return mem_size;
    }

    void bios_reboot() {
        // Jump to BIOS Reset Vector (FFFF:0000)
        asm volatile ("ljmp $0xFFFF, $0x0000");
    }
}