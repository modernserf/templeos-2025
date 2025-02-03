import { Rec } from "./data";
import { TransactDB, whereValue } from "./db";
import { Expr, Id, Ident, __, printExpr, s } from "./expr";
import { Field } from "./field";

export const k = (value: string | number) =>
  typeof value === "string"
    ? ({ tag: "string", value } as const)
    : ({ tag: "number", value } as const);

const sv = <T extends Id, Args extends Value[]>(id: T, ...args: Args) =>
  ({ tag: "struct", id, args } as const);

type Value =
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

class Exception {
  constructor(public error: Value) {}
  get message() {
    return printFact(this.error);
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

function* semidet(state: State | null | undefined) {
  if (state) yield state.yield();
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
    //
    public db: TransactDB<Rec>,
    private facts: Facts,
    private context: Record<string, Value>
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
  private exprValue(expr: Expr, localSymbols: SymbolTable): Value {
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
  private addConstraint(id: FactId, predicate: Value) {
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
  private unify(left: Value, right: Value): State | null {
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
  private expected(expected: string, received: Value): never {
    throw new Exception(sv("expected_received", k(expected), received));
  }
  private ensure<T extends Value["tag"]>(
    res: Value,
    tag: T
  ): (Value & { tag: T }) | null {
    if (res.tag === "var" || res.tag == "placeholder") return null;
    if (res.tag !== tag) this.expected(tag, res);
    return res as Value & { tag: T };
  }
  private ensureList(res: Value): Value & { tag: "struct"; id: "" } {
    const res_ = this.ensure(res, "struct");
    if (!res_ || res_.id) this.expected("list", res);
    return res_ as Value & { tag: "struct"; id: "" };
  }
  private ensureVar<T extends Value["tag"]>(
    res: Value,
    tag: T
  ): Value & { tag: T | "var" | "placeholder" } {
    if (res.tag === "var" || res.tag == "placeholder") return res;
    if (res.tag !== tag) this.expected(tag, res);
    return res as Value & { tag: T };
  }
  private log(facts: Value[]) {
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
  private *uniqueStates(gen: (this: this) => Generator<StateNext>) {
    const visited = new WeakSet<State>();
    for (const res of gen.call(this)) {
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
  private *dif(l: Value, r: Value): Generator<StateNext> {
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
        yield* this.uniqueStates(function* () {
          for (let i = 0; i < args.length; i++) {
            yield* this.dif(l.args[i], args[i]);
          }
        });
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
  private *runClause(fact_: Value): Generator<StateNext> {
    fact_ = this.resolveShallow(fact_);
    if (fact_.tag !== "struct") this.expected("struct", fact_);
    const args = fact_.args.map((arg) => this.resolveShallow(arg));
    switch (fact_.id) {
      // Control flow & basic matching
      case "fail":
        return;
      case "ok":
        yield this.yield();
        return;
      case "=":
        yield* semidet(this.unify(args[0], args[1]));
        return;
      case "/=":
        yield* this.dif(args[0], args[1]);
        return;
      case ",":
        yield* this.seq(args);
        return;
      case ";":
        yield* this.or(args);
        return;
      case "¬": // option-L
        yield* semidet(this.notProven(args[0]));
        return;
      case "throw":
        throw new Exception(args[0]);
      case "try_error_catch":
        yield* this.tryCatch(args[0], args[1], args[2]);
        return;
      case "if_then_else":
        yield* this.ifThenElse(args[0], args[1], args[2]);
        return;
      case "collect":
        yield* semidet(this.collect(args[0], args[1], args[2]));
        return;
      case "limit":
        yield* this.limit(args[0], args[1]);
        return;
      // values
      case "value_type":
        yield* semidet(this.unify(args[1], this.valueType(args[0])));
        return;
      case "value_constraint":
        yield* this.valueConstraint(args[0], args[1]);
        return;
      case "var_name": {
        const name = this.varName(args[0]);
        yield* semidet(name && this.unify(name, args[1]));
        return;
      }
      case "string_number": {
        const str = this.ensureVar(args[0], "string");
        const num = this.ensureVar(args[1], "number");
        if (str.tag === "string") {
          const parsed = Number(str.value);
          if (Number.isFinite(parsed)) {
            yield* semidet(this.unify(k(parsed), num));
          }
        } else if (num.tag === "number") {
          const strung = String(num.value);
          yield* semidet(this.unify(k(strung), str));
        }
        return;
      }
      case "string_substring": {
        const str = this.ensure(args[0], "string");
        const sub = this.ensure(args[1], "string");
        if (!str || !sub) return;
        if (str.value.toLowerCase().match(sub.value.toLowerCase())) {
          yield this.yield();
        }
        return;
      }
      case "struct_arity": {
        const st = this.ensure(args[0], "struct");
        if (!st) return;
        yield* semidet(this.unify(args[1], k(st.args.length)));
        return;
      }
      case "struct_tag_list": {
        const st = this.ensureVar(args[0], "struct");
        const id = this.ensureVar(args[1], "string");
        const xs = this.ensureVar(args[2], "struct");
        if (xs.tag === "struct" && xs.id !== "") this.expected("list", xs);
        if (st.tag === "struct") {
          yield* semidet(
            this.unify(k(st.id), id)?.unify({ ...st, id: "" }, xs)
          );
        } else if (id.tag === "string" && xs.tag === "struct") {
          yield* semidet(this.unify({ ...xs, id: id.value }, st));
        }
        return;
      }
      case "struct_at_value": {
        const st =
          this.ensure(args[0], "struct") ?? this.expected("struct", args[0]);
        if (!st) return;
        const idx = this.ensureVar(args[1], "number");
        const value = args[2];

        if (idx.tag === "number") {
          const i = idx.value;
          if (i < 0 || i >= st.args.length) return;
          yield* semidet(this.unify(value, st.args[i]));
        } else {
          yield* this.uniqueStates(function* () {
            for (let i = 0; i < st.args.length; i++) {
              yield* semidet(this.unify(idx, k(i))?.unify(value, st.args[i]));
            }
          });
        }
        return;
      }
      case "struct_at_value_updated": {
        const st =
          this.ensure(args[0], "struct") ?? this.expected("struct", args[0]);
        const idx =
          this.ensure(args[1], "number") ?? this.expected("number", args[1]);
        const argNext = args[2];
        const out = args[3];
        const nextArgs = st.args.slice();
        nextArgs[idx.value] = argNext;
        yield* semidet(
          this.unify({ tag: "struct", id: st.id, args: nextArgs }, out)
        );
        return;
      }
      case "list_from_to_slice": {
        const list = this.ensureList(args[0]);
        const from = this.ensureVar(args[1], "number");
        const to = this.ensureVar(args[2], "number");

        const fromVal = from.tag === "number" ? from.value : 0;
        const toVal = to.tag === "number" ? to.value : list.args.length;
        const slice = {
          tag: "struct",
          id: "",
          args: list.args.slice(fromVal, toVal),
        } as const;
        yield* semidet(
          this.unify(k(fromVal), from)
            ?.unify(k(toVal), to)
            ?.unify(slice, args[3])
        );
        return;
      }
      case "list_list_append": {
        const left = this.ensureVar(args[0], "struct");
        const right = this.ensureVar(args[1], "struct");
        const append = this.ensureVar(args[2], "struct");
        if (left.tag === "struct" && right.tag === "struct") {
          yield* semidet(
            this.unify(append, {
              tag: "struct",
              id: "",
              args: left.args.concat(right.args),
            })
          );
          return;
        }

        if (append.tag === "struct") {
          const unifySplit = (state: State, split: number) =>
            state
              .unify(left, {
                tag: "struct",
                id: "",
                args: append.args.slice(0, split),
              })
              ?.unify(right, {
                tag: "struct",
                id: "",
                args: append.args.slice(split),
              });

          if (left.tag === "struct") {
            yield* semidet(unifySplit(this, left.args.length));
            return;
          } else if (right.tag === "struct") {
            yield* semidet(
              unifySplit(this, append.args.length - right.args.length)
            );
            return;
          } else {
            yield* this.uniqueStates(function* () {
              for (let i = 0; i <= append.args.length; i++) {
                yield* semidet(unifySplit(this, i));
              }
            });
          }
        }
        return;
      }
      // context
      case "has_context": {
        const key = this.ensure(args[0], "string");
        if (!key) return;
        const value = this.context[key.value];
        if (value) yield this.yield();
        return;
      }
      case "get_context": {
        const key = this.ensure(args[0], "string");
        if (!key) return;
        const value = this.context[key.value];
        if (!value) throw new Error(`Unknown context: ${key.value}`);
        yield* semidet(this.unify(args[1], value));
        return;
      }
      case "set_context": {
        const key = this.ensure(args[0], "string");
        if (!key) return;
        yield new State(this.db, this.facts, {
          ...this.context,
          [key.value]: args[1],
        }).yield();
        return;
      }
      // db
      case "id":
        yield* semidet(this.unify(args[0], k(crypto.randomUUID())));
        return;
      case "timestamp":
        yield* semidet(this.unify(args[0], k(Date.now())));
        return;
      case "tx":
        yield* semidet(this.unify(args[0], k(this.db.beginTx())));
        return;
      case "commit": {
        const tx = this.ensure(args[0], "number");
        if (!tx) return;
        this.db.commitTx(tx.value);
        yield this.yield();
        return;
      }
      case "rollback": {
        const tx = this.ensure(args[0], "number");
        if (!tx) return;
        this.db.rollbackTx(tx.value);
        yield this.yield();
        return;
      }
      case "tx_update_field_value": {
        const tx = this.ensure(args[0], "number");
        const id = this.ensure(args[1], "string");
        const field = this.ensure(args[2], "string");
        if (!tx || !id || !field) return;
        const value = args[3];
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
        yield* this.delete(args[0], args[1], args[2], args[3]);
        return;
      case "get_field_value":
        yield* this.get(args[0], args[1], args[2]);
        return;

      case "log":
        this.log(args);
        yield this.yield();
        return;

      case "view": {
        const view = this.ensure(args[0], "struct");
        if (!view) return;
        const { id, args: xs } = view;

        yield {
          tag: "view",
          id,
          args: xs.map((arg) => this.factToExpr(arg)),
          state: this,
        };
        yield this.yield();
        return;
      }
      case "view_children": {
        const view = this.ensure(args[0], "struct");
        const body = this.ensure(args[1], "struct");
        if (!view || !body) return;
        const { id, args: xs } = view;

        let state = this as State;
        const children: View[] = [];
        for (const res of this.runClause(body)) {
          switch (res.tag) {
            case "view":
              children.push(res);
              continue;
            case "state":
              state = res.state;
          }
        }

        yield {
          tag: "view",
          id,
          args: xs.map((arg) => state.factToExpr(arg)),
          children,
          state,
        };

        yield state.yield();
        return;
      }
      case "call": {
        const id = this.ensure(args[0], "string");
        if (!id) return;
        yield* this.call(id.value, args.slice(1));
        return;
      }
      default: {
        yield* this.call(fact_.id, args);
        return;
      }
    }
  }
  private *or(args: Value[]) {
    yield* this.uniqueStates(function* () {
      for (const arg of args) {
        // buffer views until there's a result
        let views = [];
        for (const res of this.runClause(arg)) {
          switch (res.tag) {
            case "view":
              views.push(res);
              continue;
            case "state":
              yield* views;
              views = [];
              yield res;
          }
        }
      }
    });
  }
  private *tryCatch(tryClause: Value, errorVar: Value, catchClause: Value) {
    try {
      yield* this.runClause(tryClause);
    } catch (e) {
      if (e instanceof Exception) {
        const ns = this.unify(errorVar, e.error);
        if (!ns) throw ns;
        yield* ns.runClause(catchClause);
      } else {
        throw e;
      }
    }
  }
  private *ifThenElse(cond: Value, ifSuccess: Value, ifFail: Value) {
    let didSucceed = false;
    for (const res0 of this.runClause(cond)) {
      if (res0.tag === "view") {
        yield res0;
        continue;
      }
      didSucceed = true;
      yield* res0.state.runClause(ifSuccess);
    }
    if (!didSucceed) {
      yield* this.runClause(ifFail);
    }
  }
  private notProven(clause: Value): State | null {
    for (const _ of this.runClause(clause)) {
      // success -> failure
      return null;
    }
    return this;
  }
  private valueType(value: Value): Value {
    switch (value.tag) {
      case "string":
        return sv("string");
      case "number":
        return sv("number");
      case "placeholder":
      case "var":
        return sv("var");
      case "struct":
        return sv("struct");
    }
  }
  private *valueConstraint(value: Value, constraint: Value) {
    switch (value.tag) {
      case "string":
      case "number":
      case "struct":
        yield* this.runClause(constraint);
        return;
      case "placeholder":
        return;
      case "var":
        yield this.addConstraint(value.id, constraint).yield();
    }
  }
  private varName(value: Value) {
    switch (value.tag) {
      case "placeholder":
        return k("__");
      case "var":
        return k(value.name);
      case "struct":
      case "string":
      case "number":
        return null;
    }
  }
  private resolveVar(id: FactId): Fact | null {
    const next = this.facts[id];
    if (next?.tag === "var") return this.resolveVar(next.id);
    return next;
  }
  private resolve(value: Value): Value {
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
  private collect(into: Value, clause: Value, out: Value) {
    let state = this as State;
    let didSucceed = false;
    const results: Value[] = [];
    for (const res of this.runClause(clause)) {
      if (res.tag === "view") throw "todo";
      didSucceed = true;
      state = res.state;
      if (out.tag !== "placeholder") {
        const val = state.resolve(into);
        results.push(val);
      }
    }
    if (didSucceed) {
      if (out.tag === "placeholder") {
        return this;
      }
      return this.unify(out, { tag: "struct", id: "", args: results });
    }
    return null;
  }
  private *limit(input: Value, clause: Value) {
    const limit = this.ensure(input, "number");
    if (!limit) return;
    let count = 0;
    for (const res of this.runClause(clause)) {
      if (count >= limit.value) return;
      yield res;
      if (res.tag === "state") count++;
    }
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
        yield* semidet(this.unify(value, this.exprValue(val, {})));
      } else {
        yield* this.uniqueStates(function* () {
          for (const f in rec) {
            const val = rec[f as Field];
            if (!val) continue;
            yield* semidet(
              this.unify(field, k(f))?.unify(value, this.exprValue(val, {}))
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
            ns?.unify(field, k(f))?.unify(value, ns.exprValue(val, {}))
          );
        }
      }
    });
    return;
  }
  private *delete(tx_: Value, id_: Value, field: Value, value: Value) {
    const tx = this.ensure(tx_, "number");
    const id = this.ensure(id_, "string");
    if (!tx || !id) return;
    const rec = this.db.get(id.value);
    if (!rec) return;

    // delete a field
    if (field.tag === "string") {
      const val = this.exprValue(rec[field.value], {});
      const ns = this.unify(val, value);
      if (!ns) return;
      ns.db.updateTx(tx.value, id.value, field.value as Field, null);
      yield ns.yield();
    } else {
      // delete whole record
      this.db.insertTx(tx.value, id.value, null);
      yield* this.uniqueStates(function* () {
        for (const f in rec) {
          const val = this.exprValue(rec[f], {});
          const ns = this.unify(k(f), field) //
            ?.unify(val, value);
          if (!ns) return;
          yield ns.yield();
        }
      });
    }
  }
  private *call(id: string, args: Value[]): Generator<StateNext> {
    const rule = this.db.get(id);
    if (!rule) throw new Exception(sv("unknown_rule", k(id)));

    // callable fields
    if (rule.db__schema === "schema__field") {
      yield* this.get(args[0], k(id), args[1]);
      return;
    }

    if (!rule.rule__body || !rule.rule__params) {
      throw new Exception(sv("invalid_rule", k(id)));
    }
    const params = rule.rule__params.args;
    const body = rule.rule__body;
    if (params.length !== args.length) {
      this.expected(printExpr(s(id, ...params)), sv(id, ...args));
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

      if (res.value.tag === "view") {
        yield res.value;
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
