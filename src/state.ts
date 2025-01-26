import { DB } from "./db";
import { Rec, Id, Ident, Expr, Param, Clause, Rule } from "./schema";
import { deepEqual } from "./util";
import { k, v } from "./rule_builder";
import { RulePrimitiveId, rulePrimitives } from "./rule_primitive";
import { ViewPrimitiveId } from "./view_primitive";

type RuleRecBase =
  | {
      db__schema: "schema__rule" | "schema__view";
      rule__params: Param[];
      rule__body: Clause[];
    }
  | {
      db__schema: "schema__rulePrimitive";
      rule__params: Param[];
      rule__primitive: RulePrimitiveId;
    }
  | {
      db__schema: "schema__viewPrimitive";
      rule__params: Param[];
      view__primitive: ViewPrimitiveId;
    };

type RuleRec = Rec & RuleRecBase;

export type RuleOutput =
  | { tag: "result"; state: State }
  | {
      tag: "view";
      state: State;
      view: ViewPrimitiveId;
      args: unknown[];
    };

function notFound(name: string): never {
  throw new Error(`Not found: ${name}`);
}

export class State {
  private constructor(
    public db: DB<Rec>,
    private scope: Record<Ident, Expr>,
    private context: Record<Id, unknown>
  ) {}
  static root(db: DB<Rec>): State {
    return new State(db, {}, {});
  }
  getScope() {
    return { ...this.scope };
  }
  result() {
    return { tag: "result", state: this } as const;
  }
  resolveAll(): Record<Ident, unknown> {
    return Object.fromEntries(
      Object.entries(this.scope).map(([key, value]) => [
        key,
        this.resolve(value),
      ])
    );
  }
  isGround(expr: Expr): boolean {
    switch (expr.tag) {
      case "const":
        return true;
      case "ident": {
        const value = this.scope[expr.ident];
        if (!value || value === expr) return false;
        return this.isGround(value);
      }
    }
  }
  resolve<T>(expr: Expr): T {
    switch (expr.tag) {
      case "const":
        return expr.value as T;
      case "ident": {
        const value = this.scope[expr.ident];
        if (!value || value === expr)
          throw new Error(`cannot resolve ${expr.ident}`);
        return this.resolve(value);
      }
    }
  }
  unify(left: Expr, right: Expr): State | null {
    switch (left.tag) {
      case "ident": {
        const res = this.scope[left.ident];
        if (res) return this.unify(res, right);
        return this.setScope(left.ident, right);
      }
      case "const":
        if (right.tag === "ident") {
          return this.setScope(right.ident, left);
        }
        if (deepEqual(left.value, right.value)) return this;
        return null;
    }
  }
  private setScope(ident: Ident, expr: Expr): State {
    return new State(
      this.db,
      {
        ...this.scope,
        [ident]: expr,
      },
      this.context
    );
  }
  getContext<T>(id: Id): T {
    return (this.context[id] as T) ?? notFound(id);
  }
  setContext(id: Id, value: unknown): State {
    return new State(this.db, this.scope, { ...this.context, [id]: value });
  }
  // params are bound to args and added to a new scope
  *runRule(rule: Rule, args: unknown[]): Generator<RuleOutput> {
    const ruleState = this.ruleState(rule.rule__params, args.map(k));
    yield* ruleState.runRuleBody(rule.rule__body!);
  }
  // params are bound to args and added to current scope
  *runClosure(
    params: Param[],
    body: Clause[],
    args: unknown[]
  ): Generator<RuleOutput> {
    const state = params.reduce(
      (s, param, i) => s.unify(v(param.ident), k(args[i])) ?? s,
      this as State
    );
    yield* state.runRuleBody(body);
  }
  *runRuleBody(body: Clause[], index = 0): Generator<RuleOutput> {
    const clause = body[index];
    if (!clause) {
      yield { tag: "result", state: this };
      return;
    }
    const rule = (this.db.get(clause.name) as RuleRec) ?? notFound(clause.name);
    for (const res of this.runClause(rule, clause.args)) {
      switch (res.tag) {
        case "view":
          yield res;
          break;
        case "result":
          yield* res.state.runRuleBody(body, index + 1);
          break;
      }
    }
  }
  private ruleState(params: Param[], args: Expr[]): State {
    if (params.length !== args.length) throw new Error("invalid arity");
    const scope = Object.fromEntries(
      params.map((p, i) => {
        if (this.isGround(args[i])) {
          return [p.ident, k(this.resolve(args[i]))];
        } else {
          return [p.ident, args[i]];
        }
      })
    );
    return new State(this.db, scope, this.context);
  }
  private ruleDone(
    ruleState: State,
    params: Param[],
    args: Expr[]
  ): State | null {
    const nextState = params.reduce<State>((state, param, i) => {
      const val = ruleState.resolve(ruleState.scope[param.ident]);
      // if (!val) return state;
      return state.unify(args[i], k(val)) ?? state;
    }, this);

    return nextState;
  }
  private *runClause(rule: RuleRec, args: Expr[]): Generator<RuleOutput> {
    switch (rule.db__schema) {
      case "schema__rulePrimitive": {
        const fn = rulePrimitives[rule.rule__primitive];
        yield* fn(this, args);
        return;
      }
      case "schema__viewPrimitive": {
        yield {
          tag: "view",
          state: this,
          view: rule.view__primitive,
          args: args.map((arg) => this.resolve(arg)),
        };
        yield { tag: "result", state: this };
        return;
      }
      default: {
        const ruleState = this.ruleState(rule.rule__params, args);
        for (const res of ruleState.runRuleBody(rule.rule__body)) {
          switch (res.tag) {
            case "view":
              yield res;
              break;
            case "result": {
              const state = this.ruleDone(res.state, rule.rule__params, args);
              if (state) yield { tag: "result", state };
              break;
            }
          }
        }
        return;
      }
    }
  }
}
