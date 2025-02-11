import { Exception, k, State, sv, Value } from "./state";

class Process {
  constructor(
    private parentState: State,
    private pattern: Value,
    private goal: Value,
  ) {}
  send(message: Value) {
    try {
      const ns = this.parentState.fork().unify(this.pattern, message);
      if (!ns) return;
      for (const _ of ns.eval(this.goal)) {
        //
      }
    } catch (e) {
      // TODO: propagate errors to spawning process
      console.error(e);
    }
  }
}

function unknownProcess(pid: string): never {
  throw new Exception(sv("unknown_process", k(pid)));
}

export class ProcessManager {
  private processes = new Map<string, Process>();
  send(pid: string, message: Value) {
    const process = this.processes.get(pid);
    if (!process) unknownProcess(pid);
    process.send(message);
  }
  close(pid: string) {
    if (!this.processes.delete(pid)) unknownProcess(pid);
  }
  spawn(parentState: State, pattern: Value, goal: Value): string {
    const pid = crypto.randomUUID();
    this.processes.set(pid, new Process(parentState, pattern, goal));
    return pid;
  }
}
