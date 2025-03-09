import { Rec } from "./data";
import { TransactDB } from "./db";
import { EventSource } from "./event_source";
import { Expr, s } from "./expr";
import { Value, Fact, box, k, fresh, printValue } from "./value";

type Proc =
  | { tag: "result"; result: State }
  | { tag: "receive"; to: State; pattern: Value };
type ProcGen = Generator<Proc, void, State | undefined>;

export type RulePrimitive = (state: State, ...args: Value[]) => ProcGen;

export class Exception {
  constructor(public error: Value, public trace: Value[] = []) {}
  get message() {
    return printValue(this.error);
  }
}

export function ensure<T extends Value["tag"]>(
  value: Value,
  tag: T,
): asserts value is Value & { tag: T } {
  if (value.tag !== tag) {
    throw new Exception(box("expected_type", [k(tag), value]));
  }
}

export function ensurePid(
  pid: Value,
): asserts pid is Value & { tag: "string" | "number" } {
  if (pid.tag !== "number" && pid.tag !== "string")
    throw new Exception(box("expected_type", [k("pid"), pid]));
}

export function resolveDeep(
  value: Value,
  state = { map: new WeakMap<Fact, Fact>(), gen: 0 },
): Value {
  switch (value.tag) {
    case "string":
    case "number":
    case "fresh":
      return value;
    case "box":
      return {
        tag: "box",
        id: value.id,
        args: value.args.map((arg) => {
          if (!arg) console.error(value);
          return resolveDeep(arg, state);
        }),
      };
    case "var":
      if (value.tag === "var") {
        if (value.fact.value.tag === "fresh") {
          // make new copies of unbound vars that are distinct from parent scope
          const replaced = state.map.get(value.fact) ?? {
            name: value.fact.name,
            value: fresh,
            gen: 0,
          };
          state.map.set(value.fact, replaced);
          return { tag: "var", fact: replaced };
        } else {
          return resolveDeep(value.fact.value, state);
        }
      }
      return value;
    default:
      throw new Error("invalid value");
  }
}
export function resolveVar(value: Value): Value {
  if (value.tag === "var" && value.fact.value.tag !== "fresh") {
    return resolveVar(value.fact.value);
  }
  return value;
}

export class State {
  private constructor(
    public pm: ProcessManager,
    public scope: Record<string, Fact>,
    public readonly pid: Pid,
    private trail: Array<{ fact: Fact; prev: Value }>,
    private lastSave: number,
  ) {}
  static init(pm: ProcessManager, pid: Pid) {
    return new State(pm, {}, pid, [], 0);
  }
  result() {
    return { tag: "result", result: this } as const;
  }
  receive(pattern: Value) {
    return { tag: "receive", to: this, pattern } as const;
  }
  exprValue(expr: Expr, scope = this.scope): Value {
    switch (typeof expr) {
      case "string":
        return { tag: "string", value: expr };
      case "number":
        return { tag: "number", value: expr };
      case "object":
        switch (expr.tag) {
          case "placeholder":
            return fresh;
          case "ident":
            if (!scope[expr.ident]) {
              scope[expr.ident] = this.fresh(expr.ident);
            }
            return { tag: "var", fact: scope[expr.ident] };
          case "box":
            return {
              tag: "box",
              id: expr.id,
              args: expr.args.map((arg) => this.exprValue(arg, scope)),
            };
        }
    }
  }

  fresh(name: string) {
    return {
      value: fresh,
      gen: this.trail.length,
      name,
    };
  }
  choice(): number {
    const prev = this.lastSave;
    this.lastSave = this.trail.length;
    return prev;
  }
  cut(prev: number) {
    this.lastSave = prev;
  }
  backtrack(prev: number) {
    while (this.trail.length > this.lastSave) {
      const { fact, prev } = this.trail.pop()!;
      fact.value = prev;
    }
    this.lastSave = prev;
  }
  push(fact: Fact) {
    if (fact.gen <= this.lastSave) {
      this.trail.push({ fact, prev: fact.value });
    }
  }

  *unifyChoice(left: Value, right: Value): ProcGen {
    const s = this.choice();
    if (this.unify(left, right)) yield this.result();
    this.backtrack(s);
  }
  unify(left: Value, right: Value): boolean {
    if (left.tag === "fresh" || right.tag === "fresh") return true;
    // makes ident_var work correctly
    if (left.tag === "var" && right.tag == "var") {
      if (left.fact.gen >= right.fact.gen) {
        return this.unifyFact(left.fact, right);
      } else {
        return this.unifyFact(right.fact, left);
      }
    }

    if (left.tag === "var") return this.unifyFact(left.fact, right);
    if (right.tag === "var") return this.unifyFact(right.fact, left);

    if (left.tag === "string" && right.tag === "string")
      return left.value === right.value;
    if (left.tag === "number" && right.tag === "number")
      return left.value === right.value;
    if (
      left.tag === "box" &&
      right.tag === "box" &&
      left.id === right.id &&
      left.args.length === right.args.length
    ) {
      for (let i = 0; i < left.args.length; i++) {
        if (!this.unify(left.args[i], right.args[i])) return false;
      }
      return true;
    }
    return false;
  }
  private unifyFact(fact: Fact, value: Value): boolean {
    switch (fact.value.tag) {
      case "fresh":
        this.push(fact);
        fact.value = value;
        return true;
      case "var":
        return this.unifyFact(fact.value.fact, value);
      default:
        return this.unify(fact.value, value);
    }
  }

