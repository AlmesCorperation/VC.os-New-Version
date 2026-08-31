export class WindowManager {
  constructor() {
    this.windows = new Map();
    this.nextZIndex = 100;
  }

  createWindow(id, title) {
    const win = {
      id,
      title,
      x: 50,
      y: 50,
      width: 400,
      height: 300,
      zIndex: this.nextZIndex++
    };
    this.windows.set(id, win);
    return win;
  }

  bringToFront(id) {
    const win = this.windows.get(id);
    if (win) {
      win.zIndex = this.nextZIndex++;
    }
  }

  getWindows() {
    return Array.from(this.windows.values()).sort((a, b) => a.zIndex - b.zIndex);
  }
}
