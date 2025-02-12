import { Rec } from "./data";
import { TransactDB } from "./db";
import { Interpreter, ProcessNext, RulePrimitive } from "./interpreter";
import { State, Pid, Fail } from "./state2";
import { Value } from "./value2";

export class ProcessManager {
  constructor(
    private nextPid: Pid,
    private db: TransactDB<Rec>,
    private primitives: Record<string, RulePrimitive>,
    private processes: Map<
      Pid,
      {
        mailbox: Value[];
        gen: Generator<ProcessNext>;
      }
    >,
  ) {}
  send(pid: Pid, message: Value) {
    const process = this.processes.get(pid);
    if (!process) throw new Error("todo: missing process");
    process.mailbox.push(message);
  }
  *receive(state: State, pattern: Value) {
    while (true) {
      const process = this.processes.get(state.pid);
      if (!process) throw new Error("missing process");
      const nextMailbox: Value[] = [];

      for (const [i, message] of process.mailbox.entries()) {
        const ns = state.fork();
        try {
          ns.unify(pattern, message);
          yield { tag: "result", state: ns };
          nextMailbox.push(...process.mailbox.slice(i + 1));
          process.mailbox = nextMailbox;
          return;
        } catch (e) {
          if (e instanceof Fail) {
            nextMailbox.push(message);
            continue;
          }
          throw e;
        }
      }
      process.mailbox = nextMailbox;
      yield { tag: "suspend" };
    }
  }
  spawn(goal: Value): Pid {
    const pid = this.nextPid++;
    const child = State.init(pid);
    const interpreter = new Interpreter(this.db, this.primitives);
    const gen = interpreter.eval(child, goal);
    this.processes.set(pid, { mailbox: [], gen });
    this.runUntilSuspend(pid, gen);
    return pid;
  }
  private runUntilSuspend(
    pid: Pid,
    gen: Generator<ProcessNext, undefined, undefined>,
  ) {
    while (true) {
      const res = gen.next().value;
      if (!res) break;
      switch (res.tag) {
        case "suspend":
          this.processes.get(pid)!.gen = gen;
          return;
        case "result":
          continue;
      }
    }
  }
}
