import { vfs } from './vfs';
import { kernel } from './kernel';

export type ArchiveFormat = 'tar' | 'zip' | '7z' | 'iso' | 'cpio' | 'ar';
export type CompressionType = 'none' | 'gzip' | 'bzip2' | 'xz' | 'zstd' | 'lz4';

export interface ArchiveEntry {
  pathname: string;
  size: number;
  filetype: 'file' | 'dir' | 'link';
  perm: number;
  mtime: number;
  content?: string;
}

export class LibArchive {
  private static instance: LibArchive;
  
  private constructor() {}

  public static getInstance(): LibArchive {
    if (!LibArchive.instance) {
      LibArchive.instance = new LibArchive();
    }
    return LibArchive.instance;
  }

  /**
   * Simulated automatic format detection
   */
  public detectFormat(content: string): { format: ArchiveFormat; compression: CompressionType } {
    if (content.includes('VCOS_TAR_XZ')) return { format: 'tar', compression: 'xz' };
    if (content.startsWith('PK')) return { format: 'zip', compression: 'none' };
    if (content.startsWith('7z')) return { format: '7z', compression: 'none' };
    if (content.includes('CD001')) return { format: 'iso', compression: 'none' };
    
    // Default fallback
    return { format: 'tar', compression: 'none' };
  }

