import React, { useState, useEffect, useRef } from 'react';
import { usePIT } from '../hooks/useAudio';
import { kernel } from '../services/kernel';
import { vm } from '../services/vm/motherboard';
import { seaBios } from '../services/vcode/seabios';
import { openBios } from '../services/vcode/openbios';
import { LATENCY_PRESETS, LATENCY_PRESET_LIST } from '../services/vm/latencyPresets';
import { VCodeAssembler } from '../services/vcode/assembler';
import { ASSEMBLY_TEMPLATES } from '../services/vcode/templates';

export const Bootloader: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const { playTone } = usePIT();
  
  // Screens: 'post' | 'boot-menu' | 'cmos' | 'shell' | 'diags' | 'booting-os'
  const [screen, setScreen] = useState<'post' | 'boot-menu' | 'cmos' | 'shell' | 'diags' | 'booting-os'>('post');
  const [bootingOSLines, setBootingOSLines] = useState<string[]>([]);
  
  // POST sequence state
  const [ramTested, setRamTested] = useState(0);
  const [postLines, setPostLines] = useState<string[]>([]);
  const [ramCountingComplete, setRamCountingComplete] = useState(false);
  const [countdown, setCountdown] = useState(4);
  const countdownRef = useRef<number>(4);

  // Active firmware state: 'seabios' | 'openbios'
  const [activeFirmware, setActiveFirmware] = useState<'seabios' | 'openbios'>('seabios');

  // CMOS state
  const [activeTab, setActiveTab] = useState(0); // 0: Main, 1: Advanced, 2: Boot, 3: Exit
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [systemTime, setSystemTime] = useState({ hr: 17, min: 21, sec: 15 });
  const [systemDate, setSystemDate] = useState({ yr: 2026, mo: 9, dy: 8 });
  const [latencyPresetIdx, setLatencyPresetIdx] = useState(1); // Default to 'retro_486'
  const [cycleWeightsEnabled, setCycleWeightsEnabled] = useState(true);
  const [crtScanlines, setCrtScanlines] = useState(true);
  const [audioBeep, setAudioBeep] = useState(true);
  const [bootDeviceIdx, setBootDeviceIdx] = useState(0); // 0: VC.os GUI, 1: SeaBIOS Shell, 2: Floppy Disk
  const [quickBoot, setQuickBoot] = useState(false);
  const [cmosLogs, setCmosLogs] = useState<string[]>([]);

  // Shell State
  const [shellInput, setShellInput] = useState('');
  const [shellLines, setShellLines] = useState<string[]>([
    'SeaBIOS (version 1.16.3-vcos-rel) Interactive Command Shell.',
    'Copyright (C) 2026 VC.os Team & SeaBIOS project.',
    'Type \'help\' or \'?\' for complete bare-metal command interface.'
  ]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Diagnostics State
  const [diagsLog, setDiagsLog] = useState<string[]>([]);
  const [diagsProgress, setDiagsProgress] = useState(0);

  // Boot Menu selection index
  const [bootMenuIdx, setBootMenuIdx] = useState(0);

  // Sound helpers
  const playBeep = (freq = 900, duration = 0.1) => {
    if (audioBeep) {
      try {
        playTone(freq, duration, 'square');
      } catch (e) {
        console.error('Audio beep failed', e);
      }
    }
  };

  // Start RAM Counting
  useEffect(() => {
    if (screen !== 'post') return;

    kernel.emitEvent('CRITICAL', 'BOOT_SEQ_START');
    kernel.executeTask('BOOTLOADER', 80);

    if (quickBoot) {
      setRamTested(16384);
      setRamCountingComplete(true);
      playBeep(900, 0.15);
      return;
    }

    const interval = setInterval(() => {
      setRamTested(prev => {
        if (prev >= 16384) {
          clearInterval(interval);
          setRamCountingComplete(true);
          playBeep(900, 0.15); // Standard POST Beep
          return 16384;
        }
        return prev + 512;
      });
    }, 25);

    return () => clearInterval(interval);
  }, [screen, quickBoot]);

  // Handle remaining POST lines after RAM counts
  useEffect(() => {
    if (!ramCountingComplete || screen !== 'post') return;

    const extraPost = [
      "SeaBIOS (version 1.16.3-vcos-rel)",
      "Build Date: 2026-08-30 | VCOS Baremetal Virtual Machine Subsystem",
      "CPU: 1x VCOS x86 Virtual Core @ 25.0 MHz",
      "i440FX PMC / Intel 82371SB (PIIX3) Bus Master IDE Bridge Controller",
      "DRAM: 16384 KiB Physical Memory (Base 640K, Extended 15360K) OK",
      "VGA BIOS: VCOS Mode 13h Color Text Adapter @ 0x000A0000",
      "ATA Drive 0: VCOS-HDD-0 (16 MB Solid-State Block Drive)",
      "Sound Card: SoundBlaster 16 DSP / Yamaha OPL2 Synth @ Port 0x388",
      "Floppy Controller: [Legacy Port 0x3F0-0x3F7 Multi-Card Device] Active",
      "Network adapter: VCOS P2P NIC @ Port 0x300, MAC: aa:bb:cc:dd:ee:ff",
      "Verifying boot sector signature (0xAA55) on ATA Drive 0...",
      "MBR Boot Sector successfully resolved at address 0000:7C00.",
    ];

    setPostLines([]);
    let curLine = 0;
    const interval = setInterval(() => {
      if (curLine < extraPost.length) {
        const lineToAdd = extraPost[curLine];
        if (lineToAdd !== undefined) {
          setPostLines(prev => [...prev, lineToAdd]);
        }
        curLine++;
      } else {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [ramCountingComplete, screen]);

  // Countdown timer for automatic boot
  useEffect(() => {
    if (!ramCountingComplete || postLines.length < 12 || screen !== 'post') return;

    countdownRef.current = 4;
    setCountdown(4);

    const timer = setInterval(() => {
      countdownRef.current -= 1;
      setCountdown(countdownRef.current);
      if (countdownRef.current <= 0) {
        clearInterval(timer);
        // Execute boot action
        executeBoot();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [ramCountingComplete, postLines, screen]);

  // Update clock state in CMOS
  useEffect(() => {
    if (screen !== 'cmos') return;
    const interval = setInterval(() => {
      setSystemTime(prev => {
        let nSec = prev.sec + 1;
        let nMin = prev.min;
        let nHr = prev.hr;
        if (nSec >= 60) {
          nSec = 0;
          nMin += 1;
        }
        if (nMin >= 60) {
          nMin = 0;
          nHr += 1;
        }
        if (nHr >= 24) {
          nHr = 0;
        }
        return { hr: nHr, min: nMin, sec: nSec };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [screen]);

  // Execute actual target boot
  const executeBoot = () => {
    kernel.emitEvent('CRITICAL', 'BOOT_SEQ_COMPLETE');
    if (bootDeviceIdx === 0) {
      // Boot VC.os GUI
      triggerRealBoot();
    } else if (bootDeviceIdx === 1) {
      // Boot to SeaBIOS Command Shell
      setScreen('shell');
    } else {
      // Boot from Floppy diagnostics
      setScreen('diags');
    }
  };

  // Real baremetal OS booting engine executing instructions from compiled boot loader
  const triggerRealBoot = () => {
    setScreen('booting-os');
    setBootingOSLines([
      "=============================================================",
      "             VCOS BARE-METAL BOOTSTRAP SUBSYSTEM             ",
      "=============================================================",
      "PROBING: Hard Disk Drive 0 (DL=0x80)...",
      "READING: Physical MBR Sector 0x00007C00 (512 Bytes)..."
    ]);

    const shellTemplate = ASSEMBLY_TEMPLATES.find(t => t.id === 'seabios_shell');
    if (!shellTemplate) {
      setTimeout(() => onComplete(), 1000);
      return;
    }
    
    const res = VCodeAssembler.assemble(shellTemplate.code, 0x7C00);
    if (!res.success) {
      setBootingOSLines(prev => [...prev, "[FAIL] Failed to assemble microkernel boot sectors!"]);
      setTimeout(onComplete, 1500);
      return;
    }

    // Load assembled real-mode boot sector into motherboard memory
    seaBios.bootSector(res.bytes, 0x7C00, false);
    
    let cycle = 0;
    const maxCycles = 30;
    const linesToAppend = [
      `[OK] MBR signature 0xAA55 verified at offset 510.`,
      `[OK] Boot Vector: CS=0x0000 EIP=0x00007C00 SS=0x0000 ESP=0x00007C00`,
      `[CPU] Transferring control to CPU Core 0 executing REAL_16...`,
      `-------------------------------------------------------------`
    ];
    
    const runStep = () => {
      if (cycle >= maxCycles) {
        setBootingOSLines(prev => [
          ...prev,
          `-------------------------------------------------------------`,
          `[SUCCESS] VCOS microkernel handshake complete.`,
          `[VCOS] Loading graphical system node descriptors...`,
          `[VCOS] Passing control to VC.os window server bridge...`
        ]);
        setTimeout(() => {
          onComplete();
        }, 1000);
        return;
      }

      try {
        const currentEIP = vm.cpu.registers.eip;
        
        // Step the actual motherboard CPU emulator so registers modify for real!
        vm.cpu.step();
        
        // Format disassembly for real-time console streaming
        const dis = vm.cpu.disassemble(currentEIP, 1)[0];
        const hex = dis.bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
        const regString = `EAX=0x${vm.cpu.registers.eax.toString(16).toUpperCase().padStart(8, '0')} ESP=0x${vm.cpu.registers.esp.toString(16).toUpperCase().padStart(4, '0')} CS=0x${vm.cpu.registers.cs.toString(16).toUpperCase().padStart(4, '0')}`;
        
        const line = `[STEP ${cycle.toString().padStart(2, '0')}] 0x${currentEIP.toString(16).toUpperCase().padStart(4, '0')}:  ${hex.padEnd(8)}  ${dis.mnemonic.padEnd(5)} ${dis.operands.padEnd(16)} | ${regString}`;
        
        setBootingOSLines(prev => [...prev, line]);
        if (audioBeep) {
          playBeep(800 + cycle * 12, 0.015);
        }
        cycle++;
        setTimeout(runStep, 75);
      } catch (e: any) {
        // Fallback gracefully to complete booting on exception
        setBootingOSLines(prev => [...prev, `[CPU EXCEPTION] ${e.message}. Forcing VCOS desktop load...`]);
        setTimeout(onComplete, 1000);
      }
    };

    setBootingOSLines(prev => [...prev, ...linesToAppend]);
    setTimeout(runStep, 800);
  };

  // CMOS save handler
  const saveCMOSAndReboot = () => {
    // 1. Get Latency Configuration Preset Object
    const presetKeys = Object.keys(LATENCY_PRESETS);
    const selectedPresetKey = presetKeys[latencyPresetIdx] || 'retro_486';
    const config = LATENCY_PRESETS[selectedPresetKey];

    // 2. Apply config directly to VM
    vm.updateLatencyConfig({
      ...config,
      enableInstructionCycleWeights: cycleWeightsEnabled
    });

    // 3. Save options in LocalStorage for persistence
    localStorage.setItem('vcos_bios_preset_idx', latencyPresetIdx.toString());
    localStorage.setItem('vcos_bios_weights', cycleWeightsEnabled ? '1' : '0');
    localStorage.setItem('vcos_bios_scanlines', crtScanlines ? '1' : '0');
    localStorage.setItem('vcos_bios_beeps', audioBeep ? '1' : '0');
    localStorage.setItem('vcos_bios_boot_dev', bootDeviceIdx.toString());
    localStorage.setItem('vcos_bios_quick', quickBoot ? '1' : '0');
    localStorage.setItem('vcos_bios_firmware', activeFirmware);

    // 4. Force global canvas state if necessary
    vm.gpu.scanlinesEnabled = crtScanlines;

    playBeep(1200, 0.1);
    setTimeout(() => playBeep(1500, 0.1), 100);

    // Warm restart
    setPostLines([]);
    setRamTested(0);
    setRamCountingComplete(false);
    setScreen('post');
  };

  // Restore BIOS default settings
  const restoreBIOSDefaults = () => {
    setLatencyPresetIdx(1); // retro_486
    setCycleWeightsEnabled(true);
    setCrtScanlines(true);
    setAudioBeep(true);
    setBootDeviceIdx(0); // VC.os GUI
    setQuickBoot(false);
    setActiveFirmware('seabios');
    playBeep(600, 0.35);
  };

  // Shell Command Execution
  const handleShellCommand = () => {
    const cmd = shellInput.trim();
    if (!cmd) return;

    const updatedHistory = [...commandHistory, cmd];
    setCommandHistory(updatedHistory);
    setHistoryIndex(updatedHistory.length);
    setShellInput('');

    if (cmd.toLowerCase() === 'exit' || cmd.toLowerCase() === 'reboot' || cmd.toLowerCase() === 'reset') {
      setScreen('post');
      setRamTested(0);
      setRamCountingComplete(false);
      setPostLines([]);
      return;
    }

    if (cmd.toLowerCase() === 'boot' || cmd.toLowerCase() === 'boot vcos' || cmd.toLowerCase() === 'vcos') {
      const targetMsg = activeFirmware === 'openbios'
        ? 'Transitioning control to VC.os Graphical Desktop Kernel (PowerPC Emulator Mode)...'
        : 'Transitioning control to VC.os Graphical Desktop Kernel...';
      setShellLines(prev => [...prev, activeFirmware === 'openbios' ? `0 > ${cmd}` : `SeaBIOS (vcos)> ${cmd}`, targetMsg, '']);
      setTimeout(() => triggerRealBoot(), 800);
      return;
    }

    if (cmd.toLowerCase() === 'cls' || cmd.toLowerCase() === 'clear') {
      setShellLines([]);
      return;
    }

    if (activeFirmware === 'openbios') {
      const response = openBios.executeCommand(cmd);
      setShellLines(prev => [
        ...prev,
        `ok`,
        `0 > ${cmd}`,
        response,
        ''
      ]);
    } else {
      // Pass through to VM SeaBIOS runner for emulation queries
      const response = seaBios.executeCommand(cmd);
      setShellLines(prev => [
        ...prev,
        `SeaBIOS (vcos)> ${cmd}`,
        response,
        ''
      ]);
    }
  };

  // Run Diagnostics Subsystem
  useEffect(() => {
    if (screen !== 'diags') return;

    setDiagsProgress(0);
    setDiagsLog(['SeaBIOS Baremetal Diagnostics Utility v1.0', 'Initializing hardware probe...', '']);

    const steps = [
      { prg: 15, log: 'Probing CPU registers... 1x VCOS-X86 Core discovered (32-bit registers, Intel 80486 ISA compatible)' },
      { prg: 30, log: 'Calculating core frequency... 25,000,105 Hz. Stable MIPS threshold: 5.0 MIPS.' },
      { prg: 45, log: 'Testing System Memory DRAM block ranges... Writing patterns to 0x000000 -> 0xFFFFFF (16MB DRAM).' },
      { prg: 60, log: 'DRAM Read/Write verification complete: 0 errors detected.' },
      { prg: 75, log: 'Reading VRAM Framebuffer bounds... 128KB GFX buffer active at 0xA0000 (Mode 13h / Mode 03h text)' },
      { prg: 90, log: 'Probing SoundBlaster AdLib FM chip... Synthesizer status ok.' },
      { prg: 100, log: 'Probing P2P adaptation NIC controller... MAC Address aa:bb:cc:dd:ee:ff bound cleanly. Probe completed.' },
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < steps.length) {
        setDiagsProgress(steps[i].prg);
        setDiagsLog(prev => [...prev, steps[i].log]);
        playBeep(700 + steps[i].prg * 4, 0.05);
        i++;
      } else {
        clearInterval(interval);
        setDiagsLog(prev => [...prev, '', '>>> DIAGNOSTICS SUCCESSFUL. NO HARDWARE ANOMALIES DETECTED. <<<', 'Press any key or Escape to reboot the system.']);
      }
    }, 600);

    return () => clearInterval(interval);
  }, [screen]);

  // Handle shell welcome message depending on firmware type
  useEffect(() => {
    if (screen === 'shell') {
      if (activeFirmware === 'openbios') {
        openBios.reset();
        setShellLines([
          'OpenBIOS v1.1-vcos (Open Firmware IEEE 1275-1994 Forth Environment)',
          'Copyright (C) 2026 OpenBIOS team. PowerPC virtual platform ready.',
          'Type \'words\' to list available Forth dictionary & device commands.',
          ''
        ]);
      } else {
        setShellLines([
          'SeaBIOS (version 1.16.3-vcos-rel) Interactive Command Shell.',
          'Copyright (C) 2026 VC.os Team & SeaBIOS project.',
          'Type \'help\' or \'?\' for complete bare-metal command interface.',
          ''
        ]);
      }
    }
  }, [screen, activeFirmware]);

  // Load saved CMOS options from localStorage on mount
  useEffect(() => {
    try {
      const savedPreset = localStorage.getItem('vcos_bios_preset_idx');
      if (savedPreset !== null) setLatencyPresetIdx(parseInt(savedPreset, 10));

      const savedWeights = localStorage.getItem('vcos_bios_weights');
      if (savedWeights !== null) setCycleWeightsEnabled(savedWeights === '1');

      const savedScanlines = localStorage.getItem('vcos_bios_scanlines');
      if (savedScanlines !== null) setCrtScanlines(savedScanlines === '1');

      const savedBeeps = localStorage.getItem('vcos_bios_beeps');
      if (savedBeeps !== null) setAudioBeep(savedBeeps === '1');

      const savedBootDev = localStorage.getItem('vcos_bios_boot_dev');
      if (savedBootDev !== null) setBootDeviceIdx(parseInt(savedBootDev, 10));

      const savedQuick = localStorage.getItem('vcos_bios_quick');
      if (savedQuick !== null) setQuickBoot(savedQuick === '1');

      const savedFirmware = localStorage.getItem('vcos_bios_firmware');
      if (savedFirmware === 'openbios' || savedFirmware === 'seabios') {
        setActiveFirmware(savedFirmware);
      }
    } catch (e) {
      console.error('Failed to load CMOS state', e);
    }
  }, []);

  // Global keydown listeners for bootloader screen navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (screen === 'post') {
        const keyLower = e.key.toLowerCase();
        if (e.key === 'F2' || e.key === 'Delete' || keyLower === 's') {
          e.preventDefault();
          playBeep(800, 0.1);
          setScreen('cmos');
          setActiveTab(0);
          setSelectedIndex(0);
        } else if (e.key === 'F12' || keyLower === 'm' || keyLower === 'b') {
          e.preventDefault();
          playBeep(800, 0.1);
          setScreen('boot-menu');
          setBootMenuIdx(0);
        } else if (e.key === 'Escape' || keyLower === 'c') {
          e.preventDefault();
          playBeep(800, 0.1);
          setScreen('shell');
        }
      } else if (screen === 'boot-menu') {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          playBeep(700, 0.05);
          setBootMenuIdx(prev => (prev === 0 ? 3 : prev - 1));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          playBeep(700, 0.05);
          setBootMenuIdx(prev => (prev === 3 ? 0 : prev + 1));
        } else if (e.key === '1') {
          e.preventDefault();
          playBeep(1000, 0.12);
          triggerRealBoot();
        } else if (e.key === '2') {
          e.preventDefault();
          playBeep(1000, 0.12);
          setScreen('shell');
        } else if (e.key === '3') {
          e.preventDefault();
          playBeep(1000, 0.12);
          setScreen('diags');
        } else if (e.key === '4') {
          e.preventDefault();
          playBeep(1000, 0.12);
          setScreen('diags');
        } else if (e.key === 'Enter') {
          e.preventDefault();
          playBeep(1000, 0.12);
          if (bootMenuIdx === 0) {
            triggerRealBoot();
          } else if (bootMenuIdx === 1) {
            setScreen('shell');
          } else if (bootMenuIdx === 2) {
            setScreen('diags');
          } else {
            setScreen('diags'); // Load hardware diagnostics
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setScreen('post');
        }
      } else if (screen === 'diags') {
        if (diagsProgress >= 100) {
          e.preventDefault();
          setScreen('post');
          setRamTested(0);
          setRamCountingComplete(false);
          setPostLines([]);
        }
      } else if (screen === 'cmos') {
        // CMOS award blue setup menu navigation
        const keyLower = e.key.toLowerCase();
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          playBeep(700, 0.05);
          setActiveTab(prev => (prev === 0 ? 3 : prev - 1));
          setSelectedIndex(0);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          playBeep(700, 0.05);
          setActiveTab(prev => (prev === 3 ? 0 : prev + 1));
          setSelectedIndex(0);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          playBeep(700, 0.05);
          const maxIdx = getMaxIndexForTab(activeTab);
          setSelectedIndex(prev => (prev === 0 ? maxIdx : prev - 1));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          playBeep(700, 0.05);
          const maxIdx = getMaxIndexForTab(activeTab);
          setSelectedIndex(prev => (prev === maxIdx ? 0 : prev + 1));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleCMOSSelectAction();
        } else if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          modifyCMOSOption(1);
        } else if (e.key === '-') {
          e.preventDefault();
          modifyCMOSOption(-1);
        } else if (e.key === 'F10' || keyLower === 's') {
          e.preventDefault();
          saveCMOSAndReboot();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          playBeep(500, 0.1);
          setScreen('post');
          setRamTested(0);
          setRamCountingComplete(false);
          setPostLines([]);
        }
      } else if (screen === 'shell') {
        if (e.key === 'Escape') {
          e.preventDefault();
          setScreen('post');
          setRamTested(0);
          setRamCountingComplete(false);
          setPostLines([]);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (commandHistory.length > 0) {
            const nextIdx = historyIndex <= 0 ? commandHistory.length - 1 : historyIndex - 1;
            setHistoryIndex(nextIdx);
            setShellInput(commandHistory[nextIdx]);
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (historyIndex >= 0 && historyIndex < commandHistory.length - 1) {
            const nextIdx = historyIndex + 1;
            setHistoryIndex(nextIdx);
            setShellInput(commandHistory[nextIdx]);
          } else {
            setHistoryIndex(commandHistory.length);
            setShellInput('');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, activeTab, selectedIndex, bootMenuIdx, diagsProgress, latencyPresetIdx, cycleWeightsEnabled, crtScanlines, audioBeep, bootDeviceIdx, quickBoot, commandHistory, historyIndex, activeFirmware]);

  const getMaxIndexForTab = (tab: number) => {
    if (tab === 0) return 4; // Hour, Min, Sec, Year, Month/Day
    if (tab === 1) return 4; // Latency, CycleWeights, Scanlines, Speaker Beep, Firmware Type
    if (tab === 2) return 2; // Boot device, Quick boot, Default restore
    return 1; // Save Setup, Exit discard
  };

  const modifyCMOSOption = (dir: number) => {
    playBeep(750, 0.05);
    if (activeTab === 0) {
      if (selectedIndex === 0) { // Hour
        setSystemTime(prev => ({ ...prev, hr: (prev.hr + dir + 24) % 24 }));
      } else if (selectedIndex === 1) { // Min
        setSystemTime(prev => ({ ...prev, min: (prev.min + dir + 60) % 60 }));
      } else if (selectedIndex === 2) { // Sec
        setSystemTime(prev => ({ ...prev, sec: (prev.sec + dir + 60) % 60 }));
      } else if (selectedIndex === 3) { // Year
        setSystemDate(prev => ({ ...prev, yr: prev.yr + dir }));
      } else if (selectedIndex === 4) { // Day
        setSystemDate(prev => ({ ...prev, dy: Math.max(1, Math.min(31, prev.dy + dir)) }));
      }
    } else if (activeTab === 1) {
      if (selectedIndex === 0) { // Presets
        const len = LATENCY_PRESET_LIST.length;
        setLatencyPresetIdx(prev => (prev + dir + len) % len);
      } else if (selectedIndex === 1) { // Cycle weights
        setCycleWeightsEnabled(prev => !prev);
      } else if (selectedIndex === 2) { // Scanlines
        setCrtScanlines(prev => !prev);
      } else if (selectedIndex === 3) { // Beeps
        setAudioBeep(prev => !prev);
      } else if (selectedIndex === 4) { // Active Firmware Type
        setActiveFirmware(prev => (prev === 'seabios' ? 'openbios' : 'seabios'));
      }
    } else if (activeTab === 2) {
      if (selectedIndex === 0) { // Boot device
        setBootDeviceIdx(prev => (prev + dir + 3) % 3);
      } else if (selectedIndex === 1) { // Quick Boot
        setQuickBoot(prev => !prev);
      }
    }
  };

  const handleCMOSSelectAction = () => {
    playBeep(900, 0.1);
    if (activeTab === 2 && selectedIndex === 2) {
      restoreBIOSDefaults();
    } else if (activeTab === 3) {
      if (selectedIndex === 0) {
        saveCMOSAndReboot();
      } else {
        setScreen('post');
        setRamTested(0);
        setRamCountingComplete(false);
        setPostLines([]);
      }
    }
  };

  const getLatencyName = (idx: number) => {
    return LATENCY_PRESET_LIST[idx]?.profileName.split(' ')[1] || 'Retro 486';
  };

  const getBootDeviceName = (idx: number) => {
    const devs = ['VC.os GUI', 'SeaBIOS Shell', 'Floppy A: (Diags)'];
    return devs[idx] || 'VC.os GUI';
  };

  return (
    <div 
      className="fixed inset-0 bg-black z-50 overflow-hidden p-3 font-mono text-gray-300 text-[13px] select-none flex flex-col justify-between"
      style={{ fontFamily: 'monospace' }}
    >
      <div className="flex-1 overflow-y-auto mb-2 pr-1">
        {/* 1. SeaBIOS / OpenBIOS Standard POST Screen */}
      {screen === 'post' && (
        activeFirmware === 'openbios' ? (
          <div className="flex flex-col h-full justify-between leading-relaxed">
            <div>
              <div className="flex items-center justify-between text-yellow-500 border-b border-yellow-800 pb-1 font-bold">
                <span>OpenBIOS v1.1-vcos (Open Firmware IEEE 1275)</span>
                <span>PowerPC Architecture Sim</span>
              </div>
              
              <div className="mt-4 flex flex-col gap-1.5 text-neutral-400 font-mono">
                <div className="text-white font-bold flex gap-4 items-center">
                  <span>RAM TEST:</span>
                  <span className="text-yellow-400 font-mono text-sm">
                    {ramTested} KB (Forth system dictionary loaded)
                    {!ramCountingComplete && (
                      <span className="inline-block w-2.5 h-4 bg-yellow-500 animate-pulse ml-1 align-middle" />
                    )}
                  </span>
                </div>

                {ramCountingComplete && (
                  <div className="flex flex-col gap-0.5 mt-2 animate-fade-in text-neutral-300 text-xs">
                    <div>Initializing Open Firmware device tree hierarchy...</div>
                    <div className="text-green-400">  /cpu@0 (PowerPC VCOS, 25MHz) OK</div>
                    <div className="text-green-400">  /memory@0 (16384 KB Extended DRAM) OK</div>
                    <div className="text-green-400">  /pci@80000000 OK</div>
                    <div className="text-green-400">    /pci@80000000/display@0 (128KB Framebuffer Card) OK</div>
                    <div className="text-green-400">    /pci@80000000/ide@1/disk@0 OK</div>
                    <div className="text-green-400">  /isa@0 OK</div>
                    <div className="text-green-400">    /isa@0/sound@388 OK</div>
                    <div className="text-green-400">    /isa@0/floppy@3f0 OK</div>
                    <div className="mt-2 text-yellow-500 font-bold">Open Firmware dictionary loaded. Standard forth commands available.</div>
                  </div>
                )}
              </div>
            </div>

            {/* Action keys help screen footer */}
            {ramCountingComplete && postLines.length >= 11 && (
              <div className="border-t border-neutral-800 pt-3 text-[12px] flex flex-col gap-1 text-yellow-400 font-semibold animate-pulse">
                <div className="flex flex-wrap gap-x-8 gap-y-1">
                  <span>[F2] / [S] CMOS Setup Utility</span>
                  <span>[F12] / [M] BBS Boot Menu</span>
                  <span>[ESC] / [C] OpenBIOS Forth CLI Shell</span>
                </div>
                <div className="text-white text-xs font-normal mt-2">
                  Booting default device <span className="text-yellow-400 font-bold">{getBootDeviceName(bootDeviceIdx)}</span> in <span className="text-cyan-400 font-bold">{countdown}</span> seconds...
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-full justify-between leading-relaxed">
            <div>
              <div className="flex items-center justify-between text-white border-b border-neutral-800 pb-1 font-bold">
                <span>SeaBIOS v1.16.3 (VCOS virtual hardware machine)</span>
                <span>PCI Option ROM Loaded</span>
              </div>
              
              <div className="mt-4 flex flex-col gap-1.5 text-neutral-400">
                <div className="text-white font-bold flex gap-4 items-center">
                  <span>RAM TESTING:</span>
                  <span className="text-green-400 font-mono text-sm">
                    {ramTested} KB OK
                    {!ramCountingComplete && (
                      <span className="inline-block w-2.5 h-4 bg-green-500 animate-pulse ml-1 align-middle" />
                    )}
                  </span>
                </div>

                {ramCountingComplete && (
                  <div className="flex flex-col gap-0.5 mt-2 animate-fade-in font-mono text-neutral-300">
                    {postLines.map((line, idx) => (
                      <div key={idx} className="min-h-[18px]">
                        {line && line.startsWith('[ERROR]') ? (
                          <span className="text-red-500 font-bold">{line}</span>
                        ) : (
                          <span>{line || ''}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action keys help screen footer */}
            {ramCountingComplete && postLines.length >= 11 && (
              <div className="border-t border-neutral-800 pt-3 text-[12px] flex flex-col gap-1 text-yellow-400 font-semibold animate-pulse">
                <div className="flex flex-wrap gap-x-8 gap-y-1">
                  <span>[F2] / [S] CMOS Setup Utility</span>
                  <span>[F12] / [M] BBS Boot Menu</span>
                  <span>[ESC] / [C] SeaBIOS Console Shell</span>
                </div>
                <div className="text-white text-xs font-normal mt-2">
                  Booting default device <span className="text-green-400 font-bold">{getBootDeviceName(bootDeviceIdx)}</span> in <span className="text-cyan-400 font-bold">{countdown}</span> seconds...
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* 2. Standard BBS Boot Menu Popup */}
      {screen === 'boot-menu' && (
        <div className="flex items-center justify-center h-full bg-black/80">
          <div className="bg-neutral-800 border-4 border-double border-neutral-400 w-full max-w-lg p-6 text-neutral-300 shadow-2xl rounded-sm">
            <div className="text-white text-center font-bold text-sm border-b border-neutral-600 pb-2 uppercase tracking-wide">
              SeaBIOS Device BBS Boot Menu
            </div>
            <div className="my-5 flex flex-col gap-2 font-mono">
              <div className="text-xs text-neutral-500 mb-2">Select direct baremetal target to boot:</div>
              {[
                { label: '1. VC.os GUI Desktop Environment', desc: 'Protected mode 32-bit graphical OS shell' },
                { label: '2. SeaBIOS Interactive Shell (VCA-16)', desc: 'Emulated real mode command operations' },
                { label: '3. Legacy Floppy Disk A: Diagnostics', desc: 'Probes core CPU/motherboard operations' },
                { label: '4. Run Bare-metal Hardware Diagnostics', desc: 'Verifies x86 motherboard timings & registers' }
              ].map((item, idx) => (
                <div 
                  key={idx}
                  className={`p-2 border rounded-sm cursor-pointer transition-colors ${
                    bootMenuIdx === idx 
                      ? 'bg-blue-600 border-blue-400 text-white font-bold' 
                      : 'bg-neutral-900 border-neutral-700 hover:border-neutral-500'
                  }`}
                  onClick={() => {
                    playBeep(700, 0.05);
                    setBootMenuIdx(idx);
                  }}
                  onDoubleClick={() => {
                    playBeep(1000, 0.12);
                    if (idx === 0) triggerRealBoot();
                    else if (idx === 1) setScreen('shell');
                    else setScreen('diags');
                  }}
                >
                  <div>{item.label}</div>
                  <div className={`text-[10px] ${bootMenuIdx === idx ? 'text-blue-100' : 'text-neutral-500'}`}>
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-neutral-600 pt-3 text-[11px] text-neutral-500 flex justify-between items-center">
              <span>↑↓ / Keys 1-4: Select     Enter: Confirm selection</span>
              <button 
                onClick={() => setScreen('post')}
                className="px-2 py-0.5 bg-neutral-700 hover:bg-neutral-600 rounded text-[10px] text-neutral-200"
              >
                Cancel (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Award Blue CMOS Setup Screen */}
      {screen === 'cmos' && (
        <div className="flex flex-col h-full bg-[#0000a8] text-white border-4 border-double border-white p-2">
          {/* Header */}
          <div className="text-center font-bold border-b border-white pb-1.5 text-yellow-300 uppercase tracking-wide text-sm">
            ROM PCI/ISA BIOS CMOS SETUP UTILITY - AMIBIOS 1996
          </div>

          {/* Navigation Tab Heads */}
          <div className="flex bg-[#00a8a8] text-white font-bold text-xs mt-1 border-b border-white">
            {['Main System', 'Advanced Chipset', 'Boot Priority', 'Save & Exit'].map((tabName, idx) => (
              <div 
                key={idx}
                className={`flex-1 text-center py-1.5 cursor-pointer uppercase transition-all ${
                  activeTab === idx ? 'bg-yellow-400 text-black font-black' : 'hover:bg-[#008080]'
                }`}
                onClick={() => {
                  playBeep(700, 0.05);
                  setActiveTab(idx);
                  setSelectedIndex(0);
                }}
              >
                {tabName}
              </div>
            ))}
          </div>

          {/* Core CMOS Fields Box */}
          <div className="flex-1 border border-white mt-1.5 bg-[#000080] p-4 font-mono overflow-auto">
            {activeTab === 0 && (
              <div className="space-y-4">
                <div className="text-yellow-300 border-b border-[#0000a8] pb-1 font-bold text-xs">Standard System Parameters</div>
                <div className="space-y-2.5">
                  <div className={`flex justify-between p-1.5 ${selectedIndex === 0 ? 'bg-blue-600 font-bold' : ''}`}>
                    <span>System Clock Hour:</span>
                    <span className="text-cyan-300">[{systemTime.hr.toString().padStart(2, '0')}]</span>
                  </div>
                  <div className={`flex justify-between p-1.5 ${selectedIndex === 1 ? 'bg-blue-600 font-bold' : ''}`}>
                    <span>System Clock Minute:</span>
                    <span className="text-cyan-300">[{systemTime.min.toString().padStart(2, '0')}]</span>
                  </div>
                  <div className={`flex justify-between p-1.5 ${selectedIndex === 2 ? 'bg-blue-600 font-bold' : ''}`}>
                    <span>System Clock Second:</span>
                    <span className="text-cyan-300">[{systemTime.sec.toString().padStart(2, '0')}]</span>
                  </div>
                  <div className={`flex justify-between p-1.5 ${selectedIndex === 3 ? 'bg-blue-600 font-bold' : ''}`}>
                    <span>CMOS Calendar Year:</span>
                    <span className="text-cyan-300">[{systemDate.yr}]</span>
                  </div>
                  <div className={`flex justify-between p-1.5 ${selectedIndex === 4 ? 'bg-blue-600 font-bold' : ''}`}>
                    <span>CMOS Calendar Day:</span>
                    <span className="text-cyan-300">[{systemDate.dy.toString().padStart(2, '0')}]</span>
                  </div>
                  <div className="h-px bg-blue-950 my-2" />
                  <div className="flex justify-between p-1 text-neutral-400">
                    <span>Base Memory Size:</span>
                    <span>640 KB</span>
                  </div>
                  <div className="flex justify-between p-1 text-neutral-400">
                    <span>Extended DRAM Space:</span>
                    <span>15360 KB</span>
                  </div>
                  <div className="flex justify-between p-1 text-neutral-400 font-bold text-yellow-300">
                    <span>Total Virtual DRAM:</span>
                    <span>16384 KB OK</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 1 && (
              <div className="space-y-4">
                <div className="text-yellow-300 border-b border-[#0000a8] pb-1 font-bold text-xs">Advanced Chipset & Wait-state Timings</div>
                <div className="space-y-2.5">
                  <div className={`flex justify-between p-1.5 ${selectedIndex === 0 ? 'bg-blue-600 font-bold' : ''}`}>
                    <span>Motherboard Latency Preset:</span>
                    <span className="text-green-300">[{getLatencyName(latencyPresetIdx)}]</span>
                  </div>
                  <div className={`flex justify-between p-1.5 ${selectedIndex === 1 ? 'bg-blue-600 font-bold' : ''}`}>
                    <span>Instruction Cycles Wait-States:</span>
                    <span className="text-cyan-300">[{cycleWeightsEnabled ? 'Enabled' : 'Disabled'}]</span>
                  </div>
                  <div className={`flex justify-between p-1.5 ${selectedIndex === 2 ? 'bg-blue-600 font-bold' : ''}`}>
                    <span>CRT Monitor Scanline Filter:</span>
                    <span className="text-cyan-300">[{crtScanlines ? 'Enabled' : 'Disabled'}]</span>
                  </div>
                  <div className={`flex justify-between p-1.5 ${selectedIndex === 3 ? 'bg-blue-600 font-bold' : ''}`}>
                    <span>8253 Speaker Beep tones:</span>
                    <span className="text-cyan-300">[{audioBeep ? 'Enabled' : 'Disabled'}]</span>
                  </div>
                  <div className={`flex justify-between p-1.5 ${selectedIndex === 4 ? 'bg-blue-600 font-bold' : ''}`}>
                    <span>Firmware Type System:</span>
                    <span className="text-yellow-300 font-bold">[{activeFirmware === 'seabios' ? 'SeaBIOS x86 PC' : 'OpenBIOS PowerPC'}]</span>
                  </div>
                </div>
                <div className="text-[11px] text-neutral-400 mt-4 bg-[#0000a8] p-2.5 rounded-sm border border-neutral-600 leading-relaxed">
                  NOTE: Target firmware type determines whether the virtual system boots using a traditional BIOS (SeaBIOS) or a Forth-based Open Firmware interface (OpenBIOS) with an interactive Device Tree console.
                </div>
              </div>
            )}

            {activeTab === 2 && (
              <div className="space-y-4">
                <div className="text-yellow-300 border-b border-[#0000a8] pb-1 font-bold text-xs">System Boot Priority Devices</div>
                <div className="space-y-2.5">
                  <div className={`flex justify-between p-1.5 ${selectedIndex === 0 ? 'bg-blue-600 font-bold' : ''}`}>
                    <span>1st Boot Priority:</span>
                    <span className="text-cyan-300">[{getBootDeviceName(bootDeviceIdx)}]</span>
                  </div>
                  <div className={`flex justify-between p-1.5 ${selectedIndex === 1 ? 'bg-blue-600 font-bold' : ''}`}>
                    <span>Quick POST Memory Test Bypass:</span>
                    <span className="text-cyan-300">[{quickBoot ? 'Enabled' : 'Disabled'}]</span>
                  </div>
                  <div className={`flex justify-between p-1.5 ${selectedIndex === 2 ? 'bg-blue-600 font-bold' : ''}`}>
                    <span>Restore Standard Factory BIOS Defaults:</span>
                    <span className="text-yellow-300 font-bold">[ Press Enter ]</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 3 && (
              <div className="space-y-4 flex flex-col justify-center h-full max-w-sm mx-auto">
                <button 
                  onClick={saveCMOSAndReboot}
                  className={`w-full text-center p-3 border border-white rounded uppercase text-xs font-bold transition-colors ${
                    selectedIndex === 0 ? 'bg-green-600 text-white border-green-400 scale-102 font-black shadow-lg' : 'bg-neutral-800 border-neutral-600 hover:bg-neutral-700'
                  }`}
                >
                  Save settings and reboot (F10 / S)
                </button>
                <button 
                  onClick={() => {
                    setScreen('post');
                    setRamTested(0);
                    setRamCountingComplete(false);
                    setPostLines([]);
                  }}
                  className={`w-full text-center p-3 border border-white rounded uppercase text-xs font-bold transition-colors mt-2 ${
                    selectedIndex === 1 ? 'bg-red-600 text-white border-red-400 scale-102 font-black shadow-lg' : 'bg-neutral-800 border-neutral-600 hover:bg-neutral-700'
                  }`}
                >
                  Exit setup without saving (Esc)
                </button>
              </div>
            )}
          </div>

          {/* Footer controls legend */}
          <div className="mt-1.5 bg-[#00a8a8] border border-white text-white font-bold text-[11px] p-2 flex flex-wrap justify-between gap-2">
            <span>←→Tab: Move Tab</span>
            <span>↑↓Option: Select Row</span>
            <span>+-Value: Change Opt</span>
            <span>Enter: Run Cmd</span>
            <span>F10 / S: Save & Exit</span>
            <span>Esc: Quit Setup</span>
          </div>
        </div>
      )}

      {/* 4. SeaBIOS / OpenBIOS Emulation Interactive Terminal Shell */}
      {screen === 'shell' && (
        <div className="flex flex-col h-full bg-black text-green-400 p-2 font-mono">
          <div className="flex justify-between items-center text-[10px] text-neutral-500 border-b border-neutral-900 pb-1.5 mb-1.5">
            <span>{activeFirmware === 'openbios' ? 'OPENBIOS INTERACTIVE FORTH DECK' : 'SEABIOS BARE-METAL INTERACTIVE SHELL'}</span>
            <span className="text-green-600">CONNECTED</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 select-text scrollbar-thin text-xs leading-normal">
            {shellLines.map((line, idx) => (
              <div key={idx} className="whitespace-pre-wrap min-h-[15px]">{line}</div>
            ))}
          </div>
          
          <div className="border-t border-neutral-800 pt-2 flex items-center gap-2 mt-2">
            <span className="text-yellow-500 font-bold select-none">{activeFirmware === 'openbios' ? '0 >' : 'SeaBIOS (vcos)>'}</span>
            <input 
              type="text"
              value={shellInput}
              onChange={(e) => setShellInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleShellCommand();
                }
              }}
              className="flex-1 bg-transparent text-green-400 outline-none border-none font-mono text-xs focus:ring-0 p-0"
              autoFocus
              placeholder={activeFirmware === 'openbios' ? "Enter Forth words (e.g. 'words', 'show-devs', 'dev pci', 'ls', 'pwd')" : "Enter emulator commands (e.g., 'help', 'sysinfo', 'regs', 'dump')"}
            />
            <span className="text-[10px] text-neutral-500 select-none">
              Press Escape to exit shell
            </span>
          </div>
        </div>
      )}

      {/* 5. Diagnostics Loader Screen */}
      {screen === 'diags' && (
        <div className="flex flex-col h-full justify-between leading-relaxed bg-black text-amber-500">
          <div className="overflow-y-auto space-y-1.5 max-h-[80vh] scrollbar-thin text-xs">
            {diagsLog.map((line, idx) => (
              <div key={idx} className="min-h-[16px]">
                {line.startsWith('[ERROR]') ? (
                  <span className="text-red-500 font-bold">{line}</span>
                ) : line.includes('>>>') ? (
                  <span className="text-green-400 font-bold">{line}</span>
                ) : (
                  <span>{line}</span>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-neutral-800 pt-3">
            <div className="text-xs font-bold text-neutral-400 mb-2 uppercase flex justify-between">
              <span>Probing virtual motherboard capacitors and clocks...</span>
              <span>{diagsProgress}%</span>
            </div>
            <div className="w-full h-4 bg-neutral-900 border border-neutral-700 p-0.5 rounded-sm">
              <div 
                className="h-full bg-amber-500 transition-all duration-300"
                style={{ width: `${diagsProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. Real-Time OS Boot Step Loader Screen */}
      {screen === 'booting-os' && (
        <div className="flex flex-col h-full bg-black text-green-400 p-4 font-mono overflow-hidden select-text leading-relaxed">
          <div className="flex justify-between items-center text-[10px] text-neutral-500 border-b border-neutral-900 pb-1.5 mb-3 select-none">
            <span>VC.OS REAL-TIME KERNEL LOADSTRAP</span>
            <span className="text-green-500 animate-pulse font-bold">MONITORING VM STEPPING ENGINE</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin text-xs">
            {bootingOSLines.map((line, idx) => (
              <div key={idx} className="whitespace-pre-wrap font-mono min-h-[16px]">{line}</div>
            ))}
          </div>
          <div className="border-t border-neutral-900 pt-3 text-[10px] text-neutral-500 flex justify-between select-none">
            <span>Core Frequency: 25.00 MHz</span>
            <span>Clock Source: PIT Channel 0 Tick</span>
          </div>
        </div>
      )}
      </div>

      {/* Retro Mobile Touch Keypad Panel */}
      <div className="bg-neutral-900 border border-neutral-800 p-2 rounded shadow-lg select-none text-[12px] flex flex-col gap-1.5 font-sans mt-1">
        <div className="flex justify-between items-center text-[10px] text-neutral-500 font-mono tracking-wider border-b border-neutral-800 pb-1">
          <span>VCOS BIOS CONTROLLER DECK</span>
          <span className="text-yellow-600 animate-pulse font-bold">TOUCH-CONTROL SYSTEM</span>
        </div>
        
        {/* Render buttons based on screen state */}
        {screen === 'post' && (
          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:justify-center">
            <button 
              onClick={() => {
                playBeep(800, 0.1);
                setScreen('cmos');
                setActiveTab(0);
                setSelectedIndex(0);
              }}
              className="px-3 py-2 bg-blue-700 hover:bg-blue-600 active:bg-blue-800 border border-blue-500 rounded text-white font-bold min-h-[44px] transition-colors"
            >
              CMOS Setup (S)
            </button>
            <button 
              onClick={() => {
                playBeep(800, 0.1);
                setScreen('boot-menu');
                setBootMenuIdx(0);
              }}
              className="px-3 py-2 bg-[#00a8a8] hover:bg-[#008080] active:bg-[#00c0c0] border border-cyan-500 rounded text-white font-bold min-h-[44px] transition-colors"
            >
              BBS Boot Menu (M)
            </button>
            <button 
              onClick={() => {
                playBeep(800, 0.1);
                setScreen('shell');
              }}
              className="px-3 py-2 bg-neutral-800 hover:bg-neutral-750 active:bg-neutral-850 border border-neutral-700 rounded text-green-400 font-mono font-bold min-h-[44px] transition-colors"
            >
              SeaBIOS Console (C)
            </button>
            <button 
              onClick={() => executeBoot()}
              className="px-3 py-2 bg-green-700 hover:bg-green-650 active:bg-green-750 border border-green-500 rounded text-white font-bold min-h-[44px] transition-colors"
            >
              Boot Default Device
            </button>
          </div>
        )}

        {screen === 'boot-menu' && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-4 gap-1">
              <button 
                onClick={() => { playBeep(1000, 0.12); triggerRealBoot(); }}
                className="p-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-neutral-300 font-semibold min-h-[44px]"
              >
                1. VC.os
              </button>
              <button 
                onClick={() => { playBeep(1000, 0.12); setScreen('shell'); }}
                className="p-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-neutral-300 font-semibold min-h-[44px]"
              >
                2. Shell
              </button>
              <button 
                onClick={() => { playBeep(1000, 0.12); setScreen('diags'); }}
                className="p-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-neutral-300 font-semibold min-h-[44px]"
              >
                3. Floppy
              </button>
              <button 
                onClick={() => { playBeep(1000, 0.12); setScreen('diags'); }}
                className="p-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-neutral-300 font-semibold min-h-[44px]"
              >
                4. Diags
              </button>
            </div>
            <div className="flex gap-1.5 justify-center">
              <button 
                onClick={() => {
                  playBeep(700, 0.05);
                  setBootMenuIdx(prev => (prev === 0 ? 3 : prev - 1));
                }}
                className="flex-1 max-w-[100px] py-2 bg-blue-700 hover:bg-blue-600 border border-blue-500 rounded text-white font-bold min-h-[44px]"
              >
                ▲ Up
              </button>
              <button 
                onClick={() => {
                  playBeep(700, 0.05);
                  setBootMenuIdx(prev => (prev === 3 ? 0 : prev + 1));
                }}
                className="flex-1 max-w-[100px] py-2 bg-blue-700 hover:bg-blue-600 border border-blue-500 rounded text-white font-bold min-h-[44px]"
              >
                ▼ Down
              </button>
              <button 
                onClick={() => {
                  playBeep(1000, 0.12);
                  if (bootMenuIdx === 0) triggerRealBoot();
                  else if (bootMenuIdx === 1) setScreen('shell');
                  else setScreen('diags');
                }}
                className="flex-1 max-w-[120px] py-2 bg-green-700 hover:bg-green-600 border border-green-500 rounded text-white font-bold min-h-[44px]"
              >
                Confirm
              </button>
              <button 
                onClick={() => { playBeep(500, 0.1); setScreen('post'); }}
                className="flex-1 max-w-[100px] py-2 bg-red-800 hover:bg-red-700 border border-red-600 rounded text-white font-bold min-h-[44px]"
              >
                Esc
              </button>
            </div>
          </div>
        )}

        {screen === 'cmos' && (
          <div className="flex flex-col gap-1.5">
            {/* Tab switchers */}
            <div className="grid grid-cols-4 gap-1 text-[11px]">
              {['Main', 'Advanced', 'Boot', 'Exit'].map((tabName, idx) => (
                <button 
                  key={idx}
                  onClick={() => {
                    playBeep(700, 0.05);
                    setActiveTab(idx);
                    setSelectedIndex(0);
                  }}
                  className={`py-1.5 rounded border min-h-[36px] font-bold ${
                    activeTab === idx 
                      ? 'bg-yellow-500 border-yellow-400 text-black' 
                      : 'bg-neutral-800 border-neutral-700 text-neutral-300'
                  }`}
                >
                  {tabName}
                </button>
              ))}
            </div>

            {/* D-Pad and value adjusters */}
            <div className="flex flex-wrap gap-1.5 items-center justify-between">
              <div className="flex gap-1.5 flex-1 max-w-xs">
                <button 
                  onClick={() => {
                    playBeep(700, 0.05);
                    const maxIdx = getMaxIndexForTab(activeTab);
                    setSelectedIndex(prev => (prev === 0 ? maxIdx : prev - 1));
                  }}
                  className="flex-1 py-2 bg-blue-700 hover:bg-blue-600 border border-blue-500 rounded text-white font-bold min-h-[44px]"
                >
                  ▲ Up
                </button>
                <button 
                  onClick={() => {
                    playBeep(700, 0.05);
                    const maxIdx = getMaxIndexForTab(activeTab);
                    setSelectedIndex(prev => (prev === maxIdx ? 0 : prev + 1));
                  }}
                  className="flex-1 py-2 bg-blue-700 hover:bg-blue-600 border border-blue-500 rounded text-white font-bold min-h-[44px]"
                >
                  ▼ Down
                </button>
                <button 
                  onClick={() => {
                    playBeep(700, 0.05);
                    setActiveTab(prev => (prev === 0 ? 3 : prev - 1));
                    setSelectedIndex(0);
                  }}
                  className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 rounded text-white font-bold min-h-[44px]"
                >
                  ◀ L
                </button>
                <button 
                  onClick={() => {
                    playBeep(700, 0.05);
                    setActiveTab(prev => (prev === 3 ? 0 : prev + 1));
                    setSelectedIndex(0);
                  }}
                  className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 rounded text-white font-bold min-h-[44px]"
                >
                  R ▶
                </button>
              </div>

              <div className="flex gap-1.5 flex-1 max-w-[200px]">
                <button 
                  onClick={() => modifyCMOSOption(-1)}
                  className="flex-1 py-2 bg-[#00a8a8] hover:bg-[#008080] border border-cyan-500 rounded text-white font-black text-sm min-h-[44px]"
                >
                  -
                </button>
                <button 
                  onClick={() => modifyCMOSOption(1)}
                  className="flex-1 py-2 bg-[#00a8a8] hover:bg-[#008080] border border-cyan-500 rounded text-white font-black text-sm min-h-[44px]"
                >
                  +
                </button>
              </div>
            </div>

            {/* CMOS Action Keys */}
            <div className="grid grid-cols-3 gap-1.5 mt-0.5">
              <button 
                onClick={handleCMOSSelectAction}
                className="py-2 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 rounded text-white font-bold min-h-[44px]"
              >
                Enter
              </button>
              <button 
                onClick={saveCMOSAndReboot}
                className="py-2 bg-green-700 hover:bg-green-650 border border-green-500 rounded text-white font-bold min-h-[44px]"
              >
                Save Setup (S)
              </button>
              <button 
                onClick={() => { playBeep(500, 0.1); setScreen('post'); setRamTested(0); setRamCountingComplete(false); setPostLines([]); }}
                className="py-2 bg-red-800 hover:bg-red-750 border border-red-600 rounded text-white font-bold min-h-[44px]"
              >
                Discard (Esc)
              </button>
            </div>
          </div>
        )}

        {screen === 'shell' && (
          <div className="flex flex-col gap-1">
            <div className="text-[10px] text-neutral-500 font-mono mb-1">
              QUICK {activeFirmware === 'openbios' ? 'FORTH & OPEN FIRMWARE TREE' : 'CONSOLE DIRECT'} COMMANDS:
            </div>
            <div className="flex flex-wrap gap-1">
              {activeFirmware === 'openbios' ? (
                [
                  { label: 'words', cmd: 'words' },
                  { label: 'show-devs', cmd: 'show-devs' },
                  { label: 'pwd', cmd: 'pwd' },
                  { label: 'dev pci', cmd: 'dev pci' },
                  { label: 'ls', cmd: 'ls' },
                  { label: '.properties', cmd: '.properties' },
                  { label: '5 dup + .', cmd: '5 dup + .' },
                  { label: 'cls', cmd: 'cls' },
                  { label: 'boot OS', cmd: 'boot' },
                  { label: 'reboot', cmd: 'exit' }
                ].map((btn, idx) => (
                  <button 
                    key={idx}
                    onClick={() => {
                      playBeep(750, 0.05);
                      if (btn.cmd === 'cls') {
                        setShellLines([]);
                      } else if (btn.cmd === 'boot') {
                        setShellLines(prev => [...prev, `0 > boot`, 'Transitioning control to VC.os Graphical Desktop Kernel (PowerPC Emulator Mode)...', '']);
                        setTimeout(() => triggerRealBoot(), 800);
                      } else if (btn.cmd === 'exit') {
                        setScreen('post');
                        setRamTested(0);
                        setRamCountingComplete(false);
                        setPostLines([]);
                      } else {
                        const response = openBios.executeCommand(btn.cmd);
                        setShellLines(prev => [
                          ...prev,
                          `ok`,
                          `0 > ${btn.cmd}`,
                          response,
                          ''
                        ]);
                      }
                    }}
                    className="px-2 py-1.5 bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 rounded text-yellow-400 font-mono text-[11px] font-bold min-h-[40px] transition-all"
                  >
                    {btn.label}
                  </button>
                ))
              ) : (
                [
                  { label: 'help', cmd: 'help' },
                  { label: 'regs', cmd: 'regs' },
                  { label: 'sysinfo', cmd: 'sysinfo' },
                  { label: 'dump', cmd: 'dump' },
                  { label: 'cls', cmd: 'cls' },
                  { label: 'boot OS', cmd: 'boot' },
                  { label: 'reboot', cmd: 'exit' }
                ].map((btn, idx) => (
                  <button 
                    key={idx}
                    onClick={() => {
                      playBeep(750, 0.05);
                      if (btn.cmd === 'cls') {
                        setShellLines([]);
                      } else if (btn.cmd === 'boot') {
                        setShellLines(prev => [...prev, `SeaBIOS (vcos)> boot`, 'Transitioning control to VC.os Graphical Desktop Kernel...', '']);
                        setTimeout(() => triggerRealBoot(), 800);
                      } else if (btn.cmd === 'exit') {
                        setScreen('post');
                        setRamTested(0);
                        setRamCountingComplete(false);
                        setPostLines([]);
                      } else {
                        const response = seaBios.executeCommand(btn.cmd);
                        setShellLines(prev => [...prev, `SeaBIOS (vcos)> ${btn.cmd}`, response, '']);
                      }
                    }}
                    className="px-2 py-1.5 bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 rounded text-green-400 font-mono text-[11px] font-bold min-h-[40px] transition-all"
                  >
                    {btn.label}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {screen === 'diags' && (
          <button 
            onClick={() => {
              playBeep(500, 0.1);
              setScreen('post');
              setRamTested(0);
              setRamCountingComplete(false);
              setPostLines([]);
            }}
            className="w-full py-2.5 bg-red-800 hover:bg-red-750 border border-red-600 rounded text-white font-bold min-h-[44px]"
          >
            Cancel / Halt Diagnostics (Esc)
          </button>
        )}
      </div>
    </div>
  );
};