  *eval(value: Value): ProcGen {
    value = resolveVar(value);
    const { id, args, params, body } = this.getRule(value);
    if (this.pm.rulePrimitives[id]) {
      try {
        yield* this.pm.rulePrimitives[id](
          this,
          ...args.map((arg) => resolveVar(arg)),
        );
        return;
      } catch (e) {
        if (e instanceof Exception) {
          e.trace.push(box(id, args));
        }
        throw e;
      }
    }

    const nextState = new State(
      this.pm,
      {},
      this.pid,
      this.trail,
      this.lastSave,
    );
    const ps = nextState.exprValue(params);
    const as = box("", args);
    if (!nextState.unify(ps, as)) {
      throw new Exception(box("invalid_call", [k(id), ps, as]));
    }

    try {
      const gen = nextState.eval(nextState.exprValue(body));
      let next = gen.next();
      while (!next.done) {
        if (next.value.tag === "result") {
          next = gen.next(yield { tag: "result", result: this });
        } else {
          next = gen.next(yield next.value);
        }
      }
    } catch (e) {
      if (e instanceof Exception) {
        e.trace.push(box(id, args));
      }
      throw e;
    }
  }
  private getRule(value: Value) {
    if (value.tag !== "box") throw new Exception(box("not_a_rule", [value]));
    const { id, args } = value;

    const rule = this.pm.db.get(id);
    if (!rule) throw new Exception(box("unknown_rule", [value]));

    if (!rule.rule__params) throw new Exception(box("invalid_rule", [value]));

    return {
      id,
      args,
      params: rule.rule__params,
      body: rule.rule__body ?? s.ok(),
    };
  }
}

type ProcessFlags = {
  trapExit: boolean;
};

type Pid = number | string;
type Process =
  | { tag: "init"; mailbox: Value[]; flags: ProcessFlags }
  | {
      tag: "suspended";
      mailbox: Value[];
      next: IteratorResult<Proc>;
      gen: ProcGen;
      flags: ProcessFlags;
    }
  | {
      tag: "external";
      mailbox: Value[];
      eventSource: EventSource<Value>;
      flags: ProcessFlags;
    };

class RunQueue {
  private queue: Pid[] = [];
  private set: Set<Pid> = new Set();
  enqueue(pid: Pid) {
    if (this.set.has(pid)) return;
    this.queue.push(pid);
    this.set.add(pid);
  }
  dequeue(): Pid | null {
    const pid = this.queue.shift();
    if (pid === undefined) return null;
    this.set.delete(pid);
    return pid;
  }
  cleanup(pid: Pid) {
    if (!this.set.has(pid)) return;
    this.queue = this.queue.filter((p) => p !== pid);
    this.set.delete(pid);
  }
}

export class ProcessManager {
  private nextPid = 0;
  constructor(
    public db: TransactDB<Rec>,
    public rulePrimitives: Record<string, RulePrimitive>,
    public processes: Map<Pid, Process>,
    public runQueue: RunQueue,
    private links: Map<Pid, Set<Pid>>,
  ) {}
  static init(
    db: TransactDB<Rec>,
    rulePrimitives: Record<string, RulePrimitive>,
  ) {
    return new ProcessManager(
      db,
      rulePrimitives,
      new Map(),
      new RunQueue(),
      new Map(),
    );
  }
  addExternal(eventSource: EventSource<Value>, pid: Pid = this.nextPid++): Pid {
    this.processes.set(pid, {
      tag: "external",
      mailbox: [],
      eventSource,
      flags: { trapExit: false },
    });
    return pid;
  }
  send(pid: Pid, message: Value) {
    const process = this.processes.get(pid);
    // TODO: is missing process error useful? do we want try_send vs send?
    if (!process) return;
    // throw new Exception(box("missing_process", [k(pid), message]));
    process.mailbox.push(message);
    this.runQueue.enqueue(pid);
  }
  sendAsync(pid: Pid, message: Value) {
    this.send(pid, message);
    this.runAllQueued();
  }
  getPid() {
    return this.nextPid++;
  }
  spawn(goal: Value, pid: Pid = this.nextPid++, linkTo?: Pid): Pid {
    this.processes.set(pid, {
      tag: "init",
      mailbox: [],
      flags: { trapExit: false },
    });
    if (linkTo != null) {
      this.link(linkTo, pid);
    }

    const state = State.init(this, pid);
    const gen = state.eval(resolveDeep(goal));
    const next = gen.next();
    this.runUntilSuspend(pid, next, gen);
    this.runAllQueued();
    return pid;
  }
  private runAllQueued() {
    while (true) {
      const pid = this.runQueue.dequeue();
      if (pid == null) return;
      const process = this.processes.get(pid)!;
      switch (process.tag) {
        case "init":
          continue;
        case "suspended":
          this.runUntilSuspend(pid, process.next, process.gen);
          continue;
        case "external":
          this.runExternal(pid, process.eventSource);
          continue;
      }
    }
  }
  private runExternal(pid: Pid, eventSource: EventSource<Value>) {
    const p = this.processes.get(pid)!;
    for (const message of p.mailbox) {
      eventSource.notifyEventListeners(message);
    }
    p.mailbox = [];
  }