  /**
   * Read an archive and return its entries
   */
  public async readArchive(path: string): Promise<ArchiveEntry[]> {
    kernel.emitEvent('SYSCALL', `LIBARCHIVE_READ: ${path}`);
    const content = vfs.cat(path);
    
    if (content.startsWith('Error:')) {
      throw new Error(content);
    }

    // Convert to byte array to see if it's a real binary ISO 9660
    let bytes = new Uint8Array(0);
    if (content.startsWith('data:')) {
      const base64Index = content.indexOf(';base64,');
      if (base64Index !== -1) {
        try {
          const base64Str = content.slice(base64Index + 8).trim();
          const binaryString = atob(base64Str);
          bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
        } catch (e) {
          // Fallback
        }
      }
    } else if (/^[A-Za-z0-9+/=]+$/.test(content.trim()) && content.length > 500) {
      try {
        const binaryString = atob(content.trim());
        bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
      } catch (e) {
        // Fallback
      }
    }

    if (bytes.length === 0) {
      bytes = new Uint8Array(content.length);
      for (let i = 0; i < content.length; i++) {
        bytes[i] = content.charCodeAt(i) & 0xff;
      }
    }

    // Check for standard ISO 9660 identifier "CD001" at sector 16, 17, 18, etc.
    let isRealIso = false;
    let pvdOffset = -1;
    for (let sector = 16; sector < 24; sector++) {
      const offset = sector * 2048;
      if (offset + 6 < bytes.length) {
        if (
          bytes[offset + 1] === 67 && // 'C'
          bytes[offset + 2] === 68 && // 'D'
          bytes[offset + 3] === 48 && // '0'
          bytes[offset + 4] === 48 && // '0'
          bytes[offset + 5] === 49    // '1'
        ) {
          if (bytes[offset] === 1) { // Primary Volume Descriptor
            isRealIso = true;
            pvdOffset = offset;
            break;
          }
        }
      }
    }

    if (isRealIso && pvdOffset !== -1) {
      kernel.emitEvent('TASK', `REAL_ISO9660_DETECTED: parsing filesystem structure`);
      const entries: ArchiveEntry[] = [];

      const readUint16LE = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
      const readUint32LE = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

      // Root Directory Record in PVD is at offset 156 (0x9C) from start of PVD
      const rootDirRecordOffset = pvdOffset + 156;
      const rootDirLba = readUint32LE(bytes, rootDirRecordOffset + 2);
      const rootDirLength = readUint32LE(bytes, rootDirRecordOffset + 10);

      const visitedLbas = new Set<number>();

      const parseDirectory = (dirLba: number, dirLength: number, currentPath: string) => {
        if (visitedLbas.has(dirLba)) return;
        visitedLbas.add(dirLba);

        let offset = dirLba * 2048;
        const endOffset = offset + dirLength;
        if (endOffset > bytes.length) return;

        while (offset < endOffset) {
          const len = bytes[offset];
          if (len === 0) {
            // Sector padding - align to next 2048-byte boundary
            offset = Math.ceil((offset + 1) / 2048) * 2048;
            if (offset >= endOffset) break;
            continue;
          }

          if (offset + len > bytes.length) break;

          const extentLba = readUint32LE(bytes, offset + 2);
          const dataLength = readUint32LE(bytes, offset + 10);
          const fileFlags = bytes[offset + 25];
          const fileIdLen = bytes[offset + 32];

          if (offset + 33 + fileIdLen > bytes.length) break;

          let fileId = '';
          for (let i = 0; i < fileIdLen; i++) {
            fileId += String.fromCharCode(bytes[offset + 33 + i]);
          }

          // Skip self (.) and parent (..) records
          if (fileIdLen === 1 && (bytes[offset + 33] === 0 || bytes[offset + 33] === 1)) {
            offset += len;
            continue;
          }

          const isDir = (fileFlags & 2) !== 0;
          let cleanName = fileId.split(';')[0];
          if (cleanName.endsWith('.')) {
            cleanName = cleanName.slice(0, -1);
          }

          const fullPath = currentPath ? `${currentPath}/${cleanName}` : cleanName;

          if (isDir) {
            entries.push({
              pathname: fullPath + '/',
              size: 0,
              filetype: 'dir',
              perm: 0o755,
              mtime: Date.now()
            });
            parseDirectory(extentLba, dataLength, fullPath);
          } else {
            const fileStart = extentLba * 2048;
            const fileEnd = fileStart + dataLength;
            let fileContent = '';

            if (fileStart < bytes.length) {
              const fileBytes = bytes.subarray(fileStart, Math.min(fileEnd, bytes.length));
              const chunkSize = 8192;
              for (let i = 0; i < fileBytes.length; i += chunkSize) {
                const chunk = fileBytes.subarray(i, i + chunkSize);
                fileContent += String.fromCharCode.apply(null, chunk as any);
              }
            }

            entries.push({
              pathname: fullPath,
              size: dataLength,
              filetype: 'file',
              perm: 0o644,
              mtime: Date.now(),
              content: fileContent
            });
          }

          offset += len;
        }
      };

      parseDirectory(rootDirLba, rootDirLength, '');

      // Parse El Torito Boot Record if present
      let bootCatalogLba = -1;
      for (let sector = 17; sector < 32; sector++) {
        const offset = sector * 2048;
        if (offset + 71 < bytes.length) {
          if (
            bytes[offset + 1] === 67 &&
            bytes[offset + 2] === 68 &&
            bytes[offset + 3] === 48 &&
            bytes[offset + 4] === 48 &&
            bytes[offset + 5] === 49
          ) {
            if (bytes[offset] === 0) { // Boot Record Volume Descriptor
              let systemId = '';
              for (let i = 0; i < 23; i++) {
                systemId += String.fromCharCode(bytes[offset + 7 + i]);
              }
              if (systemId.includes('EL TORITO')) {
                bootCatalogLba = readUint32LE(bytes, offset + 0x47);
                break;
              }
            }
          }
        }
      }

      if (bootCatalogLba !== -1 && bootCatalogLba * 2048 + 64 <= bytes.length) {
        const catOffset = bootCatalogLba * 2048;
        if (bytes[catOffset] === 1 && bytes[catOffset + 30] === 0x55 && bytes[catOffset + 31] === 0xAA) {
          const defEntryOffset = catOffset + 32;
          const sectorCount = readUint16LE(bytes, defEntryOffset + 6);
          const loadLba = readUint32LE(bytes, defEntryOffset + 8);

          if (loadLba > 0 && loadLba * 2048 < bytes.length) {
            let bootSize = sectorCount * 512;
            if (bootSize === 0) bootSize = 2048; // default to 1 CD-ROM sector

            const bootStart = loadLba * 2048;
            const bootEnd = Math.min(bootStart + bootSize, bytes.length);
            const bootBytes = bytes.subarray(bootStart, bootEnd);

            let bootContent = '';
            for (let i = 0; i < bootBytes.length; i++) {
              bootContent += String.fromCharCode(bootBytes[i]);
            }

            entries.push({
              pathname: 'el_torito_boot.bin',
              size: bootBytes.length,
              filetype: 'file',
              perm: 0o755,
              mtime: Date.now(),
              content: bootContent
            });
          }
        }
      }

      return entries;
    }

    const { format, compression } = this.detectFormat(content);
    kernel.emitEvent('TASK', `ARCHIVE_DETECTED: ${format.toUpperCase()} (${compression.toUpperCase()})`);

    // Simulated/JSON extraction logic
    try {
      if (content.trim().startsWith('{')) {
        const data = JSON.parse(content);
        if (data.files) {
          return Object.entries(data.files).map(([pathname, fileContent]) => ({
            pathname,
            size: (fileContent as string).length,
            filetype: 'file',
            perm: 0o644,
            mtime: Date.now(),
            content: fileContent as string
          }));
        }
      }
    } catch (e) {
      // Fallback for non-JSON archives
    }

    // Default simulated entry if parsing fails
    return [{
      pathname: 'extracted_data',
      size: content.length,
      filetype: 'file',
      perm: 0o644,
      mtime: Date.now(),
      content: content
    }];
  }

