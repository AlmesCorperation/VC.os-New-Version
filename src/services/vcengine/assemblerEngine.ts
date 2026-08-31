import * as THREE from 'three';

export interface GameObject {
  id: string;
  name: string;
  type: 'cube' | 'sphere' | 'plane' | 'cylinder' | 'sprite' | 'light' | 'camera';
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
}

export interface EngineState {
  objects: Map<string, GameObject>;
  meshes: Map<string, THREE.Mesh>;
  keysPressed: Set<string>;
  registers: Record<string, number>;
  variables: Record<string, number | string>;
  labels: Record<string, number>;
}

export const DEFAULT_VCOS_ASSEMBLY_SCRIPT = `; ==========================================
; VC.engine: 3D Scene Controller
; Language: VC.os Assembly (x86 Mnemonic)
; ==========================================

; --- Definitions & Constants ---
VAR RotSpeed 0.02
VAR MoveSpeed 0.05

START:
    ; Read keyboard state into EAX register
    ; INT 0x20: returns active key bitflags
    ; Bit 0: W / Up Arrow
    ; Bit 1: S / Down Arrow
    ; Bit 2: A / Left Arrow
    ; Bit 3: D / Right Arrow
    ; Bit 4: Spacebar
    MOV EAX, 0x04       ; SYS_GET_INPUT
    INT 0x20

    ; Rotate Player Cube continuously (Y-axis)
    ; ROTATE object_name, dx, dy, dz
    ROTATE "Player Cube", 0.0, RotSpeed, 0.0

CHECK_KEYS:
    ; W Key - Move Forward (-Z)
    TEST EAX, 0x01
    JZ CHECK_S
    MOVE "Player Cube", 0.0, 0.0, -MoveSpeed

CHECK_S:
    ; S Key - Move Backward (+Z)
    TEST EAX, 0x02
    JZ CHECK_A
    MOVE "Player Cube", 0.0, 0.0, MoveSpeed

CHECK_A:
    ; A Key - Move Left (-X)
    TEST EAX, 0x04
    JZ CHECK_D
    MOVE "Player Cube", -MoveSpeed, 0.0, 0.0

CHECK_D:
    ; D Key - Move Right (+X)
    TEST EAX, 0x08
    JZ CHECK_SPACE
    MOVE "Player Cube", MoveSpeed, 0.0, 0.0

CHECK_SPACE:
    ; Space Key - Jump / Elevate (+Y)
    TEST EAX, 0x10
    JZ DONE
    MOVE "Player Cube", 0.0, MoveSpeed, 0.0

DONE:
    HLT
`;

export class VCEngineAssemblyInterpreter {
  public static executeFrame(
    script: string,
    meshMap: Map<string, THREE.Mesh>,
    keys: Set<string>,
    customVars: Record<string, any> = {}
  ) {
    if (!script || !script.trim()) return;

    const lines = script.split('\n');
    const variables: Record<string, any> = { ...customVars };
    const registers: Record<string, number> = {
      EAX: 0,
      EBX: 0,
      ECX: 0,
      EDX: 0,
      ESI: 0,
      EDI: 0,
      ESP: 0,
      EBP: 0,
      ZF: 0,
      CF: 0
    };

    // Calculate current key bitmask
    let keyBits = 0;
    if (keys.has('W') || keys.has('ARROWUP')) keyBits |= 0x01;
    if (keys.has('S') || keys.has('ARROWDOWN')) keyBits |= 0x02;
    if (keys.has('A') || keys.has('ARROWLEFT')) keyBits |= 0x04;
    if (keys.has('D') || keys.has('ARROWRIGHT')) keyBits |= 0x08;
    if (keys.has(' ') || keys.has('SPACE')) keyBits |= 0x10;
    if (keys.has('SHIFT')) keyBits |= 0x20;
    if (keys.has('ENTER')) keyBits |= 0x40;

    const resolveValue = (token: string): any => {
      if (!token) return 0;
      token = token.trim();
      if (token.startsWith('"') && token.endsWith('"')) {
        return token.slice(1, -1);
      }
      if (registers[token.toUpperCase()] !== undefined) {
        return registers[token.toUpperCase()];
      }
      if (variables[token] !== undefined) {
        return variables[token];
      }
      if (token.startsWith('0x') || token.startsWith('0X')) {
        return parseInt(token, 16) || 0;
      }
      const num = parseFloat(token);
      return isNaN(num) ? token : num;
    };

    // First pass: scan variables & defines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].split(';')[0].trim();
      if (!line) continue;

      const varMatch = line.match(/^(?:VAR|CONST|DEFINE)\s+([A-Za-z0-9_]+)\s+(.+)$/i);
      if (varMatch) {
        variables[varMatch[1]] = resolveValue(varMatch[2]);
      }
    }

