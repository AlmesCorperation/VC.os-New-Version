import { VideoModeInfo } from './types';

// Default 256-color VGA DAC Palette (standard Mode 13h)
const DEFAULT_VGA_PALETTE: [number, number, number][] = [];

// Initialize standard VGA 16 base colors + 216 color cube + 24 greyscale shades
(() => {
  const base16: [number, number, number][] = [
    [0, 0, 0],       // 0: Black
    [0, 0, 170],     // 1: Blue
    [0, 170, 0],     // 2: Green
    [0, 170, 170],   // 3: Cyan
    [170, 0, 0],     // 4: Red
    [170, 0, 170],   // 5: Magenta
    [170, 85, 0],    // 6: Brown
    [170, 170, 170], // 7: Light Gray
    [85, 85, 85],    // 8: Dark Gray
    [85, 85, 255],   // 9: Light Blue
    [85, 255, 85],   // 10: Light Green
    [85, 255, 255],  // 11: Light Cyan
    [255, 85, 85],   // 12: Light Red
    [255, 85, 255],  // 13: Light Magenta
    [255, 255, 85],  // 14: Yellow
    [255, 255, 255], // 15: White
  ];
  base16.forEach(c => DEFAULT_VGA_PALETTE.push(c));

  // 216 Color Cube (6x6x6)
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        DEFAULT_VGA_PALETTE.push([
          Math.floor((r * 255) / 5),
          Math.floor((g * 255) / 5),
          Math.floor((b * 255) / 5)
        ]);
      }
    }
  }

  // Greyscale 24 levels
  for (let i = 0; i < 24; i++) {
    const v = Math.floor((i * 255) / 23);
    DEFAULT_VGA_PALETTE.push([v, v, v]);
  }
})();

export class VirtualGPU {
  public vram: Uint8Array; // 128KB VGA VRAM (0xA0000 - 0xBFFFF)
  public palette: [number, number, number][] = [];
  public currentMode: number = 0x13; // Mode 13h (320x200, 256 colors)
  public width: number = 320;
  public height: number = 200;
  public isTextMode: boolean = false;

  public get mode(): number {
    return this.currentMode;
  }

  public set mode(val: number) {
    this.setMode(val);
  }
  
  // DAC registers
  private dacWriteIndex: number = 0;
  private dacWriteSubIndex: number = 0; // 0=R, 1=G, 2=B
  private dacPendingColor: [number, number, number] = [0, 0, 0];

  // Text Mode Buffer (80x25 = 2000 chars * 2 bytes = 4000 bytes)
  public textBuffer: Uint8Array = new Uint8Array(4000);
  public cursorX: number = 0;
  public cursorY: number = 0;
  public cursorVisible: boolean = true;

  // Frame statistics
  public fps: number = 60;
  private frameCount: number = 0;
  private lastFpsCheck: number = Date.now();

  // CRT Shader options
  public scanlinesEnabled: boolean = true;
  public phosphorGlow: boolean = true;
  public crtCurvature: boolean = false;

  private listeners: Set<() => void> = new Set();

  constructor() {
    this.vram = new Uint8Array(128 * 1024); // 128 KB
    this.resetPalette();
    this.initDefaultScreen();
  }

  public resetPalette() {
    this.palette = DEFAULT_VGA_PALETTE.map(c => [...c] as [number, number, number]);
  }

  public setMode(mode: number) {
    this.currentMode = mode;
    if (mode === 0x03) {
      // 80x25 Text Mode
      this.width = 640;
      this.height = 400;
      this.isTextMode = true;
    } else if (mode === 0x13) {
      // 320x200 256 Color Mode
      this.width = 320;
      this.height = 200;
      this.isTextMode = false;
    } else if (mode === 0x12) {
      // 640x480 High-Res
      this.width = 640;
      this.height = 480;
      this.isTextMode = false;
    }
    this.notify();
  }

  public getModeInfo(): VideoModeInfo {
    switch (this.currentMode) {
      case 0x03:
        return { mode: 0x03, width: 80, height: 25, colors: 16, isText: true, bpp: 4, name: '80x25 16-Color Text Mode' };
      case 0x13:
        return { mode: 0x13, width: 320, height: 200, colors: 256, isText: false, bpp: 8, name: '320x200 256-Color VGA Mode 13h' };
      case 0x12:
        return { mode: 0x12, width: 640, height: 480, colors: 16, isText: false, bpp: 4, name: '640x480 16-Color VGA Mode 12h' };
      default:
        return { mode: this.currentMode, width: this.width, height: this.height, colors: 256, isText: this.isTextMode, bpp: 8, name: 'Custom VGA Mode' };
    }
  }

