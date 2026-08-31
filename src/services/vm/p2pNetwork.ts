import { P2PPacket, P2PPeer, VMLatencyConfig } from './types';
import { LATENCY_PRESETS } from './latencyPresets';

export class VirtualP2PNetwork {
  public virtualMac: string;
  public virtualIp: string;
  public nodeId: string;
  public nodeName: string;
  public isLinkUp: boolean = true;

  // Packet buffers and stats
  public txBytes: number = 0;
  public rxBytes: number = 0;
  public txPacketsCount: number = 0;
  public rxPacketsCount: number = 0;
  public packetLog: (P2PPacket & { dropped?: boolean; latencyMs?: number })[] = [];
  public maxLogSize: number = 100;

  // Connected peers
  public peers: Map<string, P2PPeer> = new Map();

  // Simulated Hardware NIC registers & Ring Buffer
  public txBuffer: number[] = [];
  public rxBuffer: number[] = [];
  public nicStatus: number = 0x01; // Link active, ready
  public onInterrupt?: (irq: number, message: string) => void;

  // Latency & Traffic Telemetry
  public latencyConfig: VMLatencyConfig = { ...LATENCY_PRESETS.retro_486 };
  public currentNetworkLatencyMs: number = 15;
  public networkJitterMs: number = 0;
  public droppedPacketsCount: number = 0;

  // Transport Channels
  private broadcastChannel: BroadcastChannel | null = null;
  private listeners: Set<() => void> = new Set();
  private heartbeatInterval: any = null;

  constructor() {
    this.nodeId = 'node_' + Math.random().toString(36).substring(2, 9);
    this.nodeName = 'VCOS-VM-' + this.nodeId.substring(5).toUpperCase();
    
    // Generate authentic virtual MAC (00:50:56 = VMware/VCOS prefix)
    const randHex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase();
    this.virtualMac = `00:50:56:${randHex()}:${randHex()}:${randHex()}`;
    
    // Assign virtual IP in 192.168.1.0/24 subnet
    const ipLast = 10 + Math.floor(Math.random() * 240);
    this.virtualIp = `192.168.1.${ipLast}`;

    this.initBroadcastChannel();
    this.startHeartbeat();

    // --- Simulate P2P Network Activity ---
    setTimeout(() => {
      if (!this.isLinkUp) return;
      
      const simulatedApps = [
        {
          id: 'p2p_synth',
          title: 'Retro Synth (P2P)',
          description: 'A synthesizer someone just published over the P2P network!',
          category: 'MUSIC',
          version: '1.0',
          script: `; ==========================================================
; VC.code - Retro Synth & Audio Visualizer
; ==========================================================
[BITS 16]
ORG 0x7C00

START:
    CLI
    MOV EAX, 0x0013     ; Set VGA Mode 13h
    INT 0x10
    MOV EAX, 0x440      ; SoundBlaster / PIT frequency
    OUT 0x388, AL
    MOV EBX, 0x000A0000 ; VRAM Framebuffer
    MOV ECX, 0

DRAW_WAVE:
    MOV EAX, ECX
    AND EAX, 0x0F
    ADD EAX, 0x28
    MOV [EBX + ECX], AL
    INC ECX
    CMP ECX, 64000
    JL DRAW_WAVE

HANG:
    HLT
    JMP HANG

TIMES 510 - ($ - $$) DB 0
DW 0xAA55`,
          isMultiplayer: false,
          iconColor: '#FF00FF',
          developer: 'xX_CyberHacker_Xx',
          rating: 4.9,
          createdAt: new Date().toISOString()
        },
        {
          id: 'p2p_fractal',
          title: 'Fractal Viewer',
          description: 'Mandelbrot set renderer written in custom x86 assembly.',
          category: 'GRAPHICS',
          version: '0.9',
          script: `; ==========================================================
; VC.code - Mandelbrot & Fractal VRAM Generator
; ==========================================================
[BITS 16]
ORG 0x7C00

START:
    CLI
    MOV EAX, 0x0013     ; Set VGA Mode 13h (320x200 256c)
    INT 0x10
    MOV EBX, 0x000A0000 ; Point EBX to VGA VRAM Base
    MOV ECX, 0          ; Pixel Index Counter

DRAW_FRACTAL:
    MOV EAX, ECX
    AND EAX, 0x1F
    ADD EAX, 0x20
    MOV [EBX + ECX], AL ; Store color byte to VRAM
    INC ECX
    CMP ECX, 64000      ; 320 * 200 = 64000 pixels
    JL DRAW_FRACTAL

LOOP_IDLE:
    HLT
    JMP LOOP_IDLE

TIMES 510 - ($ - $$) DB 0
DW 0xAA55`,
          isMultiplayer: false,
          iconColor: '#00FFFF',
          developer: 'AcidBurn',
          rating: 4.7,
          createdAt: new Date().toISOString()
        }
      ];

      simulatedApps.forEach((app, idx) => {
        setTimeout(() => {
          const payload = `[APP_PUBLISH] ${JSON.stringify(app)}`;
          // Inject into packet log as an incoming packet from someone else
          const packet = {
            id: 'pkt_' + Math.random().toString(36).substring(2),
            timestamp: Date.now(),
            sourceMac: '00:50:56:AB:CD:EF',
            destMac: 'FF:FF:FF:FF:FF:FF',
            sourceIp: '192.168.1.100',
            destIp: '255.255.255.255',
            protocol: 'VCOS_RAW' as any,
            payloadLength: payload.length,
            payload: payload,
            rawBytes: []
          };
          
          this.rxBytes += payload.length;
          this.rxPacketsCount++;
          this.packetLog.unshift(packet);
          if (this.packetLog.length > this.maxLogSize) this.packetLog.pop();
          
          if (this.onInterrupt) {
             this.onInterrupt(11, 'INCOMING_P2P_BROADCAST (APP_PUBLISH)');
          }
          this.notify();
        }, idx * 4000 + 5000); // Stagger them
      });
    }, 2000);

  }

