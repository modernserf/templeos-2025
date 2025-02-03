import { Rec } from "./data";
import { TransactDB } from "./db";
import { Expr, Id, Ident, __, printExpr, s } from "./expr";
import { primitives } from "./rule_primitive";

export const k = (value: string | number) =>
  typeof value === "string"
    ? ({ tag: "string", value } as const)
    : ({ tag: "number", value } as const);

export const sv = <T extends Id, Args extends Value[]>(id: T, ...args: Args) =>
  ({ tag: "struct", id, args } as const);

export type Value =
  | { tag: "placeholder" }
  | { tag: "var"; id: FactId; name: string }
  | { tag: "string"; value: string }
  | { tag: "number"; value: number }
  | { tag: "struct"; id: Id; args: Value[] };

type Constraint = { tag: "constraint"; predicate: Value };

type Fact = Value | Constraint;

type FactId = number;
type Facts = Record<FactId, Fact>;
type SymbolTable = Record<Ident, FactId>;

export class Exception {
  constructor(public error: Value) {}
  get message() {
    return printFact(this.error);
  }
}

export function expected(expected: string, received: Value) {
  throw new Exception(sv("expected_received", k(expected), received));
}

export function check<T extends Value["tag"]>(
  value: Value,
  tag: T
): value is Value & { tag: T } {
  return value.tag === tag;
}

export function ensure<T extends Value["tag"]>(
  value: Value,
  tag: T
): asserts value is Value & { tag: T } {
  if (!check(value, tag)) expected(tag, value);
}

export function* uniqueStates(gen: () => Generator<StateNext>) {
  const visited = new WeakSet<State>();
  for (const res of gen()) {
    if (res.tag === "view") {
      yield res;
      continue;
    }
    if (!visited.has(res.state)) {
      visited.add(res.state);
      yield res;
    }
  }
}

function printFact(fact: Fact): string {
  switch (fact.tag) {
    case "placeholder":
      return "__";
    case "constraint":
      return `{${printFact(fact.predicate)}}`;
    case "var":
      return `${fact.name}<${fact.id}>`;
    case "string":
    case "number":
      return JSON.stringify(fact.value);
    case "struct":
      return `${fact.id}(${fact.args.map(printFact).join(", ")})`;
  }
}

type ViewPrimitive = string;
export type View = {
  tag: "view";
  id: ViewPrimitive;
  args: Expr[];
  children?: View[];
  state: State;
};

export type StateNext = { tag: "state"; state: State } | View;

let varCount = 0;