  private runUntilSuspend(pid: Pid, next: IteratorResult<Proc>, gen: ProcGen) {
    while (!next.done) {
      if (next.value.tag === "receive") {
        if (this.receive(pid, next.value.to, next.value.pattern)) {
          if (
            this.catchExit(pid, () => {
              next = gen.next(next.value.to);
            })
          ) {
            continue;
          } else {
            return;
          }
        }

        const { mailbox, flags } = this.processes.get(pid)!;
        this.processes.set(pid, {
          tag: "suspended",
          mailbox,
          gen,
          next,
          flags,
        });
        return;
      } else {
        if (
          this.catchExit(pid, () => {
            next = gen.next();
          })
        ) {
          continue;
        } else {
          return;
        }
      }
    }
    this.exitNormal(pid);
    this.deleteProcess(pid);
  }
  private catchExit(pid: Pid, fn: () => void): boolean {
    try {
      fn();
      return true;
    } catch (e) {
      if (e instanceof Exception) {
        this.exit_(pid, pid, e.error, pid);
        return false;
      } else {
        throw e;
      }
    }
  }

  private deleteProcess(pid: Pid) {
    this.processes.delete(pid);
    this.runQueue.cleanup(pid);
    this.removeAllLinks(pid);
  }
  private receive(pid: Pid, it: State, pattern: Value): boolean {
    const p = this.processes.get(pid)!;
    const nextMailbox: Value[] = [];

    for (const [i, message] of p.mailbox.entries()) {
      const s = it.choice();
      if (it.unify(pattern, message)) {
        it.cut(s);
        nextMailbox.push(...p.mailbox.slice(i + 1));
        p.mailbox = nextMailbox;
        return true;
      } else {
        it.backtrack(s);
        nextMailbox.push(message);
      }
    }
    p.mailbox = nextMailbox;
    return false;
  }
  link(a: Pid, b: Pid) {
    this.addLink(a, b);
    this.addLink(b, a);
  }
  unlink(a: Pid, b: Pid) {
    this.removeLink(a, b);
    this.removeLink(b, a);
  }
  // currentProc is proc that sent exit (and should throw if it receives an exit)
  // initTarget is proc that received exit -- this pid is what's included in trapped error
  // target is proc that exit has propagated to via link
  exit(currentProc: Pid, initTarget: Pid, reason: Value, target = initTarget) {
    const proc = this.processes.get(target);
    if (!proc) return;
    if (proc.flags.trapExit) {
      this.send(target, box("exit", [k(initTarget), reason]));
      return;
    }
    if (currentProc === target) throw new Exception(reason);
    this.exit_(currentProc, initTarget, reason, target);
  }
  exitAsync(initTarget: Pid, reason: Value) {
    this.exit(0, initTarget, reason);
    this.runAllQueued();
  }
  private exitNormal(pid: Pid) {
    const links = this.links.get(pid) ?? new Set();
    this.deleteProcess(pid);
    for (const link of links) {
      if (this.processes.get(link)?.flags.trapExit) {
        this.send(link, box("exit", [k(pid), box("normal", [])]));
      }
    }
  }
  private exit_(currentProc: Pid, initTarget: Pid, reason: Value, target: Pid) {
    const links = this.links.get(target) ?? new Set();
    this.deleteProcess(target);
    for (const link of links) {
      this.exit(currentProc, initTarget, reason, link);
    }
  }
  private addLink(from: Pid, to: Pid) {
    const set = this.links.get(from) ?? new Set();
    set.add(to);
    this.links.set(from, set);
  }
  private removeLink(from: Pid, to: Pid) {
    const set = this.links.get(from);
    if (!set) return;
    set.delete(to);
  }
  private removeAllLinks(from: Pid) {
    const set = this.links.get(from) ?? new Set();
    for (const link of set) {
      this.removeLink(link, from);
    }
    this.links.delete(from);
  }
  flush(pid: Pid): Value[] {
    const p = this.processes.get(pid)!;
    const m = p.mailbox;
    p.mailbox = [];
    return m;
  }
  setFlags(pid: Pid, flags: Partial<ProcessFlags>) {
    Object.assign(this.processes.get(pid)!.flags, flags);
  }
}
