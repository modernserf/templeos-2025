import { DB } from "./db";

export type Id = string;
export type SimpleValue = string | number;
export type Value = SimpleValue | { id: Id; args: Value[] };

export type Rec = {
  rule__params?: Expr[];
  rule__body?: Expr;
};
export type Field = keyof Rec;

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
      return `${String(expr.ident)}`;
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

const rules = {
  empty_list: {
    rule__params: [s("")],
    rule__body: s("ok"),
  },
  list_iter: {
    rule__params: [v("list"), v("iter")],
    rule__body: s(
      ",",
      s("log", k("log 1")),
      s("struct_arity", v("list"), v("len")),
      s("log", k("log 2")),
      s("=", v("iter"), s("list_index_len", v("list"), k(0), v("len"))),
      s("log", k("log 3"))
    ),
  },
  iter_value_next: {
    rule__params: [v("iter"), v("value"), v("next")],
    rule__body: s(
      ",",
      s("=", v("iter"), s("list_index_len", v("list"), v("index"), v("len"))),
      s("<", v("index"), v("len")),
      s("struct_atom_index_value", v("list"), __, v("index"), v("value")),
      s("+1", v("index"), v("next_index")),
      s(
        "=",
        v("next"),
        s("list_index_len", v("list"), v("next_index"), v("len"))
      )
    ),
  },
  iter_done: {
    rule__params: [v("iter")],
    rule__body: s("=", v("iter"), s("list_index_len", __, v("i"), v("i"))),
  },
} satisfies Record<string, Rec>;

export class State {
  private constructor(
    private db: DB<Rec>,
    private scope: Scope,
    private symbolTable: SymbolTable
  ) {}
  static root(): State {
    const db = new DB();
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
            if (left.ident === right.ident) return this;
            // left is unbound
            return this.withBinding(left[SCOPE_ID]!, right);
          }
          case "value":
          case "struct":
            return this.withBinding(left[SCOPE_ID]!, right);
        }
        break;
      }
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
        break;
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
  private partialResolve(
    expr: Expr
  ): Exclude<Expr, { tag: "ident" } | { tag: "placeholder" }> | null {
    const res: Expr = this.simplify(expr);
    if (res.tag === "placeholder" || res.tag === "ident") return null;
    return res;
  }
  private resolveStruct(expr: Expr): Expr & { tag: "struct" } {
    const res: Expr = this.simplify(expr);
    if (res.tag !== "struct")
      throw new Error(
        `Expected struct, received ${res ? res.tag : "free variable"}`
      );
    return res;
  }
  *runClause(expr: Expr): Generator<StateNext> {
    const decorated: Expr = this.mapExpr(expr, (e, args = []) => {
      switch (e.tag) {
        case "placeholder":
        case "value":
          return e;
        case "ident": {
          const sym = this.symbolTable[e.ident] ?? Symbol(e.ident);
          this.symbolTable[e.ident] = sym;
          e[SCOPE_ID] = sym;
          return e;
        }
        case "struct": {
          return { ...e, args };
        }
      }
    });
    yield* this.runClauseDecorated(decorated);
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
        console.log(this.symbolTable, this.scope);
        console.log(
          ...expr.args.map(printExpr),
          Object.fromEntries(
            Object.entries(this.symbolTable).map(([ident, sym]) => [
              ident,
              printExpr(this.scope[sym] ?? __),
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
        for (const arg of expr.args) {
          yield* this.runClauseDecorated(arg);
        }
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
        const res = this.partialResolve(expr.args[0]);
        if (res?.tag === "struct") yield this.yield();
        return;
      }
      case "struct_arity": {
        const st = this.resolveStruct(expr.args[0]);
        const ns = this.unify(expr.args[1], k(st.args.length));
        if (ns) yield ns.yield();
        return;
      }
      case "struct_atom_args": {
        const st = this.partialResolve(expr.args[0]);
        if (st) {
          if (st.tag !== "struct") throw new Error("expected struct");
          const atom = s(st.id);
          const args = s("", ...st.args);
          const ns = this.unify(expr.args[1], atom)?.unify(expr.args[2], args);
          if (ns) yield ns.yield();
        } else {
          const atom = this.resolveStruct(expr.args[1]);
          if (atom.args.length !== 0) throw new Error("expected atom");
          const args = this.resolveStruct(expr.args[2]);
          if (args.id !== "") throw new Error("Expected list");
          const ns = this.unify(expr.args[0], s(atom.id, ...args.args));
          if (ns) yield ns.yield();
        }
        return;
      }
      case "struct_atom_index_arg": {
        const st = this.resolveStruct(expr.args[0]);
        const atom = s(st.id);
        const ns = this.unify(expr.args[1], atom);
        if (!ns) return;
        // +struct, ?atom, +index, ?arg
        if (ns.canResolve(expr.args[2])) {
          const i = ns.resolve(expr.args[2]);
          if (typeof i !== "number") throw new Error("expected number");
          if (i < 0 || i >= st.args.length) {
            throw new Error("index out of range");
          }
          const ns1 = ns.unify(expr.args[3], st.args[i]);
          if (ns1) yield ns1.yield();
          // +struct, ?atom, -index, ?arg
        } else {
          for (let i = 0; i < st.args.length; i++) {
            const ns1 = ns
              .unify(expr.args[2], k(i))
              ?.unify(expr.args[3], st.args[i]);
            if (ns1) yield ns1.yield();
          }
        }

        return;
      }

      default: {
        const rule = this.db.get(expr.id);
        if (!rule) throw new Error(`unknown rule ${expr.id}`);
        if (!rule.rule__body || !rule.rule__params) {
          throw new Error(`invalid rule ${expr.id}`);
        }

        const ruleState = this.ruleState(rule.rule__params, expr.args);
        if (!ruleState) return;

        for (const res of ruleState.runClause(rule.rule__body)) {
          const ns = this.returnFrom(res.state, rule.rule__params, expr.args);
          if (ns) yield ns.yield();
        }
        return;
      }
    }
  }
  //
  private ruleState(params: Expr[], args: Expr[]): State | null {
    if (params.length !== args.length) throw new Error("invalid arity");

    let ruleState = new State(this.db, {}, {});
    for (let i = 0; i < params.length; i++) {
      const param = params[i];
      const arg = args[i];
      const ns = ruleState.unify(param, arg);
      if (!ns) return null;
      ruleState = ns;
    }
    return ruleState;
  }
  // TODO: get the results from ruleState, but avoid conflict in var names
  private returnFrom(
    ruleState: State,
    params: Expr[],
    args: Expr[]
  ): State | null {
    let state = this as State;
    for (let i = 0; i < params.length; i++) {
      const param = params[i];
      const arg = args[i];
      const item = ruleState.partialResolve(param);
      if (item) {
        const ns = state.unify(arg, item);
        if (!ns) return null;
        state = ns;
      }
    }
    return state;
  }

  private yield() {
    return { tag: "state", state: this } as const;
  }
}
