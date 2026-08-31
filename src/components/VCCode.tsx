import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Play, Pause, StepForward, RotateCcw, Save, Download, Disc, Terminal, 
  Cpu, HardDrive, Shield, Activity, RefreshCw, FileCode, Plus, X, 
  ChevronRight, CheckCircle2, AlertCircle, AlertTriangle, Monitor, 
  Layers, Code2, Sparkles, BookOpen, Bug, Eye, Radio, CornerDownLeft,
  Settings2, Copy, FileText, Check, Volume2, Search, Sliders
} from 'lucide-react';
import { VCodeAssembler, AssembleResult } from '../services/vcode/assembler';
import { seaBios, SeaBiosEvent } from '../services/vcode/seabios';
import { ASSEMBLY_TEMPLATES, AssemblyTemplate } from '../services/vcode/templates';
import { vm } from '../services/vm/motherboard';
import { vfs } from '../services/vfs';
import { kernel } from '../services/kernel';

interface VCCodeProps {
  onClose?: () => void;
  onCrash?: () => void;
}

interface OpenFile {
  id: string;
  name: string;
  code: string;
  isModified: boolean;
  targetOrigin: number;
}

export const VCCode: React.FC<VCCodeProps> = ({ onClose, onCrash }) => {
  // --- State for Files & Editor ---
  const [openFiles, setOpenFiles] = useState<OpenFile[]>(() => {
    return ASSEMBLY_TEMPLATES.map(t => ({
      id: t.id,
      name: t.filename,
      code: t.code,
      isModified: false,
      targetOrigin: t.targetOrigin
    }));
  });
  const [activeFileId, setActiveFileId] = useState<string>(ASSEMBLY_TEMPLATES[0].id);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [copiedToast, setCopiedToast] = useState(false);

  // --- Assembler State ---
  const [assembleResult, setAssembleResult] = useState<AssembleResult | null>(null);
  const [autoAssemble, setAutoAssemble] = useState(true);

  // --- Runner / SeaBIOS Monitor State ---
  const [activeTab, setActiveTab] = useState<'monitor' | 'hex' | 'disasm' | 'serial' | 'cheatsheet'>('monitor');
  const [commandInput, setCommandInput] = useState('');
  const [seaBiosHistory, setSeaBiosHistory] = useState<SeaBiosEvent[]>([]);
  const [screenMode, setScreenMode] = useState<'text' | 'vga'>('text');
  const [crtEffect, setCrtEffect] = useState(true);
  const [cpuSpeed, setCpuSpeed] = useState<number>(5000); // 5 kHz default in IDE for interactive debugging
  const [isVMRunning, setIsVMRunning] = useState(false);
  const [sidebarSection, setSidebarSection] = useState<'files' | 'symbols' | 'cheatsheet'>('files');
  const [searchQuery, setSearchQuery] = useState('');

  // Canvas ref for VGA framebuffer rendering
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const editorTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const terminalBottomRef = useRef<HTMLDivElement | null>(null);

  // Active file getter
  const activeFile = openFiles.find(f => f.id === activeFileId) || openFiles[0];

  // Assemble current active file whenever its code changes
  useEffect(() => {
    if (!activeFile) return;
    const res = VCodeAssembler.assemble(activeFile.code, activeFile.targetOrigin || 0x7C00);
    setAssembleResult(res);
  }, [activeFile?.code, activeFile?.targetOrigin]);

  // Subscribe to SeaBIOS updates
  useEffect(() => {
    const unsubSeaBios = seaBios.subscribe(() => {
      setSeaBiosHistory([...seaBios.history]);
      setIsVMRunning(vm.cpu.isRunning);
    });

    const unsubVM = vm.subscribe(() => {
      setIsVMRunning(vm.cpu.isRunning);
    });

    return () => {
      unsubSeaBios();
      unsubVM();
    };
  }, []);

  // Update CPU Frequency when slider changes
  useEffect(() => {
    vm.cpu.setFrequency(cpuSpeed);
  }, [cpuSpeed]);

  // Render VGA canvas loop
  useEffect(() => {
    let animFrame: number;
    const render = () => {
      if (canvasRef.current && activeTab === 'monitor') {
        vm.gpu.renderToCanvas(canvasRef.current, 320, 200);
      }
      animFrame = requestAnimationFrame(render);
    };
    animFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrame);
  }, [activeTab]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [seaBiosHistory]);

  // --- Handlers ---
  const handleCodeChange = (newCode: string) => {
    setOpenFiles(prev => prev.map(f => {
      if (f.id === activeFileId) {
        return { ...f, code: newCode, isModified: true };
      }
      return f;
    }));
  };

  const handleCursorMove = () => {
    if (!editorTextareaRef.current) return;
    const sel = editorTextareaRef.current.selectionStart;
    const textBefore = editorTextareaRef.current.value.substring(0, sel);
    const lines = textBefore.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    setCursorPos({ line, col });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Tab key
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const val = e.currentTarget.value;
      const newVal = val.substring(0, start) + '    ' + val.substring(end);
      handleCodeChange(newVal);
      setTimeout(() => {
        if (editorTextareaRef.current) {
          editorTextareaRef.current.selectionStart = editorTextareaRef.current.selectionEnd = start + 4;
          handleCursorMove();
        }
      }, 0);
    }
    // Handle Ctrl+S / Cmd+S
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSaveToVFS();
    }
    // Handle Ctrl+Enter or F5 -> Run in SeaBIOS
    if (((e.ctrlKey || e.metaKey) && e.key === 'Enter') || e.key === 'F5') {
      e.preventDefault();
      handleBootInSeaBios();
    }
  };

  // Run in SeaBIOS
  const handleBootInSeaBios = () => {
    if (!activeFile) return;
    const res = VCodeAssembler.assemble(activeFile.code, activeFile.targetOrigin || 0x7C00);
    setAssembleResult(res);

    if (!res.success) {
      seaBios.log(`[BUILD FAILED] Cannot boot sector: ${res.errors[0]?.message} on line ${res.errors[0]?.line}`, 'error');
      setActiveTab('monitor');
      return;
    }

    // Pass assembled binary to SeaBIOS
    seaBios.bootSector(res.bytes, res.origin, false);
    setActiveTab('monitor');
    kernel.emitEvent('SYSCALL', `SYS_BOOT_SEABIOS (ORIGIN=0x${res.origin.toString(16).toUpperCase()})`);
  };

  // Run in Native SeaBIOS Reset Vector Mode
  const handleNativeSeaBiosBoot = () => {
    if (!activeFile) return;
    const res = VCodeAssembler.assemble(activeFile.code, activeFile.targetOrigin || 0x7C00);
    setAssembleResult(res);

    if (!res.success) {
      seaBios.log(`[BUILD FAILED] Cannot boot sector natively: ${res.errors[0]?.message}`, 'error');
      setActiveTab('monitor');
      return;
    }

    seaBios.bootSector(res.bytes, res.origin, true);
    setActiveTab('monitor');
  };

  // Compile Only
  const handleCompile = () => {
    if (!activeFile) return;
    const res = VCodeAssembler.assemble(activeFile.code, activeFile.targetOrigin || 0x7C00);
    setAssembleResult(res);
    if (res.success) {
      seaBios.log(`[ASSEMBLE OK] Generated ${res.bytes.length} bytes (Origin: 0x${res.origin.toString(16).toUpperCase()}).`, 'output');
    } else {
      seaBios.log(`[ASSEMBLE ERR] Found ${res.errors.length} error(s). First error: Line ${res.errors[0].line} - ${res.errors[0].message}`, 'error');
    }
  };

  // Save File to VFS
  const handleSaveToVFS = () => {
    if (!activeFile) return;
    const vfsPath = `/usr/src/${activeFile.name}`;
    vfs.write(vfsPath, activeFile.code);
    setOpenFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, isModified: false } : f));
    seaBios.log(`[VFS] Saved ${activeFile.name} to ${vfsPath}`, 'output');
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  };

  // Download raw .bin (512-byte MBR)
  const handleDownloadBin = () => {
    if (!activeFile) return;
    const res = assembleResult || VCodeAssembler.assemble(activeFile.code, activeFile.targetOrigin || 0x7C00);
    const blob = new Blob([res.bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name.replace(/\.asm$/i, '') + '.bin';
    a.click();
    URL.revokeObjectURL(url);
    seaBios.log(`[EXPORT] Downloaded ${a.download} (${res.bytes.length} bytes)`, 'output');
  };

  // Download .asm source
  const handleDownloadAsm = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Create new file
  const handleNewFile = () => {
    const id = `file_${Date.now()}`;
    const name = `untitled_${openFiles.length + 1}.asm`;
    const template = ASSEMBLY_TEMPLATES[1]; // Hello world
    const newFile: OpenFile = {
      id,
      name,
      code: template.code,
      isModified: true,
      targetOrigin: 0x7C00
    };
    setOpenFiles(prev => [...prev, newFile]);
    setActiveFileId(id);
  };

  // Close tab
  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (openFiles.length <= 1) return;
    const newFiles = openFiles.filter(f => f.id !== id);
    setOpenFiles(newFiles);
    if (activeFileId === id) {
      setActiveFileId(newFiles[0].id);
    }
  };

  // Handle Command Line input in SeaBIOS
  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;
    seaBios.executeCommand(commandInput);
    setCommandInput('');
  };

  // Jump to label
  const handleJumpToLabel = (labelName: string) => {
    if (!activeFile) return;
    const lines = activeFile.code.split('\n');
    const idx = lines.findIndex(l => l.trim().startsWith(labelName + ':') || l.trim().startsWith(labelName + ' '));
    if (idx !== -1 && editorTextareaRef.current) {
      const charPos = lines.slice(0, idx).join('\n').length + 1;
      editorTextareaRef.current.focus();
      editorTextareaRef.current.setSelectionRange(charPos, charPos);
      handleCursorMove();
    }
  };

  // Status metrics
  const sectorCount = assembleResult?.sectorBytesCount || 0;
  const sectorPct = Math.min(100, Math.round((sectorCount / 512) * 100));
  const isValidMbr = assembleResult?.bootSectorValid;
  const hasSig = assembleResult?.bootSignaturePresent;
  const cpuRegs = vm.cpu.registers;
  const cpuFlags = vm.cpu.getFlags();

  return (
    <div className="flex flex-col h-full w-full bg-[#1e1e1e] text-[#d4d4d4] font-mono select-none overflow-hidden text-xs">
      {/* Top Menu & Action Header */}
      <div className="h-10 bg-[#252526] border-b border-[#333333] flex items-center justify-between px-2 gap-2 shrink-0">
        {/* Brand & Title */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-gradient-to-r from-blue-900 to-indigo-950 border border-blue-500/40 rounded text-blue-300 font-bold shadow-sm">
            <Code2 size={15} className="text-cyan-400 animate-pulse" />
            <span className="tracking-wide">VC.code</span>
            <span className="text-[10px] px-1 bg-cyan-500/20 text-cyan-300 rounded font-normal">x86 ASM & SeaBIOS IDE</span>
          </div>

          <div className="h-4 w-px bg-[#444] mx-1" />

          {/* Quick Action Buttons */}
          <button
            onClick={handleBootInSeaBios}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[11px] shadow-sm transition active:translate-y-0.5"
            title="Assemble & Boot via HLE (F5 / Ctrl+Enter)"
          >
            <Play size={13} className="fill-white" />
            <span>Fast Boot</span>
          </button>

          <button
            onClick={handleNativeSeaBiosBoot}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-[11px] shadow-sm transition active:translate-y-0.5"
            title="Directly Execute SeaBIOS Native Reset Vector (Experimental!)"
          >
            <Cpu size={13} className="fill-white" />
            <span>Native Reset Boot</span>
          </button>

          <button
            onClick={handleCompile}
            className="flex items-center gap-1.5 px-2 py-1 bg-[#333333] hover:bg-[#444444] text-gray-200 rounded text-[11px] transition"
            title="Assemble Source (Ctrl+B)"
          >
            <Sparkles size={13} className="text-yellow-400" />
            <span>Assemble</span>
          </button>

          <button
            onClick={handleSaveToVFS}
            className="flex items-center gap-1.5 px-2 py-1 bg-[#333333] hover:bg-[#444444] text-gray-200 rounded text-[11px] transition"
            title="Save file to VFS (Ctrl+S)"
          >
            <Save size={13} className="text-blue-400" />
            <span>Save</span>
          </button>
        </div>

        {/* Center / Right Quick Stats */}
        <div className="flex items-center gap-3">
          {/* MBR Sector Usage Meter */}
          <div className="flex items-center gap-2 bg-[#1b1b1c] px-2.5 py-0.5 rounded border border-[#3c3c3c]">
            <span className="text-[10px] text-gray-400">MBR Sector:</span>
            <div className="w-20 bg-gray-800 h-2 rounded overflow-hidden border border-gray-700">
              <div 
                className={`h-full transition-all ${
                  sectorCount > 512 ? 'bg-red-500' : sectorCount >= 510 ? 'bg-emerald-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(100, (sectorCount / 512) * 100)}%` }}
              />
            </div>
            <span className={`text-[10px] font-bold ${sectorCount > 512 ? 'text-red-400' : 'text-gray-300'}`}>
              {sectorCount}/512 B ({sectorPct}%)
            </span>
            {hasSig ? (
              <span className="flex items-center gap-0.5 text-[9px] px-1 bg-emerald-950 text-emerald-300 border border-emerald-700/50 rounded">
                <CheckCircle2 size={10} /> 0xAA55
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-[9px] px-1 bg-amber-950 text-amber-300 border border-amber-700/50 rounded">
                <AlertTriangle size={10} /> No 0xAA55
              </span>
            )}
          </div>

          {/* Export Dropdown */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleDownloadBin}
              className="flex items-center gap-1 px-2 py-1 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-gray-300 rounded text-[10px] border border-[#444]"
              title="Download raw 512B boot sector image (.bin)"
            >
              <Download size={11} className="text-green-400" />
              <span>Export .BIN</span>
            </button>
            <button
              onClick={handleDownloadAsm}
              className="flex items-center gap-1 px-2 py-1 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-gray-300 rounded text-[10px] border border-[#444]"
              title="Download source code (.asm)"
            >
              <FileText size={11} className="text-cyan-400" />
              <span>Export .ASM</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-56 bg-[#252526] border-r border-[#333333] flex flex-col shrink-0">
          {/* Sidebar Nav Buttons */}
          <div className="flex border-b border-[#333333] bg-[#1e1e1e]">
            <button
              onClick={() => setSidebarSection('files')}
              className={`flex-1 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider transition ${
                sidebarSection === 'files' ? 'text-white border-b-2 border-cyan-500 bg-[#252526]' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Files ({openFiles.length})
            </button>
            <button
              onClick={() => setSidebarSection('symbols')}
              className={`flex-1 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider transition ${
                sidebarSection === 'symbols' ? 'text-white border-b-2 border-cyan-500 bg-[#252526]' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Labels
            </button>
            <button
              onClick={() => setSidebarSection('cheatsheet')}
              className={`flex-1 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider transition ${
                sidebarSection === 'cheatsheet' ? 'text-white border-b-2 border-cyan-500 bg-[#252526]' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              ASM Ref
            </button>
          </div>

          {/* Section: Files Explorer */}
          {sidebarSection === 'files' && (
            <div className="flex-1 flex flex-col overflow-y-auto p-1.5 gap-1">
              <div className="flex items-center justify-between px-1.5 py-1 text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                <span>ASM Templates & Files</span>
                <button
                  onClick={handleNewFile}
                  className="p-0.5 hover:bg-[#333] rounded text-gray-300 hover:text-white"
                  title="Create New Assembly File"
                >
                  <Plus size={13} />
                </button>
              </div>

              {openFiles.map(file => {
                const isActive = file.id === activeFileId;
                return (
                  <div
                    key={file.id}
                    onClick={() => setActiveFileId(file.id)}
                    className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer group transition ${
                      isActive ? 'bg-[#37373d] text-white font-bold border-l-2 border-cyan-400' : 'text-gray-400 hover:bg-[#2a2d2e] hover:text-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileCode size={13} className={isActive ? 'text-cyan-400' : 'text-gray-500'} />
                      <span className="truncate">{file.name}</span>
                      {file.isModified && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />}
                    </div>
                    {openFiles.length > 1 && (
                      <button
                        onClick={(e) => handleCloseTab(file.id, e)}
                        className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                );
              })}

              <div className="mt-4 border-t border-[#333] pt-2 px-1">
                <div className="text-[9px] text-gray-500 uppercase font-bold mb-1">Target Boot Origin</div>
                <select
                  value={activeFile?.targetOrigin || 0x7C00}
                  onChange={(e) => {
                    const org = parseInt(e.target.value, 16);
                    setOpenFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, targetOrigin: org } : f));
                  }}
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-1.5 py-1 text-[10px] text-gray-200 outline-none"
                >
                  <option value="0x7C00">0x7C00 - x86 Real Mode MBR (Standard Boot)</option>
                  <option value="0x100000">0x100000 - 32-bit Protected Mode Kernel</option>
                  <option value="0x0000">0x0000 - Raw IVT / Real Origin</option>
                </select>
              </div>
            </div>
          )}

          {/* Section: Symbols & Labels */}
          {sidebarSection === 'symbols' && (
            <div className="flex-1 flex flex-col overflow-y-auto p-1.5 gap-1">
              <div className="px-1.5 py-1 text-[10px] text-gray-400 uppercase font-bold">
                Resolved Labels ({assembleResult ? Object.keys(assembleResult.labels).length : 0})
              </div>
              {assembleResult && Object.keys(assembleResult.labels).length > 0 ? (
                Object.entries(assembleResult.labels).map(([label, addr]) => (
                  <div
                    key={label}
                    onClick={() => handleJumpToLabel(label)}
                    className="flex items-center justify-between px-2 py-1 rounded bg-[#1e1e1e] hover:bg-[#2d2d2d] cursor-pointer text-[10px] border border-[#333]"
                  >
                    <span className="text-cyan-300 font-bold truncate">{label}</span>
                    <span className="text-gray-500 font-mono text-[9px]">0x{addr.toString(16).toUpperCase()}</span>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 p-2 text-center text-[10px]">No labels defined in source.</div>
              )}
            </div>
          )}

          {/* Section: x86 ASM Cheatsheet */}
          {sidebarSection === 'cheatsheet' && (
            <div className="flex-1 flex flex-col overflow-y-auto p-2 gap-2 text-[10px]">
              <div className="font-bold text-cyan-300">BIOS Video Interrupts (INT 0x10)</div>
              <div className="bg-[#1e1e1e] p-1.5 rounded border border-[#333] space-y-1">
                <div><span className="text-yellow-400">AH=0x0E</span>: Teletype print char in AL</div>
                <div><span className="text-yellow-400">AH=0x00</span>: Set video mode (AL=0x13 or 0x03)</div>
                <div><span className="text-yellow-400">AH=0x0C</span>: Write pixel (AL=color, CX=x, DX=y)</div>
                <div><span className="text-yellow-400">AH=0x02</span>: Set cursor (DH=row, DL=col)</div>
              </div>

              <div className="font-bold text-green-300">Keyboard & System INTs</div>
              <div className="bg-[#1e1e1e] p-1.5 rounded border border-[#333] space-y-1">
                <div><span className="text-yellow-400">INT 0x16</span>: AH=0 read key (AL=ASCII)</div>
                <div><span className="text-yellow-400">INT 0x13</span>: AH=2 read sector from disk</div>
                <div><span className="text-yellow-400">INT 0x19</span>: SeaBIOS warm reboot</div>
                <div><span className="text-yellow-400">INT 0x80</span>: VCOS Native Syscalls</div>
              </div>

              <div className="font-bold text-purple-300">Hardware I/O Ports</div>
              <div className="bg-[#1e1e1e] p-1.5 rounded border border-[#333] space-y-1">
                <div><span className="text-cyan-400">0x3C8 / 0x3C9</span>: VGA DAC Palette</div>
                <div><span className="text-cyan-400">0x388 / 0x42</span>: SoundBlaster / 8253 PIT</div>
                <div><span className="text-cyan-400">0x300 / 0x302</span>: P2P Network Mesh NIC</div>
                <div><span className="text-cyan-400">0x3F8</span>: COM1 Serial Port</div>
              </div>
            </div>
          )}
        </div>

        {/* Center: Multi-Tab Code Editor */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
          {/* File Tabs Bar */}
          <div className="h-8 bg-[#252526] border-b border-[#333333] flex items-center overflow-x-auto px-1 gap-1 shrink-0 scrollbar-none">
            {openFiles.map(file => {
              const isActive = file.id === activeFileId;
              return (
                <div
                  key={file.id}
                  onClick={() => setActiveFileId(file.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-[11px] rounded-t cursor-pointer border-t-2 transition ${
                    isActive
                      ? 'bg-[#1e1e1e] text-white font-bold border-cyan-400 shadow-sm'
                      : 'bg-[#2d2d2d] text-gray-400 hover:text-gray-200 border-transparent'
                  }`}
                >
                  <FileCode size={13} className={isActive ? 'text-cyan-400' : 'text-gray-500'} />
                  <span>{file.name}</span>
                  {file.isModified && <span className="text-cyan-400">*</span>}
                  {openFiles.length > 1 && (
                    <button
                      onClick={(e) => handleCloseTab(file.id, e)}
                      className="hover:text-red-400 rounded p-0.5 ml-1"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              );
            })}
            <button
              onClick={handleNewFile}
              className="p-1 hover:bg-[#333] text-gray-400 hover:text-white rounded ml-1"
              title="Add New File"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Code Textarea & Gutter */}
          <div className="flex-1 relative flex overflow-hidden">
            {/* Line Numbers Gutter */}
            <div className="w-12 bg-[#1e1e1e] border-r border-[#2d2d2d] py-3 text-right pr-3 select-none text-gray-600 font-mono text-[11px] leading-[18px] shrink-0">
              {(activeFile?.code || '').split('\n').map((_, i) => {
                const lineNum = i + 1;
                const hasError = assembleResult?.errors.some(e => e.line === lineNum);
                return (
                  <div key={i} className={`flex items-center justify-end gap-1 ${hasError ? 'text-red-400 font-bold bg-red-950/30' : ''}`}>
                    {hasError && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                    <span>{lineNum}</span>
                  </div>
                );
              })}
            </div>

            {/* Editor TextArea */}
            <textarea
              ref={editorTextareaRef}
              value={activeFile?.code || ''}
              onChange={(e) => handleCodeChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onKeyUp={handleCursorMove}
              onClick={handleCursorMove}
              spellCheck={false}
              className="flex-1 bg-[#1e1e1e] text-[#d4d4d4] p-3 outline-none resize-none font-mono text-[11px] leading-[18px] tab-4 selection:bg-blue-700/50 whitespace-pre overflow-auto"
            />
          </div>

          {/* Editor Status Bar */}
          <div className="h-6 bg-[#007acc] text-white flex items-center justify-between px-3 text-[10px] shrink-0 font-sans">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 font-bold">
                <Code2 size={12} /> x86 Real Mode
              </span>
              <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
              <span>{(activeFile?.code || '').length} chars</span>
              <span>{(activeFile?.code || '').split('\n').length} lines</span>
            </div>
            <div className="flex items-center gap-4">
              {assembleResult?.errors && assembleResult.errors.length > 0 ? (
                <span className="flex items-center gap-1 text-red-200 bg-red-900/60 px-1.5 rounded font-bold">
                  <AlertCircle size={11} /> {assembleResult.errors.length} Error(s)
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-200">
                  <CheckCircle2 size={11} /> Ready
                </span>
              )}
              <span>Origin: 0x{(activeFile?.targetOrigin || 0x7C00).toString(16).toUpperCase()}</span>
              <span>UTF-8</span>
            </div>
          </div>
        </div>

        {/* Right / Bottom Pane: SeaBIOS & Boot Sector Execution Console */}
        <div className="w-[480px] bg-[#1a1a1b] border-l border-[#333333] flex flex-col shrink-0">
          {/* Runner Tabs */}
          <div className="h-8 bg-[#252526] border-b border-[#333333] flex items-center px-1 gap-1 shrink-0">
            <button
              onClick={() => setActiveTab('monitor')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded transition ${
                activeTab === 'monitor' ? 'bg-[#1a1a1b] text-cyan-400 border border-[#3c3c3c]' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Monitor size={12} />
              <span>SeaBIOS Monitor</span>
            </button>

            <button
              onClick={() => setActiveTab('hex')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded transition ${
                activeTab === 'hex' ? 'bg-[#1a1a1b] text-yellow-400 border border-[#3c3c3c]' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Layers size={12} />
              <span>MBR Hex Listing</span>
            </button>

            <button
              onClick={() => setActiveTab('disasm')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded transition ${
                activeTab === 'disasm' ? 'bg-[#1a1a1b] text-purple-400 border border-[#3c3c3c]' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Cpu size={12} />
              <span>Disasm</span>
            </button>

            <button
              onClick={() => setActiveTab('serial')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded transition ${
                activeTab === 'serial' ? 'bg-[#1a1a1b] text-green-400 border border-[#3c3c3c]' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Radio size={12} />
              <span>COM1</span>
            </button>
          </div>

          {/* Tab 1: SeaBIOS CRT Monitor & Interactive Runner */}
          {activeTab === 'monitor' && (
            <div className="flex-1 flex flex-col p-2 gap-2 overflow-hidden bg-[#121213]">
              {/* CRT Screen Frame */}
              <div className="relative flex-1 bg-black border-2 border-[#333] rounded overflow-hidden flex flex-col shadow-inner">
                {/* CRT Scanline overlay */}
                {crtEffect && (
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_4px] z-10 opacity-70" />
                )}

                {/* Video Mode Switch (Text Mode vs VGA Mode 13h Framebuffer) */}
                {screenMode === 'vga' ? (
                  <div className="flex-1 flex items-center justify-center bg-black p-1">
                    <canvas
                      ref={canvasRef}
                      width={320}
                      height={200}
                      className="w-full h-full object-contain image-rendering-pixelated"
                    />
                  </div>
                ) : (
                  <div className="flex-1 p-2 font-mono text-[10px] leading-[15px] overflow-y-auto text-emerald-400 bg-black selection:bg-emerald-800">
                    {seaBiosHistory.length === 0 ? (
                      <div className="text-gray-600 text-center mt-10">
                        SeaBIOS Standby.<br />Click [Run in SeaBIOS] or press F5 to boot sector.
                      </div>
                    ) : (
                      seaBiosHistory.map((item, idx) => (
                        <div
                          key={idx}
                          className={`whitespace-pre-wrap ${
                            item.type === 'post' ? 'text-gray-300' :
                            item.type === 'boot' ? 'text-cyan-400 font-bold' :
                            item.type === 'cmd' ? 'text-yellow-300 font-bold' :
                            item.type === 'error' ? 'text-red-400 font-bold' :
                            item.type === 'reboot' ? 'text-orange-400' :
                            'text-emerald-400'
                          }`}
                        >
                          {item.text}
                        </div>
                      ))
                    )}
                    <div ref={terminalBottomRef} />
                  </div>
                )}

                {/* CRT Header / Mode Tag */}
                <div className="absolute top-1 right-2 flex items-center gap-1 z-20">
                  <button
                    onClick={() => setScreenMode(screenMode === 'text' ? 'vga' : 'text')}
                    className="px-1.5 py-0.5 bg-[#222]/80 hover:bg-[#333] text-[9px] text-cyan-300 rounded border border-cyan-800/40 backdrop-blur"
                  >
                    {screenMode === 'text' ? 'Switch to VGA (0x13)' : 'Switch to Text (0x03)'}
                  </button>
                  <button
                    onClick={() => setCrtEffect(!crtEffect)}
                    className={`px-1.5 py-0.5 text-[9px] rounded border backdrop-blur ${
                      crtEffect ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/50' : 'bg-gray-800/80 text-gray-400 border-gray-600'
                    }`}
                  >
                    CRT FX
                  </button>
                </div>
              </div>

              {/* SeaBIOS Interactive Command Line Prompt */}
              <form onSubmit={handleCommandSubmit} className="flex items-center gap-1.5 bg-[#1e1e1e] p-1.5 rounded border border-[#333]">
                <span className="text-yellow-400 font-bold text-[10px] whitespace-nowrap">SeaBIOS&gt;</span>
                <input
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  placeholder="Type SeaBIOS command (e.g. help, regs, dump, step, boot)..."
                  className="flex-1 bg-transparent text-gray-100 text-[10px] outline-none font-mono"
                />
                <button
                  type="submit"
                  className="px-2 py-0.5 bg-[#333] hover:bg-[#444] text-gray-300 rounded text-[9px] font-bold"
                >
                  SEND
                </button>
              </form>

              {/* Hardware Execution Controls */}
              <div className="bg-[#1e1e1e] p-2 rounded border border-[#333] flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {isVMRunning ? (
                      <button
                        onClick={() => seaBios.pause()}
                        className="flex items-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-bold"
                      >
                        <Pause size={11} /> Pause
                      </button>
                    ) : (
                      <button
                        onClick={() => seaBios.resume()}
                        className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold"
                      >
                        <Play size={11} /> Resume
                      </button>
                    )}

                    <button
                      onClick={() => seaBios.step()}
                      className="flex items-center gap-1 px-2 py-1 bg-[#333] hover:bg-[#444] text-gray-200 rounded text-[10px]"
                      title="Step single instruction"
                    >
                      <StepForward size={11} className="text-cyan-400" /> Step
                    </button>

                    <button
                      onClick={() => seaBios.reboot()}
                      className="flex items-center gap-1 px-2 py-1 bg-[#333] hover:bg-[#444] text-gray-200 rounded text-[10px]"
                      title="SeaBIOS Warm Reboot"
                    >
                      <RotateCcw size={11} className="text-orange-400" /> Reboot
                    </button>
                  </div>

                  {/* CPU Speed Slider */}
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <Sliders size={11} className="text-gray-400" />
                    <span className="text-gray-400">{cpuSpeed >= 1000000 ? `${(cpuSpeed / 1000000).toFixed(1)}MHz` : `${cpuSpeed}Hz`}</span>
                    <input
                      type="range"
                      min="10"
                      max="100000"
                      step="50"
                      value={cpuSpeed}
                      onChange={(e) => setCpuSpeed(parseInt(e.target.value, 10))}
                      className="w-16 accent-cyan-500"
                    />
                  </div>
                </div>

                {/* Live CPU Registers Inspector */}
                <div className="grid grid-cols-4 gap-1 bg-black/40 p-1.5 rounded border border-[#2c2c2c] text-[9px]">
                  <div><span className="text-yellow-400">EAX:</span> 0x{cpuRegs.eax.toString(16).padStart(8, '0').toUpperCase()}</div>
                  <div><span className="text-yellow-400">EBX:</span> 0x{cpuRegs.ebx.toString(16).padStart(8, '0').toUpperCase()}</div>
                  <div><span className="text-yellow-400">ECX:</span> 0x{cpuRegs.ecx.toString(16).padStart(8, '0').toUpperCase()}</div>
                  <div><span className="text-yellow-400">EDX:</span> 0x{cpuRegs.edx.toString(16).padStart(8, '0').toUpperCase()}</div>

                  <div><span className="text-cyan-400">ESI:</span> 0x{cpuRegs.esi.toString(16).padStart(8, '0').toUpperCase()}</div>
                  <div><span className="text-cyan-400">EDI:</span> 0x{cpuRegs.edi.toString(16).padStart(8, '0').toUpperCase()}</div>
                  <div><span className="text-cyan-400">ESP:</span> 0x{cpuRegs.esp.toString(16).padStart(8, '0').toUpperCase()}</div>
                  <div><span className="text-cyan-400">EBP:</span> 0x{cpuRegs.ebp.toString(16).padStart(8, '0').toUpperCase()}</div>

                  <div><span className="text-green-400">EIP:</span> 0x{cpuRegs.eip.toString(16).padStart(8, '0').toUpperCase()}</div>
                  <div><span className="text-green-400">CS:</span> 0x{cpuRegs.cs.toString(16).padStart(4, '0').toUpperCase()}</div>
                  <div><span className="text-green-400">DS:</span> 0x{cpuRegs.ds.toString(16).padStart(4, '0').toUpperCase()}</div>
                  <div><span className="text-green-400">SS:</span> 0x{cpuRegs.ss.toString(16).padStart(4, '0').toUpperCase()}</div>
                </div>

                {/* EFLAGS Chips */}
                <div className="flex items-center gap-1 text-[9px]">
                  <span className="text-gray-500 font-bold">FLAGS:</span>
                  <span className={`px-1 rounded ${cpuFlags.carry ? 'bg-red-900 text-white font-bold' : 'bg-[#222] text-gray-500'}`}>CF</span>
                  <span className={`px-1 rounded ${cpuFlags.zero ? 'bg-green-900 text-white font-bold' : 'bg-[#222] text-gray-500'}`}>ZF</span>
                  <span className={`px-1 rounded ${cpuFlags.sign ? 'bg-blue-900 text-white font-bold' : 'bg-[#222] text-gray-500'}`}>SF</span>
                  <span className={`px-1 rounded ${cpuFlags.interrupt ? 'bg-purple-900 text-white font-bold' : 'bg-[#222] text-gray-500'}`}>IF</span>
                  <span className={`px-1 rounded ${cpuFlags.overflow ? 'bg-amber-900 text-white font-bold' : 'bg-[#222] text-gray-500'}`}>OF</span>
                  <span className={`px-1 rounded ${cpuFlags.parity ? 'bg-teal-900 text-white font-bold' : 'bg-[#222] text-gray-500'}`}>PF</span>
                  <span className="ml-auto text-gray-500 text-[9px]">Cycles: {vm.cpu.totalCycles}</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: MBR Machine Code Hex Listing */}
          {activeTab === 'hex' && (
            <div className="flex-1 p-2 flex flex-col gap-2 overflow-y-auto bg-[#121213]">
              <div className="text-[10px] text-gray-400 flex items-center justify-between">
                <span>Assembled Hex Listing ({assembleResult?.bytes.length || 0} bytes)</span>
                <button
                  onClick={handleDownloadBin}
                  className="px-2 py-0.5 bg-[#333] hover:bg-[#444] text-cyan-300 rounded text-[9px]"
                >
                  Download .bin
                </button>
              </div>

              {/* Raw Hex Dump View */}
              <div className="bg-black p-2 rounded border border-[#333] text-[9px] font-mono text-gray-300 leading-relaxed overflow-x-auto">
                {assembleResult && assembleResult.bytes.length > 0 ? (
                  Array.from({ length: Math.ceil(assembleResult.bytes.length / 16) }).map((_, rowIndex) => {
                    const rowAddr = (assembleResult.origin + rowIndex * 16).toString(16).padStart(4, '0').toUpperCase();
                    const slice = Array.from(assembleResult.bytes.slice(rowIndex * 16, (rowIndex + 1) * 16));
                    const hexStr = slice.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ').padEnd(47, ' ');
                    const asciiStr = slice.map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('');
                    return (
                      <div key={rowIndex} className="flex gap-2">
                        <span className="text-cyan-400">0x{rowAddr}:</span>
                        <span className="text-yellow-200">{hexStr}</span>
                        <span className="text-gray-500">|{asciiStr}|</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-gray-500 text-center p-4">No assembled machine code. Click [Assemble] or [Run].</div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Disassembler View */}
          {activeTab === 'disasm' && (
            <div className="flex-1 p-2 flex flex-col gap-2 overflow-y-auto bg-[#121213]">
              <div className="text-[10px] text-gray-400">Real-time Instruction Disassembly</div>
              <div className="bg-black p-2 rounded border border-[#333] text-[10px] font-mono space-y-1">
                {vm.cpu.disassemble(vm.cpu.registers.eip, 12).map((inst, idx) => {
                  const isCurrent = inst.address === vm.cpu.registers.eip;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 px-1.5 py-0.5 rounded ${
                        isCurrent ? 'bg-blue-900/60 text-white font-bold border-l-2 border-cyan-400' : 'text-gray-400'
                      }`}
                    >
                      <span className="w-4 text-cyan-400 font-bold">{isCurrent ? '=>' : '  '}</span>
                      <span className="text-yellow-400">0x{inst.address.toString(16).padStart(8, '0').toUpperCase()}</span>
                      <span className="text-gray-500 w-24 truncate">
                        {inst.bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')}
                      </span>
                      <span className="text-cyan-300 font-bold w-14">{inst.mnemonic}</span>
                      <span className="text-gray-200">{inst.operands}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 4: Serial COM1 Output */}
          {activeTab === 'serial' && (
            <div className="flex-1 p-2 flex flex-col gap-2 overflow-y-auto bg-[#121213]">
              <div className="text-[10px] text-gray-400">COM1 Serial Port Log (0x3F8)</div>
              <div className="flex-1 bg-black p-2 rounded border border-[#333] text-[10px] font-mono text-green-400 overflow-y-auto">
                {vm.serialLog.length === 0 ? (
                  <div className="text-gray-600 text-center mt-10">No serial transmission received.</div>
                ) : (
                  vm.serialLog.map((line, idx) => (
                    <div key={idx} className="whitespace-pre-wrap">{line}</div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
