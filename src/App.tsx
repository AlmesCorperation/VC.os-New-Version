import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Draggable from 'react-draggable';
import { PALETTE, SYSTEM_HEADER, SPECTRUM_GRADIENT } from './constants';
import { GuestBlocker } from './components/GuestBlocker';
import { Bootloader } from './components/Bootloader';
import { LoginScreen } from './components/LoginScreen';
import { Framebuffer } from './components/Framebuffer';
import { HardwareMonitor } from './components/HardwareMonitor';
import { GlitchEditor } from './components/GlitchEditor';
import { KernelMonitor } from './components/KernelMonitor';
import { SnakeGame } from './components/SnakeGame';
import { PongGame } from './components/PongGame';
import { CivilGame } from './components/CivilGame';
import { Minesweeper } from './components/Minesweeper';
import { DoomGame } from './components/DoomGame';
import { TUIEditor } from './components/TUIEditor';
import { GameStore, GameListing } from './components/GameStore';
import { GameMaker } from './components/GameMaker';
import { SpectrumInterpreter } from './components/SpectrumInterpreter';
import { VCEngineRuntime } from './components/VCEngineRuntime';
import { SearchEngine } from './components/SearchEngine';
import { FindUtility } from './components/FindUtility';
import { HelpViewer } from './components/HelpViewer';
import { DocumentsFolder } from './components/DocumentsFolder';
import { FileManager } from './components/FileManager';
import { Notepad } from './components/Notepad';
import { BackgroundMusic } from './components/BackgroundMusic';
import { RSOD } from './components/RSOD';
import { VCEngine } from './components/VCEngine';
import { VCLinux } from './components/VCLinux';
import { ISOMaster } from './components/ISOMaster';
import { LegacyBiosRunner } from './components/LegacyBiosRunner';
import { MazeScreensaver } from './components/MazeScreensaver';
import { MystifyScreensaver } from './components/MystifyScreensaver';
import { PipesScreensaver } from './components/PipesScreensaver';
import { StarfieldScreensaver } from './components/StarfieldScreensaver';
import { BouncingBoxScreensaver } from './components/BouncingBoxScreensaver';
import { BlenderApp } from './components/BlenderApp';
import { SysAntiUpdate } from './components/SysAntiUpdate';
import { DevTools } from './components/DevTools';
import { KernelFileBrowser } from './components/KernelFileBrowser';
import { WifiManager } from './components/WifiManager';
import { usePIT } from './hooks/useAudio';
import { useSettings } from './hooks/useSettings';
import { kernel, CPURing } from './services/kernel';
import { TaskManager } from './components/TaskManager';
import { TimerApp } from './components/TimerApp';
import { AlarmClockApp } from './components/AlarmClockApp';
import { MemoryBitmap } from './components/MemoryBitmap';
import { InterruptMonitor } from './components/InterruptMonitor';
import { VMController } from './components/VMController';
import { VCCode } from './components/VCCode';
import { db, auth, onAuthStateChanged, collection, query, orderBy, onSnapshot, OperationType, handleFirestoreError, doc, getDoc, setDoc, serverTimestamp } from './services/p2p_mock';
import { vfs } from './services/vfs';
import { libarchive } from './services/libarchive';
import { memoryManager } from './services/memoryManager';
import { Terminal as TerminalIcon, Maximize2, Minus, X, AlertTriangle, Cpu, HardDrive, Activity, Edit3, Shield, Gamepad2, ShoppingBag, Code2, Monitor, Folder, Settings, Search, HelpCircle, Power, ChevronRight, Save, Globe, FileText, Download, History, Bug, Cloud, Timer as TimerIcon, AlarmClock as AlarmIcon, List, Disc, Wifi, WifiOff } from 'lucide-react';
import { useScreenSize, ScreenSize } from './hooks/useScreenSize';


const LINUX_INSTALLER_SCRIPT = `#!/bin/bash
APP_NAME="VC.os"
APP_URL="https://ais-pre-5lkn2czrukpkvpzhk5tnzv-186560127721.us-east1.run.app"
ICON_URL="$APP_URL/icon.svg"
APP_DIR="$HOME/.local/share/vcos"
DESKTOP_FILE="$HOME/.local/share/applications/vcos.desktop"
ICON_FILE="$HOME/.local/share/icons/vcos.svg"
PYTHON_SCRIPT="$APP_DIR/vcos.py"

echo "========================================"
echo "  Installing VC.os Native Linux App...  "
echo "========================================"

mkdir -p "$HOME/.local/share/applications"
mkdir -p "$HOME/.local/share/icons"
mkdir -p "$APP_DIR"

echo "[1/4] Downloading high-res icon..."
if command -v curl >/dev/null 2>&1; then
    curl -s "$ICON_URL" -o "$ICON_FILE"
else
    wget -q "$ICON_URL" -O "$ICON_FILE"
fi

echo "[2/4] Creating native Python wrapper..."
cat << 'EOF' > "$PYTHON_SCRIPT"
#!/usr/bin/env python3
import sys
import os

def run_gtk():
    try:
        import gi
        gi.require_version('Gtk', '3.0')
        try:
            gi.require_version('WebKit2', '4.1')
        except ValueError:
            try:
                gi.require_version('WebKit2', '4.0')
            except ValueError:
                return False
                
        from gi.repository import Gtk, WebKit2

        window = Gtk.Window(title="VC.os")
        window.set_default_size(1024, 768)
        window.set_position(Gtk.WindowPosition.CENTER)
        
        icon_path = os.path.expanduser("~/.local/share/icons/vcos.svg")
        if os.path.exists(icon_path):
            window.set_icon_from_file(icon_path)

        window.connect("destroy", Gtk.main_quit)
        
        webview = WebKit2.WebView()
        webview.get_settings().set_enable_developer_extras(True)
        webview.load_uri("https://ais-pre-5lkn2czrukpkvpzhk5tnzv-186560127721.us-east1.run.app")
        
        window.add(webview)
        window.show_all()
        Gtk.main()
        return True
    except Exception:
        return False

def run_qt():
    try:
        from PyQt5.QtCore import QUrl
        from PyQt5.QtWidgets import QApplication, QMainWindow
        from PyQt5.QtWebEngineWidgets import QWebEngineView
        
        app = QApplication(sys.argv)
        app.setApplicationName("VC.os")
        window = QMainWindow()
        window.setWindowTitle("VC.os")
        window.resize(1024, 768)
        view = QWebEngineView()
        view.load(QUrl("https://ais-pre-5lkn2czrukpkvpzhk5tnzv-186560127721.us-east1.run.app"))
        window.setCentralWidget(view)
        window.show()
        sys.exit(app.exec_())
        return True
    except Exception:
        return False

if __name__ == "__main__":
    if run_gtk():
        sys.exit(0)
    if run_qt():
        sys.exit(0)
        
    print("Could not launch native window. Falling back to browser.")
    os.system("xdg-open https://ais-pre-5lkn2czrukpkvpzhk5tnzv-186560127721.us-east1.run.app")
EOF

chmod +x "$PYTHON_SCRIPT"

echo "[3/4] Creating native desktop entry..."
cat <<EOF > "$DESKTOP_FILE"
[Desktop Entry]
Version=1.0
Name=$APP_NAME
Comment=16-bit operating system environment
Exec=python3 $PYTHON_SCRIPT
Icon=$ICON_FILE
Terminal=false
Type=Application
Categories=Utility;System;
EOF

chmod +x "$DESKTOP_FILE"

echo "[4/4] Installation complete!"
echo ""
echo "VC.os is now installed natively on your system."
echo "You can find it in your application launcher menu."
echo "Launching now..."

if command -v gtk-launch >/dev/null 2>&1; then
    gtk-launch vcos.desktop >/dev/null 2>&1
else
    python3 "$PYTHON_SCRIPT" &
fi
`;

interface WindowState {
  id: string;
  title: string;
  content: React.ReactNode;
  color: string;
  icon: React.ReactNode;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  zIndex?: number;
}

interface WindowFrameProps {
  win: WindowState;
  state: { x: number, y: number, width: number, height: number, zIndex: number };
  isMaximized: boolean;
  isActive: boolean;
  screenSize: ScreenSize;
  bringToFront: (id: string) => void;
  minimizeWindow: (id: string) => void;
  setMaximizedWindow: (id: string | null) => void;
  closeWindow: (id: string) => void;
  setWindowStates: React.Dispatch<React.SetStateAction<Record<string, { x: number, y: number, width: number, height: number, zIndex: number }>>>;
}

