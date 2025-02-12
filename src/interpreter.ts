import { Rec } from "./data";
import { Expr, Ident, s } from "./expr";
import { State, Fail } from "./state2";
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

export type ProcessNext = { tag: "result"; state: State } | { tag: "suspend" };

export type RulePrimitive = (
  state: State,
  ...args: Value[]
) => Generator<ProcessNext>;

interface IDB {
  get(key: string): Rec | undefined | null;
}

export class Interpreter {
  private constructor(
    private varCount: number,
    private db: IDB,
    private primitives: Record<string, RulePrimitive>,
  ) {}
  static init(db: IDB, primitives: Record<string, RulePrimitive>) {
    return new Interpreter(0, db, primitives);
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
  private *call(
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

    // // callable fields
    // if (rule.db__schema === "field") {
    //   if (args.length !== 2) {
    //     expected(box(id, [v(0, "entity"), v(1, "value")]), box(id, args));
    //   }
    //   yield* this.primitives.get_field_value(state, args[0], k(id), args[1]);
    //   return;
    // }

    const { params, body } = this.check_call(id, rule, args);

    const localSymbols: SymbolTable = {};

    if (rule.rule__rest_params) {
      const restParams = this.exprValue(rule.rule__rest_params, localSymbols);
      const restArgs = args.slice(params.length);
      state.unify(restParams, box("", restArgs));
    }

    for (let i = 0; i < params.length; i++) {
      const param = this.exprValue(params[i], localSymbols);
      const arg = args[i];
      state.unify(param, arg);
    }

    yield* this.eval(state, this.exprValue(body, localSymbols));
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