  private initBroadcastChannel() {
    try {
      this.broadcastChannel = new BroadcastChannel('vcos_p2p_virtual_lan');
      this.broadcastChannel.onmessage = (event: MessageEvent) => {
        this.handleIncomingRawMessage(event.data);
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported in this environment', e);
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.sendDiscoveryBroadcast();
      this.pruneStalePeers();
    }, 3000);
  }

  public destroy() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.broadcastChannel) this.broadcastChannel.close();
  }

  public setLatencyConfig(config: VMLatencyConfig) {
    this.latencyConfig = { ...config };
    this.currentNetworkLatencyMs = this.latencyConfig.p2pBaseLatencyMs;
    this.notify();
  }

  private sendDiscoveryBroadcast() {
    if (!this.isLinkUp) return;
    const msg = {
      type: 'DISCOVERY',
      nodeId: this.nodeId,
      name: this.nodeName,
      virtualMac: this.virtualMac,
      virtualIp: this.virtualIp,
      timestamp: Date.now()
    };
    this.broadcastChannel?.postMessage(msg);
  }

  private pruneStalePeers() {
    const now = Date.now();
    let changed = false;
    this.peers.forEach((peer, id) => {
      if (now - peer.lastSeen > 12000) {
        this.peers.delete(id);
        changed = true;
      }
    });
    if (changed) this.notify();
  }

  public calculateArtificialTransitDelay(byteLength: number): { delayMs: number; isDropped: boolean; jitter: number } {
    // 1. Packet Loss Simulation
    if (this.latencyConfig.p2pPacketLossPct > 0) {
      if (Math.random() * 100 < this.latencyConfig.p2pPacketLossPct) {
        return { delayMs: 0, isDropped: true, jitter: 0 };
      }
    }

    // 2. Link Serialization Delay based on Bandwidth (Kbps)
    let serializationDelayMs = 0;
    if (this.latencyConfig.p2pBandwidthKbps > 0) {
      const bitCount = byteLength * 8;
      serializationDelayMs = (bitCount / this.latencyConfig.p2pBandwidthKbps);
    }

    // 3. Jitter Deviation (+/- ms)
    const jitter = this.latencyConfig.p2pJitterMs > 0
      ? (Math.random() * 2 - 1) * this.latencyConfig.p2pJitterMs
      : 0;

    // 4. Total Artificial Latency
    const totalDelay = Math.max(0, Math.round(this.latencyConfig.p2pBaseLatencyMs + jitter + serializationDelayMs));

    return { delayMs: totalDelay, isDropped: false, jitter: Math.round(jitter * 10) / 10 };
  }

  private handleIncomingRawMessage(data: any) {
    if (!this.isLinkUp || !data || data.nodeId === this.nodeId) return;

    if (data.type === 'DISCOVERY') {
      const existing = this.peers.get(data.nodeId);
      const measuredPing = existing ? existing.pingMs : Math.max(1, this.latencyConfig.p2pBaseLatencyMs + Math.floor(Math.random() * 4));
      this.peers.set(data.nodeId, {
        nodeId: data.nodeId,
        name: data.name || 'Remote VM',
        virtualMac: data.virtualMac,
        virtualIp: data.virtualIp,
        lastSeen: Date.now(),
        pingMs: measuredPing,
        packetsSent: existing ? existing.packetsSent : 0,
        packetsReceived: (existing ? existing.packetsReceived : 0) + 1,
        connectedVia: 'BroadcastChannel'
      });
      this.notify();
      return;
    }

    if (data.type === 'PACKET') {
      const packet: P2PPacket = data.packet;
      const isForMe = packet.destMac === 'FF:FF:FF:FF:FF:FF' || 
                      packet.destMac === this.virtualMac || 
                      packet.destIp === '255.255.255.255' || 
                      packet.destIp === this.virtualIp;

      if (!isForMe) return;

      // Apply incoming delivery delay based on artificial network latency
      const transit = this.calculateArtificialTransitDelay(packet.payloadLength + 14);

      if (transit.isDropped) {
        this.droppedPacketsCount++;
        this.addPacketToLog({ ...packet, dropped: true, latencyMs: 0 });
        this.notify();
        return;
      }

      this.currentNetworkLatencyMs = transit.delayMs;
      this.networkJitterMs = transit.jitter;

      const deliverPacket = () => {
        this.rxBytes += packet.payloadLength + 14;
        this.rxPacketsCount++;
        this.addPacketToLog({ ...packet, latencyMs: transit.delayMs });

        if (packet.rawBytes) {
          this.rxBuffer.push(...packet.rawBytes);
          if (this.rxBuffer.length > 2048) {
            this.rxBuffer = this.rxBuffer.slice(-1024);
          }
        }

        // Trigger Hardware IRQ 11 (Vector 0x2B)
        if (this.onInterrupt) {
          this.onInterrupt(11, `VIRTUAL_NIC_RX: [${packet.protocol}] (${transit.delayMs}ms artificial latency) from ${packet.sourceIp}`);
        }

        // Automatic ICMP Ping Echo Reply
        if (packet.protocol === 'ICMP' && packet.payload.startsWith('ECHO_REQUEST') && packet.destIp === this.virtualIp) {
          this.sendIcmpReply(packet.sourceIp, packet.sourceMac, packet.payload);
        }

        const peer = this.peers.get(data.nodeId);
        if (peer) {
          peer.lastSeen = Date.now();
          peer.pingMs = transit.delayMs;
          peer.packetsReceived++;
        }

        this.notify();
      };

      if (transit.delayMs > 0) {
        setTimeout(deliverPacket, transit.delayMs);
      } else {
        deliverPacket();
      }
    }
  }

  public sendRawPacket(destIp: string, destMac: string, protocol: 'ARP' | 'ICMP' | 'UDP' | 'TCP' | 'VCOS_RAW', payloadText: string) {
    if (!this.isLinkUp) return;

    const payloadBytes: number[] = [];
    for (let i = 0; i < payloadText.length; i++) {
      payloadBytes.push(payloadText.charCodeAt(i) & 0xFF);
    }

    const rawFrame = this.buildEthernetFrame(destMac, this.virtualMac, protocol, payloadBytes);

    const packet: P2PPacket = {
      id: 'pkt_' + Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      sourceMac: this.virtualMac,
      destMac: destMac || 'FF:FF:FF:FF:FF:FF',
      sourceIp: this.virtualIp,
      destIp: destIp || '255.255.255.255',
      protocol,
      payloadLength: payloadBytes.length,
      payload: payloadText,
      rawBytes: rawFrame
    };

    // Calculate artificial transit latency & drop chances
    const transit = this.calculateArtificialTransitDelay(rawFrame.length);

    if (transit.isDropped) {
      this.droppedPacketsCount++;
      this.addPacketToLog({ ...packet, dropped: true, latencyMs: 0 });
      this.notify();
      return;
    }

    this.currentNetworkLatencyMs = transit.delayMs;
    this.networkJitterMs = transit.jitter;

    this.txBytes += rawFrame.length;
    this.txPacketsCount++;
    this.addPacketToLog({ ...packet, latencyMs: transit.delayMs });

    const postMsg = () => {
      this.broadcastChannel?.postMessage({
        type: 'PACKET',
        nodeId: this.nodeId,
        packet
      });
    };

    if (transit.delayMs > 0) {
      setTimeout(postMsg, transit.delayMs);
    } else {
      postMsg();
    }

    this.notify();
  }

  public ping(targetIp: string) {
    let destMac = 'FF:FF:FF:FF:FF:FF';
    this.peers.forEach(peer => {
      if (peer.virtualIp === targetIp) {
        destMac = peer.virtualMac;
      }
    });

    const timestamp = Date.now();
    this.sendRawPacket(targetIp, destMac, 'ICMP', `ECHO_REQUEST seq=1 t=${timestamp}`);
  }

  private sendIcmpReply(targetIp: string, targetMac: string, requestPayload: string) {
    const replyText = requestPayload.replace('ECHO_REQUEST', 'ECHO_REPLY');
    // Ping reply goes out through latency pipe
    this.sendRawPacket(targetIp, targetMac, 'ICMP', replyText);
  }

  public sendArpRequest(targetIp: string) {
    this.sendRawPacket(targetIp, 'FF:FF:FF:FF:FF:FF', 'ARP', `WHO_HAS ${targetIp} TELL ${this.virtualIp}`);
  }

  public broadcastMessage(message: string) {
    this.sendRawPacket('255.255.255.255', 'FF:FF:FF:FF:FF:FF', 'VCOS_RAW', message);
  }

  private buildEthernetFrame(destMac: string, srcMac: string, protocol: string, payload: number[]): number[] {
    const frame: number[] = [];
    const dmac = (destMac === 'FF:FF:FF:FF:FF:FF' ? 'FF:FF:FF:FF:FF:FF' : destMac).split(':').map(h => parseInt(h, 16) || 0);
    frame.push(...dmac);
    const smac = srcMac.split(':').map(h => parseInt(h, 16) || 0);
    frame.push(...smac);
    if (protocol === 'ARP') {
      frame.push(0x08, 0x06);
    } else {
      frame.push(0x08, 0x00);
    }
    frame.push(...payload);
    return frame;
  }

  private addPacketToLog(packet: P2PPacket & { dropped?: boolean; latencyMs?: number }) {
    this.packetLog.unshift(packet);
    if (this.packetLog.length > this.maxLogSize) {
      this.packetLog.pop();
    }
  }

  public clearLogs() {
    this.packetLog = [];
    this.notify();
  }

  // Virtual I/O Port Handler (Ports 0x300 - 0x30F)
  public handleIOWrite(port: number, value: number) {
    const val8 = value & 0xFF;
    if (port === 0x300) {
      if (val8 === 0x01) {
        this.txBuffer = [];
        this.rxBuffer = [];
      } else if (val8 === 0x02) {
        if (this.txBuffer.length > 0) {
          const text = this.txBuffer.map(b => String.fromCharCode(b)).join('');
          this.broadcastMessage(text);
          this.txBuffer = [];
        }
      }
    } else if (port === 0x302) {
      this.txBuffer.push(val8);
    }
  }

  public handleIORead(port: number): number {
    if (port === 0x300) {
      let status = 0x04;
      if (this.isLinkUp) status |= 0x01;
      if (this.rxBuffer.length > 0) status |= 0x02;
      return status;
    } else if (port === 0x304) {
      return this.rxBuffer.length > 0 ? (this.rxBuffer.shift() || 0) : 0;
    } else if (port === 0x306) {
      return Math.min(255, this.rxBuffer.length);
    }
    return 0xFF;
  }

  public subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }
}