    // Execution pass
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].split(';')[0].trim();
      if (!line) continue;

      // Labels (e.g. START:, CHECK_W:)
      if (line.endsWith(':')) continue;

      // Handle direct assembly instructions
      const parts = line.split(/[,\s]+/).map(p => p.trim()).filter(Boolean);
      if (parts.length === 0) continue;

      const op = parts[0].toUpperCase();

      switch (op) {
        case 'MOV': {
          if (parts.length >= 3) {
            const reg = parts[1].toUpperCase();
            const val = resolveValue(parts[2]);
            if (registers[reg] !== undefined) {
              registers[reg] = typeof val === 'number' ? val : 0;
            } else {
              variables[parts[1]] = val;
            }
          }
          break;
        }

        case 'INT': {
          const interruptNum = resolveValue(parts[1]);
          if (interruptNum === 0x20 || interruptNum === 0x16) {
            registers.EAX = keyBits;
          }
          break;
        }

        case 'TEST': {
          if (parts.length >= 3) {
            const val1 = resolveValue(parts[1]);
            const val2 = resolveValue(parts[2]);
            const result = (val1 & val2);
            registers.ZF = (result === 0) ? 1 : 0;
          }
          break;
        }

        case 'CMP': {
          if (parts.length >= 3) {
            const val1 = resolveValue(parts[1]);
            const val2 = resolveValue(parts[2]);
            registers.ZF = (val1 === val2) ? 1 : 0;
            registers.CF = (val1 < val2) ? 1 : 0;
          }
          break;
        }

        case 'JZ':
        case 'JE': {
          if (registers.ZF === 1) {
            const targetLabel = parts[1];
            for (let j = 0; j < lines.length; j++) {
              if (lines[j].trim().toUpperCase() === `${targetLabel.toUpperCase()}:`) {
                i = j;
                break;
              }
            }
          }
          break;
        }

        case 'JNZ':
        case 'JNE': {
          if (registers.ZF === 0) {
            const targetLabel = parts[1];
            for (let j = 0; j < lines.length; j++) {
              if (lines[j].trim().toUpperCase() === `${targetLabel.toUpperCase()}:`) {
                i = j;
                break;
              }
            }
          }
          break;
        }

        case 'JMP': {
          const targetLabel = parts[1];
          for (let j = 0; j < lines.length; j++) {
            if (lines[j].trim().toUpperCase() === `${targetLabel.toUpperCase()}:`) {
              i = j;
              break;
            }
          }
          break;
        }

        case 'ROTATE':
        case 'ROTATE_OBJECT': {
          const match = line.match(/(?:ROTATE|ROTATE_OBJECT)\s+("[^"]+"|\w+)[,\s]+([\w\d.-]+)[,\s]+([\w\d.-]+)[,\s]+([\w\d.-]+)/i);
          if (match) {
            const targetName = resolveValue(match[1]);
            const dx = resolveValue(match[2]);
            const dy = resolveValue(match[3]);
            const dz = resolveValue(match[4]);
            const mesh = meshMap.get(String(targetName));
            if (mesh) {
              mesh.rotation.x += Number(dx) || 0;
              mesh.rotation.y += Number(dy) || 0;
              mesh.rotation.z += Number(dz) || 0;
            }
          }
          break;
        }

        case 'MOVE':
        case 'MOVE_OBJECT': {
          const match = line.match(/(?:MOVE|MOVE_OBJECT)\s+("[^"]+"|\w+)[,\s]+([\w\d.-]+)[,\s]+([\w\d.-]+)[,\s]+([\w\d.-]+)/i);
          if (match) {
            const targetName = resolveValue(match[1]);
            const dx = resolveValue(match[2]);
            const dy = resolveValue(match[3]);
            const dz = resolveValue(match[4]);
            const mesh = meshMap.get(String(targetName));
            if (mesh) {
              mesh.position.x += Number(dx) || 0;
              mesh.position.y += Number(dy) || 0;
              mesh.position.z += Number(dz) || 0;
            }
          }
          break;
        }

        case 'SET_POS':
        case 'SET_POSITION': {
          const match = line.match(/(?:SET_POS|SET_POSITION)\s+("[^"]+"|\w+)[,\s]+([\w\d.-]+)[,\s]+([\w\d.-]+)[,\s]+([\w\d.-]+)/i);
          if (match) {
            const targetName = resolveValue(match[1]);
            const x = resolveValue(match[2]);
            const y = resolveValue(match[3]);
            const z = resolveValue(match[4]);
            const mesh = meshMap.get(String(targetName));
            if (mesh) {
              mesh.position.set(Number(x) || 0, Number(y) || 0, Number(z) || 0);
            }
          }
          break;
        }

        case 'SET_COLOR': {
          const match = line.match(/SET_COLOR\s+("[^"]+"|\w+)[,\s]+("[^"]+"|\#[a-fA-F0-9]+|0x[a-fA-F0-9]+)/i);
          if (match) {
            const targetName = resolveValue(match[1]);
            let colorVal = resolveValue(match[2]);
            const mesh = meshMap.get(String(targetName));
            if (mesh && mesh.material) {
              if (typeof colorVal === 'number') {
                colorVal = '#' + colorVal.toString(16).padStart(6, '0');
              }
              try {
                (mesh.material as any).color.set(colorVal);
              } catch (e) {}
            }
          }
          break;
        }

        case 'HLT': {
          return;
        }

        default:
          break;
      }
    }
  }
}
