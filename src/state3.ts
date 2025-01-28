import { Field, SchemaId } from "./data3";
import { DB, whereValue } from "./db";

export type Id = string;
export type SimpleValue = string | number;

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

type IndexType = "ref" | "multiRef" | "sorted" | "unique";

export type Rec = Record<string, Expr> & {
  time__created?: number;
  db__schema?: SchemaId;
  db__fields?: List<SchemaField>;
  db__refType?: SchemaId;
  db__index?: IndexType;

  rule__params?: Struct<"params", Expr[]>;
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
  | SimpleValue
  | { tag: "placeholder" }
  | { tag: "ident"; ident: Ident }
  | { tag: "struct"; id: Id; args: Expr[] };

export const __ = { tag: "placeholder" } as const;
export const k = (value: SimpleValue) => ({ tag: "value", value } as const);

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

type Fact =
  | { tag: "unify"; id: FactId }
  | { tag: "value"; value: SimpleValue }
  | { tag: "struct"; id: Id; args: Fact[] };
// TODO: constraints

type FactId = symbol;
type Facts = Record<FactId, Fact>;
type SymbolTable = Record<Ident, FactId>;
const PLACEHOLDER_ID = Symbol("__");

function printFact(fact: Fact): string {
  switch (fact.tag) {
    case "unify":
      return `${fact.id.description}`;
    case "value":
      return JSON.stringify(fact.value);
    case "struct":
      return `${fact.id}(${fact.args.map(printFact).join(", ")})`;
  }
}

export type StateNext = { tag: "state"; state: State };

let varCount = 0;

type Tx = number;

class TransactDB extends DB<Rec> {
  private txs = new Map<Tx, Map<Id, Rec>>();
  private getTx(tx: Tx): Map<Id, Rec> {
    const changes = this.txs.get(tx);
    if (!changes) throw new Error("invalid tx");
    return changes;
  }
  beginTx(): Tx {
    const tx = varCount++;
    this.txs.set(tx, new Map());
    return tx;
  }
  commitTx(tx: Tx) {
    if (!this.txs.delete(tx)) throw new Error("invalid tx");
  }
  rollbackAll() {
    for (const tx of this.txs.keys()) {
      this.rollbackTx(tx);
    }
  }
  rollbackTx(tx: Tx) {
    const changes = this.getTx(tx);
    for (const [id, rec] of changes) {
      this.insert(id, rec);
    }
    this.txs.delete(tx);
  }
  updateTx(tx: Tx, id: Id, field: Field, value: Expr | null) {
    const changes = this.getTx(tx);
    if (!changes.has(id)) {
      const prev = this.get(id) ?? null;
      changes.set(id, { ...prev });
    }
    this.update(id, field, value);
  }
  insertTx(tx: Tx, id: Id, rec: Rec | null) {
    const changes = this.getTx(tx);
    if (!changes.has(id)) {
      const prev = this.get(id) ?? null;
      changes.set(id, { ...prev });
    }
    this.insert(id, rec);
  }
}

export class State {
  private constructor(
    private db: TransactDB,
    private facts: Facts,
    private symbolTable: SymbolTable
  ) {}
  static root(rules: Record<Id, Rec>): State {
    const db = new TransactDB();
    db.bulkInsert(rules);
    return new State(db, {}, {});
  }
  private mapFact<T>(fact: Fact, f: (f: Fact, args?: T[]) => T): T {
    switch (fact.tag) {
      case "value":
        return f(fact);
      case "unify":
        if (this.facts[fact.id]) {
          return this.mapFact(this.facts[fact.id], f);
        }
        return f(fact);
      case "struct":
        return f(
          fact,
          fact.args.map((arg) => this.mapFact(arg, f))
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
  resolveAll(): Record<Ident, Expr | undefined> {
    return Object.fromEntries(
      Object.entries(this.symbolTable).map(([key, sym]) => [
        key,
        this.facts[sym] ? this.factToExpr(this.facts[sym]) : undefined,
      ])
    );
  }
  private factToExpr(fact: Fact): Expr {
    return this.mapFact(fact, (f, args = []) => {
      switch (f.tag) {
        case "unify":
          if (f.id === PLACEHOLDER_ID) return __;
          return { tag: "ident", ident: f.id.description ?? "<anonymous>" };
        case "value":
          return f.value;
        case "struct":
          return { ...f, args };
      }
    });
  }
  private expr(expr: Expr): Fact {
    if (typeof expr !== "object") {
      return { tag: "value", value: expr };
    }
    switch (expr.tag) {
      case "placeholder":
        return { tag: "unify", id: PLACEHOLDER_ID };
      case "ident": {
        const sym =
          this.symbolTable[expr.ident] ??
          Symbol(`${expr.ident}<${varCount++}>`);
        this.symbolTable[expr.ident] = sym;
        return { tag: "unify", id: sym };
      }
      case "struct": {
        const res = {
          ...expr,
          args: expr.args.map((arg) => this.expr(arg)),
        };
        if (expr.args.length !== res.args.length) throw new Error();
        // if (expr.id === "cons") console.log(expr, res);
        return res;
      }
    }
  }
  private exprValue(expr: Expr, localSymbols: SymbolTable = {}): Fact {
    if (typeof expr !== "object") {
      return { tag: "value", value: expr };
    }
    switch (expr.tag) {
      case "placeholder":
        return { tag: "unify", id: PLACEHOLDER_ID };
      case "ident": {
        // vars should bind to each other,
        // but not to similarly named vars in scope
        const sym =
          localSymbols[expr.ident] ?? Symbol(`${expr.ident}<${varCount++}>`);
        localSymbols[expr.ident] = sym;
        return { tag: "unify", id: sym };
      }
      case "struct":
        return {
          ...expr,
          args: expr.args.map((arg) => this.exprValue(arg, localSymbols)),
        };
    }
  }
  private addFact(id: FactId, fact: Fact): State {
    // console.log("addFact", id, fact);
    return new State(this.db, { ...this.facts, [id]: fact }, this.symbolTable);
  }
  private unify(left: Fact, right: Fact): State | null {
    // handle placeholders
    if (left.tag === "unify" && left.id === PLACEHOLDER_ID) return this;
    if (right.tag === "unify" && right.id === PLACEHOLDER_ID) return this;
    // follow unify chains
    left = this.simplify(left);
    right = this.simplify(right);

    switch (left.tag) {
      case "unify":
        return this.addFact(left.id, right);
      case "value":
        switch (right.tag) {
          case "unify":
            return this.addFact(right.id, left);
          case "struct":
            return null;
          case "value":
            return left.value === right.value ? this : null;
        }
        break;
      case "struct":
        switch (right.tag) {
          case "unify":
            return this.addFact(right.id, left);
          case "value":
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
  private simplify(fact: Fact): Fact {
    return this.mapFact(fact, (e, args = []) => {
      switch (e.tag) {
        case "unify":
        case "value":
          return e;
        case "struct": {
          return { ...e, args };
        }
      }
    });
  }
  private ensureSimple(fact: Fact): Fact & { tag: "value" } {
    const res = this.simplify(fact);
    if (res.tag !== "value") {
      throw new Error(`Expected struct, received ${printFact(res)}`);
    }
    return res;
  }
  private ensureStruct(fact: Fact): Fact & { tag: "struct" } {
    const res = this.simplify(fact);
    if (res.tag !== "struct") {
      throw new Error(`Expected struct, received ${printFact(res)}`);
    }
    return res;
  }
  *run(expr: Expr): Generator<StateNext> {
    try {
      yield* this.runClause(this.expr(expr));
    } finally {
      this.db.rollbackAll();
    }
  }
  log(facts: Fact[]) {
    console.log(
      ...facts.map((fact) => printFact(this.simplify(fact))),
      Object.fromEntries(
        Object.getOwnPropertySymbols(this.facts).map((sym) => [
          sym.description,
          printFact(this.simplify(this.facts[sym])),
        ])
      )
    );
  }
  private *runClause(fact: Fact): Generator<StateNext> {
    fact = this.simplify(fact);
    if (fact.tag !== "struct") {
      throw new Error(`Expected struct, received ${fact.tag}`);
    }
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
      case "=": {
        const [l, r] = fact.args;
        const ns = this.unify(l, r);
        if (ns) yield ns.yield();
        return;
      }
      case ",": {
        yield* this.runClauseSeq(fact.args);
        return;
      }
      case ";": {
        yield* this.uniqueStates(function* () {
          for (const arg of fact.args) {
            yield* this.runClause(arg);
          }
        });
        return;
      }
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
      case "var": {
        const res = this.simplify(fact.args[0]);
        if (res.tag === "unify") yield this.yield();
        return;
      }
      case "nonvar": {
        const res = this.simplify(fact.args[0]);
        if (res.tag !== "unify") yield this.yield();
        return;
      }
      case "number": {
        const res = this.simplify(fact.args[0]);
        if (res.tag === "value" && typeof res.value === "number")
          yield this.yield();
        return;
      }
      case "string": {
        const res = this.simplify(fact.args[0]);
        if (res.tag === "value" && typeof res.value === "string")
          yield this.yield();
        return;
      }
      case "struct": {
        const res = this.simplify(fact.args[0]);
        if (res.tag === "struct") yield this.yield();
        return;
      }
      case "struct_arity": {
        const st = this.ensureStruct(fact.args[0]);
        const ns = this.unify(fact.args[1], k(st.args.length));
        if (ns) yield ns.yield();
        return;
      }
      case "struct_id_args": {
        const st = this.simplify(fact.args[0]);
        switch (st.tag) {
          case "struct": {
            const id = k(st.id);
            const args = { ...st, id: "" };
            const ns = this.unify(fact.args[1], id)?.unify(fact.args[2], args);
            if (ns) yield ns.yield();
            return;
          }
          case "unify": {
            const id = this.ensureSimple(fact.args[1]);
            const args = this.ensureStruct(fact.args[2]);
            if (args.id !== "") throw new Error("Expected list");
            const st = { ...args, id: id.value as string };
            const ns = this.unify(fact.args[0], st);
            if (ns) yield ns.yield();
            return;
          }
          case "value":
            throw new Error("expected struct");
        }
        break;
      }
      case "struct_id_index_arg": {
        const st = this.ensureStruct(fact.args[0]);
        const id = k(st.id);
        const ns = this.unify(fact.args[1], id);
        if (!ns) return;
        const idx = ns.simplify(fact.args[2]);
        switch (idx.tag) {
          // +struct, ?id, ?index, ?arg
          case "unify": {
            yield* this.uniqueStates(function* () {
              for (let i = 0; i < st.args.length; i++) {
                const ns1 = ns
                  .unify(fact.args[2], k(i))
                  ?.unify(fact.args[3], st.args[i]);
                if (ns1) yield ns1.yield();
              }
            });
            return;
          }
          // +struct, ?id, +index, ?arg
          case "value": {
            const i = idx.value;
            if (typeof i !== "number") throw new Error("expected number");
            if (i < 0 || i >= st.args.length) {
              throw new Error("index out of range");
            }
            const ns1 = ns.unify(fact.args[3], st.args[i]);
            if (ns1) yield ns1.yield();
            return;
          }
          case "struct":
            throw new Error("expected number");
        }
        break;
      }
      // db
      case "id": {
        const id = crypto.randomUUID();
        const ns = this.unify(fact.args[0], k(id));
        if (ns) yield ns.yield();
        return;
      }
      case "timestamp": {
        const id = Date.now();
        const ns = this.unify(fact.args[0], k(id));
        if (ns) yield ns.yield();
        return;
      }
      case "tx": {
        const tx = this.db.beginTx();
        const ns = this.unify(fact.args[0], k(tx));
        if (ns) yield ns.yield();
        return;
      }
      case "commit": {
        const tx = this.ensureSimple(fact.args[0]);
        this.db.commitTx(tx.value as Tx);
        yield this.yield();
        return;
      }
      case "rollback": {
        const tx = this.ensureSimple(fact.args[0]);
        this.db.rollbackTx(tx.value as Tx);
        yield this.yield();
        return;
      }
      // TODO: handle rollback
      case "tx_update_field_value": {
        const tx = this.ensureSimple(fact.args[0]);
        const id = this.ensureSimple(fact.args[1]);
        const field = this.ensureSimple(fact.args[2]);
        const value = this.simplify(fact.args[3]);
        this.db.updateTx(
          tx.value as Tx,
          id.value as string,
          field.value as Field,
          this.factToExpr(value)
        );
        yield this.yield();
        return;
      }
      case "tx_delete_field_value": {
        const tx = this.ensureSimple(fact.args[0]);
        const id = this.ensureSimple(fact.args[1]);
        const field = this.simplify(fact.args[2]);
        const rec = this.db.get(id.value as string);
        if (!rec) return;

        // delete a field
        if (field.tag === "value") {
          const val = this.exprValue(rec[field.value]);
          const ns = this.unify(val, fact.args[3]);
          if (!ns) return;
          this.db.updateTx(
            tx.value as Tx,
            id.value as string,
            field.value as Field,
            null
          );
          yield ns.yield();
          return;
        } else {
          // delete whole record
          this.db.insertTx(tx.value as Tx, id.value as string, null);
          yield* this.uniqueStates(function* () {
            for (const f in rec) {
              const val = this.exprValue(rec[f]);
              const ns = this.unify(k(f), fact.args[2]) //
                ?.unify(val, fact.args[3]);
              if (!ns) return;
              yield ns.yield();
            }
          });
          return;
        }
      }
      case "get_field_value": {
        const id = this.simplify(fact.args[0]);
        const field = this.simplify(fact.args[1]);
        if (id.tag === "value") {
          const rec = this.db.get(id.value as string);
          if (!rec) return;
          if (field.tag === "value") {
            const val = rec[field.value as Field];
            if (!val) return;
            const ns = this.unify(fact.args[2], this.exprValue(val));
            if (ns) yield ns.yield();
          } else {
            yield* this.uniqueStates(function* () {
              for (const f in rec) {
                const val = rec[f as Field];
                if (!val) continue;
                const ns = this.unify(fact.args[1], k(f)) //
                  ?.unify(fact.args[2], this.exprValue(val));
                if (ns) yield ns.yield();
              }
            });
          }
          return;
        }
        const value = this.simplify(fact.args[2]);
        if (field.tag === "value" && value.tag === "value") {
          const idx = this.db.getIndex(field.value as string);
          if (idx) {
            yield* this.uniqueStates(function* () {
              for (const [{ entityId }] of idx.tree.where(
                whereValue(value.value as string)
              )) {
                const ns = this.unify(fact.args[0], k(entityId));
                if (ns) yield ns.yield();
              }
            });
            return;
          }
        }
        yield* this.uniqueStates(function* () {
          for (const id of this.db.keys()) {
            const ns = this.unify(fact.args[0], k(id))!;
            const rec = this.db.get(id)!;
            for (const f in rec) {
              const val = rec[f as Field];
              if (!val) continue;
              const ns1 = ns
                ?.unify(fact.args[1], k(f))
                ?.unify(fact.args[2], this.exprValue(val));
              if (ns1) yield ns1.yield();
            }
          }
        });
        return;
      }
      default: {
        const rule = this.db.get(fact.id);
        if (!rule) throw new Error(`unknown rule ${fact.id}`);
        if (
          !rule.rule__body ||
          !rule.rule__params ||
          typeof rule.rule__params !== "object" ||
          rule.rule__params.tag !== "struct" ||
          rule.rule__params.id !== "params"
        ) {
          throw new Error(`invalid rule ${fact.id}`);
        }

        yield* this.call(rule.rule__params.args, rule.rule__body, fact.args);
        return;
      }
    }
  }
  private *call(
    params: Expr[],
    body: Expr,
    args: Fact[]
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
      const ns = new State(this.db, res.state.facts, this.symbolTable);
      if (ns) yield ns.yield();
    }
  }
  private *runClauseSeq(items: Fact[], index = 0): Generator<StateNext> {
    if (index >= items.length) {
      yield this.yield();
      return;
    }
    for (const res of this.runClause(items[index])) {
      yield* res.state.runClauseSeq(items, index + 1);
    }
  }
  private yield() {
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
}
