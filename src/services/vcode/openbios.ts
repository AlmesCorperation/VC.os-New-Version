export interface DeviceNode {
  name: string;
  properties: Record<string, string>;
  children: Record<string, DeviceNode>;
}

export class OpenBiosEmulator {
  private stack: number[] = [];
  private currentPath: string[] = []; // Current node path in device tree
  private deviceTree: DeviceNode = {
    name: "/",
    properties: {
      "model": "VCOS PowerPC Virtual Machine",
      "compatible": "vcos,powervm",
      "#address-cells": "1",
      "#size-cells": "1"
    },
    children: {
      "cpu": {
        name: "cpu",
        properties: {
          "device_type": "cpu",
          "reg": "0x00000000",
          "clock-frequency": "25000000",
          "d-cache-size": "32768",
          "i-cache-size": "32768"
        },
        children: {}
      },
      "memory": {
        name: "memory",
        properties: {
          "device_type": "memory",
          "reg": "0x00000000",
          "size": "0x01000000" // 16MB
        },
        children: {}
      },
      "pci": {
        name: "pci",
        properties: {
          "device_type": "pci",
          "ranges": "0x01000000 0x00000000 0x00000000",
          "clock-frequency": "33333333"
        },
        children: {
          "display": {
            name: "display",
            properties: {
              "device_type": "display",
              "model": "VCOS GFX Framebuffer Card",
              "vram-size": "131072",
              "address": "0x000A0000"
            },
            children: {}
          },
          "ide": {
            name: "ide",
            properties: {
              "device_type": "ide",
              "model": "Intel 82371SB (PIIX3) Bus Master Controller",
              "ports": "0x1F0-0x1F7, 0x3F6"
            },
            children: {
              "disk": {
                name: "disk",
                properties: {
                  "device_type": "block",
                  "model": "VCOS-HDD-0 (16 MB Solid-State Block Drive)",
                  "blocks": "32768",
                  "block-size": "512"
                },
                children: {}
              }
            }
          }
        }
      },
      "isa": {
        name: "isa",
        properties: {
          "device_type": "isa",
          "ranges": "0x00000000 0x00000000"
        },
        children: {
          "sound": {
            name: "sound",
            properties: {
              "device_type": "sound",
              "model": "SoundBlaster 16 DSP / Yamaha OPL2 Synth",
              "io-port": "0x388"
            },
            children: {}
          },
          "floppy": {
            name: "floppy",
            properties: {
              "device_type": "block",
              "model": "Legacy 1.44M Floppy controller",
              "io-port": "0x3F0"
            },
            children: {}
          }
        }
      }
    }
  };

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.stack = [];
    this.currentPath = [];
  }

  // Retrieve current active device node
  private resolveNode(path: string[]): DeviceNode | null {
    let current = this.deviceTree;
    for (const segment of path) {
      if (current.children[segment]) {
        current = current.children[segment];
      } else {
        return null;
      }
    }
    return current;
  }

  // Push value to Forth stack
  private push(val: number): void {
    this.stack.push(val);
  }

  // Pop value from Forth stack
  private pop(): number | undefined {
    return this.stack.pop();
  }

  // Execute Forth word or general IEEE 1275 command
  public executeCommand(input: string): string {
    const tokens = input.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return "";

    const firstToken = tokens[0].toLowerCase();

    // 1. Device Tree navigation commands
    if (firstToken === "pwd") {
      return "/" + this.currentPath.join("/");
    }

    if (firstToken === "dev") {
      if (tokens.length < 2) {
        return "Usage: dev <path-segment> or dev / (for root)";
      }
      const target = tokens[1];
      if (target === "/") {
        this.currentPath = [];
        return "Current device: /";
      }
      if (target === "..") {
        if (this.currentPath.length > 0) {
          this.currentPath.pop();
        }
        return "Current device: /" + this.currentPath.join("/");
      }
      // Check absolute or relative paths
      const segments = target.startsWith("/") ? target.split("/").filter(Boolean) : [...this.currentPath, ...target.split("/")];
      const verified = this.resolveNode(segments);
      if (verified) {
        this.currentPath = segments;
        return `Current device: /${this.currentPath.join("/")}`;
      } else {
        return `Device not found: ${target}`;
      }
    }

    if (firstToken === "ls") {
      const node = this.resolveNode(this.currentPath);
      if (!node) return "Error resolving active node";
      const childrenNames = Object.keys(node.children);
      if (childrenNames.length === 0) return "No child devices under this node.";
      return childrenNames.map(name => `  ${name}`).join("\n");
    }

    if (firstToken === ".properties") {
      const node = this.resolveNode(this.currentPath);
      if (!node) return "Error resolving active node";
      const props = Object.entries(node.properties);
      if (props.length === 0) return "No properties declared.";
      return props.map(([k, v]) => `  ${k}: ${v}`).join("\n");
    }

    if (firstToken === "words") {
      return "Forth dictionary words:\n" +
        "  dup   ( x -- x x )       - Duplicate top stack item\n" +
        "  drop  ( x -- )           - Discard top stack item\n" +
        "  swap  ( x1 x2 -- x2 x1 )  - Swap top two stack items\n" +
        "  +     ( x1 x2 -- sum )   - Add top two items\n" +
        "  -     ( x1 x2 -- diff )  - Subtract top two items\n" +
        "  *     ( x1 x2 -- prod )  - Multiply top two items\n" +
        "  /     ( x1 x2 -- quot )  - Divide top two items\n" +
        "  .     ( x -- )           - Pop and print top of stack\n" +
        "  .s    ( -- )             - Show stack values\n" +
        "  clear ( -- )             - Clear stack\n" +
        "Device Tree commands:\n" +
        "  pwd                      - Print active device path\n" +
        "  dev <path>               - Select active device node\n" +
        "  ls                       - List sub-devices of active node\n" +
        "  .properties              - Show device properties\n" +
        "  show-devs                - Display entire interactive hardware tree";
    }

    if (firstToken === "show-devs") {
      const renderTree = (node: DeviceNode, depth: number): string => {
        const indent = "  ".repeat(depth);
        let out = `${indent}/${node.name === "/" ? "" : node.name}\n`;
        for (const child of Object.values(node.children)) {
          out += renderTree(child, depth + 1);
        }
        return out;
      };
      return renderTree(this.deviceTree, 0);
    }

    // 2. Interactive Forth Stack Interpretive engine
    let output = "";
    for (const token of tokens) {
      const tokenLower = token.toLowerCase();
      
      // Math/Stack operations
      if (tokenLower === "dup") {
        if (this.stack.length < 1) {
          output += "Stack underflow\n";
          break;
        }
        this.push(this.stack[this.stack.length - 1]);
      } else if (tokenLower === "drop") {
        if (this.stack.length < 1) {
          output += "Stack underflow\n";
          break;
        }
        this.pop();
      } else if (tokenLower === "swap") {
        if (this.stack.length < 2) {
          output += "Stack underflow\n";
          break;
        }
        const first = this.pop()!;
        const second = this.pop()!;
        this.push(first);
        this.push(second);
      } else if (tokenLower === "+") {
        if (this.stack.length < 2) {
          output += "Stack underflow\n";
          break;
        }
        const b = this.pop()!;
        const a = this.pop()!;
        this.push(a + b);
      } else if (tokenLower === "-") {
        if (this.stack.length < 2) {
          output += "Stack underflow\n";
          break;
        }
        const b = this.pop()!;
        const a = this.pop()!;
        this.push(a - b);
      } else if (tokenLower === "*") {
        if (this.stack.length < 2) {
          output += "Stack underflow\n";
          break;
        }
        const b = this.pop()!;
        const a = this.pop()!;
        this.push(a * b);
      } else if (tokenLower === "/") {
        if (this.stack.length < 2) {
          output += "Stack underflow\n";
          break;
        }
        const b = this.pop()!;
        const a = this.pop()!;
        if (b === 0) {
          output += "Division by zero\n";
          this.push(a);
          this.push(b);
          break;
        }
        this.push(Math.floor(a / b));
      } else if (tokenLower === ".") {
        const val = this.pop();
        if (val === undefined) {
          output += "Stack empty\n";
        } else {
          output += `${val} `;
        }
      } else if (tokenLower === ".s") {
        output += `<${this.stack.length}> ` + this.stack.join(" ") + " ";
      } else if (tokenLower === "clear") {
        this.stack = [];
      } else {
        // Is it a number?
        const parsed = parseInt(token, 10);
        if (!isNaN(parsed)) {
          this.push(parsed);
        } else if (tokenLower !== "pwd" && tokenLower !== "ls" && tokenLower !== ".properties" && tokenLower !== "dev" && tokenLower !== "show-devs" && tokenLower !== "words") {
          output += `Unknown token: ${token}\n`;
        }
      }
    }

    return output.trim();
  }
}

export const openBios = new OpenBiosEmulator();
