import { Field, SchemaId } from "./data3";
import { TransactDB, whereValue } from "./db";

export type Id = string;
export type Ident = string;

export type Struct<Id, Args extends Expr[]> = {
  tag: "struct";
  id: Id;
  args: Args;
};
export type List<T extends Expr> = Struct<"", T[]>;
export type AnyStruct = Struct<string, Expr[]>;

type FormatText = string | Struct<"link", [string, Id]>;

type SchemaField =
  | Struct<"field", [Field]>
  | Struct<"field_optional", [Field]>
  | Struct<"field_default", [Field, Expr]>;

type IndexType =
  | Struct<"ref", []> // TODO: what does this mean now?
  | Struct<"multiRef", []>
  | Struct<"sorted", []>
  | Struct<"unique", []>;

type DBType =
  | Struct<"any", []>
  | Struct<"string", []>
  | Struct<"number", []>
  | Struct<"ref", []>
  | Struct<"ref", [SchemaId]>
  | Struct<"list", [DBType]>
  | Struct<"struct", []>
  | Struct<"struct", [string, ...DBType[]]>
  | Struct<"oneof", DBType[]>;

export type Rec = Record<string, Expr> & {
  time__created?: number;
  db__schema?: SchemaId;
  db__fields?: List<SchemaField>;
  db__type?: DBType;
  db__index?: IndexType;

  rule__params?: List<Expr>;
  rule__body?: AnyStruct;
  view__schema?: SchemaId;

  file__name?: string;
  file__description?: List<FormatText>;

  folder__items?: List<Id>;

  history__location?: Id;
  history__view?: Id;
  history__back?: Id;
  history__forward?: Id;
  window__currentHistory?: Id;
  browser__currentWindow?: Id;

  text__content?: List<FormatText>;
};

export type Expr =
  | string
  | number
  | { tag: "placeholder" }
  | { tag: "ident"; ident: Ident }
  | { tag: "struct"; id: Id; args: Expr[] };

export const __ = { tag: "placeholder" } as const;
export const k = (value: string | number) =>
  typeof value === "string"
    ? ({ tag: "string", value } as const)
    : ({ tag: "number", value } as const);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const v: any = new Proxy(
  function v(ident: string) {
    return { tag: "ident", ident };
  },
  {
    get(_, ident) {
      return { tag: "ident", ident };
    },
  }
);

export const s = <T extends Id, Args extends Expr[]>(id: T, ...args: Args) =>
  ({ tag: "struct", id, args } as const);
const sv = <T extends Id, Args extends Value[]>(id: T, ...args: Args) =>
  ({ tag: "struct", id, args } as const);

type Value =
  | { tag: "var"; id: FactId }
  | { tag: "string"; value: string }
  | { tag: "number"; value: number }
  | { tag: "struct"; id: Id; args: Value[] };

type Constraint = { tag: "constraint"; predicate: Value };

type Fact = Value | Constraint;

type FactId = symbol;
type Facts = Record<FactId, Fact>;
type SymbolTable = Record<Ident, FactId>;
const PLACEHOLDER_ID = Symbol("__");

function printFact(fact: Fact): string {
  switch (fact.tag) {
    case "constraint":
      return `{${printFact(fact.predicate)}}`;
    case "var":
      return `${fact.id.description}`;
    case "string":
    case "number":
      return JSON.stringify(fact.value);
    case "struct":
      return `${fact.id}(${fact.args.map(printFact).join(", ")})`;
  }
}

function* semidet(state: State | null | undefined) {
  if (state) yield state.yield();
}

export type StateNext = { tag: "state"; state: State };

let varCount = 0;

