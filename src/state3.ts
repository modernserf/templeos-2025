import { DB, whereValue } from "./db";

export type Id = string;
export type SimpleValue = string | number;
export type Value = SimpleValue | { id: Id; args: Value[] };

export type Field = Id;
export type Rec = Record<Field, Expr>;

export type Ident = string;
type ScopeId = symbol;
const SCOPE_ID = Symbol("SCOPE_ID");

export type Expr =
  | { tag: "placeholder" }
  | { tag: "value"; value: SimpleValue }
  | { tag: "ident"; ident: Ident; [SCOPE_ID]?: ScopeId }
  | { tag: "struct"; id: Id; args: Expr[] };

export const __ = { tag: "placeholder" } as const;
export const k = (value: SimpleValue) => ({ tag: "value", value } as const);
export const v = (ident: Ident) => ({ tag: "ident", ident } as const);
export const s = (id: Id, ...args: Expr[]) =>
  ({ tag: "struct", id, args } as const);

function printExpr(expr: Expr): string {
  switch (expr.tag) {
    case "ident":
      return expr[SCOPE_ID]?.description ?? expr.ident;
    case "placeholder":
      return `__`;
    case "value":
      return JSON.stringify(expr.value);
    case "struct":
      return `${expr.id}(${expr.args.map(printExpr).join(",")})`;
  }
}

type Scope = Record<ScopeId, Expr>;
type SymbolTable = Record<Ident, ScopeId>;

export type StateNext = { tag: "state"; state: State };

export const rules = {
  list_list_append: {
    rule__params: s("params", v("left"), v("right"), v("append")),
    rule__body: s(
      ";",
      s(
        ",", // []
        s("=", v("left"), s("nil")),
        s("=", v("right"), v("append"))
      ),
      s(
        ",", // [head | tail]
        s("=", v("left"), s("cons", v("head"), v("tail"))),
        s("=", s("cons", v("head"), v("append_tail")), v("append")),
        s("list_list_append", v("tail"), v("right"), v("append_tail"))
      )
    ),
  },
} satisfies Record<string, Rec>;

let varCount = 0;

