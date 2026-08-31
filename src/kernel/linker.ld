/* linker.ld - Almes Corp Linker Script */

ENTRY(_start)

SECTIONS
{
    /* The kernel is loaded at 1MB (0x100000) as per memory_map.h */
    . = 1M;

    /* Multiboot2 Header MUST be at the beginning of the file */
    .text :
    {
        *(.multiboot)
        *(.text)
    }

    /* Read-only data */
    .rodata :
    {
        *(.rodata)
    }

    /* Read-write data (initialized) */
    .data :
    {
        *(.data)
    }

    /* Read-write data (uninitialized) and stack */
    .bss :
    {
        *(COMMON)
        *(.bss)
    }

    /* The compiler may produce other sections, by default we include them */
    /DISCARD/ :
    {
        *(.comment)
    }
}
