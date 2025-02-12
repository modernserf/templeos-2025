import { Rec } from "./data";
import { TransactDB } from "./db";
import {
  Interpreter,
  ProcessGen,
  ProcessNext,
  RulePrimitive,
} from "./interpreter";
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
    const interpreter = Interpreter.init(this.db, this.primitives, pid);
    const gen = interpreter.eval(goal);
    this.processes.set(pid, { mailbox: [], gen });
    this.runUntilSuspend(pid, gen);
    return pid;
  }
  private runUntilSuspend(pid: Pid, gen: ProcessGen) {
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
