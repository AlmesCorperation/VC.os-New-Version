import React, { useState } from 'react';
import { HelpCircle, Book, FileText } from 'lucide-react';
import { kernel } from '../services/kernel';

export const HelpViewer: React.FC = () => {
  const [activeTopic, setActiveTopic] = useState<string | null>('intro');

  const topics: Record<string, { title: string, content: string }> = {
    'intro': {
      title: 'Welcome to VC.os v1.2.0 (Bare-metal)',
      content: 'VC.os is a real bare-metal operating system environment. It is designed to boot directly on x86 hardware using Multiboot2.\n\nNEW IN THIS VERSION:\n- VC.os Assembly (VCA-16 / VCA-32 / VCA-Hybrid) Pipeline\n- Real C++/Assembly Kernel Source\n- GDT & IDT Implementation\n- Bare-metal Build Pipeline (make)\n- Bootable ISO Generation (grub-mkrescue)\n- Global Cloud Sync with Firebase'
    },
    'vca_arch': {
      title: 'VC.os Assembly (VCA 16/32-Bit) Specification',
      content: 'VC.os Assembly (VCA) is the native machine-level language for the VC.os Virtual CPU.\n\nARCHITECTURE MODES:\n1. [ARCH VCA16] / [BITS 16]: Real Mode 16-bit segmented execution with CS, DS, ES, SS segments.\n2. [ARCH VCA32] / [BITS 32]: Flat 32-bit protected mode with 4GB linear memory addressing.\n3. [ARCH HYBRID]: 16-bit real mode bootloader with 32-bit register and extended addressing capability.\n\nREGISTER SET:\n- 32-bit General: R0 / EAX, R1 / ECX, R2 / EDX, R3 / EBX, R4 / ESP, R5 / EBP, R6 / ESI, R7 / EDI\n- 16-bit General: R0W / AX, R1W / CX, R2W / DX, R3W / BX, R4W / SP, R5W / BP, R6W / SI, R7W / DI\n- 8-bit Low/High: R0B / AL, R1B / CL, R2B / DL, R3B / BL, AH, CH, DH, BH\n- Segment Regs: CS, DS, ES, SS, FS, GS\n\nBUILT-IN MACROS & SYSCALLS:\n- VCOS_MODE13H: Set 320x200 256-color VGA mode\n- VCOS_TEXTMODE: Set 80x25 Color Text mode\n- VCOS_HALT: Halt CPU loop safely\n- VCOS_BOOT_SIG: Automatic 512-byte MBR pad & 0xAA55 signature\n- SYS_CALL <id>: Invoke Ring 0 Kernel Supervisor API (INT 0x20)'
    },
    'cloud': {
      title: 'Cloud Sync & Profiles',
      content: 'VC.os integrates cloud persistence for user settings, games, and hardware state across sessions.\n\nFEATURES:\n1. Persistent User Profiles: Your display name and configurations are stored securely.\n2. Cross-Device Memory: Your Physical Memory Bitmap is saved to the cloud.\n3. Global Game Store: Published games are instantly available to all users worldwide.'
    },
    'taskman': {
      title: 'Task Manager (TASK_MAN.EXE)',
      content: 'The Task Manager allows you to monitor system performance and manage running applications.\n\n- VIEWING TASKS: See a real-time list of all open windows and their status.\n- END TASK: Force-close any unresponsive application by clicking "End Task".\n- SYSTEM STATS: Monitor simulated CPU and Memory usage in the status bar.\n- RESTART: Quickly reboot the OS environment if needed.'
    },
    'memmap': {
      title: 'Physical Memory Bitmap',
      content: 'The Physical Memory Bitmap utility tracks every 4KB page of the simulated 128MB RAM.\n\n- VISUALIZER: A 256x128 grid where each pixel represents one 4KB page (Green = Used, Dark = Free).\n- ALLOCATION: Manually allocate or free pages to see how memory fragmentation works.\n- SYSTEM RESERVATION: The first 1MB of RAM is reserved for the kernel and cannot be freed.\n- CLOUD COMMIT: Use the "COMMIT_TO_CLOUD" button to save your current memory state to your Firebase profile.'
    },
    'timer': {
      title: 'High-Precision Timer',
      content: 'A professional-grade timing utility for VC.os.\n\n- STOPWATCH: Track time with centisecond (1/100th) precision.\n- LAPS: Record multiple lap times during a session. The history is displayed in the scrollable list below the controls.\n- RESET: Clear all time and lap data to start a new session.'
    },
    'idt': {
      title: 'Interrupt Descriptor Table (IDT)',
      content: 'The IDT is the heart of the VC.os event-driven architecture. Every single action—from mouse clicks to system signals—is processed as a hardware interrupt.\n\n- VECTORS: 256 unique interrupt vectors (0x00 to 0xFF) handle specific system events.\n- UI_EVENT (0xCC): Triggered whenever you open, close, or move a window.\n- SYS_DAEMON (0xDD): Triggered for background system tasks and daemons.\n- KEYBOARD (0x21): Triggered for every simulated keypress.\n- FLOW MONITOR: Use the IDT Monitor to see the real-time "Pipeline" of interrupts being computed by the CPU.'
    },
    'rings': {
      title: 'CPU Privilege Levels (Rings)',
      content: 'VC.os implements a multi-ring protection architecture to isolate the kernel from user applications.\n\n- RING 0 (KERNEL): Full access to hardware, memory management, and all interrupt vectors. The core OS runs here.\n- RING 3 (USER): Restricted mode where user applications run. Direct access to sensitive hardware or memory allocation is forbidden.\n- SYSCALLS: User mode applications must use the SYSCALL interface to request services from the Kernel. This causes a controlled transition from Ring 3 to Ring 0.\n- PROTECTION FAULTS: Attempting to execute privileged instructions in Ring 3 will trigger a General Protection Fault (INT 0x0D).'
    },
    'libarchive': {
      title: 'libarchive & bsdtar',
      content: 'VC.os now includes a simulated implementation of libarchive, the universal archive handling engine.\n\n- MULTI-FORMAT: Supports .tar, .zip, .7z, and .iso (ISO 9660) images.\n- BSDTAR: The primary command-line tool for archive management.\n- USAGE:\n  - Create: `bsdtar -cvf backup.tar docs/` \n  - Extract: `bsdtar -xvf archive.zip` \n  - List: `bsdtar -tvf image.iso` \n- ISO 9660: Treats disk images as streaming archives, allowing you to browse and extract files from virtual CD-ROMs.'
    },
    'iso_creation': {
      title: 'ISO Creation & Mastering',
      content: 'VC.os provides professional tools for creating ISO 9660 disk images using libarchive.\n\n1. ISO MASTER (GUI):\n- Launch ISO_MASTER.EXE from the Start Menu.\n- Select files from the VFS to include in the image.\n- Set the output filename and click "BUILD_ISO".\n\n2. MKISOFS (CLI):\n- Use the `mkisofs` command in VC.linux.\n- Usage: `mkisofs -o backup.iso .` (Archives entire VFS)\n- Usage: `mkisofs -o docs.iso bin/` (Archives specific folder)\n\n3. C++ API:\n- Use the libarchive headers in your C++ projects.\n- Example (iso_creator.cpp):\n```cpp\n#include <archive.h>\n#include <archive_entry.h>\n\n// 1. Create archive object\na = archive_write_new();\n\n// 2. Set format to ISO 9660\narchive_write_set_format_iso9660(a);\n\n// 3. Open output file\narchive_write_open_filename(a, "disk.iso");\n\n// 4. Create entry and write data\nentry = archive_entry_new();\narchive_entry_set_pathname(entry, "file.txt");\narchive_write_header(a, entry);\narchive_write_data(a, "Hello!", 6);\n\n// 5. Cleanup\narchive_write_close(a);\n```'
    },
    'games': {
      title: 'Game Publishing & Store',
      content: 'The VC Store is now globally synchronized!\n\n1. CREATE: Use the Game Maker (VCEngine) to build your own games.\n2. PUBLISH: Click "Publish to Store" to upload your game to the global Firestore database. (Requires Login)\n3. INSTALL: Browse the VC Store to see games published by other users and install them to your local system.'
    },
    'tarxz': {
      title: 'Handling .tar.xz Files',
      content: 'VC.linux now supports native .tar.xz archive handling. This allows you to download and extract complex software like Blender.\n\nVISUAL METHOD (Recommended):\n1. Open VC.linux.\n2. Click "Software Center" in the bottom toolbar (or type "software").\n3. Click "SELECT .TAR.XZ PACKAGE" and pick a file from your computer.\n4. The system will automatically extract and install it.\n\nCOMMAND LINE METHOD:\n1. Download an archive: wget https://example.com/app.tar.xz\n2. Extract the archive: tar -xvf Downloads/app.tar.xz\n3. Run the extracted binary: ./app/binary_name'
    },
    'commands': {
      title: 'MS-DOS Commands',
      content: 'The Command Prompt supports standard MS-DOS commands including: DIR, TYPE, DEL, CLS, DATE, TIME, VER, COPY, REN, MOVE, MD, RD, CD, and VOL. Type HELP in the prompt for a full list.'
    },
    'linux': {
      title: 'Linux Installation',
      content: 'To install VC.os natively on Linux:\n\n1. Click "Download for Linux" on the Desktop or Start Menu.\n2. Open your terminal and navigate to your Downloads folder.\n3. Make the script executable: chmod +x install-vcos.sh\n4. Run the installer: ./install-vcos.sh\n\nVC.os will be added to your application launcher and will run in a standalone window.'
    }
  };

  return (
    <div className="h-full flex flex-col font-sans text-[11px] bg-win95-gray">
      <div className="flex items-center gap-2 p-2 bg-win95-blue text-white">
        <HelpCircle size={16} />
        <span className="font-bold">VC.os Help Topics</span>
      </div>
      
      <div className="flex flex-1 overflow-hidden p-1 gap-1">
        {/* Sidebar */}
        <div className="w-1/3 border-inset bg-white overflow-y-auto p-1">
          <div className="flex items-center gap-1 mb-1 font-bold">
            <Book size={14} className="text-yellow-600" />
            Contents
          </div>
          <ul className="pl-4 space-y-1">
            {Object.entries(topics).map(([id, topic]) => (
              <li 
                key={id}
                className={`flex items-center gap-1 cursor-pointer px-1 ${activeTopic === id ? 'bg-win95-blue text-white' : 'hover:bg-zinc-200'}`}
                onClick={() => {
                  setActiveTopic(id);
                  kernel.emitEvent('TASK', `HELP: VIEWING (${id})`);
                }}
              >
                <FileText size={12} />
                {topic.title}
              </li>
            ))}
          </ul>
        </div>

        {/* Content */}
        <div className="flex-1 border-inset bg-white p-4 overflow-y-auto">
          {activeTopic && topics[activeTopic] ? (
            <>
              <h2 className="text-lg font-bold mb-4 border-b border-win95-gray pb-1">
                {topics[activeTopic].title}
              </h2>
              <div className="leading-relaxed whitespace-pre-wrap">
                {topics[activeTopic].content}
              </div>
            </>
          ) : (
            <div className="text-win95-dark-gray italic">Select a topic from the left.</div>
          )}
        </div>
      </div>
    </div>
  );
};