  public clear(colorIndex: number = 0) {
    this.vram.fill(colorIndex);
    this.textBuffer.fill(0);
    this.cursorX = 0;
    this.cursorY = 0;
    this.notify();
  }

  public setPixel(x: number, y: number, colorIndex: number) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const offset = y * this.width + x;
    if (offset < this.vram.length) {
      this.vram[offset] = colorIndex & 0xFF;
    }
  }

  public getPixel(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
    const offset = y * this.width + x;
    return offset < this.vram.length ? this.vram[offset] : 0;
  }

  public drawRect(x: number, y: number, w: number, h: number, colorIndex: number, filled: boolean = true) {
    if (filled) {
      for (let cy = y; cy < y + h; cy++) {
        for (let cx = x; cx < x + w; cx++) {
          this.setPixel(cx, cy, colorIndex);
        }
      }
    } else {
      for (let cx = x; cx < x + w; cx++) {
        this.setPixel(cx, y, colorIndex);
        this.setPixel(cx, y + h - 1, colorIndex);
      }
      for (let cy = y; cy < y + h; cy++) {
        this.setPixel(x, cy, colorIndex);
        this.setPixel(x + w - 1, cy, colorIndex);
      }
    }
  }

  public drawLine(x0: number, y0: number, x1: number, y1: number, colorIndex: number) {
    // Bresenham's line algorithm
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let cx = x0;
    let cy = y0;

    while (true) {
      this.setPixel(cx, cy, colorIndex);
      if (cx === x1 && cy === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
    }
  }

  public bitBlt(destX: number, destY: number, srcData: Uint8Array, srcW: number, srcH: number) {
    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const pixel = srcData[y * srcW + x];
        if (pixel !== 0) { // 0 = transparent in simple blitter
          this.setPixel(destX + x, destY + y, pixel);
        }
      }
    }
  }

  // Text Mode helpers
  public writeTextChar(x: number, y: number, charCode: number, attr: number = 0x07) {
    if (x < 0 || x >= 80 || y < 0 || y >= 25) return;
    const offset = (y * 80 + x) * 2;
    this.textBuffer[offset] = charCode & 0xFF;
    this.textBuffer[offset + 1] = attr & 0xFF;
  }

  public printText(text: string, attr: number = 0x07) {
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      if (ch === 10) { // \n
        this.cursorX = 0;
        this.cursorY++;
      } else if (ch === 13) { // \r
        this.cursorX = 0;
      } else {
        this.writeTextChar(this.cursorX, this.cursorY, ch, attr);
        this.cursorX++;
        if (this.cursorX >= 80) {
          this.cursorX = 0;
          this.cursorY++;
        }
      }
      if (this.cursorY >= 25) {
        // Scroll text up
        this.scrollTextUp();
        this.cursorY = 24;
      }
    }
  }

  public scrollTextUp() {
    this.textBuffer.copyWithin(0, 80 * 2, 80 * 25 * 2);
    // Clear last line
    for (let i = 80 * 24 * 2; i < 80 * 25 * 2; i += 2) {
      this.textBuffer[i] = 32; // space
      this.textBuffer[i + 1] = 0x07; // default grey on black
    }
  }

  // I/O Ports for VGA
  public handleIOWrite(port: number, value: number) {
    if (port === 0x3C8) {
      // DAC Address Write Mode Register
      this.dacWriteIndex = value & 0xFF;
      this.dacWriteSubIndex = 0;
    } else if (port === 0x3C9) {
      // DAC Data Register (6-bit RGB component 0..63 -> scaled to 0..255)
      const scaledVal = Math.min(255, Math.floor(((value & 0x3F) * 255) / 63));
      if (this.dacWriteSubIndex === 0) {
        this.dacPendingColor[0] = scaledVal;
        this.dacWriteSubIndex = 1;
      } else if (this.dacWriteSubIndex === 1) {
        this.dacPendingColor[1] = scaledVal;
        this.dacWriteSubIndex = 2;
      } else {
        this.dacPendingColor[2] = scaledVal;
        this.palette[this.dacWriteIndex] = [...this.dacPendingColor];
        this.dacWriteIndex = (this.dacWriteIndex + 1) & 0xFF;
        this.dacWriteSubIndex = 0;
      }
    }
  }

  public handleIORead(port: number): number {
    if (port === 0x3DA) {
      // Input Status #1 Register: Bit 3 = Vertical Retrace active
      return (Date.now() % 16 < 2) ? 0x08 : 0x00;
    }
    return 0xFF;
  }

  // Render to standard 2D Canvas context or HTMLCanvasElement
  public renderToCanvas(target: HTMLCanvasElement | CanvasRenderingContext2D, targetWidth?: number, targetHeight?: number) {
    let ctx: CanvasRenderingContext2D | null = null;
    let w = targetWidth;
    let h = targetHeight;

    if (target instanceof HTMLCanvasElement) {
      ctx = target.getContext('2d');
      if (!w) w = target.width;
      if (!h) h = target.height;
    } else {
      ctx = target;
    }

    if (!ctx) return;
    const finalW = w || 320;
    const finalH = h || 200;

    this.frameCount++;
    const now = Date.now();
    if (now - this.lastFpsCheck >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsCheck = now;
    }

    if (this.isTextMode) {
      this.renderTextMode(ctx, finalW, finalH);
    } else {
      this.renderGraphicsMode(ctx, finalW, finalH);
    }
  }

  private renderGraphicsMode(ctx: CanvasRenderingContext2D, targetWidth: number, targetHeight: number) {
    const imgData = ctx.createImageData(this.width, this.height);
    const data = imgData.data;

    for (let i = 0; i < this.width * this.height; i++) {
      const colorIdx = this.vram[i];
      const color = this.palette[colorIdx] || [0, 0, 0];
      const ptr = i * 4;
      data[ptr] = color[0];
      data[ptr + 1] = color[1];
      data[ptr + 2] = color[2];
      data[ptr + 3] = 255;
    }

    // Temporary offscreen canvas for scaling
    const offscreen = document.createElement('canvas');
    offscreen.width = this.width;
    offscreen.height = this.height;
    const offCtx = offscreen.getContext('2d');
    if (offCtx) {
      offCtx.putImageData(imgData, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(offscreen, 0, 0, targetWidth, targetHeight);
    }

    if (this.scanlinesEnabled) {
      this.applyScanlines(ctx, targetWidth, targetHeight);
    }
  }

  private renderTextMode(ctx: CanvasRenderingContext2D, targetWidth: number, targetHeight: number) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    const cellW = targetWidth / 80;
    const cellH = targetHeight / 25;
    ctx.font = `bold ${Math.max(10, Math.floor(cellH * 0.75))}px "Courier New", monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.imageSmoothingEnabled = true;

    for (let y = 0; y < 25; y++) {
      for (let x = 0; x < 80; x++) {
        const offset = (y * 80 + x) * 2;
        const charCode = this.textBuffer[offset] || 32;
        const attr = this.textBuffer[offset + 1] || 0x07;
        const fgIdx = attr & 0x0F;
        const bgIdx = (attr >> 4) & 0x07;

        const fgColor = this.palette[fgIdx] || [170, 170, 170];
        const bgColor = this.palette[bgIdx] || [0, 0, 0];

        const cx = x * cellW;
        const cy = y * cellH;

        if (bgIdx !== 0) {
          ctx.fillStyle = `rgb(${bgColor[0]},${bgColor[1]},${bgColor[2]})`;
          ctx.fillRect(cx, cy, cellW, cellH);
        }

        if (charCode !== 32) {
          ctx.fillStyle = `rgb(${fgColor[0]},${fgColor[1]},${fgColor[2]})`;
          ctx.fillText(String.fromCharCode(charCode), cx + cellW / 2, cy + cellH / 2);
        }
      }
    }

    if (this.scanlinesEnabled) {
      this.applyScanlines(ctx, targetWidth, targetHeight);
    }
  }

  private applyScanlines(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    for (let y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }
  }

  private initDefaultScreen() {
    // Generate an authentic retro OS boot splash on Mode 13h
    this.clear(0);
    // Draw decorative border
    this.drawRect(0, 0, 320, 200, 1, false);
    this.drawRect(1, 1, 318, 198, 9, false);

    // Draw header banner
    this.drawRect(2, 2, 316, 16, 1, true);

    // Draw grid pattern in center
    for (let y = 30; y < 180; y += 10) {
      this.drawLine(20, y, 300, y, 8);
    }
    for (let x = 20; x <= 300; x += 20) {
      this.drawLine(x, 30, x, 180, 8);
    }

    // Draw center logo / palette bar
    for (let i = 0; i < 256; i++) {
      const bx = 32 + (i % 32) * 8;
      const by = 50 + Math.floor(i / 32) * 12;
      this.drawRect(bx, by, 7, 10, i, true);
    }
  }

  public subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }
}