export class State {
  private constructor(
    public db: TransactDB<Rec>,
    private facts: Facts,
    public context: Record<string, Value>
  ) {}
  static root(rules: Record<Id, Rec>): State {
    const db = new TransactDB<Rec>();
    db.bulkInsert(rules);
    return new State(db, {}, {});
  }
  *render(expr: Expr): Generator<View> {
    for (const res of this.runClause(this.exprValue(expr, {}))) {
      if (res.tag === "view") yield res;
    }
  }
  *runAll(expr: Expr): Generator<Record<Ident, Expr | undefined>> {
    const rootSymbolTable: SymbolTable = {};
    try {
      for (const res of this.runClause(this.exprValue(expr, rootSymbolTable))) {
        if (res.tag !== "state") continue;
        const { state } = res;
        yield Object.fromEntries(
          Object.entries(rootSymbolTable).map(([key, sym]) => [
            key,
            state.facts[sym]
              ? state.factToExpr(state.facts[sym] as Value)
              : undefined,
          ])
        );
      }
    } finally {
      this.db.rollbackAll();
    }
  }
  factToExpr(fact: Value): Expr {
    switch (fact.tag) {
      case "placeholder":
        return __;
      case "var": {
        const resolved = this.resolveVar(fact.id);
        if (resolved && resolved.tag !== "constraint") {
          return this.factToExpr(resolved);
        }
        return { tag: "ident", ident: fact.name };
      }
      case "string":
      case "number":
        return fact.value;
      case "struct":
        return {
          tag: "struct",
          id: fact.id,
          args: fact.args.map((arg) => this.factToExpr(arg)),
        };
    }
  }
  exprValue(expr: Expr, localSymbols: SymbolTable): Value {
    if (typeof expr !== "object") {
      return k(expr);
    }
    switch (expr.tag) {
      case "placeholder":
        return __;
      case "ident": {
        const id = localSymbols[expr.ident] ?? varCount++;
        localSymbols[expr.ident] = id;
        return { tag: "var", id, name: expr.ident };
      }
      case "struct":
        return {
          ...expr,
          args: expr.args.map((arg) => this.exprValue(arg, localSymbols)),
        };
    }
  }
  private addValue(id: FactId, value: Value): State {
    return new State(this.db, { ...this.facts, [id]: value }, this.context);
  }
  addConstraint(id: FactId, predicate: Value) {
    const prev = this.facts[id];
    if (prev?.tag === "constraint") {
      predicate = sv(",", prev.predicate, predicate);
    }
    return new State(
      this.db,
      {
        ...this.facts,
        [id]: { tag: "constraint", predicate },
      },
      this.context
    );
  }
  private unifyVar(left: Value & { tag: "var" }, right: Value): State | null {
    const constraint = this.facts[left.id];
    const ns = this.addValue(left.id, right);
    if (!ns) return null;
    if (constraint?.tag === "constraint") {
      for (const res of ns.runClause(constraint.predicate)) {
        if (res.tag === "view") throw new Error();
        return res.state;
      }
      return null;
    }
    return ns;
  }
  unify(left: Value, right: Value): State | null {
    if (left === right) return this;
    left = this.resolve(left);
    right = this.resolve(right);
    // handle placeholders
    if (left.tag == "placeholder" || right.tag === "placeholder") return this;

    switch (left.tag) {
      case "var":
        return this.unifyVar(left, right);
      case "string":
      case "number":
        switch (right.tag) {
          case "var":
            return this.unifyVar(right, left);
          case "struct":
            return null;
          case "string":
          case "number":
            return left.value === right.value ? this : null;
        }
        break;
      case "struct":
        switch (right.tag) {
          case "var":
            return this.unifyVar(right, left);
          case "string":
          case "number":
            return null;
          case "struct": {
            let nextState = this as State;
            if (left.id !== right.id) return null;
            if (left.args.length !== right.args.length) return null;
            for (let i = 0; i < left.args.length; i++) {
              const ns = nextState.unify(left.args[i], right.args[i]);
              if (!ns) return null;
              nextState = ns;
            }
            return nextState;
          }
        }
    }
  }
  log(facts: Value[]) {
    console.log(
      ...facts.map((fact) => {
        if (fact.tag === "var") {
          const next = this.resolveVar(fact.id);
          if (next) return printFact(next);
        }
        return printFact(fact);
      })
    );
  }
  yield() {
    return { tag: "state", state: this } as const;
  }
  *dif(l: Value, r: Value): Generator<StateNext> {
    if (l.tag === "var" || r.tag === "var") {
      let ns = this as State;
      if (l.tag === "var") {
        ns = ns.addConstraint(l.id, sv("/=", l, r));
      }
      if (r.tag === "var") {
        ns = ns.addConstraint(r.id, sv("/=", l, r));
      }
      yield ns.yield();
      return;
    }

    if (l.tag !== r.tag || l.tag === "placeholder" || r.tag === "placeholder") {
      yield this.yield();
      return this;
    }

    switch (l.tag) {
      case "string":
      case "number":
        if (l.value !== (r as typeof l).value) yield this.yield();
        return;
      case "struct": {
        const { id, args } = r as typeof l;
        if (l.id !== id || l.args.length !== args.length) {
          yield this.yield();
          return;
        }
        yield* uniqueStates(
          function* (this: State) {
            for (let i = 0; i < args.length; i++) {
              yield* this.dif(l.args[i], args[i]);
            }
          }.bind(this)
        );
      }
    }
  }
  private resolveShallow(fact: Value): Value {
    switch (fact.tag) {
      case "string":
      case "number":
      case "placeholder":
      case "struct":
        return fact;
      case "var": {
        const next = this.resolveVar(fact.id);
        if (next && next.tag !== "constraint") return next;
        return fact;
      }
    }
  }
  setContext(key: string, value: Value) {
    return new State(this.db, this.facts, {
      ...this.context,
      [key]: value,
    });
  }
  *runClause(fact: Value): Generator<StateNext> {
    fact = this.resolveShallow(fact);
    ensure(fact, "struct");
    const args = fact.args.map((arg) => this.resolveShallow(arg));
    if (primitives[fact.id]) {
      yield* primitives[fact.id](this, ...args);
    } else {
      yield* this.call(fact.id, args);
    }
  }

  private resolveVar(id: FactId): Fact | null {
    const next = this.facts[id];
    if (next?.tag === "var") return this.resolveVar(next.id);
    return next;
  }
  resolve(value: Value): Value {
    switch (value.tag) {
      case "var": {
        const next = this.facts[value.id];
        if (next?.tag === "var") return this.resolve(next);
        if (next && next.tag !== "constraint") return next;
        return value;
      }
      case "placeholder":
      case "string":
      case "number":
        return value;
      case "struct": {
        return { ...value, args: value.args.map((arg) => this.resolve(arg)) };
      }
    }
  }

  *call(id: string, args: Value[]): Generator<StateNext> {
    const rule = this.db.get(id);
    if (!rule) throw new Exception(sv("unknown_rule", k(id)));

    // callable fields
    if (rule.db__schema === "schema__field") {
      yield* primitives.get_field_value(this, args[0], k(id), args[1]);
      return;
    }

    if (!rule.rule__body || !rule.rule__params) {
      throw new Exception(sv("invalid_rule", k(id)));
    }
    const params = rule.rule__params.args;
    const body = rule.rule__body;
    if (params.length !== args.length) {
      expected(printExpr(s(id, ...params)), sv(id, ...args));
    }

    let ruleState = new State(this.db, this.facts, this.context);
    const symbolTable = {};
    for (let i = 0; i < params.length; i++) {
      const param = ruleState.exprValue(params[i], symbolTable);
      const arg = args[i];
      const ns = ruleState.unify(param, arg);
      if (!ns) return;
      ruleState = ns;
    }

    for (const res of ruleState.runClause(
      ruleState.exprValue(body, symbolTable)
    )) {
      if (res.tag === "view") {
        yield res;
        continue;
      }
      yield new State(this.db, res.state.facts, this.context).yield();
    }
  }
}
