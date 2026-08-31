import React, { useRef, useEffect, useState, Component, ErrorInfo, ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Billboard, Plane } from "@react-three/drei";
import * as THREE from "three";
import { useSettings } from "../hooks/useSettings";
import { VCEngineAssemblyInterpreter, GameObject, DEFAULT_VCOS_ASSEMBLY_SCRIPT } from "../services/vcengine/assemblerEngine";
import { vm } from "../services/vm/motherboard";
import { VCodeAssembler } from "../services/vcode/assembler";
import { seaBios } from "../services/vcode/seabios";
import { Monitor, ShieldAlert, RefreshCw, Cpu, Code2, Gamepad2 } from "lucide-react";
import { VirtualGamepad } from "./VirtualGamepad";

type EngineMode = "2D" | "Pseudo-3D" | "Retro-3D";

// Fallback Error Boundary
interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RuntimeErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("RuntimeErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full bg-[#1e1e1e] text-red-400 p-4 font-mono text-[11px] flex flex-col items-center justify-center border-4 border-red-800 select-none">
          <ShieldAlert size={32} className="text-red-500 mb-2" />
          <div className="font-bold text-sm text-red-300 mb-1 uppercase">VC.os Runtime Protection Fault</div>
          <div className="text-gray-400 mb-3 text-center max-w-md">
            The creation encountered a memory or syntax fault, but VC.os hypervisor isolated the process safely.
          </div>
          <pre className="bg-black/80 text-red-300 p-2 border border-red-500/40 rounded text-[10px] max-w-full overflow-auto mb-3 whitespace-pre-wrap">
            {this.state.error?.message || "Unknown runtime execution error"}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-1.5 px-3 py-1 bg-red-900/60 hover:bg-red-800 text-white border border-red-500 rounded font-bold transition-all text-[10px]"
          >
            <RefreshCw size={12} />
            Reboot Virtual Sandbox
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// 3D Object Mesh Renderer
const MeshWrapper: React.FC<{
  obj: GameObject;
  mode: EngineMode;
  onRegisterMesh: (name: string, mesh: THREE.Mesh | null) => void;
}> = ({ obj, mode, onRegisterMesh }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    onRegisterMesh(obj.name, meshRef.current);
    return () => {
      onRegisterMesh(obj.name, null);
    };
  }, [obj.name, onRegisterMesh]);

  if (obj.type === "light" || (obj.type as any) === "camera") return null;

  const color = obj.color || "#3b82f6";
  const pos = obj.position || [0, 0, 0];
  const rot = obj.rotation || [0, 0, 0];
  const scale = obj.scale || [1, 1, 1];

  if (mode === "2D") {
    return (
      <group position={[pos[0], pos[1], 0]} rotation={[0, 0, rot[2]]} scale={scale}>
        <Plane args={[1, 1] as any}>
          <meshBasicMaterial color={color} />
        </Plane>
      </group>
    );
  }

  if (mode === "Pseudo-3D" && obj.type !== "plane") {
    return (
      <Billboard position={pos} args={[scale[0], scale[1]] as any}>
        <Plane args={[1, 1] as any}>
          <meshBasicMaterial color={color} />
        </Plane>
      </Billboard>
    );
  }

  return (
    <mesh ref={meshRef} position={pos} rotation={rot} scale={scale}>
      {obj.type === "cube" && <boxGeometry args={[1, 1, 1]} />}
      {obj.type === "sphere" && <sphereGeometry args={[0.5, 8, 8]} />}
      {obj.type === "plane" && <planeGeometry args={[1, 1]} />}
      {obj.type === "cylinder" && <cylinderGeometry args={[0.5, 0.5, 1, 8]} />}
      {(!obj.type || obj.type === ("sprite" as any)) && <boxGeometry args={[1, 1, 1]} />}

      {mode === "Pseudo-3D" ? (
        <meshBasicMaterial color={color} />
      ) : (
        <meshLambertMaterial color={color} flatShading={true} />
      )}
    </mesh>
  );
};