const WindowFrame: React.FC<WindowFrameProps> = ({ 
  win, state, isMaximized, isActive, screenSize, bringToFront, minimizeWindow, setMaximizedWindow, closeWindow, setWindowStates 
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);

  // Calculate responsive maximum width/height bounded to viewport
  const maxAllowedWidth = Math.max(280, screenSize.width - 8);
  const maxAllowedHeight = Math.max(200, screenSize.height - 56);
  
  const widthVal = isMaximized ? '100%' : Math.min(state.width || 600, maxAllowedWidth);
  const heightVal = isMaximized ? '100%' : Math.min(state.height || 400, maxAllowedHeight);

  // Keep window safely within screen bounds
  const currentX = isMaximized ? 0 : Math.max(0, Math.min(state.x ?? 10, screenSize.width - (typeof widthVal === 'number' ? widthVal : 280) - 4));
  const currentY = isMaximized ? 0 : Math.max(0, Math.min(state.y ?? 10, screenSize.height - (typeof heightVal === 'number' ? heightVal : 200) - 52));

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".window-header"
      cancel="button"
      bounds="parent"
      disabled={isMaximized}
      onStart={() => bringToFront(win.id)}
      position={{ x: currentX, y: currentY }}
      onStop={(e, data) => {
        setWindowStates(prev => ({
          ...prev,
          [win.id]: { ...prev[win.id], x: data.x, y: data.y }
        }));
      }}
    >
      <div
        ref={nodeRef}
        className={`absolute flex flex-col ${
          isMaximized ? 'inset-0 !w-full !h-full !transform-none' : ''
        }`}
        style={{ 
          zIndex: state.zIndex,
          width: widthVal,
          height: heightVal,
          maxWidth: isMaximized ? '100%' : 'calc(100vw - 8px)',
          maxHeight: isMaximized ? '100%' : 'calc(100vh - 54px)',
          padding: '4px',
          background: isActive ? '#000080' : '#808080',
        }}
        onMouseDown={() => bringToFront(win.id)}
        onTouchStart={() => bringToFront(win.id)}
      >
        <div className="flex-1 flex flex-col bg-win95-gray h-full w-full border-2 border-white overflow-hidden">
          {/* Window Header */}
          <div 
            className={`window-header h-8 flex items-center justify-between px-2 m-0.5 sm:m-1 font-bold text-[11px] sm:text-[12px] uppercase tracking-wider select-none cursor-move ${
              isActive ? 'bg-win95-blue text-white' : 'bg-win95-dark-gray text-win95-gray'
            }`}
            onDoubleClick={() => setMaximizedWindow(isMaximized ? null : win.id)}
          >
            <div className="flex items-center gap-1.5 sm:gap-2 truncate flex-1 mr-2">
              <div className="scale-90 sm:scale-100 flex-shrink-0">{win.icon}</div>
              <span className="truncate">{win.title}</span>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button 
                type="button"
                className="w-6 h-6 sm:w-5 sm:h-5 bg-win95-gray border-outset flex items-center justify-center hover:bg-white active:border-inset active:translate-y-0.5"
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  minimizeWindow(win.id);
                }}
                title="Minimize"
              >
                <Minus size={10} className="text-black" />
              </button>
              <button 
                type="button"
                className="w-6 h-6 sm:w-5 sm:h-5 bg-win95-gray border-outset flex items-center justify-center hover:bg-white active:border-inset active:translate-y-0.5"
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setMaximizedWindow(isMaximized ? null : win.id);
                }}
                title={isMaximized ? "Restore" : "Maximize"}
              >
                <Maximize2 size={10} className="text-black" />
              </button>
              <button 
                type="button"
                className="w-6 h-6 sm:w-5 sm:h-5 bg-win95-gray border-outset flex items-center justify-center hover:bg-white active:border-inset active:translate-y-0.5 text-black"
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  closeWindow(win.id);
                }}
                title="Close"
              >
                <X size={10} className="text-black" />
              </button>
            </div>
          </div>

          {/* Window Content */}
          <div className="flex-1 m-0.5 sm:m-1 border-inset bg-white overflow-auto relative min-h-0">
            <div id={`win-content-${win.id}`} className="h-full w-full">
              {win.content}
            </div>
          </div>
        </div>
      </div>
    </Draggable>
  );
};

