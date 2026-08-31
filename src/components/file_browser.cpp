#include "vcos.h"

/**
 * VC.os Kernel File Browser
 * Freestanding C++20 Implementation
 * 
 * This component provides low-level directory navigation and file listing.
 * It interacts directly with the VC.os HAL.
 */

namespace vcos_fs {
    using namespace vcos;

    struct FileEntry {
        char name[32];
        bool is_directory;
        size_t size;
    };

    struct Directory {
        char path[64];
        FileEntry entries[16];
        uint8_t count;
    };

    // Simulated Filesystem Data (Kernel-level)
    static Directory root_dir = {
        "/",
        {
            {"sys", true, 0},
            {"docs", true, 0},
            {"boot.cfg", false, 512},
            {"kernel.bin", false, 1048576},
            {"README.txt", false, 2048},
            {"logo.Picture", false, 65536}
        },
        6
    };

    static Directory sys_dir = {
        "/sys",
        {
            {"drivers", true, 0},
            {"hal.bin", false, 256000},
            {"init.cfg", false, 1024}
        },
        3
    };

    class KernelBrowser {
    private:
        Directory* current_dir;
        uint8_t selected_index;

    public:
        KernelBrowser() : current_dir(&root_dir), selected_index(0) {}

        void draw() {
            vcos_clear_screen();
            vcos_set_cursor(0, 0);
            vcos_print("--- VC.os Kernel File Browser v1.0 ---\n");
            vcos_print("Current Path: ");
            vcos_print(current_dir->path);
            vcos_print("\n\n");

            for (uint8_t i = 0; i < current_dir->count; i++) {
                if (i == selected_index) {
                    vcos_print(" > [ ");
                } else {
                    vcos_print("   [ ");
                }

                vcos_print(current_dir->entries[i].name);
                
                if (current_dir->entries[i].is_directory) {
                    vcos_print(" ] (DIR)\n");
                } else {
                    vcos_print(" ] (FILE)\n");
                }
            }

            vcos_print("\n[W/S] Navigate | [ENTER] Open | [ESC] Exit\n");
        }

        void run() {
            bool running = true;
            while (running) {
                draw();
                uint8_t key = vcos_get_key();

                switch (key) {
                    case 'w': // UP
                    case 'W':
                        if (selected_index > 0) selected_index--;
                        break;
                    case 's': // DOWN
                    case 'S':
                        if (selected_index < current_dir->count - 1) selected_index++;
                        break;
                    case 13: // ENTER
                        handle_enter();
                        break;
                    case 27: // ESC
                        running = false;
                        break;
                }
            }
        }

    private:
        void handle_enter() {
            FileEntry& entry = current_dir->entries[selected_index];
            if (entry.is_directory) {
                if (str_compare(entry.name, "sys")) {
                    current_dir = &sys_dir;
                    selected_index = 0;
                } else if (str_compare(entry.name, "..")) {
                    current_dir = &root_dir;
                    selected_index = 0;
                }
            } else {
                vcos_print("\nOpening file: ");
                vcos_print(entry.name);
                vcos_print("...\n");
                // Simulated file read
                for (volatile int i = 0; i < 1000000; i++); 
            }
        }
    };
}

/**
 * Entry Point for VC.os Kernel Loader
 */
extern "C" void kernel_main() {
    vcos_fs::KernelBrowser browser;
    browser.run();
}

/**
 * VMWARE BOOT INSTRUCTIONS:
 * 1. Open VMware Workstation Player.
 * 2. Mount vcos.img or VC_OS.iso as a Bootable Drive.
 * 3. Ensure memory is set to 256M and Network is NAT.
 * 
 * BUILD COMMAND (Freestanding C++20):
 * x86_64-elf-g++ -ffreestanding -O2 -Wall -Wextra -fno-exceptions -fno-rtti -std=c++20 \
 *   -c file_browser.cpp -o file_browser.o
 * x86_64-elf-ld -T linker.ld -o vcos.img file_browser.o
 */
