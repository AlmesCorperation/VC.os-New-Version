import { kernel } from './kernel';

export const PAGE_SIZE = 4096; // 4KB
export const TOTAL_RAM = 128 * 1024 * 1024; // 128MB
export const TOTAL_PAGES = TOTAL_RAM / PAGE_SIZE; // 32,768 pages
export const BITMAP_SIZE = TOTAL_PAGES / 8; // 4,096 bytes

export interface Allocation {
  id: string; // Identifier for the process/UI
  startPage: number;
  numPages: number;
}

class MemoryManager {
  public bitmap: Uint8Array = new Uint8Array(BITMAP_SIZE);
  public allocations: Allocation[] = [];
  private listeners: Set<() => void> = new Set();
  
  constructor() {
    // Reserve KERNEL Space (first 2MB = 512 pages)
    this.allocatePages('KERNEL_CORE', 512);
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  public setBitmap(newBitmap: Uint8Array) {
    if (newBitmap.length === BITMAP_SIZE) {
      this.bitmap = new Uint8Array(newBitmap);
      this.notify();
    }
  }

  public getStats() {
    let used = 0;
    for (let i = 0; i < this.bitmap.length; i++) {
        let byte = this.bitmap[i];
        while (byte > 0) {
            if (byte & 1) used++;
            byte >>= 1;
        }
    }
    return { used, free: TOTAL_PAGES - used };
  }

  public allocatePages(id: string, count: number): number {
    let allocated = 0;
    let startIndex = -1;
    
    // Find contiguous space if possible, or just fragment (we fragment here since it's a simple bitmap)
    // Actually, for it to be ACTUALLY useful and realistic, we should try contiguous first
    
    let contiguousFound = false;
    let currentRun = 0;
    let currentStartIndex = -1;

    for (let i = 0; i < TOTAL_PAGES; i++) {
      const idx = Math.floor(i / 8);
      const bit = i % 8;
      const isUsed = this.bitmap[idx] & (1 << bit);
      
      if (!isUsed) {
        if (currentRun === 0) currentStartIndex = i;
        currentRun++;
        if (currentRun === count) {
           contiguousFound = true;
           startIndex = currentStartIndex;
           break;
        }
      } else {
        currentRun = 0;
      }
    }

    if (contiguousFound && startIndex !== -1) {
      for (let i = startIndex; i < startIndex + count; i++) {
        const idx = Math.floor(i / 8);
        const bit = i % 8;
        this.bitmap[idx] |= (1 << bit);
      }
      this.allocations.push({ id, startPage: startIndex, numPages: count });
      this.notify();
      return startIndex;
    }

    // Fallback: fragmented allocation
    startIndex = -1;
    let pagesToAllocate: number[] = [];
    for (let i = 0; i < TOTAL_PAGES && pagesToAllocate.length < count; i++) {
      const idx = Math.floor(i / 8);
      const bit = i % 8;
      if (!(this.bitmap[idx] & (1 << bit))) {
        pagesToAllocate.push(i);
        if (startIndex === -1) startIndex = i;
      }
    }

    if (pagesToAllocate.length === count) {
      pagesToAllocate.forEach(page => {
        const idx = Math.floor(page / 8);
        const bit = page % 8;
        this.bitmap[idx] |= (1 << bit);
      });
      // Store a fragmented allocation as a single block starting at the first page 
      // (not strictly accurate for physical mapping but ok for simple unfree)
      this.allocations.push({ id, startPage: startIndex, numPages: count });
      this.notify();
      return startIndex;
    }

    // Out of memory!
    throw new Error('OUT_OF_MEMORY');
  }

  public freeAllocation(id: string) {
    const allocIndexes = [];
    for (let i = 0; i < this.allocations.length; i++) {
      if (this.allocations[i].id === id) allocIndexes.push(i);
    }
    
    // Iterate backwards so splicing doesn't mess up indexes
    for (let i = allocIndexes.length - 1; i >= 0; i--) {
      const index = allocIndexes[i];
      const alloc = this.allocations[index];
      let freed = 0;
      let pageIndex = alloc.startPage;
      
      // Since it could be fragmented, we try to free contiguous first, 
      // but in this model unfreeing might be slightly imperfect if heavily fragmented.
      // We will free sequentially for now based on what we recorded.
      while(freed < alloc.numPages && pageIndex < TOTAL_PAGES) {
          const byteIdx = Math.floor(pageIndex / 8);
          const bitIdx = pageIndex % 8;
          if ((this.bitmap[byteIdx] & (1 << bitIdx))) {
              this.bitmap[byteIdx] &= ~(1 << bitIdx);
              freed++;
          }
          pageIndex++;
      }
      this.allocations.splice(index, 1);
    }
    this.notify();
  }
}

export const memoryManager = new MemoryManager();
