export type Id = string;
export type Field = string;
export type SimpleValue = string | number;
export type Value = SimpleValue | { id: Id; args: Value[] };

export type Rec = Record<Field, Value>;
export type DB = {
  get(id: Id): Rec | null;
  set(id: Id, rec: Rec): void;
};

export type Ident = string;

export type Expr =
  | { tag: "placeholder" }
  | { tag: "value"; value: SimpleValue }
  | { tag: "ident"; ident: Ident }
  | { tag: "struct"; id: Id; args: Expr[] };

export const __ = { tag: "placeholder" } as const;
export const k = (value: SimpleValue) => ({ tag: "value", value } as const);
export const v = (ident: Ident) => ({ tag: "ident", ident } as const);
export const s = (id: Id, ...args: Expr[]) =>
  ({ tag: "struct", id, args } as const);

function printExpr(expr: Expr): string {
  switch (expr.tag) {
    case "ident":
      return `${expr.ident}`;
    case "placeholder":
      return `__`;
    case "value":
      return JSON.stringify(expr.value);
    case "struct":
      return `${expr.id}(${expr.args.map(printExpr).join(",")})`;
  }
}

type Scope = Record<Ident, Expr>;

export type StateNext = { tag: "state"; state: State };

export class State {
  private constructor(private scope: Scope) {}
  static root(): State {
    return new State({});
  }
  canResolve(expr: Expr): boolean {
    switch (expr.tag) {
      case "placeholder":
        return false;
      case "ident":
        if (expr.ident in this.scope) {
          return this.canResolve(this.scope[expr.ident]);
        } else {
          return false;
        }
      case "value":
        return true;
      case "struct":
        return expr.args.every((arg) => this.canResolve(arg));
    }
  }
  resolve(expr: Expr): Value {
    switch (expr.tag) {
      case "placeholder":
        throw new Error("cannot resolve placeholder");
      case "ident":
        if (expr.ident in this.scope) {
          return this.resolve(this.scope[expr.ident]);
        } else {
          throw new Error(`cannot resolve ${expr.ident}`);
        }
      case "value":
        return expr.value;
      case "struct":
        return { id: expr.id, args: expr.args.map((arg) => this.resolve(arg)) };
    }
  }
  resolveAll(): Record<Ident, Value> {
    return Object.fromEntries(
      Object.entries(this.scope).map(([key, expr]) => [key, this.resolve(expr)])
    );
  }
  unify(left: Expr, right: Expr): State | null {
    if (left.tag === "placeholder" || right.tag === "placeholder") return this;
    switch (left.tag) {
      case "ident":
        // left is bound
        if (left.ident in this.scope) {
          return this.unify(this.scope[left.ident], right);
        }
        switch (right.tag) {
          case "ident": {
            // right is bound
            if (right.ident in this.scope) {
              return this.unify(left, this.scope[right.ident]);
            }
            // same var
            if (left.ident === right.ident) return this;
            // left is unbound
            return this.withBinding(left.ident, right);
          }
          case "value":
          case "struct":
            return this.withBinding(left.ident, right);
        }
        break;
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
  *runClause(expr: Expr): Generator<StateNext> {
    if (expr.tag !== "struct") {
      throw new Error(`Expected struct, received ${expr.tag}`);
    }
    switch (expr.id) {
      case "fail":
        return;
      case "ok":
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
          yield* this.runClause(arg);
        }
        return;
      }
      case "¬": // option-L
        for (const _ of this.runClause(expr.args[0])) {
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
          yield* this.runClause(expr.args[0]);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
          // console.error(e);
          yield* this.runClause(expr.args[1]);
        }
        return;
      case "if_then_else": {
        const [cond, ifSuccess, ifFail] = expr.args;
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

      default:
        throw new Error(`unknown rule ${expr.id}`);
    }
  }
  private partialResolve(
    expr: Expr
  ): Exclude<Expr, { tag: "ident" } | { tag: "placeholder" }> | null {
    while (expr?.tag === "ident") {
      expr = this.scope[expr.ident];
    }
    if (!expr || expr.tag === "placeholder") return null;
    return expr;
  }
  private resolveStruct(expr: Expr): Expr & { tag: "struct" } {
    const res = this.partialResolve(expr);
    if (!res || res.tag !== "struct")
      throw new Error(
        `Expected struct, received ${res ? res.tag : "free variable"}`
      );
    return res;
  }
  private *runClauseSeq(items: Expr[], index = 0): Generator<StateNext> {
    if (index >= items.length) {
      yield this.yield();
      return;
    }
    for (const res of this.runClause(items[index])) {
      yield* res.state.runClauseSeq(items, index + 1);
    }
  }
  private withBinding(ident: Ident, expr: Expr): State {
    return new State({ ...this.scope, [ident]: expr });
  }
  private yield() {
    return { tag: "state", state: this } as const;
  }
}