export class State {
  private constructor(
    private db: DB<Rec>,
    private scope: Scope,
    private symbolTable: SymbolTable
  ) {}
  static root(): State {
    const db = new DB<Rec>();
    db.bulkInsert(rules);
    return new State(db, {}, {});
  }
  private getScope(expr: Expr): Expr | null {
    if (expr.tag === "ident") return this.scope[expr[SCOPE_ID]!] ?? null;
    return null;
  }
  private mapExpr<T>(expr: Expr, f: (e: Expr, args?: T[]) => T): T {
    switch (expr.tag) {
      case "placeholder":
      case "value":
        return f(expr);
      case "ident": {
        const next = this.getScope(expr);
        if (next) return this.mapExpr(next, f);
        return f(expr);
      }
      case "struct":
        return f(
          { tag: "struct", id: expr.id, args: [] },
          expr.args.map((arg) => this.mapExpr(arg, f))
        );
    }
  }
  private canResolve(expr: Expr): boolean {
    return this.mapExpr(expr, (e, args = []) => {
      switch (e.tag) {
        case "placeholder":
        case "ident":
          return false;
        case "value":
          return true;
        case "struct":
          return args.every(Boolean);
      }
    });
  }
  private resolve(expr: Expr): Value {
    return this.mapExpr(expr, (e, args = []) => {
      switch (e.tag) {
        case "placeholder":
          throw new Error("cannot resolve placeholder");
        case "ident":
          throw new Error(`cannot resolve ${e.ident}`);
        case "value":
          return e.value;
        case "struct":
          return { id: e.id, args };
      }
    });
  }
  resolveAll(): Record<Ident, Value | undefined> {
    return Object.fromEntries(
      Object.entries(this.symbolTable).map(([key, sym]) => [
        key,
        this.scope[sym] ? this.resolve(this.scope[sym]) : undefined,
      ])
    );
  }
  private unify(left: Expr, right: Expr): State | null {
    if (left.tag === "placeholder" || right.tag === "placeholder") return this;
    switch (left.tag) {
      case "ident": {
        // left is bound
        const l = this.getScope(left);
        if (l) return this.unify(l, right);
        switch (right.tag) {
          case "ident": {
            // right is bound
            const r = this.getScope(right);
            if (r) return this.unify(left, r);
            // same var
            if (left[SCOPE_ID] === right[SCOPE_ID]) return this;
            // left is unbound
            return this.withBinding(left[SCOPE_ID]!, right);
          }
          case "value":
          case "struct":
            return this.withBinding(left[SCOPE_ID]!, right);
        }
      }
      // eslint-disable-next-line no-fallthrough
      case "value":
        switch (right.tag) {
          case "ident":
            return this.unify(right, left);
          case "value":
            if (left.value === right.value) {
              return this;
            } else {
              return null;
            }
          case "struct":
            return null;
        }
      // eslint-disable-next-line no-fallthrough
      case "struct":
        switch (right.tag) {
          case "ident":
            return this.unify(right, left);
          case "value":
            return null;
          case "struct": {
            if (
              left.id !== right.id ||
              left.args.length !== right.args.length
            ) {
              return null;
            }
            // eslint-disable-next-line @typescript-eslint/no-this-alias
            let state: State = this;
            for (let i = 0; i < left.args.length; i++) {
              const nextState = state.unify(left.args[i], right.args[i]);
              if (!nextState) return null;
              state = nextState;
            }
            return state;
          }
        }
    }
  }
  private *runClauseSeq(items: Expr[], index = 0): Generator<StateNext> {
    if (index >= items.length) {
      yield this.yield();
      return;
    }
    for (const res of this.runClauseDecorated(items[index])) {
      yield* res.state.runClauseSeq(items, index + 1);
    }
  }
  private withBinding(scopeId: ScopeId, expr: Expr): State {
    return new State(
      this.db,
      { ...this.scope, [scopeId]: expr },
      this.symbolTable
    );
  }
  private simplify(expr: Expr): Expr {
    return this.mapExpr(expr, (e, args = []) => {
      switch (e.tag) {
        case "ident":
        case "placeholder":
        case "value":
          return e;
        case "struct":
          return { ...e, args };
      }
    });
  }
  private tryResolve(
    expr: Expr
  ): Exclude<Expr, { tag: "ident" } | { tag: "placeholder" }> | null {
    const res: Expr = this.simplify(expr);
    if (res.tag === "placeholder" || res.tag === "ident") return null;
    return res;
  }
  private resolveSimple(expr: Expr): Expr & { tag: "value" } {
    const res = this.simplify(expr);
    if (res.tag !== "value") {
      throw new Error(`Expected struct, received ${printExpr(res)}`);
    }
    return res;
  }
  private resolveStruct(expr: Expr): Expr & { tag: "struct" } {
    const res = this.simplify(expr);
    if (res.tag !== "struct")
      throw new Error(`Expected struct, received ${printExpr(res)}`);
    return res;
  }
  *runClause(expr: Expr): Generator<StateNext> {
    yield* this.runClauseDecorated(this.decorateExpr(expr));
  }
  private decorateExpr(expr: Expr): Expr {
    return this.mapExpr(expr, (e, args = []) => {
      switch (e.tag) {
        case "placeholder":
        case "value":
          return e;
        case "ident": {
          const sym =
            this.symbolTable[e.ident] ?? Symbol(`${e.ident}<${varCount++}>`);
          this.symbolTable[e.ident] = sym;
          // e[SCOPE_ID] = sym;
          return { ...e, [SCOPE_ID]: sym };
        }
        case "struct": {
          return { ...e, args };
        }
      }
    });
  }
  private *runClauseDecorated(expr: Expr): Generator<StateNext> {
    if (expr.tag !== "struct") {
      throw new Error(`Expected struct, received ${expr.tag}`);
    }
    switch (expr.id) {
      case "fail":
        return;
      case "ok":
        yield this.yield();
        return;
      case "log":
        console.log(
          ...expr.args.map(printExpr),
          Object.fromEntries(
            Object.getOwnPropertySymbols(this.scope).map((sym) => [
              sym.description,
              printExpr(this.scope[sym]),
            ])
          )
        );
        yield this.yield();
        return;
      case "=": {
        const [l, r] = expr.args;
        const ns = this.unify(l, r);
        if (ns) yield ns.yield();
        return;
      }
      case ",": {
        yield* this.runClauseSeq(expr.args);
        return;
      }
      case ";": {
        yield* this.uniqueStates(function* () {
          for (const arg of expr.args) {
            yield* this.runClauseDecorated(arg);
          }
        });
        return;
      }
      case "¬": // option-L
        for (const _ of this.runClauseDecorated(expr.args[0])) {
          // success -> failure
          return;
        }
        // failure -> success
        yield this.yield();
        return;
      case "throw":
        throw new Error(`failure at ${printExpr(expr.args[0])}`);
      case "try_catch":
        try {
          yield* this.runClauseDecorated(expr.args[0]);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
          // console.error(e);
          yield* this.runClauseDecorated(expr.args[1]);
        }
        return;
      case "if_then_else": {
        const [cond, ifSuccess, ifFail] = expr.args;
        let didSucceed = false;
        for (const res0 of this.runClauseDecorated(cond)) {
          didSucceed = true;
          yield* res0.state.runClauseDecorated(ifSuccess);
        }
        if (!didSucceed) {
          yield* this.runClauseDecorated(ifFail);
        }
        return;
      }
      case "var":
        if (!this.canResolve(expr.args[0])) {
          yield this.yield();
        }
        return;
      case "nonvar":
        if (this.canResolve(expr.args[0])) {
          yield this.yield();
        }
        return;
      case "number":
        if (this.canResolve(expr.args[0])) {
          const val = this.resolve(expr.args[0]);
          if (typeof val === "number") yield this.yield();
        }
        return;
      case "string":
        if (this.canResolve(expr.args[0])) {
          const val = this.resolve(expr.args[0]);
          if (typeof val === "string") yield this.yield();
        }
        return;
      case "struct": {
        const res = this.tryResolve(expr.args[0]);
        if (res?.tag === "struct") yield this.yield();
        return;
      }
      case "struct_arity": {
        const st = this.resolveStruct(expr.args[0]);
        const ns = this.unify(expr.args[1], k(st.args.length));
        if (ns) yield ns.yield();
        return;
      }
      case "struct_id_args": {
        const st = this.tryResolve(expr.args[0]);
        if (st) {
          if (st.tag !== "struct") throw new Error("expected struct");
          const id = k(st.id);
          const args = s("", ...st.args);
          const ns = this.unify(expr.args[1], id)?.unify(expr.args[2], args);
          if (ns) yield ns.yield();
        } else {
          const id = this.resolveSimple(expr.args[1]);
          const args = this.resolveStruct(expr.args[2]);
          if (args.id !== "") throw new Error("Expected list");
          const ns = this.unify(expr.args[0], s(id.value as Id, ...args.args));
          if (ns) yield ns.yield();
        }
        return;
      }
      case "struct_id_index_arg": {
        const st = this.resolveStruct(expr.args[0]);
        const id = k(st.id);
        const ns = this.unify(expr.args[1], id);
        if (!ns) return;
        // +struct, ?id, +index, ?arg
        if (ns.canResolve(expr.args[2])) {
          const i = ns.resolve(expr.args[2]);
          if (typeof i !== "number") throw new Error("expected number");
          if (i < 0 || i >= st.args.length) {
            throw new Error("index out of range");
          }
          const ns1 = ns.unify(expr.args[3], st.args[i]);
          if (ns1) yield ns1.yield();
          // +struct, ?id, -index, ?arg
        } else {
          yield* this.uniqueStates(function* () {
            for (let i = 0; i < st.args.length; i++) {
              const ns1 = ns
                .unify(expr.args[2], k(i))
                ?.unify(expr.args[3], st.args[i]);
              if (ns1) yield ns1.yield();
            }
          });
        }
        return;
      }
      // db
      case "id": {
        const id = crypto.randomUUID();
        const ns = this.unify(expr.args[0], k(id));
        if (ns) yield ns.yield();
        return;
      }
      case "timestamp": {
        const id = Date.now();
        const ns = this.unify(expr.args[0], k(id));
        if (ns) yield ns.yield();
        return;
      }
      // TODO: handle rollback
      case "update_field_value": {
        const id = this.resolveSimple(expr.args[0]);
        const field = this.resolveSimple(expr.args[1]);
        const value = this.simplify(expr.args[2]);
        this.db.update(id.value as string, field.value as string, value);
        yield this.yield();
        return;
      }
      case "delete_field_value": {
        const id = this.resolveSimple(expr.args[0]);
        const field = this.simplify(expr.args[1]);
        const rec = this.db.get(id.value as string);
        if (!rec) return;

        // delete a field
        if (field.tag === "value") {
          const ns = this.unify(rec[field.value], expr.args[2]);
          if (!ns) return;
          this.db.update(id.value as string, field.value as string, null);
          yield ns.yield();
          return;
        } else {
          // delete whole record
          this.db.insert(id.value as string, null);
          yield* this.uniqueStates(function* () {
            for (const f in rec) {
              const ns = this.unify(k(f), expr.args[1]) //
                ?.unify(rec[f], expr.args[2]);
              if (!ns) return;
              yield ns.yield();
            }
          });
          return;
        }
      }
      case "get_field_value": {
        const id = this.simplify(expr.args[0]);
        const field = this.simplify(expr.args[1]);
        if (id.tag === "value") {
          const rec = this.db.get(id.value as string);
          if (!rec) return;
          if (field.tag === "value") {
            const val = rec[field.value as Field];
            if (!val) return;
            const ns = this.unify(expr.args[2], val);
            if (ns) yield ns.yield();
          } else {
            yield* this.uniqueStates(function* () {
              for (const f in rec) {
                const val = rec[f as Field];
                if (!val) continue;
                const ns = this.unify(expr.args[1], k(f)) //
                  ?.unify(expr.args[2], val);
                if (ns) yield ns.yield();
              }
            });
          }
          return;
        }
        const value = this.simplify(expr.args[2]);
        if (field.tag === "value" && value.tag === "value") {
          const idx = this.db.getIndex(field.value as string);
          if (idx) {
            yield* this.uniqueStates(function* () {
              for (const [{ entityId }] of idx.tree.where(
                whereValue(value.value as string)
              )) {
                const ns = this.unify(expr.args[0], k(entityId));
                if (ns) yield ns.yield();
              }
            });
            return;
          }
        }
        yield* this.uniqueStates(function* () {
          for (const id of this.db.keys()) {
            const ns = this.unify(expr.args[0], k(id))!;
            const rec = this.db.get(id)!;
            for (const f in rec) {
              const val = rec[f as Field];
              if (!val) continue;
              const ns1 = ns
                ?.unify(expr.args[1], k(f))
                ?.unify(expr.args[2], val);
              if (ns1) yield ns1.yield();
            }
          }
        });
        return;
      }
      default: {
        const rule = this.db.get(expr.id);
        if (!rule) throw new Error(`unknown rule ${expr.id}`);
        if (!rule.rule__body || !rule.rule__params) {
          throw new Error(`invalid rule ${expr.id}`);
        }

        const { args: params } = this.resolveStruct(rule.rule__params);
        const ruleState = this.ruleState(params, expr.args);
        if (!ruleState) return;

        for (const res of ruleState.runClause(rule.rule__body)) {
          const ns = this.returnFrom(res.state);
          if (ns) yield ns.yield();
        }
        return;
      }
    }
  }
  private ruleState(params: Expr[], args: Expr[]): State | null {
    if (params.length !== args.length) throw new Error("invalid arity");

    let ruleState = new State(this.db, this.scope, {});
    for (let i = 0; i < params.length; i++) {
      const param = ruleState.decorateExpr(params[i]);
      const arg = args[i];
      const ns = ruleState.unify(param, arg);
      if (!ns) return null;
      ruleState = ns;
    }
    return ruleState;
  }
  private returnFrom(ruleState: State): State | null {
    return new State(this.db, ruleState.scope, this.symbolTable);
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