export default function App() {
  const screenSize = useScreenSize();
  const [booting, setBooting] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isCrashing, setIsCrashing] = useState(false);
  const [glitchLevel, setGlitchLevel] = useState(0);
  const [activeWindow, setActiveWindow] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [cloudStatus, setCloudStatus] = useState<'online' | 'offline' | 'syncing'>('offline');
  const { performanceMode, isWifiConnected } = useSettings();
  const [installedGames, setInstalledGames] = useState<string[]>(['snake', 'pong']);
  const [legacyIsoRunner, setLegacyIsoRunner] = useState<{ name: string, content?: string | Uint8Array } | null>(null);

  useEffect(() => {
    return kernel.subscribe(() => {
      if (kernel.activeLegacyIso && !legacyIsoRunner) {
        setLegacyIsoRunner(kernel.activeLegacyIso);
      } else if (!kernel.activeLegacyIso && legacyIsoRunner) {
        setLegacyIsoRunner(null);
      }
    });
  }, [legacyIsoRunner]);

  useEffect(() => {
    if (currentUser && currentUser !== 'Guest') {
      localStorage.setItem('vcos_username', currentUser);
    }
  }, [currentUser]);

  useEffect(() => {
    const savedUser = localStorage.getItem('vcos_username');
    if (savedUser) {
      setCurrentUser(savedUser);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user && !user.isAnonymous) {
        setCloudStatus('online');
        // Sync user data
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) {
            await setDoc(userDocRef, {
              uid: user.uid,
              displayName: user.displayName || 'Anonymous User',
              email: user.email || '',
              role: 'user',
              lastLogin: serverTimestamp(),
              settings: {}
            });
          } else {
            await setDoc(userDocRef, { lastLogin: serverTimestamp() }, { merge: true });
          }
        } catch (e) {
          console.error('Failed to sync user data', e);
        }
      } else {
        setCloudStatus('offline');
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!firebaseUser || firebaseUser.isAnonymous) {
      setCloudStatus('offline');
      return;
    }
    
    setCloudStatus('syncing');
    const q = query(collection(db, 'games'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const games = snapshot.docs.map(doc => doc.data() as GameListing);
      setStoreListings(prev => {
        // Merge cloud games with built-in ones
        const builtIn = prev.filter(g => ['snake', 'pong', 'glitch_run', 'civil', 'tui_editor', 'vc_mines', 'vc_doom', 'blender'].includes(g.id));
        const cloudIds = new Set(games.map(g => g.id));
        const filteredBuiltIn = builtIn.filter(g => !cloudIds.has(g.id));
        return [...filteredBuiltIn, ...games];
      });
      setCloudStatus('online');
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'games');
      setCloudStatus('offline');
    });
    return unsubscribe;
  }, [firebaseUser]);

  useEffect(() => {
    const unsubscribe = kernel.subscribe(() => {
      setGlitchLevel(kernel.glitchLevel);
    });
    kernel.setOnPanic((reason) => {
      setIsCrashing(true);
    });
    return unsubscribe;
  }, []);

  const [storeListings, setStoreListings] = useState<GameListing[]>([
    {
      id: 'snake',
      title: 'VC_SNAKE',
      developer: 'SYSTEM_CORE',
      description: 'The classic grid-based survival game. Ported from original C++ sources.',
      rating: 4.8,
      trailerUrl: 'https://www.dropbox.com/scl/fi/mbdllvjsmp3svfanfsgq0/Screenshot-2026-02-28-2.33.36-PM.png?rlkey=ds5phi67czz7v2wmd56v528rn&st=jr7j6u8a&raw=1',
      iconColor: '#FF0000',
      script: `# VC_SNAKE_EMULATED
# This is a legacy system game
# Running in compatibility mode
BG #000000
TEXT 100 100 "SNAKE_LEGACY_MODE" #FFFFFF
TEXT 100 120 "RUNNING_NATIVE_BINARY" #00FF00`
    },
    {
      id: 'pong',
      title: 'VC_PONG',
      developer: 'SYSTEM_CORE',
      description: 'High-speed paddle simulation. Re-implemented in optimized x86 Assembly.',
      rating: 4.5,
      trailerUrl: 'https://www.dropbox.com/scl/fi/0idgvyhlbptup9a5fkb5b/Screenshot-2026-02-28-2.31.24-PM.png?rlkey=85w0dskmgw173dp45odfdzau8&st=plih0oda&raw=1',
      iconColor: '#FFFFFF',
      script: `# VC_PONG_EMULATED
BG #000000
TEXT 100 100 "PONG_LEGACY_MODE" #FFFFFF
TEXT 100 120 "RUNNING_NATIVE_BINARY" #FFFF00`
    },
    {
      id: 'glitch_run',
      title: 'GLITCH_RUN',
      developer: 'VCOS_DEV',
      description: 'An experimental platformer where the level corrupts as you move.',
      rating: 4.9,
      trailerUrl: 'https://www.dropbox.com/scl/fi/ndztqkdyq92v654ag8rx7/Screenshot-2026-02-28-2.34.39-PM.png?rlkey=enbocsimwbw7hl84evuospmci&st=c130w8v6&raw=1',
      iconColor: '#00FF00',
      script: `# GLITCH_RUN v3.1
VAR X 20
VAR Y 150
VAR G 0
VAR VY 0
VAR JUMP 0
VAR LAST_G -1
VAR HIT_GOAL 0

LOOP BG #111111

# Generate map on new level
LOOP IF_GT $G $LAST_G GEN_GLITCH_MAP $G
LOOP IF_GT $G $LAST_G SET LAST_G $G

# Draw Goal
LOOP RECT 280 40 20 20 #FFFF00

# Draw Map
LOOP DRAW_GLITCH_MAP $G

# Draw Player
LOOP RECT $X $Y 10 10 #00FF00
LOOP TEXT 10 20 "GLITCH_LEVEL: $G" #FF00FF

# Gravity
LOOP INC VY 1
LOOP IF_GT $VY 10 SET VY 10
LOOP INC Y $VY

# Map Collision
LOOP COLLIDE_GLITCH_MAP X Y 10 10 VY JUMP $G

# Goal Collision
LOOP SET HIT_GOAL 0
LOOP IF_COLLIDE $X $Y 10 10 280 40 20 20 SET HIT_GOAL 1
LOOP IF_EQ $HIT_GOAL 1 INC G 1
LOOP IF_EQ $HIT_GOAL 1 SET X 20
LOOP IF_EQ $HIT_GOAL 1 SET Y 150

# Movement
LOOP IF_KEY ARROWRIGHT INC X 3
LOOP IF_KEY ARROWLEFT DEC X 3

# Screen Wrap
LOOP IF_GT $X 320 SET X 0
LOOP IF_LT $X 0 SET X 320

# Jump
LOOP IF_KEY J IF_EQ $JUMP 1 SET VY -12
LOOP IF_KEY J IF_EQ $JUMP 1 SET JUMP 0

# Glitch mechanic
LOOP IF_KEY G INC G 1`
    },
    {
      id: 'civil',
      title: 'KEO\'S CIVIL 1',
      developer: 'Keo Doolish',
      description: 'A 1990s-style demake of the classic civilization-building game. Build cities, train armies, and conquer the world!',
      rating: 5.0,
      trailerUrl: 'https://images.unsplash.com/photo-1580234811432-5202e6bf02e2?auto=format&fit=crop&w=400&q=80',
      iconColor: '#0000FF',
      script: `# NATIVE_REACT_COMPONENT`
    },
    {
      id: 'tui_editor',
      title: 'TUI_EDIT',
      developer: 'SYSTEM_CORE',
      description: 'Freestanding text-based user interface editor with Windows 1.0 tiling logic. Runs directly on the framebuffer.',
      rating: 5.0,
      trailerUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=400&q=80',
      iconColor: SPECTRUM_GRADIENT[3],
      script: `# NATIVE_REACT_COMPONENT`
    },
    {
      id: 'vc_mines',
      title: 'VC_MINES',
      developer: 'SYSTEM_CORE',
      description: 'Classic 1990s mine clearing utility. Features standard 16x16 grid with 40 mines.',
      rating: 4.7,
      trailerUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=400&q=80',
      iconColor: '#C0C0C0',
      script: `# NATIVE_REACT_COMPONENT`
    },
    {
      id: 'vc_doom',
      title: 'VC_DOOM',
      developer: 'id Software (Ported)',
      description: 'Groundbreaking 1993 pseudo-3D first-person shooter. Uses advanced raycasting technology.',
      rating: 5.0,
      trailerUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=80',
      iconColor: '#AA0000',
      script: `# NATIVE_REACT_COMPONENT`
    },
    {
      id: 'blender',
      title: 'VC_BLENDER',
      developer: 'Blender Foundation (Ported)',
      description: 'Professional 3D creation suite. Fully emulated and hardware accelerated.',
      rating: 5.0,
      trailerUrl: 'https://images.unsplash.com/photo-1633167606207-d840b5070fc2?auto=format&fit=crop&w=400&q=80',
      iconColor: '#EA580C',
      script: `# NATIVE_REACT_COMPONENT`
    },
    {
      id: 'starfighter_3d',
      title: 'STARFIGHTER 3D',
      developer: 'VCOs_Community',
      description: 'A 3D space flight demo powered by the VC.os Assembly 3D engine. Use WASD to steer through space!',
      rating: 4.9,
      trailerUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
      iconColor: '#38bdf8',
      engineMode: 'Retro-3D',
      sceneObjects: [
        { id: '1', name: 'Main Camera', type: 'camera', position: [0, 2, 6], rotation: [-0.2, 0, 0], scale: [1, 1, 1], color: '#ffffff' },
        { id: '2', name: 'Sun Light', type: 'light', position: [10, 15, 10], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#ffffff' },
        { id: '3', name: 'Player Ship', type: 'cube', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1.2, 0.4, 2], color: '#38bdf8' },
        { id: '4', name: 'Asteroid Alpha', type: 'sphere', position: [-4, 1, -6], rotation: [0, 0, 0], scale: [1.5, 1.5, 1.5], color: '#94a3b8' },
        { id: '5', name: 'Asteroid Beta', type: 'cylinder', position: [5, -1, -8], rotation: [0.5, 0.5, 0], scale: [1.2, 1.2, 1.2], color: '#64748b' },
        { id: '6', name: 'Space Base', type: 'plane', position: [0, -3, 0], rotation: [-Math.PI / 2, 0, 0], scale: [30, 30, 1], color: '#0f172a' }
      ],
      script: `; Starfighter 3D Space Flight
; Language: VC.os Assembly (x86 Mnemonic)
VAR RotSpeed 0.02
VAR MoveSpeed 0.08

START:
    ; Poll Keyboard Inputs
    MOV EAX, 0x04
    INT 0x20

    ; Slowly rotate background asteroids
    ROTATE "Asteroid Alpha", 0.01, 0.02, 0.005
    ROTATE "Asteroid Beta", -0.015, 0.01, 0.02

CHECK_W:
    TEST EAX, 0x01
    JZ CHECK_S
    MOVE "Player Ship", 0.0, 0.0, -MoveSpeed

CHECK_S:
    TEST EAX, 0x02
    JZ CHECK_A
    MOVE "Player Ship", 0.0, 0.0, MoveSpeed

CHECK_A:
    TEST EAX, 0x04
    JZ CHECK_D
    MOVE "Player Ship", -MoveSpeed, 0.0, 0.0
    ROTATE "Player Ship", 0.0, 0.0, 0.03

CHECK_D:
    TEST EAX, 0x08
    JZ CHECK_SPACE
    MOVE "Player Ship", MoveSpeed, 0.0, 0.0
    ROTATE "Player Ship", 0.0, 0.0, -0.03

CHECK_SPACE:
    TEST EAX, 0x10
    JZ DONE
    MOVE "Player Ship", 0.0, MoveSpeed, 0.0

DONE:
    HLT`
    },
    {
      id: 'cyber_vga_plasma',
      title: 'VGA 13H PLASMA',
      developer: 'RetroHacker99',
      description: 'Bare-metal x86 Mode 13h (320x200 256 colors) animated hardware buffer demonstration running in the VM.',
      rating: 5.0,
      trailerUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=80',
      iconColor: '#a855f7',
      script: `; VC.os Bare-Metal VGA Mode 13h Hardware Demo
START:
    CLI                 ; Disable Interrupts
    MOV EAX, 0x0013     ; Set Video Mode 13h (320x200 256c)
    INT 0x10
    MOV EBX, 0x000A0000 ; VRAM Base Pointer
    MOV EAX, 0x0000002A ; Palette entry
    OUT 0x3C8, AL
    MOV EAX, 0x0000003F ; Red
    OUT 0x3C9, AL
    HLT`
    }
  ]);
  const [openWindows, setOpenWindows] = useState<string[]>([]);
  const [minimizedWindows, setMinimizedWindows] = useState<string[]>([]);
  const [windowStates, setWindowStates] = useState<Record<string, { x: number, y: number, width: number, height: number, zIndex: number }>>({});
  const [maximizedWindow, setMaximizedWindow] = useState<string | null>(null);
  const [showStartMenu, setShowStartMenu] = useState(false);
  const [showProgramsMenu, setShowProgramsMenu] = useState(false);
  const [nextZIndex, setNextZIndex] = useState(100);
  const [isSaving, setIsSaving] = useState(false);
  const { glitchTone } = usePIT();

  const [isLoaded, setIsLoaded] = useState(false);

  // Initial user check on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('vcos_username');
    if (savedUser) {
      setCurrentUser(savedUser);
    } else if (process.env.USER_EMAIL?.toLowerCase().includes('keo')) {
      setCurrentUser('Keo Doolish');
    }
  }, []);

  
  // P2P Network Store Hook
  useEffect(() => {
    let unsub = () => {};
    import('./services/vm/motherboard').then(({ vm }) => {
      unsub = vm.net.subscribe(() => {
        const packet = vm.net.packetLog[0];
        // Only process newly received packets (not our own echoes if we can avoid it, or let echoes update our own store)
        if (packet && packet.protocol === 'VCOS_RAW' && typeof packet.payload === 'string') {
          if (packet.payload.startsWith('[APP_PUBLISH]')) {
             try {
                const appData = JSON.parse(packet.payload.replace('[APP_PUBLISH]', '').trim());
                if (appData.id && appData.title) {
                   setStoreListings(prev => {
                      const exists = prev.some(g => g.id === appData.id);
                      // Update or add
                      if (exists) {
                        return prev.map(g => g.id === appData.id ? appData : g);
                      }
                      return [appData, ...prev];
                   });
                }
             } catch (e) {
                console.error("Failed to parse P2P app publish", e);
             }
          }
        }
      });
    });
    return () => unsub();
  }, []);

  // Load state when currentUser changes
  useEffect(() => {
    if (!currentUser) return;

    if (currentUser === 'Guest') {
      // Guest mode - start fresh
      setOpenWindows([]);
      setMinimizedWindows([]);
      setWindowStates({});
      setMaximizedWindow(null);
      setActiveWindow(null);
      setInstalledGames(['snake', 'pong']);
      vfs.setCurrentUser('Guest');
      setIsLoaded(true);
      return;
    }

    // Load VFS
    vfs.setCurrentUser(currentUser);

    const saved = localStorage.getItem(`vcos_save_state_${currentUser}`);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setOpenWindows(Array.from(new Set(state.openWindows || [])));
        setMinimizedWindows(Array.from(new Set(state.minimizedWindows || [])));
        setWindowStates(state.windowStates || {});
        if (state.maximizedWindow) {
          setMaximizedWindow(state.maximizedWindow);
        }
        if (state.activeWindow) {
          setActiveWindow(state.activeWindow);
        }
      } catch (e) {
        console.error('Failed to load save state', e);
      }
    } else {
        // Defaults
        setOpenWindows([]);
        setMinimizedWindows([]);
        setWindowStates({});
        setMaximizedWindow(null);
        setActiveWindow(null);
    }

    const savedGames = localStorage.getItem(`vcos_games_state_${currentUser}`);
    if (savedGames) {
      try {
        const state = JSON.parse(savedGames);
        if (state.installedGames) {
          setInstalledGames(Array.from(new Set(state.installedGames as string[])));
        }
      } catch (e) {
        console.error('Failed to load games state', e);
      }
    } else {
        setInstalledGames(['snake', 'pong']);
    }
    
    setIsLoaded(true);
  }, [currentUser]);

  // Auto-save games state
  useEffect(() => {
    if (!isLoaded || !currentUser || currentUser === 'Guest') return;
    const state = {
      installedGames
    };
    localStorage.setItem(`vcos_games_state_${currentUser}`, JSON.stringify(state));
  }, [installedGames, isLoaded, currentUser]);

  // Auto-save window state
  useEffect(() => {
    if (!isLoaded || !currentUser || currentUser === 'Guest') return;
    // Filter out redirect/system apps that shouldn't persist across reloads
    const persistentWindows = openWindows.filter(id => id !== 'sys-anti-update');
    const state = {
      openWindows: persistentWindows,
      minimizedWindows: minimizedWindows.filter(id => persistentWindows.includes(id)),
      windowStates,
      maximizedWindow: maximizedWindow === 'sys-anti-update' ? null : maximizedWindow,
      activeWindow: activeWindow === 'sys-anti-update' ? null : activeWindow
    };
    localStorage.setItem(`vcos_save_state_${currentUser}`, JSON.stringify(state));
  }, [openWindows, minimizedWindows, windowStates, maximizedWindow, activeWindow, isLoaded, currentUser]);

  const saveSystemState = () => {
    if (!currentUser || currentUser === 'Guest') return;
    setIsSaving(true);
    const persistentWindows = openWindows.filter(id => id !== 'sys-anti-update');
    const state = {
      openWindows: persistentWindows,
      minimizedWindows: minimizedWindows.filter(id => persistentWindows.includes(id)),
      windowStates,
      maximizedWindow: maximizedWindow === 'sys-anti-update' ? null : maximizedWindow,
      activeWindow: activeWindow === 'sys-anti-update' ? null : activeWindow
    };
    localStorage.setItem(`vcos_save_state_${currentUser}`, JSON.stringify(state));
    setTimeout(() => setIsSaving(false), 1000);
  };

  useEffect(() => {
    if (isLoaded) {
      // Transition to Ring 3 (User Mode) after initial boot
      setTimeout(() => {
        kernel.setRing(CPURing.RING_3);
        kernel.emitEvent('TASK', 'USER_MODE_SUBSYSTEM_STARTED');
      }, 2000);
    }
  }, [isLoaded]);

  useEffect(() => {
    // Automatically clamp all active windows whenever screen dimensions or orientation change
    setWindowStates(prev => {
      let changed = false;
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        const w = next[id];
        if (!w) continue;
        const maxW = Math.max(280, screenSize.width - 8);
        const maxH = Math.max(200, screenSize.height - 56);
        const boundedW = Math.min(w.width, maxW);
        const boundedH = Math.min(w.height, maxH);
        const boundedX = Math.max(0, Math.min(w.x, screenSize.width - boundedW - 4));
        const boundedY = Math.max(0, Math.min(w.y, screenSize.height - boundedH - 52));
        
        if (boundedX !== w.x || boundedY !== w.y || boundedW !== w.width || boundedH !== w.height) {
          next[id] = { ...w, x: boundedX, y: boundedY, width: boundedW, height: boundedH };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [screenSize.width, screenSize.height]);

  const toggleWindow = (id: string) => {
    kernel.triggerInterrupt(0xCC, `(TOGGLE_WINDOW: ${id.toUpperCase()})`);

    if (openWindows.includes(id)) {
      if (minimizedWindows.includes(id)) {
        setMinimizedWindows(prev => prev.filter(winId => winId !== id));
        kernel.emitEvent('TASK', `RESTORE: ${id.toUpperCase()}`);
      }
      bringToFront(id);
    } else {
      // Allocate Memory for new App
      try {
        const pagesToAlloc = 512 + Math.floor(Math.random() * 2048); // 2MB to 10MB
        memoryManager.allocatePages(id, pagesToAlloc);
        kernel.emitEvent('MEM', `ALLOCATED ${pagesToAlloc * 4}KB FOR ${id}`);
      } catch (e) {
        kernel.triggerInterrupt(0x0D, `OUT_OF_MEMORY: ${id.toUpperCase()}`);
        kernel.emitEvent('CRITICAL', `OOM_ERROR: CANNOT LOAD TASK`);
        kernel.panic('SYSTEM HALTED: SEVERE OUT OF MEMORY');
        return; // Block opening
      }

      setOpenWindows(prev => {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      });

      const isSmall = screenSize.isMobile;
      const defaultW = isSmall ? Math.max(300, screenSize.width - 8) : Math.min(680, screenSize.width - 40);
      const defaultH = isSmall ? Math.max(260, screenSize.height - 56) : Math.min(460, screenSize.height - 100);
      const defaultX = isSmall ? 4 : Math.max(10, Math.min(35 + (openWindows.length % 6) * 25, screenSize.width - defaultW - 20));
      const defaultY = isSmall ? 4 : Math.max(10, Math.min(30 + (openWindows.length % 6) * 25, screenSize.height - defaultH - 60));

      setWindowStates(prev => ({
        ...prev,
        [id]: prev[id] || { 
          x: defaultX, 
          y: defaultY, 
          width: defaultW, 
          height: defaultH, 
          zIndex: nextZIndex 
        }
      }));
      setNextZIndex(prev => prev + 1);
      setActiveWindow(id);

      if (isSmall) {
        setMaximizedWindow(id);
      }

      kernel.emitEvent('TASK', `LAUNCH: ${id.toUpperCase()}`);
      kernel.executeTask(id.toUpperCase(), 15);
    }
    setShowStartMenu(false);
  };

  const bringToFront = (id: string) => {
    setWindowStates(prev => ({
      ...prev,
      [id]: { ...prev[id], zIndex: nextZIndex }
    }));
    setNextZIndex(prev => prev + 1);
    setActiveWindow(id);
  };

  const closeWindow = (id: string) => {
    kernel.triggerInterrupt(0xCC, `(CLOSE_WINDOW: ${id.toUpperCase()})`);
    
    // Free Memory
    memoryManager.freeAllocation(id);
    kernel.emitEvent('MEM', `FREED MEMORY FOR ${id}`);

    setOpenWindows(prev => prev.filter(winId => winId !== id));
    setMinimizedWindows(prev => prev.filter(winId => winId !== id));
    if (activeWindow === id) setActiveWindow(null);
    if (maximizedWindow === id) setMaximizedWindow(null);
    kernel.emitEvent('TASK', `KILL: ${id.toUpperCase()}`);
  };

  const minimizeWindow = (id: string) => {
    kernel.triggerInterrupt(0xCC, `(MINIMIZE_WINDOW: ${id.toUpperCase()})`);
    setMinimizedWindows(prev => [...prev, id]);
    setActiveWindow(null);
    kernel.emitEvent('TASK', `MINIMIZE: ${id.toUpperCase()}`);
  };

  const triggerRSOD = () => {
    setIsCrashing(true);
    glitchTone();
    setTimeout(() => {
      // In a real OS we'd hang, here we might just stay glitched
    }, 100);
  };

  const isKeo = currentUser?.toLowerCase().includes('keo');

  const BASE_WINDOW_TITLES: Record<string, string> = {
    taskman: 'Task Manager',
    timer: 'Timer',
    alarm: 'Alarm Clock',
    isomaster: 'ISO Master',
    memmap: 'Memory Bitmap',
    idt: 'Interrupt Monitor',
    kernelbrowser: 'KERNEL_FILE_BROWSER',
    sys: 'HARDWARE_MONITOR',
    kern: 'BAREBONES_KERNEL',
    vcengine: 'VC.engine',
    search: 'VC_EXPLORER',
    store: 'VC_STORE',
    edit: 'GLITCH_EDITOR',
    gfx: 'GFX_TEST',
    find: 'Find: All Files',
    help: 'Help Topics',
    docs: 'C:\\Documents',
    fileman: 'MS-DOS Executive',
    linux: 'VC.linux (Unified)',
    maze3d: '3D Maze (Screensaver)',
    mystify: 'Mystify (Screensaver)',
    pipes3d: '3D Pipes (Screensaver)',
    starfield: 'Starfield (Screensaver)',
    bouncingbox: 'Bouncing Box (Screensaver)',
    antiupdate: 'sys-anti-update',
    devtools: 'VC.os Developer Tools'
  };

  const getWindowTitle = (id: string) => {
    if (BASE_WINDOW_TITLES[id]) return BASE_WINDOW_TITLES[id];
    
    // Check game windows
    const game = storeListings.find(g => g.id === id);
    if (game) return game.title;
    
    // Check notepad windows
    if (id.startsWith('notepad-')) return `Notepad - ${id.replace('notepad-', '')}`;
    
    return id.toUpperCase();
  };

  const baseWindows: WindowState[] = [
    {
      id: 'taskman',
      title: 'Task Manager',
      color: PALETTE.blue,
      icon: <Activity size={14} />,
      content: (
        <TaskManager 
          openWindows={openWindows} 
          activeWindow={activeWindow} 
          closeWindow={closeWindow} 
          bringToFront={bringToFront}
          windowTitles={Object.fromEntries(openWindows.map(id => [id, getWindowTitle(id)]))}
        />
      )
    },
    {
      id: 'timer',
      title: 'Timer',
      color: PALETTE.blue,
      icon: <TimerIcon size={14} />,
      content: <TimerApp />
    },
    {
      id: 'alarm',
      title: 'Alarm Clock',
      color: PALETTE.red,
      icon: <AlarmIcon size={14} />,
      content: <AlarmClockApp />
    },
    {
      id: 'isomaster',
      title: 'ISO Master',
      color: PALETTE.white,
      icon: <Disc size={14} />,
      content: <ISOMaster />
    },
    {
      id: 'memmap',
      title: 'Memory Bitmap',
      color: PALETTE.green,
      icon: <HardDrive size={14} />,
      content: <MemoryBitmap firebaseUser={firebaseUser} />
    },
    {
      id: 'idt',
      title: 'Interrupt Monitor',
      color: PALETTE.blue,
      icon: <Shield size={14} />,
      content: <InterruptMonitor />
    },
    {
      id: 'kernelbrowser',
      title: 'KERNEL_FILE_BROWSER',
      color: PALETTE.green,
      icon: <TerminalIcon size={14} />,
      content: <KernelFileBrowser />
    },
    { 
      id: 'vm', 
      title: 'Hardware VM (CPU / VGA / P2P Net)', 
      color: PALETTE.purple,
      icon: <Cpu size={14} className="text-purple-400" />,
      content: <VMController />
    },
    { 
      id: 'sys', 
      title: 'HARDWARE_MONITOR', 
      color: PALETTE.yellow,
      icon: <Activity size={14} />,
      content: <HardwareMonitor onCrash={() => setIsCrashing(true)} />
    },
    { 
      id: 'kern', 
      title: 'BAREBONES_KERNEL', 
      color: PALETTE.green,
      icon: <Shield size={14} />,
      content: <KernelMonitor onCrash={() => setIsCrashing(true)} openWindows={openWindows} />
    },
    {
      id: 'vcengine',
      title: 'VC.engine',
      color: PALETTE.blue,
      icon: <Monitor size={14} />,
      content: <VCEngine firebaseUser={firebaseUser} currentUser={currentUser} onPublish={(game: any) => {
        setStoreListings(prev => {
          const exists = prev.some(g => g.id === game.id);
          const merged = exists ? prev.map(g => g.id === game.id ? game : g) : [...prev, game];
          return Array.from(new Map(merged.map(g => [g.id, g])).values());
        });
        setInstalledGames(prev => Array.from(new Set([...prev, game.id])));
        toggleWindow(game.id);
      }} />
    },
    {
      id: 'vccode',
      title: 'VC.code',
      color: PALETTE.blue,
      icon: <Code2 size={14} />,
      content: <VCCode />
    },
    {
      id: 'search',
      title: 'VC_EXPLORER',
      color: PALETTE.blue,
      icon: <Globe size={14} />,
      content: currentUser === 'Guest' ? <GuestBlocker /> : <SearchEngine />
    },
    {
      id: 'store',
      title: 'VC_STORE',
      color: PALETTE.yellow,
      icon: <ShoppingBag size={14} />,
      content: currentUser === 'Guest' ? <GuestBlocker /> : <GameStore 
        listings={storeListings}
        installedGames={installedGames} 
        onInstall={(id) => setInstalledGames(prev => Array.from(new Set([...prev, id])))} 
      />
    },
    { 
      id: 'edit', 
      title: 'GLITCH_EDITOR', 
      color: PALETTE.blue,
      icon: <Edit3 size={14} />,
      content: <GlitchEditor onCrash={() => setIsCrashing(true)} />
    },
    { 
      id: 'gfx', 
      title: 'GFX_TEST', 
      color: PALETTE.white,
      icon: <Cpu size={14} />,
      content: (
        <div className="flex flex-col h-full">
          <div className="flex-1 grid grid-cols-4 gap-1 mb-2">
            {SPECTRUM_GRADIENT.map(c => (
              <div key={c} style={{ backgroundColor: c }} className="h-full border border-black/20" />
            ))}
          </div>
          <div className="text-[10px] bg-black/5 p-2 border border-black/10">
            VGA_MODE: 0x13 (320x200)<br/>
            REFRESH: 60Hz<br/>
            PALETTE: SPECTRUM_V1
          </div>
        </div>
      )
    },
    {
      id: 'find',
      title: 'Find: All Files',
      color: PALETTE.blue,
      icon: <Search size={14} />,
      content: <FindUtility />
    },
    {
      id: 'help',
      title: 'Help Topics',
      color: PALETTE.blue,
      icon: <HelpCircle size={14} />,
      content: <HelpViewer />
    },
    {
      id: 'docs',
      title: 'C:\\Documents',
      color: PALETTE.yellow,
      icon: <Folder size={14} className="text-yellow-600" />,
      content: <DocumentsFolder onOpenFile={(name) => {
        const newId = `notepad-${name}`;
        setOpenWindows(prev => {
          if (prev.includes(newId)) return prev;
          return [...prev, newId];
        });
        if (!openWindows.includes(newId)) {
          setWindowStates(prev => ({
            ...prev,
            [newId]: prev[newId] || { x: 100, y: 100, width: 400, height: 300, zIndex: nextZIndex }
          }));
          setNextZIndex(prev => prev + 1);
        }
        setActiveWindow(newId);
      }} />
    },
    {
      id: 'fileman',
      title: 'MS-DOS Executive',
      color: PALETTE.white,
      icon: <HardDrive size={14} className="text-gray-600" />,
      content: <FileManager onCrash={() => setIsCrashing(true)} onOpenFile={(name) => {
        const newId = `notepad-${name}`;
        setOpenWindows(prev => {
          if (prev.includes(newId)) return prev;
          return [...prev, newId];
        });
        if (!openWindows.includes(newId)) {
          setWindowStates(prev => ({
            ...prev,
            [newId]: prev[newId] || { x: 150, y: 150, width: 500, height: 400, zIndex: nextZIndex }
          }));
          setNextZIndex(prev => prev + 1);
        }
        setActiveWindow(newId);
      }} />
    },
    {
      id: 'linux',
      title: 'VC.linux (Unified)',
      color: PALETTE.purple,
      icon: <TerminalIcon size={14} className="text-purple-400" />,
      content: (
        <VCLinux 
          onCrash={() => setIsCrashing(true)} 
          installedGames={installedGames}
          onLaunchGame={(id) => toggleWindow(id)}
          onInstallGame={(id) => setInstalledGames(prev => Array.from(new Set([...prev, id])))}
          onBootLegacyISO={(name, content) => setLegacyIsoRunner({ name, content })}
          onOpenFile={(name) => {
            const newId = `notepad-${name}`;
            setOpenWindows(prev => {
              if (prev.includes(newId)) return prev;
              return [...prev, newId];
            });
            if (!openWindows.includes(newId)) {
              setWindowStates(prev => ({
                ...prev,
                [newId]: prev[newId] || { x: 100, y: 100, width: 400, height: 300, zIndex: nextZIndex }
              }));
              setNextZIndex(prev => prev + 1);
            }
            setActiveWindow(newId);
          }}
        />
      )
    },
    {
      id: 'maze3d',
      title: '3D Maze (Screensaver)',
      color: PALETTE.purple,
      icon: <Monitor size={14} />,
      content: <MazeScreensaver />
    },
    {
      id: 'mystify',
      title: 'Mystify (Screensaver)',
      color: PALETTE.purple,
      icon: <Monitor size={14} />,
      content: <MystifyScreensaver />
    },
    {
      id: 'pipes3d',
      title: '3D Pipes (Screensaver)',
      color: PALETTE.purple,
      icon: <Monitor size={14} />,
      content: <PipesScreensaver />
    },
    {
      id: 'starfield',
      title: 'Starfield (Screensaver)',
      color: PALETTE.purple,
      icon: <Monitor size={14} />,
      content: <StarfieldScreensaver />
    },
    {
      id: 'bouncingbox',
      title: 'Bouncing Box (Screensaver)',
      color: PALETTE.purple,
      icon: <Monitor size={14} />,
      content: <BouncingBoxScreensaver />
    },
    {
      id: 'wifi',
      title: 'Wireless Network Connection',
      color: PALETTE.blue,
      icon: <Wifi size={14} />,
      content: currentUser === 'Guest' ? <GuestBlocker /> : <WifiManager />
    },
    {
      id: 'antiupdate',
      title: 'sys-anti-update',
      color: '#EA580C',
      icon: <History size={14} />,
      content: <SysAntiUpdate />
    },
    ...(isKeo ? [{
      id: 'devtools',
      title: 'VC.os Developer Tools',
      color: '#991b1b',
      icon: <Bug size={14} />,
      content: <DevTools onPanic={triggerRSOD} />
    }] : [])
  ];

  // Dynamic windows for installed games
  const gameWindows: WindowState[] = storeListings
    .filter(listing => installedGames.includes(listing.id))
    .map(listing => {
      const script = listing.script || '';
      const is3DOrEngine = 
        Boolean((listing as any).engineMode) || 
        Boolean((listing as any).sceneObjects && (listing as any).sceneObjects.length > 0) ||
        script.includes('START:') ||
        script.includes('ROTATE') ||
        script.includes('MOVE') ||
        script.includes('0x0013') ||
        script.includes('0x000A0000') ||
        script.includes('0x3C8') ||
        script.includes('Base64 Encoded') ||
        script.includes('{[%^Startcode%^}');

      return {
        id: listing.id,
        title: listing.title || 'Untitled Creation',
        color: listing.iconColor || '#3b82f6',
        icon: <Gamepad2 size={14} />,
        content: listing.id === 'snake' ? <SnakeGame /> : 
                 listing.id === 'pong' ? <PongGame /> : 
                 listing.id === 'civil' ? <CivilGame /> :
                 listing.id === 'vc_mines' ? <Minesweeper /> :
                 listing.id === 'vc_doom' ? <DoomGame /> :
                 listing.id === 'blender' ? <BlenderApp /> :
                 listing.id === 'tui_editor' ? <TUIEditor /> :
                 is3DOrEngine ? (
                   <VCEngineRuntime 
                     script={script} 
                     objects={(listing as any).sceneObjects || []}
                     mode={(listing as any).engineMode || 'Retro-3D'}
                   />
                 ) : (
                   <SpectrumInterpreter 
                     script={script} 
                     gameId={listing.id}
                     isMultiplayer={listing.isMultiplayer}
                   />
                 )
      };
    });

  // Dynamic windows for notepad files
  const notepadWindows: WindowState[] = openWindows
    .filter(id => id.startsWith('notepad-'))
    .map(id => {
      const fileName = id.replace('notepad-', '');
      return {
        id,
        title: `Notepad - ${fileName}`,
        color: PALETTE.white,
        icon: <FileText size={14} />,
        content: <Notepad fileName={fileName} />
      };
    });

  const windows = Array.from(new Map([...baseWindows, ...gameWindows, ...notepadWindows].map(w => [w.id, w])).values());

  // Global Arrow Key Scrolling for Chromebooks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeWindow) return;
      
      // Don't scroll if we're in a game window (except store/maker)
      const isSystemWindow = ['term', 'sys', 'kern', 'store', 'maker', 'edit', 'gfx'].includes(activeWindow);
      if (!isSystemWindow) return;

      const element = document.getElementById(`win-content-${activeWindow}`);
      if (!element) return;

      const scrollAmount = 40;
      if (e.key === 'ArrowDown') {
        element.scrollBy({ top: scrollAmount, behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        element.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeWindow]);

  if (booting) {
    return <Bootloader onComplete={() => setBooting(false)} />;
  }

  if (legacyIsoRunner) {
    return (
      <LegacyBiosRunner
        isoName={legacyIsoRunner.name}
        isoContent={legacyIsoRunner.content}
        onResetToOS={() => {
          setLegacyIsoRunner(null);
          kernel.exitLegacyIso();
        }}
      />
    );
  }

  if (!isLoggedIn) {
    return <LoginScreen onLogin={(user) => {
      setCurrentUser(user);
      setIsLoggedIn(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vcos_auth_state_changed'));
      }
    }} />;
  }

  return (
    <motion.div 
      className="fixed inset-0 bg-cover bg-center font-sans overflow-hidden flex flex-col select-none"
      style={{ backgroundColor: '#2d2d2d', backgroundImage: 'radial-gradient(#333 15%, transparent 16%), radial-gradient(#333 15%, transparent 16%)', backgroundSize: '10px 10px', backgroundPosition: '0 0, 5px 5px' }}
      animate={glitchLevel > 0 ? {
        x: [0, -2, 2, -1, 1, 0].map(v => v * glitchLevel * 5),
        y: [0, 1, -1, 2, -2, 0].map(v => v * glitchLevel * 5),
        filter: [
          'none',
          `hue-rotate(${glitchLevel * 45}deg) contrast(${1 + glitchLevel * 0.5})`,
          'none'
        ]
      } : {}}
      transition={glitchLevel > 0 ? {
        duration: 0.2,
        repeat: Infinity,
        repeatType: 'mirror'
      } : {}}
    >
      {/* Main Desktop Workspace Area (Desktop Icons & Floating Windows) */}
      <div className="relative flex-1 w-full h-full overflow-hidden min-h-0">
        {/* Desktop Icons Grid */}
        <div className="absolute inset-0 p-3 sm:p-6 md:p-8 flex flex-row-reverse flex-wrap gap-3 sm:gap-6 md:gap-8 justify-start items-start overflow-y-auto z-0 select-none scrollbar-thin">
          <DesktopIcon 
            icon={<Activity className="text-blue-400" size={28} />} 
            label="Task Manager" 
            onClick={() => toggleWindow('taskman')} 
          />
          <DesktopIcon 
            icon={<TimerIcon className="text-win95-white" size={28} />} 
            label="Timer" 
            onClick={() => toggleWindow('timer')} 
          />
          <DesktopIcon 
            icon={<AlarmIcon className="text-red-400" size={28} />} 
            label="Alarm Clock" 
            onClick={() => toggleWindow('alarm')} 
          />
          <DesktopIcon 
            icon={<Disc className="text-win95-white" size={28} />} 
            label="ISO Master" 
            onClick={() => toggleWindow('isomaster')} 
          />
          <DesktopIcon 
            icon={<HardDrive className="text-green-400" size={28} />} 
            label="Memory Map" 
            onClick={() => toggleWindow('memmap')} 
          />
          <DesktopIcon 
            icon={<Shield className="text-blue-400" size={28} />} 
            label="IDT Monitor" 
            onClick={() => toggleWindow('idt')} 
          />
          <DesktopIcon 
            icon={<HelpCircle className="text-win95-white" size={28} />} 
            label="Start Here" 
            onClick={() => toggleWindow('help')} 
          />
          <DesktopIcon 
            icon={<Download className="text-win95-white" size={28} />} 
            label="Download for Linux" 
            onClick={async () => {
              kernel.emitEvent('TASK', 'ISO_MASTER: STARTING_BAREMETAL_EXPORT');
              try {
                vfs.make();
                await libarchive.writeArchive('vcos_bootable.iso', ['kernel.bin', 'boot.s', 'linker.ld', 'gdt.cpp', 'idt.cpp'], 'iso');
                kernel.emitEvent('TASK', 'ISO_MASTER: EXPORT_SUCCESS');
              } catch (e) {
                kernel.emitEvent('CRITICAL', 'ISO_MASTER: EXPORT_FAILED');
              }
            }} 
          />
          <DesktopIcon 
            icon={<TerminalIcon className="text-green-400" size={28} />} 
            label="Kernel Browser" 
            onClick={() => toggleWindow('kernelbrowser')} 
          />
          <DesktopIcon 
            icon={<Monitor className="text-win95-white" size={28} />} 
            label="VC.engine" 
            onClick={() => toggleWindow('vcengine')} 
          />
          <DesktopIcon 
            icon={<Globe className="text-win95-white" size={28} />} 
            label="VC Explorer" 
            onClick={() => toggleWindow('search')} 
          />
          <DesktopIcon 
            icon={<Monitor className="text-win95-white" size={28} />} 
            label="My Computer" 
            onClick={() => toggleWindow('sys')} 
          />
          <DesktopIcon 
            icon={<HardDrive className="text-win95-white" size={28} />} 
            label="File Manager" 
            onClick={() => toggleWindow('fileman')} 
          />
          <DesktopIcon 
            icon={<Folder className="text-yellow-400" size={28} />} 
            label="My Documents" 
            onClick={() => toggleWindow('docs')} 
          />
          <DesktopIcon 
            icon={<ShoppingBag className="text-win95-white" size={28} />} 
            label="VC Store" 
            onClick={() => toggleWindow('store')} 
          />
          <DesktopIcon 
            icon={<Shield className="text-win95-white" size={28} />} 
            label="Barebones Kernel" 
            onClick={() => toggleWindow('kern')} 
          />
          <DesktopIcon 
            icon={<TerminalIcon className="text-purple-400" size={28} />} 
            label="VC.linux" 
            onClick={() => toggleWindow('linux')} 
          />
          <DesktopIcon 
            icon={<Cpu className="text-yellow-400" size={28} />} 
            label="Hardware VM" 
            onClick={() => toggleWindow('vm')} 
          />
          <DesktopIcon 
            icon={<Monitor className="text-green-500" size={28} />} 
            label="3D Maze" 
            onClick={() => toggleWindow('maze3d')} 
          />
          <DesktopIcon 
            icon={<Monitor className="text-blue-500" size={28} />} 
            label="Mystify" 
            onClick={() => toggleWindow('mystify')} 
          />
          <DesktopIcon 
            icon={<Monitor className="text-yellow-500" size={28} />} 
            label="3D Pipes" 
            onClick={() => toggleWindow('pipes3d')} 
          />
          <DesktopIcon 
            icon={<Monitor className="text-white" size={28} />} 
            label="Starfield" 
            onClick={() => toggleWindow('starfield')} 
          />
          <DesktopIcon 
            icon={<Monitor className="text-pink-500" size={28} />} 
            label="Bouncing Box" 
            onClick={() => toggleWindow('bouncingbox')} 
          />
          <DesktopIcon 
            icon={<History className="text-orange-600" size={28} />} 
            label="sys-anti-update" 
            onClick={() => toggleWindow('antiupdate')} 
          />
          {isKeo && (
            <DesktopIcon 
              icon={<Bug className="text-red-600" size={28} />} 
              label="Dev Tools" 
              onClick={() => toggleWindow('devtools')} 
            />
          )}
          {installedGames.map(gameId => {
            const game = storeListings.find(g => g.id === gameId);
            if (!game) return null;
            return (
              <DesktopIcon 
                key={gameId}
                icon={<Gamepad2 style={{ color: game.iconColor }} size={28} />} 
                label={game.title} 
                onClick={() => toggleWindow(gameId)} 
              />
            );
          })}
        </div>

        {/* Floating Windows Stack */}
        {windows
          .filter(win => openWindows.includes(win.id) && !minimizedWindows.includes(win.id))
          .map((win) => {
            const state = windowStates[win.id] || { 
              x: 10, 
              y: 10, 
              width: Math.min(600, screenSize.width - 8), 
              height: Math.min(400, screenSize.height - 56), 
              zIndex: 100 
            };
            const isMaximized = maximizedWindow === win.id;
            const isActive = activeWindow === win.id;

            return (
              <WindowFrame
                key={win.id}
                win={win}
                state={state}
                isMaximized={isMaximized}
                isActive={isActive}
                screenSize={screenSize}
                bringToFront={bringToFront}
                minimizeWindow={minimizeWindow}
                setMaximizedWindow={setMaximizedWindow}
                closeWindow={closeWindow}
                setWindowStates={setWindowStates}
              />
            );
          })}
      </div>

      {/* Taskbar */}
      <div className="h-10 sm:h-12 bg-win95-gray border-t-2 sm:border-t-4 border-white flex items-center px-1 sm:px-2 gap-1 sm:gap-2 z-[9999] flex-shrink-0">
        <button 
          className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 border-outset font-bold text-xs sm:text-sm uppercase tracking-wider active:translate-y-0.5 ${showStartMenu ? 'border-inset bg-white' : ''}`}
          onClick={() => {
            setShowStartMenu(!showStartMenu);
            setShowProgramsMenu(false);
          }}
        >
          <div className="bg-win95-blue p-0.5 flex-shrink-0">
            <Monitor size={14} className="text-white" />
          </div>
          <span>Start</span>
        </button>
        
        <div className="w-1 h-6 sm:h-8 bg-win95-dark-gray mx-0.5 sm:mx-1 flex-shrink-0" />

        <div className="flex-1 flex gap-1 overflow-x-auto scrollbar-hide min-w-0">
          {openWindows.map(winId => {
            const win = windows.find(w => w.id === winId);
            if (!win) return null;
            const isActive = activeWindow === winId;
            return (
              <button
                key={winId}
                onClick={() => {
                  if (minimizedWindows.includes(winId)) {
                    setMinimizedWindows(prev => prev.filter(id => id !== winId));
                    bringToFront(winId);
                  } else if (isActive) {
                    minimizeWindow(winId);
                  } else {
                    bringToFront(winId);
                  }
                }}
                className={`flex items-center gap-1.5 px-2 sm:px-3 py-1 min-w-[80px] sm:min-w-[120px] max-w-[140px] sm:max-w-[180px] border-outset text-[9px] sm:text-[10px] uppercase truncate active:translate-y-0.5 flex-shrink-0 ${
                  isActive ? 'border-inset bg-white font-bold' : ''
                }`}
              >
                <div className="scale-75 sm:scale-90 flex-shrink-0">{win.icon}</div>
                <span className="truncate">{win.title}</span>
              </button>
            );
          })}
        </div>

        <div className="border-inset px-1.5 sm:px-3 py-1 sm:py-1.5 flex items-center gap-1 sm:gap-2 text-[10px] sm:text-[12px] bg-win95-gray font-mono flex-shrink-0">
          <div className="flex items-center gap-1 cursor-pointer hover:bg-gray-200 px-0.5 sm:px-1" onClick={() => toggleWindow('wifi')}>
            {isWifiConnected ? (
              <Wifi size={13} className="text-blue-600" />
            ) : (
              <WifiOff size={13} className="text-red-500" />
            )}
          </div>
          <div className="flex items-center gap-1 mx-1 sm:mx-2 border-l border-r border-[#808080] px-1 sm:px-2 shadow-[1px_0_0_#fff,-1px_0_0_#fff]">
            {cloudStatus === 'syncing' ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}>
                <Cloud size={12} className="text-blue-400" />
              </motion.div>
            ) : cloudStatus === 'online' ? (
              <Cloud size={12} className="text-green-500" />
            ) : (
              <Cloud size={12} className="text-red-500 opacity-50" />
            )}
            <span className="text-[8px] sm:text-[9px] uppercase opacity-70 hidden sm:inline">{cloudStatus}</span>
          </div>
          <Cpu size={12} className="text-black hidden xs:inline" />
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* Start Menu */}
      <AnimatePresence>
        {showStartMenu && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            className="fixed bottom-10 sm:bottom-12 left-0 w-60 sm:w-64 max-h-[calc(100vh-50px)] overflow-y-auto bg-win95-gray border-outset z-[10000] flex shadow-2xl"
          >
            <div className="w-7 sm:w-8 bg-win95-dark-gray flex items-end justify-center pb-4 flex-shrink-0">
              <span className="rotate-[-90deg] text-win95-gray font-bold text-lg sm:text-xl whitespace-nowrap origin-center translate-y-[-50px]">
                VC.os
              </span>
            </div>
            <div className="flex-1 py-1 relative">
              <div 
                className="flex items-center justify-between px-3 py-1.5 hover:bg-win95-blue hover:text-white cursor-pointer text-sm group"
                onClick={() => setShowProgramsMenu(!showProgramsMenu)}
                onMouseEnter={() => setShowProgramsMenu(true)}
              >
                <div className="flex items-center gap-3">
                  <Folder size={16} className="text-yellow-600" />
                  <span>Programs</span>
                </div>
                <ChevronRight size={14} />
              </div>

              {showProgramsMenu && (
                <div 
                  className="sm:absolute sm:left-full sm:bottom-0 w-full sm:w-48 max-h-72 overflow-y-auto bg-win95-gray border-outset py-1 z-[10001] shadow-lg"
                  onMouseLeave={() => setShowProgramsMenu(false)}
                >
                  <StartMenuItem icon={<Activity size={16} className="text-blue-500" />} label="Task Manager" onClick={() => toggleWindow('taskman')} />
                  <StartMenuItem icon={<TimerIcon size={16} />} label="Timer" onClick={() => toggleWindow('timer')} />
                  <StartMenuItem icon={<AlarmIcon size={16} className="text-red-500" />} label="Alarm Clock" onClick={() => toggleWindow('alarm')} />
                  <StartMenuItem icon={<Disc size={16} />} label="ISO Master" onClick={() => toggleWindow('isomaster')} />
                  <StartMenuItem icon={<HardDrive size={16} className="text-green-500" />} label="Memory Map" onClick={() => toggleWindow('memmap')} />
                  <StartMenuItem icon={<Shield size={16} className="text-blue-500" />} label="IDT Monitor" onClick={() => toggleWindow('idt')} />
                  <StartMenuItem icon={<TerminalIcon size={16} className="text-green-500" />} label="Kernel Browser" onClick={() => toggleWindow('kernelbrowser')} />
                  <StartMenuItem icon={<ShoppingBag size={16} />} label="VC Store" onClick={() => toggleWindow('store')} />
                  <StartMenuItem icon={<Monitor size={16} />} label="VC.engine" onClick={() => toggleWindow('vcengine')} />
                  <StartMenuItem icon={<Code2 size={16} />} label="VC.code" onClick={() => toggleWindow('vccode')} />
                  <StartMenuItem icon={<TerminalIcon size={16} className="text-purple-500" />} label="VC.linux" onClick={() => toggleWindow('linux')} />
                  <StartMenuItem icon={<Cpu size={16} className="text-yellow-500" />} label="Hardware VM" onClick={() => toggleWindow('vm')} />
                  <StartMenuItem icon={<Monitor size={16} className="text-green-500" />} label="3D Maze" onClick={() => toggleWindow('maze3d')} />
                  <StartMenuItem icon={<Monitor size={16} className="text-blue-500" />} label="Mystify" onClick={() => toggleWindow('mystify')} />
                  <StartMenuItem icon={<Monitor size={16} className="text-yellow-500" />} label="3D Pipes" onClick={() => toggleWindow('pipes3d')} />
                  <StartMenuItem icon={<Monitor size={16} className="text-white" />} label="Starfield" onClick={() => toggleWindow('starfield')} />
                  <StartMenuItem icon={<Monitor size={16} className="text-pink-500" />} label="Bouncing Box" onClick={() => toggleWindow('bouncingbox')} />
                  <StartMenuItem icon={<History size={16} className="text-orange-500" />} label="sys-anti-update" onClick={() => toggleWindow('antiupdate')} />
                  {isKeo && (
                    <StartMenuItem icon={<Bug size={16} className="text-red-500" />} label="Dev Tools" onClick={() => toggleWindow('devtools')} />
                  )}
                  <StartMenuItem icon={<Globe size={16} />} label="VC Explorer" onClick={() => toggleWindow('search')} />
                  <StartMenuItem icon={<Gamepad2 size={16} />} label="Snake" onClick={() => toggleWindow('snake')} />
                  <StartMenuItem icon={<Gamepad2 size={16} />} label="Pong" onClick={() => toggleWindow('pong')} />
                </div>
              )}

              <StartMenuItem icon={<Folder size={16} className="text-yellow-600" />} label="Documents" onClick={() => toggleWindow('docs')} />
              <StartMenuItem icon={<HardDrive size={16} />} label="File Manager" onClick={() => toggleWindow('fileman')} />
              <StartMenuItem icon={<Settings size={16} />} label="Settings" onClick={() => toggleWindow('sys')} />
              <StartMenuItem icon={<Search size={16} />} label="Find" onClick={() => toggleWindow('find')} />
              <StartMenuItem icon={<HelpCircle size={16} />} label="Help" onClick={() => toggleWindow('help')} />
              <StartMenuItem 
                icon={<Download size={16} className="text-green-600" />} 
                label="Download for Linux" 
                onClick={async () => {
                  kernel.emitEvent('TASK', 'ISO_MASTER: STARTING_BAREMETAL_EXPORT');
                  try {
                    vfs.make();
                    await libarchive.writeArchive('vcos_bootable.iso', ['kernel.bin', 'boot.s', 'linker.ld', 'gdt.cpp', 'idt.cpp'], 'iso');
                    kernel.emitEvent('TASK', 'ISO_MASTER: EXPORT_SUCCESS');
                  } catch (e) {
                    kernel.emitEvent('CRITICAL', 'ISO_MASTER: EXPORT_FAILED');
                  }
                }} 
              />
              <div className="h-px bg-win95-dark-gray my-1 mx-1" />
              {currentUser && currentUser !== 'Guest' && (
                <StartMenuItem 
                  icon={isSaving ? <div className="w-4 h-4 border-2 border-win95-dark-gray border-t-transparent rounded-full animate-spin" /> : <Save size={16} />} 
                  label="Save State" 
                  onClick={saveSystemState} 
                />
              )}
              <StartMenuItem 
                icon={<Power size={16} className="text-win95-dark-gray" />} 
                label={`Log Off ${currentUser}...`} 
                onClick={() => {
                  localStorage.removeItem('vcos_username');
                  setCurrentUser(null);
                  auth.signOut();
                  setIsLoaded(false);
                  setShowStartMenu(false);
                }} 
              />
              <StartMenuItem icon={<Power size={16} className="text-red-600" />} label="Shut Down..." onClick={triggerRSOD} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RSOD Overlay */}
      <AnimatePresence>
        {isCrashing && (
          <RSOD onRestart={() => window.location.reload()} />
        )}
      </AnimatePresence>

      {/* Subtle Framebuffer Effect */}
      <Framebuffer isCrashing={isCrashing} />

      {/* Scanline Effect */}
      {!performanceMode && (
        <div className="fixed inset-0 pointer-events-none z-[30000] opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      )}
      <BackgroundMusic />
    </motion.div>
  );
}

// Helper Components
const DesktopIcon: React.FC<{ icon: React.ReactNode, label: string, onClick: () => void }> = ({ icon, label, onClick }) => (
  <div 
    className="w-16 sm:w-20 flex flex-col items-center gap-1 cursor-pointer group select-none active:scale-95 transition-transform"
    onClick={onClick}
  >
    <div className="p-1.5 sm:p-2 group-hover:bg-win95-blue/30 rounded-sm transition-colors flex items-center justify-center">
      {icon}
    </div>
    <span className="text-white text-[10px] sm:text-[11px] text-center leading-tight drop-shadow-md px-1 group-hover:bg-win95-blue break-words line-clamp-2 max-w-full">
      {label}
    </span>
  </div>
);

const StartMenuItem: React.FC<{ icon: React.ReactNode, label: string, onClick: () => void }> = ({ icon, label, onClick }) => (
  <div 
    className="flex items-center gap-2.5 sm:gap-3 px-3 py-1.5 hover:bg-win95-blue hover:text-white cursor-pointer text-xs sm:text-sm active:bg-win95-blue/80"
    onClick={onClick}
  >
    <div className="flex-shrink-0">{icon}</div>
    <span className="truncate">{label}</span>
  </div>
);
