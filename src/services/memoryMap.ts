/**
 * VC.os MEMORY MAPPING PROFILE (v1.0.4)
 * TypeScript implementation of memory_map.h
 */

export const MemoryMap = {
  // --- CRITICAL SYSTEM ZONES (READ-ONLY/LOCKED) ---
  IVT_START: 0x00000000, // Interrupt Vector Table
  BDA_START: 0x00000400, // BIOS Data Area
  BOOTLOADER_ENTRY: 0x00007C00, // Entry point for .asm
  KERNEL_CORE_START: 0x00100000, // The Heart of VC.os

  // --- VISUAL & UI ZONES (WRITE-ONLY/RW) ---
  VGA_BUFFER_START: 0x000B8000, // Text Mode / RSOD Logic
  SPECTRUM_UI_BUFFER: 0x01000000, // React/TSX Visual Layers

  // --- APPLICATION & ENGINE HEAPS ---
  VC_ENGINE_HEAP: 0x20000000, // 3D Data & Asset Pipeline
  VC_STORE_HEAP: 0x40000000, // Dynamic App Allocation
  VC_LINUX_BRIDGE: 0x80000000, // Virtualized Subsystem

  /**
   * Check if a memory address is safe for AI-writing.
   * @returns true if the address is in a RW (Read-Write) zone.
   */
  isSafeZone: (address: number): boolean => {
    if (address >= MemoryMap.SPECTRUM_UI_BUFFER && address < 0xFFFFFFFF) {
      return true; // Safe for UI and Engine operations
    }
    return false; // Potentially triggers RSOD (Kernel/BIOS Protection)
  }
};
