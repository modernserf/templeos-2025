import { Facts } from "./facts";
import { Pid, ProcessGen } from "./process_manager";
import { Value, Exception, k, box } from "./value";

function unknownContext(ctx: Value) {
  throw new Exception(box("unknown_context", [ctx]));
}

export interface IProcessManager {
  send(pid: Pid, message: Value): void;
  sendAsync(pid: Pid, message: Value): void;
  spawn(goal: Value): Pid;
  eval(it: Process, value: Value): ProcessGen;
}

export class Process {
  private constructor(
    public readonly processManager: IProcessManager,
    public pid: Pid,
    private facts: Facts,
    private context: Record<string, Value>,
  ) {}
  static init(pm: IProcessManager, pid: Pid) {
    return new Process(pm, pid, Facts.init(), {});
  }
  result() {
    return { tag: "result", result: this as Process } as const;
  }
  receive(pattern: Value) {
    return { tag: "receive", to: this as Process, pattern } as const;
  }
  unify(l: Value, r: Value): boolean {
    return this.facts.unify(l, r);
  }
  dif(l: Value, r: Value): boolean {
    return this.facts.dif(l, r);
  }
  getContext(key: string) {
    return this.context[key] ?? unknownContext(k(key));
  }
  setContext(key: string, value: Value): Process {
    return new Process(
      this.processManager,
      this.pid,
      this.facts,

      { ...this.context, [key]: value },
    );
  }
  fork() {
    return new Process(
      this.processManager,
      this.pid,
      this.facts.fork(),
      this.context,
    );
  }
  resolve(value: Value) {
    return this.facts.resolve(value);
  }
  resolveVar(value: Value) {
    return this.facts.resolveVar(value);
  }
  eval(value: Value) {
    return this.processManager.eval(this, value);
  }
}