export class State {
  private constructor(
    private db: TransactDB<Rec>,
    private facts: Facts,
    private symbolTable: SymbolTable
  ) {}
  static root(rules: Record<Id, Rec>): State {
    const db = new TransactDB<Rec>();
    db.bulkInsert(rules);
    return new State(db, {}, {});
  }
  *run(expr: Expr): Generator<StateNext> {
    try {
      yield* this.runClause(this.expr(expr));
    } finally {
      this.db.rollbackAll();
    }
  }
  resolveAll(): Record<Ident, Expr | undefined> {
    return Object.fromEntries(
      Object.entries(this.symbolTable).map(([key, sym]) => [
        key,
        this.facts[sym] ? this.factToExpr(this.facts[sym] as Value) : undefined,
      ])
    );
  }
  private mapValue<T>(fact: Value, f: (f: Value, args?: T[]) => T): T {
    switch (fact.tag) {
      case "string":
      case "number":
        return f(fact);
      case "var": {
        const next = this.facts[fact.id];
        if (next && next.tag !== "constraint") {
          return this.mapValue(next, f);
        } else {
          return f(fact);
        }
      }
      case "struct":
        return f(
          fact,
          fact.args.map((arg) => this.mapValue(arg, f))
        );
    }
  }
  private mapExpr<T>(expr: Expr, f: (e: Expr, args?: T[]) => T): T {
    if (typeof expr !== "object") {
      return f(expr);
    }
    switch (expr.tag) {
      case "placeholder":
      case "ident":
        return f(expr);
      case "struct":
        return f(
          expr,
          expr.args.map((arg) => this.mapExpr(arg, f))
        );
    }
  }
  private factToExpr(fact: Value): Expr {
    return this.mapValue(fact, (f, args = []) => {
      switch (f.tag) {
        case "var":
          if (f.id === PLACEHOLDER_ID) return __;
          return { tag: "ident", ident: f.id.description ?? "<anonymous>" };
        case "string":
        case "number":
          return f.value;
        case "struct":
          return { ...f, args };
      }
    });
  }
  private expr(expr: Expr): Value {
    if (typeof expr !== "object") {
      return k(expr);
    }
    switch (expr.tag) {
      case "placeholder":
        return { tag: "var", id: PLACEHOLDER_ID };
      case "ident": {
        const sym =
          this.symbolTable[expr.ident] ??
          Symbol(`${expr.ident}<${varCount++}>`);
        this.symbolTable[expr.ident] = sym;
        return { tag: "var", id: sym };
      }
      case "struct": {
        const res = {
          ...expr,
          args: expr.args.map((arg) => this.expr(arg)),
        };
        if (expr.args.length !== res.args.length) throw new Error();
        return res;
      }
    }
  }
  private exprValue(expr: Expr, localSymbols: SymbolTable = {}): Value {
    if (typeof expr !== "object") {
      return k(expr);
    }
    switch (expr.tag) {
      case "placeholder":
        return { tag: "var", id: PLACEHOLDER_ID };
      case "ident": {
        // vars should bind to each other,
        // but not to similarly named vars in scope
        const sym =
          localSymbols[expr.ident] ?? Symbol(`${expr.ident}<${varCount++}>`);
        localSymbols[expr.ident] = sym;
        return { tag: "var", id: sym };
      }
      case "struct":
        return {
          ...expr,
          args: expr.args.map((arg) => this.exprValue(arg, localSymbols)),
        };
    }
  }
  private addValue(id: FactId, value: Value): State {
    return new State(this.db, { ...this.facts, [id]: value }, this.symbolTable);
  }
  private addConstraint(id: FactId, predicate: Value) {
    const prev = this.facts[id];
    if (prev?.tag === "constraint") {
      predicate = sv(",", prev.predicate, predicate);
    }
    return new State(
      this.db,
      { ...this.facts, [id]: { tag: "constraint", predicate } },
      this.symbolTable
    );
  }
  private unifyVar(left: Value & { tag: "var" }, right: Value): State | null {
    const constraint = this.facts[left.id];
    const ns = this.addValue(left.id, right);
    if (!ns) return null;
    if (constraint?.tag === "constraint") {
      for (const res of ns.runClause(constraint.predicate)) {
        return res.state;
      }
      return null;
    }
    return ns;
  }
  private unify(left: Value, right: Value): State | null {
    // handle placeholders
    if (left.tag === "var" && left.id === PLACEHOLDER_ID) return this;
    if (right.tag === "var" && right.id === PLACEHOLDER_ID) return this;

    switch (left.tag) {
      case "var": {
        return this.unifyVar(left, right);
      }
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
  private ensure<T extends Value["tag"]>(
    res: Value,
    tag: T
  ): Value & { tag: T } {
    if (res.tag !== tag) {
      throw new Error(`Expected ${tag}, received ${printFact(res)}`);
    }
    return res as Value & { tag: T };
  }
  private ensureVar<T extends Value["tag"]>(
    res: Value,
    tag: T
  ): Value & { tag: T | "var" } {
    if (res.tag !== tag && res.tag !== "var") {
      throw new Error(`Expected ${tag}, received ${printFact(res)}`);
    }
    return res as Value & { tag: T | "var" };
  }
  private log(facts: Value[]) {
    console.log(
      ...facts.map(printFact),
      Object.fromEntries(
        Object.getOwnPropertySymbols(this.facts).map((sym) => [
          sym.description,
          printFact(this.facts[sym]),
        ])
      )
    );
  }
  yield() {
    return { tag: "state", state: this } as const;
  }
  private *uniqueStates(gen: (this: this) => Generator<StateNext>) {
    const visited = new WeakSet<State>();
    for (const res of gen.call(this)) {
      if (!visited.has(res.state)) {
        visited.add(res.state);
        yield res;
      }
    }
  }
  private dif(l: Value, r: Value): State | null {
    if (l.tag === "var" || r.tag === "var") {
      let ns = this as State;
      if (l.tag === "var") {
        ns = ns.addConstraint(l.id, sv("/=", l, r));
      }
      if (r.tag === "var") {
        ns = ns.addConstraint(r.id, sv("/=", l, r));
      }
      return ns;
    }

    if (l.tag !== r.tag) return this;

    switch (l.tag) {
      case "string":
      case "number":
        if (l.value === (r as typeof l).value) return null;
        return this;
      case "struct": {
        const { id, args } = r as typeof l;
        if (l.id !== id || l.args.length !== args.length) return this;
        let ns = this as State;
        for (let i = 0; i < args.length; i++) {
          const next = ns.dif(l.args[i], args[i]);
          if (!next) return null;
          ns = next;
        }
        return ns;
      }
    }
  }
  private *runClause(fact_: Value): Generator<StateNext> {
    // simplify
    fact_ = this.mapValue(fact_, (e, args = []) => {
      switch (e.tag) {
        case "var":
        case "string":
        case "number":
          return e;
        case "struct": {
          return { ...e, args };
        }
      }
    });
    const fact = this.ensure(fact_, "struct");
    switch (fact.id) {
      case "fail":
        return;
      case "ok":
        yield this.yield();
        return;
      case "log":
        this.log(fact.args);
        yield this.yield();
        return;
      case "=":
        yield* semidet(this.unify(fact.args[0], fact.args[1]));
        return;
      case "/=":
        yield* semidet(this.dif(fact.args[0], fact.args[1]));
        return;
      case ",":
        yield* this.seq(fact.args);
        return;
      case ";":
        yield* this.uniqueStates(function* () {
          for (const arg of fact.args) {
            yield* this.runClause(arg);
          }
        });
        return;
      case "¬": // option-L
        for (const _ of this.runClause(fact.args[0])) {
          // success -> failure
          return;
        }
        // failure -> success
        yield this.yield();
        return;
      case "throw":
        throw new Error(`failure at ${printFact(fact.args[0])}`);
      case "try_catch":
        try {
          yield* this.runClause(fact.args[0]);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
          // console.error(e);
          yield* this.runClause(fact.args[1]);
        }
        return;
      case "if_then_else": {
        const [cond, ifSuccess, ifFail] = fact.args;
        let didSucceed = false;
        for (const res0 of this.runClause(cond)) {
          didSucceed = true;
          yield* res0.state.runClause(ifSuccess);
        }
        if (!didSucceed) {
          yield* this.runClause(ifFail);
        }
        return;
      }
      case "var":
        if (fact.args[0].tag === "var") yield this.yield();
        return;
      case "nonvar":
        if (fact.args[0].tag !== "var") yield this.yield();
        return;
      case "number":
        yield* this.test(fact.args[0], "number");
        return;
      case "string":
        yield* this.test(fact.args[0], "string");
        return;
      case "struct":
        yield* this.test(fact.args[0], "struct");
        return;
      case "struct_arity": {
        const st = this.ensure(fact.args[0], "struct");
        yield* semidet(this.unify(fact.args[1], k(st.args.length)));
        return;
      }
      case "struct_id_args": {
        const st = this.ensureVar(fact.args[0], "struct");
        const id = this.ensureVar(fact.args[1], "string");
        const args = this.ensureVar(fact.args[2], "struct");
        if (args.tag === "struct" && args.id !== "") {
          throw new Error("Expected list");
        }
        if (st.tag === "struct") {
          yield* semidet(
            this.unify(k(st.id), id)?.unify({ ...st, id: "" }, args)
          );
        } else if (id.tag === "string" && args.tag === "struct") {
          yield* semidet(this.unify({ ...args, id: id.value }, st));
        }
        return;
      }
      case "struct_id_index_arg": {
        const st = this.ensure(fact.args[0], "struct");
        const id = this.ensureVar(fact.args[1], "string");
        const idx = this.ensureVar(fact.args[2], "number");
        const arg = fact.args[3];

        const ns = this.unify(k(st.id), id);
        if (!ns) return;

        if (idx.tag === "number") {
          const i = idx.value;
          if (i < 0 || i >= st.args.length) return;
          yield* semidet(ns.unify(arg, st.args[i]));
        } else {
          yield* this.uniqueStates(function* () {
            for (let i = 0; i < st.args.length; i++) {
              yield* semidet(ns.unify(idx, k(i))?.unify(arg, st.args[i]));
            }
          });
        }
        return;
      }
      // db
      case "id": {
        const id = crypto.randomUUID();
        yield* semidet(this.unify(fact.args[0], k(id)));
        return;
      }
      case "timestamp": {
        const id = Date.now();
        yield* semidet(this.unify(fact.args[0], k(id)));
        return;
      }
      case "tx": {
        const tx = this.db.beginTx();
        yield* semidet(this.unify(fact.args[0], k(tx)));
        return;
      }
      case "commit": {
        const tx = this.ensure(fact.args[0], "number");
        this.db.commitTx(tx.value);
        yield this.yield();
        return;
      }
      case "rollback": {
        const tx = this.ensure(fact.args[0], "number");
        this.db.rollbackTx(tx.value);
        yield this.yield();
        return;
      }
      // TODO: handle rollback
      case "tx_update_field_value": {
        const tx = this.ensure(fact.args[0], "number");
        const id = this.ensure(fact.args[1], "string");
        const field = this.ensure(fact.args[2], "string");
        const value = fact.args[3];
        this.db.updateTx(
          tx.value,
          id.value,
          field.value as Field,
          this.factToExpr(value)
        );
        yield this.yield();
        return;
      }
      case "tx_delete_field_value":
        yield* this.delete(
          fact.args[0],
          fact.args[1],
          fact.args[2],
          fact.args[3]
        );
        return;
      case "get_field_value":
        yield* this.get(fact.args[0], fact.args[1], fact.args[2]);
        return;
      default: {
        const rule = this.db.get(fact.id);
        if (!rule) throw new Error(`unknown rule ${fact.id}`);
        if (!rule.rule__body || !rule.rule__params) {
          throw new Error(`invalid rule ${fact.id}`);
        }

        yield* this.call(rule.rule__params.args, rule.rule__body, fact.args);
        return;
      }
    }
  }
  private *test(value: Value, tag: Value["tag"]) {
    if (value.tag === tag) yield this.yield();
    if (value.tag === "var") {
      yield this.addConstraint(value.id, sv(tag, value)).yield();
    }
    return;
  }
  private *get(id: Value, field: Value, value: Value) {
    id = this.ensureVar(id, "string");
    field = this.ensureVar(field, "string");

    if (id.tag === "string") {
      const rec = this.db.get(id.value);
      if (!rec) return;
      if (field.tag === "string") {
        const val = rec[field.value as Field];
        if (!val) return;
        yield* semidet(this.unify(value, this.exprValue(val)));
      } else {
        yield* this.uniqueStates(function* () {
          for (const f in rec) {
            const val = rec[f as Field];
            if (!val) continue;
            yield* semidet(
              this.unify(field, k(f))?.unify(value, this.exprValue(val))
            );
          }
        });
      }
      return;
    }
    if (field.tag === "string" && value.tag === "string") {
      const idx = this.db.getIndex(field.value);
      if (idx) {
        yield* this.uniqueStates(function* () {
          for (const [{ entityId }] of idx.tree.where(
            whereValue(value.value)
          )) {
            yield* semidet(this.unify(id, k(entityId)));
          }
        });
        return;
      }
    }
    yield* this.uniqueStates(function* () {
      for (const key of this.db.keys()) {
        const ns = this.unify(id, k(key))!;
        const rec = this.db.get(key)!;
        for (const f in rec) {
          const val = rec[f as Field];
          if (!val) continue;
          yield* semidet(
            ns?.unify(field, k(f))?.unify(value, this.exprValue(val))
          );
        }
      }
    });
    return;
  }
  private *delete(tx_: Value, id_: Value, field: Value, value: Value) {
    const tx = this.ensure(tx_, "number");
    const id = this.ensure(id_, "string");
    const rec = this.db.get(id.value);
    if (!rec) return;

    // delete a field
    if (field.tag === "string") {
      const val = this.exprValue(rec[field.value]);
      const ns = this.unify(val, value);
      if (!ns) return;
      ns.db.updateTx(tx.value, id.value, field.value as Field, null);
      yield ns.yield();
    } else {
      // delete whole record
      this.db.insertTx(tx.value, id.value, null);
      yield* this.uniqueStates(function* () {
        for (const f in rec) {
          const val = this.exprValue(rec[f]);
          const ns = this.unify(k(f), field) //
            ?.unify(val, value);
          if (!ns) return;
          yield ns.yield();
        }
      });
    }
  }
  private *call(
    params: Expr[],
    body: Expr,
    args: Value[]
  ): Generator<StateNext> {
    if (params.length !== args.length) throw new Error("invalid arity");

    let ruleState = new State(this.db, this.facts, {});
    for (let i = 0; i < params.length; i++) {
      const param = ruleState.expr(params[i]);
      const arg = args[i];
      const ns = ruleState.unify(param, arg);
      if (!ns) return;
      ruleState = ns;
    }

    for (const res of ruleState.runClause(ruleState.expr(body))) {
      yield new State(this.db, res.state.facts, this.symbolTable).yield();
    }
  }
  private *seq(items: Value[]): Generator<StateNext> {
    if (items.length === 0) {
      yield this.yield();
      return;
    }

    const stack = [this.runClause(items[0])];
    while (stack.length) {
      const frame = stack.at(-1)!;
      const res = frame.next();
      if (res.done) {
        stack.pop();
        continue;
      }
      const nextClause = items[stack.length];

      if (nextClause) {
        stack.push(res.value.state.runClause(nextClause));
      } else {
        yield res.value;
      }
    }
  }
}
