import { Rec } from "./data";
import { Expr, Ident, s } from "./expr";
import { State, Fail, Pid } from "./state2";
import { Value, Exception, k, box, FactId } from "./value2";

type SymbolTable = Record<Ident, FactId>;

function ensure<T extends Value["tag"]>(
  value: Value,
  tag: T,
): asserts value is Value & { tag: T } {
  if (value.tag !== tag) {
    throw new Exception(box("expected_type", [k(tag), value]));
  }
}

function expected(expected: Value, received: Value) {
  throw new Exception(box("expected_received", [expected, received]));
}

export type ProcessNext =
  | { tag: "result"; result: Interpreter }
  | { tag: "receive"; to: Interpreter; pattern: Value };
export type ProcessNextOf<T extends ProcessNext["tag"]> = ProcessNext & {
  tag: T;
};

export type ProcessGen = Generator<ProcessNext, void, Interpreter | undefined>;

export type RulePrimitive = (
  interpreter: Interpreter,
  ...args: Value[]
) => ProcessGen;

interface IDB {
  get(key: string): Rec | undefined | null;
}

export class Interpreter {
  private constructor(
    private varCount: number,
    private db: IDB,
    private primitives: Record<string, RulePrimitive>,
    private state: State,
  ) {}
  static init(db: IDB, primitives: Record<string, RulePrimitive>, pid: Pid) {
    return new Interpreter(0, db, primitives, State.init(pid));
  }
  result() {
    return { tag: "result", result: this as Interpreter } as const;
  }
  receive(pattern: Value) {
    return { tag: "receive", to: this as Interpreter, pattern } as const;
  }
  unify(l: Value, r: Value) {
    return this.state.unify(l, r);
  }
  tryUnify(l: Value, r: Value): Interpreter | null {
    try {
      this.state.unify(l, r);
      return this;
    } catch (e) {
      if (e instanceof Fail) return null;
      throw e;
    }
  }
  dif(l: Value, r: Value) {
    return this.state.dif(l, r);
  }
  fork() {
    return new Interpreter(
      this.varCount,
      this.db,
      this.primitives,
      this.state.fork(),
    );
  }
  resolve(value: Value) {
    return this.state.resolve(value);
  }
  *eval(value: Value): ProcessGen {
    value = this.state.resolveVar(value);
    ensure(value, "box");
    const args = value.args.map((arg) => this.state.resolveVar(arg));

    try {
      yield* this.call(value.id, args);
    } catch (e) {
      if (e instanceof Fail) return;
      throw e;
    }
  }
  private *call(id: string, args: Value[]): ProcessGen {
    // stateProfile.call(id);
    // try {
    const rule = this.db.get(id);
    if (!rule) throw new Exception(box("unknown_rule", [k(id)]));

    if (this.primitives[id]) {
      this.check_call(id, rule, args);
      yield* this.primitives[id](this, ...args);
      return;
    }

    const { params, body } = this.check_call(id, rule, args);

    const localSymbols: SymbolTable = {};

    if (rule.rule__rest_params) {
      const restParams = this.exprValue(rule.rule__rest_params, localSymbols);
      const restArgs = args.slice(params.length);
      this.state.unify(restParams, box("", restArgs));
    }

    for (let i = 0; i < params.length; i++) {
      const param = this.exprValue(params[i], localSymbols);
      const arg = args[i];
      this.state.unify(param, arg);
    }

    yield* this.eval(this.exprValue(body, localSymbols));
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
  private exprValue(expr: Expr, localSymbols: SymbolTable): Value {
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
