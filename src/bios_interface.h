#ifndef BIOS_INTERFACE_H
#define BIOS_INTERFACE_H

#include <stdint.h>

// Represents register state for BIOS interrupt calls
typedef struct {
    uint32_t eax, ebx, ecx, edx, esi, edi, ebp, esp;
} bios_regs_t;

// BIOS Interface functions
extern "C" {
    void bios_print_char(char c);
    void bios_print_string(const char* str);
    uint16_t bios_get_memory_size();
    void bios_reboot();
}

#endif // BIOS_INTERFACE_H