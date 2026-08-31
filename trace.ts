import { VirtualMotherboard } from './src/services/vm/motherboard';
import { CPUMode, CPURingLevel } from './src/services/vm/types';

const mb = new VirtualMotherboard();

// Hardware Reset Vector for x86
mb.cpu.registers.eax = 0;
mb.cpu.registers.ebx = 0;
mb.cpu.registers.ecx = 0;
mb.cpu.registers.edx = 0;
mb.cpu.registers.eip = 0xFFFFFFF0;
mb.cpu.registers.cs = 0xF000;
mb.cpu.registers.ds = 0;
mb.cpu.registers.es = 0;
mb.cpu.registers.ss = 0;
mb.cpu.mode = CPUMode.REAL_16;

let steps = 0;
try {
  while (steps < 20) {
    const pc = mb.cpu.registers.eip;
    const op = mb.readMem8(pc);
    console.log(\`Step \${steps}: EIP=0x\${pc.toString(16)} Opcode=0x\${op.toString(16)}\`);
    mb.cpu.step();
    steps++;
  }
} catch (e) {
  console.log("Crashed after", steps, "steps:", e.message);
}
