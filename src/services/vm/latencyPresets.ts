import { VMLatencyConfig } from './types';

export const LATENCY_PRESETS: Record<string, VMLatencyConfig> = {
  zero_latency: {
    profileName: '⚡ Ideal Zero-Latency (Virtual Unconstrained)',
    dramWaitStatesCycles: 0,
    vramWaitStatesCycles: 0,
    ioPortWaitStatesCycles: 0,
    irqDispatchDelayCycles: 0,
    cpuLoadThrottlingPct: 0,
    enableInstructionCycleWeights: false,
    p2pBaseLatencyMs: 0,
    p2pJitterMs: 0,
    p2pBandwidthKbps: 0, // unlimited
    p2pPacketLossPct: 0
  },

  retro_486: {
    profileName: '📟 Retro 486-DX2 (33MHz / 70ns FPM DRAM / 10M LAN)',
    dramWaitStatesCycles: 3,
    vramWaitStatesCycles: 8,
    ioPortWaitStatesCycles: 16,
    irqDispatchDelayCycles: 45,
    cpuLoadThrottlingPct: 10,
    enableInstructionCycleWeights: true,
    p2pBaseLatencyMs: 15,
    p2pJitterMs: 4,
    p2pBandwidthKbps: 10000, // 10 Mbps 10BASE-T
    p2pPacketLossPct: 0.1
  },

  pentium_classic: {
    profileName: '🚀 Pentium MMX (200MHz / EDO DRAM / 100M Fast Ethernet)',
    dramWaitStatesCycles: 1,
    vramWaitStatesCycles: 4,
    ioPortWaitStatesCycles: 8,
    irqDispatchDelayCycles: 20,
    cpuLoadThrottlingPct: 5,
    enableInstructionCycleWeights: true,
    p2pBaseLatencyMs: 6,
    p2pJitterMs: 1.5,
    p2pBandwidthKbps: 100000, // 100 Mbps Fast Ethernet
    p2pPacketLossPct: 0
  },

  dialup_modem: {
    profileName: '📞 Dial-up V.90 Modem (56 Kbps / High RTT & Jitter)',
    dramWaitStatesCycles: 2,
    vramWaitStatesCycles: 6,
    ioPortWaitStatesCycles: 32,
    irqDispatchDelayCycles: 60,
    cpuLoadThrottlingPct: 20,
    enableInstructionCycleWeights: true,
    p2pBaseLatencyMs: 145,
    p2pJitterMs: 30,
    p2pBandwidthKbps: 56, // 56 Kbps Dial-up
    p2pPacketLossPct: 1.5
  },

  geo_satellite: {
    profileName: '🛰️ Geostationary Satellite Uplink (600ms RTT / Jitter)',
    dramWaitStatesCycles: 1,
    vramWaitStatesCycles: 4,
    ioPortWaitStatesCycles: 12,
    irqDispatchDelayCycles: 25,
    cpuLoadThrottlingPct: 0,
    enableInstructionCycleWeights: true,
    p2pBaseLatencyMs: 620,
    p2pJitterMs: 80,
    p2pBandwidthKbps: 2048, // 2 Mbps
    p2pPacketLossPct: 2.5
  },

  unstable_cellular: {
    profileName: '📱 Unstable 3G/Edge Cellular (Lossy / Burst Jitter)',
    dramWaitStatesCycles: 2,
    vramWaitStatesCycles: 4,
    ioPortWaitStatesCycles: 10,
    irqDispatchDelayCycles: 30,
    cpuLoadThrottlingPct: 25,
    enableInstructionCycleWeights: true,
    p2pBaseLatencyMs: 110,
    p2pJitterMs: 55,
    p2pBandwidthKbps: 3000, // 3 Mbps
    p2pPacketLossPct: 4.0
  }
};

export const LATENCY_PRESET_LIST: (VMLatencyConfig & { id: string; description: string })[] = [
  {
    id: 'zero_latency',
    description: 'Instant zero wait-states and unconstrained bus speed',
    ...LATENCY_PRESETS.zero_latency
  },
  {
    id: 'retro_486',
    description: 'Authentic 486-DX2 with DRAM wait states and 10BASE-T LAN delay',
    ...LATENCY_PRESETS.retro_486
  },
  {
    id: 'pentium_classic',
    description: 'High-speed Pentium MMX with 100 Mbps Fast Ethernet',
    ...LATENCY_PRESETS.pentium_classic
  },
  {
    id: 'dialup_modem',
    description: 'Simulates 56k dial-up modem transmission & RTT serialization',
    ...LATENCY_PRESETS.dialup_modem
  },
  {
    id: 'geo_satellite',
    description: 'High round-trip latency with packet serialization over satellite',
    ...LATENCY_PRESETS.geo_satellite
  },
  {
    id: 'unstable_cellular',
    description: 'Hostile wireless mesh with jitter deviations and packet loss',
    ...LATENCY_PRESETS.unstable_cellular
  }
];