// Scene Engine with dual Assembly + Legacy N parser
const SceneEngineRunner: React.FC<{
  script: string;
  objects: GameObject[];
  mode: EngineMode;
  keysPressed: Set<string>;
}> = ({ script, objects, mode, keysPressed }) => {
  const meshMap = useRef<Map<string, THREE.Mesh>>(new Map());

  const handleRegisterMesh = (name: string, mesh: THREE.Mesh | null) => {
    if (mesh) {
      meshMap.current.set(name, mesh);
    } else {
      meshMap.current.delete(name);
    }
  };

  useFrame(() => {
    if (!script) return;

    // Check if script is legacy N-code
    if (script.includes("{[%^Startcode%^}") && script.includes("{[^%Endcode^%]}")) {
      const sequenceMatch = script.match(/%\^([\s\S]*?)\^%/);
      if (sequenceMatch) {
        const sequence = sequenceMatch[1];
        const definitions: Record<string, string> = {};
        const constraintMatch = sequence.match(/\[([\s\S]*?)\]/);
        if (constraintMatch) {
          const constraints = constraintMatch[1];
          const defRegex = /\+Define\+\s+(\w+)\s+"?([^"\s.]+)"?\s*\./g;
          let dMatch;
          while ((dMatch = defRegex.exec(constraints)) !== null) {
            definitions[dMatch[1]] = dMatch[2];
          }
        }

        const triggerMatch = sequence.match(/\{([\s\S]*?)\}/);
        if (triggerMatch) {
          const trigger = triggerMatch[1];
          const resolve = (val: string) => definitions[val] || val;

          const isKeyPressed = (key: string) => {
            const mappedKey = key.replace("KEY_", "").toUpperCase();
            if (mappedKey === "W") return keysPressed.has("W") || keysPressed.has("ARROWUP");
            if (mappedKey === "S") return keysPressed.has("S") || keysPressed.has("ARROWDOWN");
            if (mappedKey === "A") return keysPressed.has("A") || keysPressed.has("ARROWLEFT");
            if (mappedKey === "D") return keysPressed.has("D") || keysPressed.has("ARROWRIGHT");
            return keysPressed.has(mappedKey);
          };

          const ifRegex = /IF\s*\(\s*is_key_pressed\s*\(\s*(\w+)\s*\)\s*\)\s*\{\s*([\s\S]*?)\s*\}/g;
          const processedTrigger = trigger.replace(ifRegex, (_fullMatch, key, innerCode) => {
            return isKeyPressed(key) ? innerCode : "";
          });

          const rotateRegex = /rotate_object\s*\(\s*(\w+|"[^"]+")\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)\s*\./g;
          let match;
          while ((match = rotateRegex.exec(processedTrigger)) !== null) {
            const targetName = resolve(match[1].replace(/"/g, ""));
            const mesh = meshMap.current.get(targetName);
            if (mesh) {
              mesh.rotation.x += parseFloat(match[2]);
              mesh.rotation.y += parseFloat(match[3]);
              mesh.rotation.z += parseFloat(match[4]);
            }
          }

          const moveRegex = /move_object\s*\(\s*(\w+|"[^"]+")\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)\s*\./g;
          while ((match = moveRegex.exec(processedTrigger)) !== null) {
            const targetName = resolve(match[1].replace(/"/g, ""));
            const mesh = meshMap.current.get(targetName);
            if (mesh) {
              mesh.position.x += parseFloat(match[2]);
              mesh.position.y += parseFloat(match[3]);
              mesh.position.z += parseFloat(match[4]);
            }
          }
        }
      }
      return;
    }

    // Default: Execute VC.os Assembly Engine Frame
    try {
      VCEngineAssemblyInterpreter.executeFrame(
        script,
        meshMap.current,
        keysPressed
      );
    } catch (e) {
      console.warn("VCEngine Frame Execution Warning:", e);
    }
  });

  const lights = objects.filter(o => o.type === "light");

  return (
    <>
      <color attach="background" args={["#1a1a1a"]} />
      {mode !== "2D" && <fog attach="fog" args={["#1a1a1a", 5, 30]} />}
      <ambientLight intensity={mode === "Retro-3D" ? 0.5 : 0.8} />
      {lights.length > 0 ? (
        lights.map(l => (
          <directionalLight
            key={l.id}
            position={(l.position as any) || [5, 10, 5]}
            intensity={1.5}
            color={l.color || "#ffffff"}
          />
        ))
      ) : (
        <directionalLight position={[5, 10, 5]} intensity={1.5} color="#ffffff" />
      )}
      {objects.map(obj => (
        <MeshWrapper
          key={obj.id}
          obj={obj}
          mode={mode}
          onRegisterMesh={handleRegisterMesh}
        />
      ))}
      {mode !== "2D" && <OrbitControls makeDefault />}
    </>
  );
};

export const VCEngineRuntime: React.FC<{
  script: string;
  objects?: GameObject[];
  mode?: EngineMode;
}> = ({ script, objects, mode = "Retro-3D" }) => {
  const { performanceMode } = useSettings();
  const keysPressed = useRef<Set<string>>(new Set());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVGAHardwareMode, setIsVGAHardwareMode] = useState(false);
  const [vmError, setVmError] = useState<string | null>(null);

  const activeScript = script || DEFAULT_VCOS_ASSEMBLY_SCRIPT;

  useEffect(() => {
    // Check if script is raw bare-metal x86 VGA mode
    const isVGA =
      activeScript.includes("0x0013") ||
      activeScript.includes("0x000A0000") ||
      activeScript.includes("0x3C8") ||
      activeScript.includes("// Base64 Encoded Assembly Binary");

    setIsVGAHardwareMode(isVGA);

    if (isVGA) {
      try {
        vm.cpu.stop();
        setVmError(null);

        if (activeScript.includes("// Base64 Encoded Assembly Binary")) {
          const match = activeScript.match(/const base64Bin = "([^"]+)"/);
          if (match && match[1]) {
            const b64 = match[1];
            const binStr = atob(b64);
            const bin = new Uint8Array(binStr.length);
            for (let i = 0; i < binStr.length; i++) {
              bin[i] = binStr.charCodeAt(i);
            }
            seaBios.bootSector(bin, 0x7C00, false);
            return;
          }
        }

        const res = VCodeAssembler.assemble(activeScript, 0x7C00);
        if (res.errors.length > 0) {
          setVmError(res.errors.map(e => `Line ${e.line}: ${e.message}`).join("\n"));
        } else {
          seaBios.bootSector(res.bytes, 0x7C00, false);
        }
      } catch (e: any) {
        setVmError(e.message || "VM Execution Error");
      }
    }
  }, [activeScript]);

  useEffect(() => {
    if (!isVGAHardwareMode) return;
    let animId: number;
    const loop = () => {
      if (canvasRef.current) {
        vm.gpu.renderToCanvas(canvasRef.current);
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      vm.cpu.stop();
    };
  }, [isVGAHardwareMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      keysPressed.current.add(e.key.toUpperCase());

      if (isVGAHardwareMode) {
        if (e.key.length === 1) seaBios.pushKey(e.key, e.key.charCodeAt(0));
        if (e.key === "Enter") seaBios.pushKey("\n", 0x0D);
        if (e.key === "Backspace") seaBios.pushKey("\b", 0x08);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toUpperCase());
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isVGAHardwareMode]);

  // Clean objects array
  const safeObjects: GameObject[] =
    Array.isArray(objects) && objects.length > 0
      ? objects
      : [
          { id: "1", name: "Main Camera", type: "camera" as any, position: [0, 2, 5], rotation: [-0.2, 0, 0], scale: [1, 1, 1], color: "#ffffff" },
          { id: "2", name: "Directional Light", type: "light", position: [5, 10, 5], rotation: [0, 0, 0], scale: [1, 1, 1], color: "#ffffff" },
          { id: "3", name: "Player Cube", type: "cube", position: [0, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: "#3b82f6" },
          { id: "4", name: "Ground", type: "plane", position: [0, 0, 0], rotation: [-Math.PI / 2, 0, 0], scale: [10, 10, 1], color: "#2d2d2d" }
        ];

  const [showGamepad, setShowGamepad] = useState(true);

  return (
    <RuntimeErrorBoundary>
      <div className="w-full h-full bg-black flex flex-col font-mono text-[11px] select-none relative overflow-hidden">
        <div className="bg-[#111] border-b border-[#333] px-2 py-1 flex items-center justify-between text-gray-400 z-20">
          <div className="flex items-center gap-2">
            <Monitor size={12} className="text-cyan-400" />
            <span className="text-cyan-400 font-bold">VC.engine Runtime</span>
            <button
              type="button"
              onClick={() => setShowGamepad(p => !p)}
              className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-white/80 border border-zinc-600 rounded flex items-center gap-1 text-[9px] ml-1"
            >
              <Gamepad2 size={10} className={showGamepad ? "text-green-400" : "text-zinc-400"} />
              <span>{showGamepad ? "Hide Controls" : "Touch Controls"}</span>
            </button>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-green-400">ARCH: VC.os ASM / x86</span>
            <span className="text-blue-400">MODE: {isVGAHardwareMode ? "VGA_VRAM" : mode}</span>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden flex items-center justify-center">
          {isVGAHardwareMode ? (
            vmError ? (
              <div className="absolute inset-0 bg-red-950/90 text-red-300 p-4 overflow-auto font-mono">
                <div className="flex items-center gap-2 text-red-400 font-bold mb-2">
                  <ShieldAlert size={16} />
                  VM COMPILE / RUNTIME ERROR
                </div>
                <pre className="text-xs whitespace-pre-wrap">{vmError}</pre>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-full object-contain"
                style={{ imageRendering: "pixelated", width: "100%", height: "100%" }}
                tabIndex={0}
              />
            )
          ) : (
            <Canvas
              camera={{
                position: mode === "2D" ? [0, 0, 10] : [5, 5, 5],
                fov: 60,
                near: 0.1,
                far: 1000
              }}
              orthographic={mode === "2D"}
              gl={{
                antialias: false,
                pixelRatio: performanceMode
                  ? 0.5
                  : mode === "Retro-3D"
                  ? 0.3
                  : mode === "Pseudo-3D"
                  ? 0.5
                  : 1
              }}
            >
              <SceneEngineRunner
                script={activeScript}
                objects={safeObjects}
                mode={mode}
                keysPressed={keysPressed.current}
              />
            </Canvas>
          )}

          {/* On-screen touch gamepad overlay */}
          {showGamepad && (
            <div className="absolute inset-x-0 bottom-0 z-30 pointer-events-none pb-2">
              <VirtualGamepad 
                keyMap={{
                  up: 'w',
                  down: 's',
                  left: 'a',
                  right: 'd',
                  a: ' ',
                  b: 'Shift'
                }}
              />
            </div>
          )}
        </div>
      </div>
    </RuntimeErrorBoundary>
  );
};
