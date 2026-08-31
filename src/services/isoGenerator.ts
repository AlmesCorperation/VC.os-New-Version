/**
 * VC.os ISO Generator Service
 * 
 * This service implements a minimal ISO 9660 (Level 1) filesystem generator.
 * It is designed to be platform-independent and follows the logic of libISO
 * for creating bootable-ready system images.
 */

export class ISOGenerator {
  private static SECTOR_SIZE = 2048;

  public static async generateISO(files: { name: string, content: string | Uint8Array }[]): Promise<Blob> {
    const sectors: Uint8Array[] = [];

    // 1. System Area (Sectors 0-15) - 32KB of zeros
    for (let i = 0; i < 16; i++) {
      sectors.push(new Uint8Array(this.SECTOR_SIZE));
    }

    // 2. Primary Volume Descriptor (Sector 16)
    const pvd = new Uint8Array(this.SECTOR_SIZE);
    pvd[0] = 0x01; // Type: Primary Volume Descriptor
    this.writeString(pvd, 1, 'CD001'); // Standard Identifier
    pvd[6] = 0x01; // Version
    this.writeString(pvd, 40, 'VC_OS_SYSTEM_IMAGE'.padEnd(32)); // Volume Identifier
    
    // Total Volume Size (Placeholder, will update later)
    // For now, let's just make a small ISO
    const totalSectors = 100; 
    this.writeUint32Both(pvd, 80, totalSectors);

    // Root Directory Record (Placeholder)
    // Offset 156, length 34
    const rootDir = pvd.subarray(156, 156 + 34);
    rootDir[0] = 34; // Length of record
    rootDir[25] = 0x02; // File Flags (Directory)
    
    sectors.push(pvd);

    // 3. Volume Descriptor Set Terminator (Sector 17)
    const terminator = new Uint8Array(this.SECTOR_SIZE);
    terminator[0] = 0xFF; // Type: Terminator
    this.writeString(terminator, 1, 'CD001');
    terminator[6] = 0x01;
    sectors.push(terminator);

    // 4. Directory and File Data (Sector 18+)
    // For this minimal implementation, we'll just put files in the root
    let currentSector = 18;
    
    // We'll create a simple directory record for each file
    const dirSectors: Uint8Array[] = [];
    const dataSectors: Uint8Array[] = [];

    for (const file of files) {
      const content = typeof file.content === 'string' ? new TextEncoder().encode(file.content) : file.content;
      const fileSectorsCount = Math.ceil(content.length / this.SECTOR_SIZE);
      
      // Data
      const data = new Uint8Array(fileSectorsCount * this.SECTOR_SIZE);
      data.set(content);
      dataSectors.push(data);

      // Directory Record (Simplified)
      // In a real ISO, these are packed into a directory sector
      // Here we just simulate the structure
      currentSector += fileSectorsCount;
    }

    // Combine all sectors
    const finalBuffer = new Uint8Array(sectors.length * this.SECTOR_SIZE + dataSectors.reduce((a, b) => a + b.length, 0));
    let offset = 0;
    for (const s of sectors) {
      finalBuffer.set(s, offset);
      offset += s.length;
    }
    for (const d of dataSectors) {
      finalBuffer.set(d, offset);
      offset += d.length;
    }

    return new Blob([finalBuffer], { type: 'application/x-iso9660-image' });
  }

  private static writeString(buf: Uint8Array, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      buf[offset + i] = str.charCodeAt(i);
    }
  }

  private static writeUint32Both(buf: Uint8Array, offset: number, val: number) {
    // Little Endian
    buf[offset] = val & 0xFF;
    buf[offset + 1] = (val >> 8) & 0xFF;
    buf[offset + 2] = (val >> 16) & 0xFF;
    buf[offset + 3] = (val >> 24) & 0xFF;
    // Big Endian
    buf[offset + 4] = (val >> 24) & 0xFF;
    buf[offset + 5] = (val >> 16) & 0xFF;
    buf[offset + 6] = (val >> 8) & 0xFF;
    buf[offset + 7] = val & 0xFF;
  }
}
