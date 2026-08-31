section .multiboot_header
header_start:
    ; Magic number
    dd 0xe85250d6                ; multiboot2 magic number
    ; Architecture
    dd 0                         ; protected mode i386
    ; Header length
    dd header_end - header_start
    ; Checksum
    dd 0x100000000 - (0xe85250d6 + 0 + (header_end - header_start))

    ; Optional multiboot tags
    ; ...

    ; End tag
    dw 0    ; type
    dw 0    ; flags
    dd 8    ; size
header_end:
