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

export function resolveDeep(value: Value): Value {
  switch (value.tag) {
    case "string":
    case "number":
    case "fresh":
      return value;
    case "box":
      return {
        tag: "box",
        id: value.id,
        args: value.args.map((arg) => resolveDeep(arg)),
      };
    case "var":
      // TODO: do I want to create new facts when these hit bottom?
      if (value.tag === "var" && value.fact.value.tag !== "fresh") {
        return resolveDeep(value.fact.value);
      }
      return value;
  }
}
export function resolveVar(value: Value): Value {
  if (value.tag === "var" && value.fact.value.tag !== "fresh") {
    return resolveVar(value.fact.value);
  }
  return value;
}

class Trail {
  constructor(
    private trail: Array<{ fact: Fact; prev: Value }> = [],
    private lastSave: number = 0,
  ) {}
  fresh(name: string) {
    const f = {
      value: fresh,
      gen: this.trail.length,
      name,
    } as const;
    return f;
  }
  choice(): number {
    const prev = this.lastSave;
    this.lastSave = this.trail.length;
    return prev;
  }
  backtrack(prev: number) {
    for (let i = this.trail.length - 1; i >= this.lastSave; --i) {
      const { fact, prev } = this.trail[i];
      fact.value = prev;
    }
    this.trail.length = this.lastSave;
    this.lastSave = prev;
  }
  cut(prev: number) {
    this.trail.length = this.lastSave;
    this.lastSave = prev;
  }
  push(fact: Fact) {
    if (fact.gen <= this.lastSave) {
      this.trail.push({ fact, prev: fact.value });
    }
  }
}

export class State {
  private constructor(
    public pm: ProcessManager,
    public scope: Record<string, Fact>,
    public context: Record<string, Value>,
    public readonly pid: Pid,
    private trail: Array<{ fact: Fact; prev: Value }>,
    private lastSave: number,
    private t: Trail,
  ) {}
  static init(pm: ProcessManager, pid: Pid) {
    return new State(pm, {}, {}, pid, [], 0, new Trail());
  }
  result() {
    return { tag: "result", result: this } as const;
  }
  receive(pattern: Value) {
    return { tag: "receive", to: this, pattern } as const;
  }
  withContext(ctx: string, value: Value): State {
    return new State(
      this.pm,
      this.scope,
      { ...this.context, [ctx]: value },
      this.pid,
      this.trail,
      this.lastSave,
      this.t,
    );
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
  backtrack(prev: number) {
    for (let i = this.trail.length - 1; i >= this.lastSave; --i) {
      const { fact, prev } = this.trail[i];
      fact.value = prev;
    }
    this.trail.length = this.lastSave;
    this.lastSave = prev;
  }
  cut(prev: number) {
    this.trail.length = this.lastSave;
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
    // if (left.tag === "var" && right.tag == "var") {
    //   if (left.fact.gen >= right.fact.gen) {
    //     return this.unifyFact(left.fact, right);
    //   } else {
    //     return this.unifyFact(right.fact, left);
    //   }
    // }

    // if these go in the opposite order, form elements dont update correctly
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
    const { id, args, params, restParams, body } = this.getRule(value);
    if (this.pm.rulePrimitives[id]) {
      yield* this.pm.rulePrimitives[id](
        this,
        ...args.map((arg) => resolveVar(arg)),
      );
      return;
    }

    const nextState = new State(
      this.pm,
      {},
      this.context,
      this.pid,
      this.trail,
      this.lastSave,
      this.t,
    );
    for (let i = 0; i < params.length; i++) {
      if (!nextState.unify(args[i], nextState.exprValue(params[i]))) return;
    }
    if (restParams) {
      if (
        !nextState.unify(
          box("", args.slice(params.length)),
          nextState.exprValue(restParams),
        )
      ) {
        return;
      }
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
        e.trace.push(k(id));
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
    if (rule.rule__rest_params && rule.rule__params.args.length > args.length) {
      throw new Exception(
        box("invalid_variadic_arity", [
          k(rule.rule__params.args.length),
          value,
        ]),
      );
    } else if (
      !rule.rule__rest_params &&
      rule.rule__params.args.length !== args.length
    ) {
      throw new Exception(
        box("invalid_arity", [k(rule.rule__params.args.length), value]),
      );
    }

    return {
      id,
      args,
      params: rule.rule__params.args,
      restParams: rule.rule__rest_params ?? null,
      body: rule.rule__body ?? s.ok(),
    };
  }
}

type Pid = number | string;
type Process =
  | { tag: "init"; mailbox: Value[] }
  | {
      tag: "suspended";
      mailbox: Value[];
      next: IteratorResult<Proc>;
      gen: ProcGen;
    }
  | { tag: "external"; mailbox: Value[]; eventSource: EventSource<Value> };

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
}

export class ProcessManager {
  private nextPid = 0;
  constructor(
    public db: TransactDB<Rec>,
    public rulePrimitives: Record<string, RulePrimitive>,
    public processes: Map<Pid, Process>,
    public runQueue: RunQueue,
  ) {}
  static init(
    db: TransactDB<Rec>,
    rulePrimitives: Record<string, RulePrimitive>,
  ) {
    return new ProcessManager(db, rulePrimitives, new Map(), new RunQueue());
  }
  addExternal(eventSource: EventSource<Value>, pid: Pid = this.nextPid++): Pid {
    this.processes.set(pid, { tag: "external", mailbox: [], eventSource });
    return pid;
  }
  send(pid: Pid, message: Value) {
    const process = this.processes.get(pid);
    if (!process) throw new Error("todo");
    process.mailbox.push(message);
    this.runQueue.enqueue(pid);
  }
  sendAsync(pid: Pid, message: Value) {
    this.send(pid, message);
    setTimeout(() => this.runAllQueued(), 1);
  }
  runExpr(goal: Expr, pid: Pid = this.nextPid++): Pid {
    this.processes.set(pid, { tag: "init", mailbox: [] });

    const state = State.init(this, pid);
    const parsed = state.exprValue(goal);
    const gen = state.eval(parsed);
    const next = gen.next();
    this.runUntilSuspend(pid, next, gen);
    this.runAllQueued();
    return pid;
  }
  spawn(goal: Value, pid: Pid = this.nextPid++): Pid {
    this.processes.set(pid, { tag: "init", mailbox: [] });

    const state = State.init(this, pid);
    const gen = state.eval(goal);
    const next = gen.next();
    this.runUntilSuspend(pid, next, gen);
    return pid;
  }
  private runAllQueued() {
    while (true) {
      const pid = this.runQueue.dequeue();
      if (pid == null) return;
      const process = this.processes.get(pid);
      if (!process) {
        throw new Error(`missing process ${pid}`);
      }
      switch (process.tag) {
        case "init":
          throw new Error("todo");
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
          next = gen.next(next.value.to);
          continue;
        }

        const { mailbox } = this.processes.get(pid)!;
        this.processes.set(pid, { tag: "suspended", mailbox, gen, next });
        return;
      } else {
        next = gen.next();
      }
    }
    this.processes.delete(pid);
  }
  private receive(pid: Pid, it: State, pattern: Value): boolean {
    const p = this.processes.get(pid)!;
    const nextMailbox: Value[] = [];

    for (const [i, message] of p.mailbox.entries()) {
      const s = it.choice();
      if (it.unify(pattern, message)) {
        nextMailbox.push(...p.mailbox.slice(i + 1));
        p.mailbox = nextMailbox;
        return true;
      }
      it.backtrack(s);
    }
    p.mailbox = nextMailbox;
    return false;
  }
}
