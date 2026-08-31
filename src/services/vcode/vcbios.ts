import { VirtualMotherboard } from '../vm/motherboard';

class VCBios {
  public init(mb: VirtualMotherboard) {
    console.log("[VC.bios] Extensions initialized on top of SeaBIOS Magic Binary.");
  }

  /**
   * Intercept software interrupts to provide custom VC.bios / VC.os APIs.
   * Returns true if the interrupt was handled by VC.bios.
   */
  public handleInterrupt(vector: number, mb: VirtualMotherboard): boolean {
    // INT 0x88: VC.os Custom System Call API
    if (vector === 0x88) {
      const ah = (mb.cpu.registers.eax >> 8) & 0xFF;
      
      if (ah === 0x00) {
        // AH = 0x00: Print String (DS:SI points to null-terminated string)
        let addr = (mb.cpu.registers.ds << 4) + mb.cpu.registers.esi;
        let char = mb.readMem8(addr);
        let str = '';
        while (char !== 0) {
          str += String.fromCharCode(char);
          addr++;
          char = mb.readMem8(addr);
        }
        mb.gpu.printText(str);
        mb.logSerial(`[VC.bios] Print String: ${str}`);
        return true;
      }
      
      if (ah === 0x01) {
        // AH = 0x01: Get System Time in Milliseconds
        // Returns time in EAX
        mb.cpu.registers.eax = Date.now() >>> 0;
        return true;
      }
      
      if (ah === 0x02) {
        // AH = 0x02: Send P2P Packet (DS:SI points to null-terminated string)
        let addr = (mb.cpu.registers.ds << 4) + mb.cpu.registers.esi;
        let char = mb.readMem8(addr);
        let str = '';
        while (char !== 0) {
          str += String.fromCharCode(char);
          addr++;
          char = mb.readMem8(addr);
        }
        mb.net.broadcastMessage(str);
        mb.logSerial(`[VC.bios] P2P Broadcast: ${str}`);
        return true;
      }
      
      mb.logSerial(`[VC.bios] Unknown INT 0x88 call: AH=0x${ah.toString(16)}`);
      return true; // We handled the interrupt vector, even if AH is unknown
    }

    return false; // Not handled by VC.bios, pass back to SeaBIOS / Motherboard defaults
  }
}

export const vcBios = new VCBios();