  /**
   * Write an archive from a list of file paths
   */
  public async writeArchive(path: string, filePaths: string[], format: ArchiveFormat = 'tar', compression: CompressionType = 'none'): Promise<void> {
    kernel.emitEvent('SYSCALL', `LIBARCHIVE_WRITE: ${path} [${format}]`);
    
    const archiveData: Record<string, string> = {};
    filePaths.forEach(p => {
      const file = vfs.getFile(p);
      if (file && file.type === 'file') {
        archiveData[p] = file.content;
      }
    });

    const magicMap: Record<ArchiveFormat, string> = {
      tar: 'VCOS_TAR',
      zip: 'PK_VCOS',
      '7z': '7Z_VCOS',
      iso: 'CD001_VCOS',
      cpio: 'CPIO_VCOS',
      ar: 'AR_VCOS'
    };

    const archiveObject = {
      magic: magicMap[format] + (compression !== 'none' ? `_${compression.toUpperCase()}` : ''),
      version: '1.0',
      format,
      compression,
      files: archiveData,
      timestamp: Date.now()
    };

    vfs.write(path, JSON.stringify(archiveObject, null, 2));
    kernel.emitEvent('MEM', `ARCHIVE_COMMITTED: ${path} (${Object.keys(archiveData).length} files)`);
  }

  /**
   * bsdtar simulated command
   */
  public async bsdtar(args: string[]): Promise<string> {
    const flags = args.filter(a => a.startsWith('-')).join('');
    const params = args.filter(a => !a.startsWith('-'));

    if (flags.includes('x')) { // Extract
      const archivePath = params[0];
      if (!archivePath) return 'bsdtar: error: no archive specified';
      
      const entries = await this.readArchive(archivePath);
      entries.forEach(entry => {
        vfs.write(entry.pathname, entry.content || '');
      });
      return `Extracted ${entries.length} files from ${archivePath}`;
    }

    if (flags.includes('c')) { // Create
      const archivePath = params[0];
      const filesToArchive = params.slice(1);
      if (!archivePath || filesToArchive.length === 0) return 'bsdtar: error: usage: bsdtar -cvf <archive> <files...>';
      
      let format: ArchiveFormat = 'tar';
      if (archivePath.endsWith('.zip')) format = 'zip';
      if (archivePath.endsWith('.iso')) format = 'iso';
      if (archivePath.endsWith('.7z')) format = '7z';

      await this.writeArchive(archivePath, filesToArchive, format);
      return `Created ${format} archive: ${archivePath}`;
    }

    if (flags.includes('t')) { // List
      const archivePath = params[0];
      if (!archivePath) return 'bsdtar: error: no archive specified';
      
      const entries = await this.readArchive(archivePath);
      return entries.map(e => `${e.perm.toString(8)} ${e.size} ${e.pathname}`).join('\n');
    }

    return 'bsdtar: usage: -x (extract), -c (create), -t (list)';
  }
}

export const libarchive = LibArchive.getInstance();
