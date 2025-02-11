import { Rec } from "./data";
import { TransactDB } from "./db";
import { Expr } from "./expr";

type Ident = string;
type Id = string;

type Pid = number;

type SymbolTable = Record<Ident, FactId>;

export type Value =
  | { tag: "var"; id: FactId; name: string }
  | { tag: "string"; value: string }
  | { tag: "number"; value: number }
  | { tag: "box"; id: Id; args: Value[] };

export const k = (value: string | number) =>
  typeof value === "string"
    ? ({ tag: "string", value } as const)
    : ({ tag: "number", value } as const);

export const __ = { tag: "placeholder" } as const;

export const v = (id: FactId, name = "") => ({ tag: "var", id, name } as const);

export const box = <T extends Id, Args extends Value[]>(id: T, args: Args) =>
  ({ tag: "box", id, args } as const);

let varCount = 0;

export function exprValue(expr: Expr, localSymbols: SymbolTable): Value {
  if (typeof expr !== "object") {
    return k(expr);
  }
  switch (expr.tag) {
    case "placeholder":
      return { tag: "var", id: varCount++, name: "__" };
    case "ident": {
      const id = localSymbols[expr.ident] ?? varCount++;
      localSymbols[expr.ident] = id;
      return { tag: "var", id, name: expr.ident };
    }
    case "box":
      return {
        tag: "box",
        id: expr.id,
        args: expr.args.map((arg) => exprValue(arg, localSymbols)),
      };
  }
}

type Constraint =
  | { tag: "unify"; value: Value }
  | { tag: "type"; type: Value }
  | { tag: "dif"; value: Value }
  | { tag: "and"; left: Constraint; right: Constraint };

type Fact = Value | { tag: "constraint"; constraint: Constraint };

type FactId = number;
type Facts = Record<FactId, Fact>;

// fail & exception use throw because they are non-resumable
export class Fail {}
const fail = new Fail();

export class Exception {
  constructor(public error: Value) {}
  get message() {
    return printFact(this.error);
  }
}

function ensure<T extends Value["tag"]>(
  value: Value,
  tag: T,
): asserts value is Value & { tag: T } {
  if (value.tag !== tag) {
    throw new Exception({
      tag: "box",
      id: "expected_type",
      args: [{ tag: "string", value: tag }, value],
    });
  }
}

function expected(expected: Value, received: Value) {
  throw new Exception(box("expected_received", [expected, received]));
}

function unknownContext(ctx: Value) {
  throw new Exception(box("unknown_context", [ctx]));
}

function printConstraint(constraint: Constraint): string {
  switch (constraint.tag) {
    case "unify":
      return `{ = ${printFact(constraint.value)} }`;
    case "type":
      return `{ is ${printFact(constraint.type)} }`;
    case "dif":
      return `{ /= ${printFact(constraint.value)} }`;
    case "and":
      return `${printConstraint(constraint.left)} && ${printConstraint(
        constraint.right,
      )}}`;
  }
}

export function printFact(fact: Fact, indent = ""): string {
  switch (fact.tag) {
    case "constraint":
      return printConstraint(fact.constraint);
    case "var":
      return `${fact.name}<${fact.id}>`;
    case "string":
    case "number":
      return JSON.stringify(fact.value);
    case "box":
      return `${fact.id}(\n${indent}  ${fact.args
        .map((f) => printFact(f, indent + "  "))
        .join("\n" + indent + "  ")}\n${indent})`;
  }
}

type ProcessNext = { tag: "result"; state: State } | { tag: "suspend" };

type RulePrimitive = (state: State, ...args: Value[]) => Generator<ProcessNext>;

export class ProcessManager {
  constructor(
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
    const pid = nextPid++;
    const child = State.init(pid);
    const gen = this.eval(child, goal);
    this.processes.set(pid, { mailbox: [], gen });
    this.runUntilSuspend(pid, gen);
    return pid;
  }
  *eval(
    state: State,
    fact: Value,
  ): Generator<ProcessNext, undefined, undefined> {
    fact = state.resolveVar(fact);
    ensure(fact, "box");
    const args = fact.args.map((arg) => state.resolveVar(arg));

    try {
      for (const res of this.call(state, fact.id, args)) {
        yield res;
      }
    } catch (e) {
      if (e instanceof Fail) return;
      throw e;
    }
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

  *call(
    state: State,
    id: string,
    args: Value[],
  ): Generator<ProcessNext, undefined, undefined> {
    // stateProfile.call(id);
    // try {
    const rule = this.db.get(id);
    if (!rule) throw new Exception(box("unknown_rule", [k(id)]));

    if (this.primitives[id]) {
      this.check_call(id, rule, args);
      yield* this.primitives[id](state, ...args);
      return;
    }

    // callable fields
    if (rule.db__schema === "field") {
      if (args.length !== 2) {
        expected(box(id, [v(0, "entity"), v(1, "value")]), box(id, args));
      }
      yield* this.primitives.get_field_value(state, args[0], k(id), args[1]);
      return;
    }

    const { params, body } = this.check_call(id, rule, args);

    const symbolTable = {};

    if (rule.rule__rest_params) {
      const param = exprValue(rule.rule__rest_params, symbolTable);
      const restArgs = args.slice(params.length);
      state.unify(param, {
        tag: "box",
        id: "",
        args: restArgs,
      });
    }

    for (let i = 0; i < params.length; i++) {
      const param = exprValue(params[i], symbolTable);
      const arg = args[i];
      state.unify(param, arg);
    }

    yield* this.eval(state, exprValue(body, symbolTable));
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
      expected(exprValue({ tag: "box", id, args: params }, {}), box(id, args));
    }
    return { params, body: rule.rule__body ?? box("do", []) };
  }
}
