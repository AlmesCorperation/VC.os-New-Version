export class ProcessManager {
  constructor() {
    this.processes = new Map();
    this.nextPid = 1000;
  }

  spawn(name) {
    const pid = this.nextPid++;
    this.processes.set(pid, { pid, name, status: 'running' });
    console.log(`Process ${name} spawned with PID ${pid}`);
    return pid;
  }

  kill(pid) {
    const proc = this.processes.get(pid);
    if (proc) {
      proc.status = 'terminated';
      this.processes.delete(pid);
    }
  }
}
