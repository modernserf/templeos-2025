import { Rec } from "../data";
import { TransactDB } from "../db";
import { EventSource } from "../event_source";
import { Expr, Ident, s } from "./expr";
import { Process } from "./process";
import { Value, FactId, Exception, box, k, ensure } from "./value";

export type Pid = number | string;

export type ProcessNext =
  | { tag: "result"; result: Process }
  | { tag: "receive"; to: Process; pattern: Value };
export type ProcessNextOf<T extends ProcessNext["tag"]> = ProcessNext & {
  tag: T;
};

export type ProcessGen = Generator<ProcessNext, void, Process | undefined>;

export type RulePrimitive = (
  interpreter: Process,
  ...args: Value[]
) => ProcessGen;

type SymbolTable = Record<Ident, FactId>;

function expected(expected: Value, received: Value) {
  throw new Exception(box("expected_received", [expected, received]));
}

type ProcessRecord =
  | {
      tag: "internal";
      next: IteratorResult<ProcessNext>;
      gen: Generator<ProcessNext>;
    }
  | { tag: "external"; eventSource: EventSource<Value> };

export class ProcessManager {
  constructor(
    private varCount: number,
    private nextPid: number,
    public db: TransactDB<Rec>,
    private primitives: Record<string, RulePrimitive>,
    private mailboxes: Map<Pid, Value[]>,
    private processes: Map<Pid, ProcessRecord>,
  ) {}
  static init(db: TransactDB<Rec>, primitives: Record<string, RulePrimitive>) {
    return new ProcessManager(0, 0, db, primitives, new Map(), new Map());
  }
  runExpr(expr: Expr) {
    const goal = this.exprValue(expr, {});
    return this.spawn(goal);
  }
  process(pid: Pid) {
    return Process.init(this, pid);
  }
  send(pid: Pid, message: Value) {
    const p = this.processes.get(pid)!;
    if (p.tag === "external") {
      p.eventSource.notifyEventListeners(message);
      return;
    }

    const mailbox = this.mailboxes.get(pid);
    if (!mailbox) throw new Error("missing process");
    mailbox.push(message);
  }
  sendAsync(pid: Pid, message: Value) {
    const p = this.processes.get(pid)!;
    this.send(pid, message);
    if (p.tag === "internal") {
      this.runUntilSuspend(pid, p.next, p.gen);
    }
  }
  addExternal(pid: Pid, eventSource: EventSource<Value>) {
    this.processes.set(pid, { tag: "external", eventSource });
  }
  spawn(goal: Value): Pid {
    const pid = this.nextPid++;
    this.mailboxes.set(pid, []);

    const proc = Process.init(this, pid);
    const gen = proc.eval(goal);
    const next = gen.next();
    this.processes.set(pid, { tag: "internal", next, gen });
    this.runUntilSuspend(pid, next, gen);
    return pid;
  }
  private runUntilSuspend(
    pid: Pid,
    next: IteratorResult<ProcessNext>,
    gen: ProcessGen,
  ) {
    while (!next.done) {
      if (next.value.tag === "receive") {
        const nextIt = this.receive(next.value.to, next.value.pattern);
        if (nextIt) {
          next = gen.next(nextIt);
        } else {
          Object.assign(this.processes.get(pid)!, { gen, next });
          return;
        }
      } else {
        next = gen.next();
      }
    }
    this.processes.delete(pid);
    this.mailboxes.delete(pid);
  }
  private receive(it: Process, pattern: Value): Process | null {
    const mailbox = this.mailboxes.get(it.pid);
    if (!mailbox) throw new Error("missing process");
    const nextMailbox: Value[] = [];

    for (const [i, message] of mailbox.entries()) {
      const ns = it.fork();
      if (ns.unify(pattern, message)) {
        nextMailbox.push(...mailbox.slice(i + 1));
        this.mailboxes.set(it.pid, nextMailbox);
        return ns;
      }
    }
    this.mailboxes.set(it.pid, nextMailbox);
    return null;
  }
  *eval(it: Process, value: Value): ProcessGen {
    value = it.resolveVar(value);
    ensure(value, "box");
    const id = value.id;
    const args = value.args.map((arg) => it.resolveVar(arg));

    // stateProfile.call(id);
    // try {
    const rule = this.db.get(id);
    if (!rule) throw new Exception(box("unknown_rule", [k(id)]));

    if (this.primitives[id]) {
      this.check_call(id, rule, args);
      yield* this.primitives[id](it, ...args);
      return;
    }

    const { params, body } = this.check_call(id, rule, args);

    const localSymbols: SymbolTable = {};

    if (rule.rule__rest_params) {
      const restParams = this.exprValue(rule.rule__rest_params, localSymbols);
      const restArgs = args.slice(params.length);
      if (!it.unify(restParams, box("", restArgs))) return;
    }

    for (let i = 0; i < params.length; i++) {
      const param = this.exprValue(params[i], localSymbols);
      const arg = args[i];
      if (!it.unify(param, arg)) return;
    }

    yield* this.eval(it, this.exprValue(body, localSymbols));
    // } finally {
    // stateProfile.return();
    // }
  }
  private check_call(
    id: string,
    rule: Rec,
    args: Value[],
  ): { params: Expr[]; body: Expr } {
    if (!rule.rule__params || (!rule.rule__body && !this.primitives[id])) {
      throw new Exception(box("invalid_rule", [k(id)]));
    }
    const params = rule.rule__params.args;
    if (params.length !== args.length && !rule.rule__rest_params) {
      expected(this.exprValue(s(id, ...params), {}), box(id, args));
    }
    return { params, body: rule.rule__body ?? box("do", []) };
  }
  exprValue(expr: Expr, localSymbols: SymbolTable): Value {
    if (typeof expr !== "object") {
      return k(expr);
    }
    switch (expr.tag) {
      case "placeholder":
        return { tag: "var", id: this.varCount++, name: "__" };
      case "ident": {
        const id = localSymbols[expr.ident] ?? this.varCount++;
        localSymbols[expr.ident] = id;
        return { tag: "var", id, name: expr.ident };
      }
      case "box":
        return box(
          expr.id,
          expr.args.map((arg) => this.exprValue(arg, localSymbols)),
        );
    }
  }
}
