#ifndef VCOS_H
#define VCOS_H

/**
 * VC.os Mandatory Kernel Header
 * Version: 1.0.0
 * Lead Architect: [REDACTED]
 * 
 * This header defines the low-level interface for the VC.os kernel.
 * All freestanding components must include this header.
 */

namespace vcos {
    typedef unsigned long size_t;
    typedef unsigned int uint32_t;
    typedef unsigned char uint8_t;
    typedef unsigned short uint16_t;

    // Hardware Abstraction Layer (HAL)
    extern "C" {
        void vcos_print(const char* str);
        void vcos_print_char(char c);
        void vcos_clear_screen();
        uint8_t vcos_get_key();
        void vcos_set_cursor(uint8_t x, uint8_t y);
    }

    // Basic string utilities for freestanding environment
    inline void print_str(const char* str) {
        vcos_print(str);
    }

    inline bool str_compare(const char* s1, const char* s2) {
        while (*s1 && (*s1 == *s2)) {
            s1++;
            s2++;
        }
        return *(unsigned char*)s1 - *(unsigned char*)s2 == 0;
    }
}

#endif // VCOS_H
