import React, { useState, useEffect } from 'react';
import { HardDrive, Disc, Save, CheckCircle, AlertTriangle, Loader2, Download } from 'lucide-react';
import { vfs } from '../services/vfs';
import { libarchive } from '../services/libarchive';
import { kernel } from '../services/kernel';
import JSZip from 'jszip';

export const ISOMaster: React.FC = () => {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isoName, setIsoName] = useState('VC_OS_Source_x86.zip');
  const [buildMode, setBuildMode] = useState<'standard' | 'baremetal'>('baremetal');

  useEffect(() => {
    const allFiles = vfs.ls();
    setFiles(allFiles);
    // Auto-select files by default
    setSelectedFiles(new Set(allFiles));
  }, []);

  const toggleFile = (file: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(file)) {
      newSelected.delete(file);
    } else {
      newSelected.add(file);
    }
    setSelectedFiles(newSelected);
  };

  const createISO = async () => {
    if (selectedFiles.size === 0) return;
    
    setIsCreating(true);
    setStatus('idle');
    kernel.emitEvent('TASK', `ISO_MASTER: STARTING_BUILD [${isoName}]`);

    try {
      // Simulate build process for atmosphere
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (buildMode === 'baremetal') {
        kernel.emitEvent('TASK', 'ISO_MASTER: RUNNING_MAKE');
        vfs.make(); // Compiles VFS into the simulated bin
        await libarchive.writeArchive(isoName, ['kernel.bin', 'boot.s', 'linker.ld', 'gdt.cpp', 'idt.cpp', 'Makefile'], 'zip');
      } else {
        await libarchive.writeArchive(isoName, Array.from(selectedFiles), 'iso');
      }
      
      setStatus('success');
      kernel.emitEvent('TASK', `ISO_MASTER: BUILD_COMPLETE [${isoName}]`);
    } catch (e) {
      console.error(e);
      setStatus('error');
      kernel.emitEvent('CRITICAL', `ISO_MASTER: BUILD_FAILED [${isoName}]`);
    } finally {
      setIsCreating(false);
    }
  };

  const downloadToHost = async () => {
    kernel.emitEvent('TASK', `ISO_MASTER: EXPORTING_TO_HOST [${isoName}]`);
    const zip = new JSZip();

    // Give them the files they selected (or baremetal files)
    const exportFiles = buildMode === 'baremetal' ? 
      ['boot.s', 'linker.ld', 'gdt.cpp', 'idt.cpp', 'memory_map.h', 'sys_logs.dat', 'Makefile', 'kernel.cpp'] : 
      Array.from(selectedFiles);
      
    exportFiles.forEach(fileName => {
      const vfsFile = vfs.getFile(fileName);
      if (vfsFile) {
        let content = vfsFile.content;
        // Makefiles MUST use tabs. If the string representation in JS converted them to spaces,
        // we force them back to tabs for the host export.
        if (fileName === 'Makefile') {
           // Make sure all rule recipes start with a TAB
           // We split by lines and if a line is not a variable definition or a target definition,
           // and it follows a target definition, it must be a recipe line.
           // A simpler heuristic for this template: if a line starts with spaces, convert them to a TAB.
           content = content.split('\n').map(line => {
             if (line.match(/^\s+/)) {
               return '\t' + line.trimStart();
             }
             return line;
           }).join('\n');
        }
        zip.file(fileName, content);
      }
    });

    // Add a README to explain
    zip.file("README_HOST.txt", 
      "VC.os Source Code Export for Debian/Linux\n" +
      "========================================\n\n" +
      "You are building a 32-bit x86 (i386) Microkernel.\n\n" +
      "STEP 1: Extract the source\n" +
      "--------------------------\n" +
      "unzip VC_OS_Source_x86.zip -d vc_os_src\n" +
      "cd vc_os_src\n\n" +
      "STEP 2: Verify the Makefile\n" +
      "---------------------------\n" +
      "Run: cat Makefile\n" +
      "Check if it contains the line 'all: VC_OS.iso'.\n\n" +
      "STEP 3: Install dependencies on Debian:\n" +
      "---------------------------------------\n" +
      "sudo apt update\n" +
      "sudo apt install nasm build-essential vmware-workstation-player grub-pc-bin xorriso gcc-i686-linux-gnu g++-i686-linux-gnu binutils-i686-linux-gnu\n\n" +
      "STEP 4: Build the project:\n" +
      "--------------------------\n" +
      "make\n\n" +
      "STEP 5: Run the OS in a Virtual Machine:\n" +
      "----------------------------------------\n" +
      "1. Open VMware Workstation Player\n" +
      "2. Create New Virtual Machine -> I will install the operating system later\n" +
      "3. Select 'Other' -> 'Other' (32-bit)\n" +
      "4. Mount VC_OS.iso as the CD/DVD (IDE/SATA) source.\n" +
      "5. Power on the VM.\n\n" +
      "PATH A HYBRID BUILD (BRING YOUR OWN WEB ASSETS):\n" +
      "----------------------------------------------\n" +
      "The kernel is now set for 'Hybrid Mode'. This allows VC.os to run the FULL Chrome-grade browser version on bare metal.\n" +
      "1. Build the React app: npm run build\n" +
      "2. Copy the 'dist' folder into your 'vc_os_src' directory.\n" +
      "3. WARNING: The resulting ISO will be ~2.1GB. Ensure you use a high-speed USB 3.0 drive for flashing.\n" +
      "4. Use 'xorriso -as mkisofs' to bundle the 'dist' folder into the ISO root.\n\n" +
      "USER TIP: The bridge layer in vcos_web_bridge.cpp handles the handoff from the C++ Microkernel to the JavaScript UI engine.\n\n" +
      "DEV NOTE: If you see 'No rule to make target', perform a 'make clean' then 'make' again.\n"
    );

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isoName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-win95-gray font-sans text-[11px]">
      <div className="p-2 bg-win95-dark-gray text-white font-bold flex items-center gap-2 border-b border-white">
        <Disc size={16} />
        ISO_MASTER.EXE - System Archive Utility
      </div>

      <div className="flex-1 flex gap-2 p-2 overflow-hidden">
        {/* File List */}
        <div className="flex-1 flex flex-col border-inset bg-white overflow-hidden">
          <div className="p-1 bg-win95-gray border-b border-win95-dark-gray font-bold text-[9px] flex justify-between">
            <span>FILES_TO_INCLUDE</span>
            <span>{selectedFiles.size} / {files.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1">
            {files.map(file => (
              <label key={file} className="flex items-center gap-2 p-1 hover:bg-win95-blue/10 cursor-pointer border-b border-win95-gray/10">
                <input 
                  type="checkbox" 
                  checked={selectedFiles.has(file)} 
                  onChange={() => toggleFile(file)}
                  className="w-3 h-3"
                />
                <span className={vfs.getFile(file)?.isCritical ? 'font-bold text-red-700' : ''}>
                  {file}
                </span>
                {vfs.getFile(file)?.isCritical && <span className="text-[8px] opacity-50">[SYSTEM]</span>}
              </label>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="w-48 flex flex-col gap-4 overflow-y-auto pr-1">
          <div className="border-inset bg-white p-3 space-y-3 shrink-0">
            <div className="font-bold border-b border-win95-gray pb-1">ARCHIVE_SETTINGS</div>
            <div className="space-y-1">
              <label className="text-[9px] text-gray-600 block">OUTPUT_FILENAME:</label>
              <input 
                type="text" 
                value={isoName}
                onChange={(e) => setIsoName(e.target.value)}
                className="w-full bg-white border-inset p-1 outline-none focus:ring-1 focus:ring-win95-blue"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-gray-600 block">BUILD_MODE:</label>
              <select 
                value={buildMode}
                onChange={(e) => setBuildMode(e.target.value as any)}
                className="w-full bg-white border-inset p-1 outline-none focus:ring-1 focus:ring-win95-blue text-[10px]"
              >
                <option value="baremetal">Bare-metal Source (C++)</option>
                <option value="standard">Standard Archive</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-gray-600 block">FORMAT:</label>
              <div className="font-bold text-blue-800">
                {buildMode === 'baremetal' ? 'ZIP (Host Executable)' : 'ISO 9660 (Standard)'}
              </div>
            </div>
          </div>

          <div className="p-2 border-inset bg-red-50 space-y-2">
            <div className="font-bold text-red-800 text-[10px]">RECOVERY_TOOLS</div>
            <button 
              onClick={() => { vfs.repair(); setFiles(vfs.ls()); }}
              className="w-full py-1 bg-red-600 text-white font-bold border-outset border-red-400 active:border-inset hover:bg-red-500"
            >
              REPAIR KERNEL FILES
            </button>
            <p className="text-[8px] text-red-700 italic leading-tight">
              Fixes 'Makefile' and 'stray @' errors by resetting system files to factory defaults.
            </p>
          </div>

          <div className="flex-1 flex flex-col justify-end gap-2 shrink-0">
            {status === 'success' && (
              <div className="flex flex-col gap-2">
                <div className="p-2 bg-green-100 border border-green-600 text-green-800 flex items-center justify-center gap-2 animate-in fade-in">
                  <CheckCircle size={14} className="shrink-0" />
                  <span className="text-center font-bold">Build Ready</span>
                </div>
                <button 
                  onClick={downloadToHost}
                  className="w-full py-3 h-12 bg-green-600 text-white font-bold border-outset border-green-400 active:border-inset hover:bg-green-500 flex items-center justify-center gap-2 animate-pulse"
                >
                  <Download size={16} />
                  DOWNLOAD TO HOST
                </button>
              </div>
            )}
            {status === 'error' && (
              <div className="p-2 bg-red-100 border border-red-600 text-red-800 flex items-center gap-2 animate-in fade-in">
                <AlertTriangle size={14} />
                <span>Build Failed.</span>
              </div>
            )}

            <button 
              onClick={createISO}
              disabled={isCreating || selectedFiles.size === 0}
              className="w-full py-3 h-12 bg-win95-gray border-outset font-bold flex items-center justify-center gap-2 active:border-inset disabled:opacity-50"
            >
              {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isCreating ? 'COMPILING...' : 'PREPARE BUILD'}
            </button>
          </div>
        </div>
      </div>

      <div className="p-2 bg-win95-gray border-t border-white flex items-center gap-4 text-[9px] text-win95-dark-gray shrink-0">
        <div className="flex items-center gap-1">
          <HardDrive size={12} />
          <span>VFS_SOURCE: /</span>
        </div>
        <div className="flex items-center gap-1">
          <Disc size={12} />
          <span>TARGET: {isoName}</span>
        </div>
      </div>
    </div>
  );
};
