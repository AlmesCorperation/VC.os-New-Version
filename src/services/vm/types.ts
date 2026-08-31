export enum CPUMode {
  REAL_16 = 'Real Mode (16-bit)',
  PROTECTED_32 = 'Protected Mode (32-bit)',
  LONG_64 = 'Long Mode (64-bit)'
}

export enum CPURingLevel {
  RING_0 = 0, // Kernel / Hypervisor
  RING_1 = 1, // Device Drivers
  RING_2 = 2, // I/O Services
  RING_3 = 3  // User Space Applications
}

export interface CPURegisters {
  // General Purpose Registers (32-bit)
  eax: number;
  ebx: number;
  ecx: number;
  edx: number;
  esi: number;
  edi: number;
  esp: number;
  ebp: number;

  // Instruction Pointer
  eip: number;

  // EFLAGS Register
  // Bit 0: CF (Carry), Bit 2: PF (Parity), Bit 6: ZF (Zero), Bit 7: SF (Sign)
  // Bit 8: TF (Trap), Bit 9: IF (Interrupt), Bit 10: DF (Direction), Bit 11: OF (Overflow)
  eflags: number;

  // Segment Registers (16-bit)
  cs: number;
  ds: number;
  ss: number;
  es: number;
  fs: number;
  gs: number;

  // Control Registers
  cr0: number; // Bit 0: PE (Protected Mode), Bit 31: PG (Paging)
  cr2: number; // Page Fault Linear Address
  cr3: number; // Page Directory Base
  cr4: number; // PAE & Extensions
}

export interface CPUFlags {
  carry: boolean;
  parity: boolean;
  zero: boolean;
  sign: boolean;
  trap: boolean;
  interrupt: boolean;
  direction: boolean;
  overflow: boolean;
}

export interface Instruction {
  address: number;
  bytes: number[];
  mnemonic: string;
  operands: string;
  comment?: string;
  label?: string;
}

export interface IOPortHandler {
  read8: (port: number) => number;
  write8: (port: number, value: number) => void;
  read16?: (port: number) => number;
  write16?: (port: number, value: number) => void;
}

export interface P2PPacket {
  id: string;
  timestamp: number;
  sourceMac: string;
  destMac: string;
  sourceIp: string;
  destIp: string;
  protocol: 'ARP' | 'ICMP' | 'UDP' | 'TCP' | 'VCOS_RAW';
  payloadLength: number;
  payload: string; // ASCII or Hex payload
  rawBytes: number[];
}

export interface P2PPeer {
  nodeId: string;
  name: string;
  virtualMac: string;
  virtualIp: string;
  lastSeen: number;
  pingMs: number;
  packetsSent: number;
  packetsReceived: number;
  connectedVia: 'BroadcastChannel' | 'WebRTC';
}

export interface VideoModeInfo {
  mode: number;
  width: number;
  height: number;
  colors: number;
  isText: boolean;
  bpp: number;
  name: string;
}

export interface VMLatencyConfig {
  profileName: string;
  // Memory & Bus Wait States (in CPU Cycles)
  dramWaitStatesCycles: number;     // Extra wait cycles per system RAM access
  vramWaitStatesCycles: number;     // Extra wait cycles per VRAM access (0xA0000-0xBFFFF)
  ioPortWaitStatesCycles: number;   // Extra wait cycles per I/O Port access
  irqDispatchDelayCycles: number;   // Cycles before interrupt is acknowledged & dispatched
  
  // CPU Throttling & Pipeline Stalls
  cpuLoadThrottlingPct: number;     // Simulated load/thermal throttling (0% - 90%)
  enableInstructionCycleWeights: boolean; // Accurate cycle costs per instruction type

  // Network (P2P Mesh) Latency & Serialization
  p2pBaseLatencyMs: number;         // Base propagation delay (ms)
  p2pJitterMs: number;              // Random jitter deviation (+/- ms)
  p2pBandwidthKbps: number;         // Simulated NIC link bandwidth (Kbps, 0 = unlimited)
  p2pPacketLossPct: number;         // Packet drop rate percentage (0% - 100%)
}

export interface VMLatencyStats {
  lastInstructionCycles: number;
  totalWaitCycles: number;
  simulatedTimeUs: number;          // Total simulated virtual time in microseconds
  busStallCycles: number;
  effectiveMips: number;            // Effective Mega-Instructions Per Second
  busUtilizationPct: number;
  currentNetworkLatencyMs: number;
  networkJitterMs: number;
  droppedPacketsCount: number;
}

export interface VMSystemStats {
  cpuFrequencyHz: number;
  totalCycles: number;
  instructionsExecuted: number;
  currentMode: CPUMode;
  currentRing: CPURingLevel;
  vramFps: number;
  p2pTxBytes: number;
  p2pRxBytes: number;
  p2pPeersCount: number;
  interruptsHandled: number;
  ioPortReads: number;
  ioPortWrites: number;
  latencyConfig: VMLatencyConfig;
  latencyStats: VMLatencyStats;
}
