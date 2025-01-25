import { whereValue } from "./db";
import { k } from "./rule_builder";
import { RuleOutput, State } from "./state";
import { Clause, Expr, Field, Id, Ident, Rec, RuleRec } from "./schema";

type RulePrimitive = (state: State, args: Expr[]) => Generator<RuleOutput>;

export type RulePrimitiveId = keyof typeof rulePrimitives;
export const rulePrimitives = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  *rule__fail(_state, _args) {},
  *rule__ground(state, [q]) {
    if (state.isGround(q)) yield { tag: "result", state };
  },
  *rule__id(state, [qId]) {
    const ns = state.unify(qId, k(crypto.randomUUID()));
    if (ns) yield { tag: "result", state: ns };
  },
  *rule__timestamp(state, [qId]) {
    const ns = state.unify(qId, k(Date.now()));
    if (ns) yield { tag: "result", state: ns };
  },
  *rule__getContext(state, [qId, qValue]) {
    const id = state.mustResolve<Id>(qId);
    const value = state.getContext(id);
    if (!value) return;
    const ns = state.unify(qValue, k(value));
    if (!ns) return;
    yield { tag: "result", state: ns };
  },
  *rule__setContext(state, [qId, qValue]) {
    const id = state.mustResolve<Id>(qId);
    const value = state.mustResolve(qValue);
    const ns = state.setContext(id, value);
    yield { tag: "result", state: ns };
  },
  *rule__get(state, [qId, qField, qValue]) {
    if (state.isGround(qId)) {
      const id = state.mustResolve<Ident>(qId);
      const rec = state.db.get(id);
      if (!rec) return;
      if (state.isGround(qField)) {
        const field = state.mustResolve<keyof Rec>(qField);
        const value = rec[field];
        if (value == null) return;
        const ns = state.unify(qValue, k(value));
        if (ns) yield { tag: "result", state: ns };
      } else {
        for (const [field, value] of Object.entries(rec)) {
          if (value == null) continue;
          const ns = state.unify(qField, k(field));
          if (!ns) continue;
          const ns1 = ns.unify(qValue, k(value));
          if (!ns1) continue;
          yield { tag: "result", state: ns1 };
        }
      }
    } else {
      const field = state.mustResolve<Field>(qField);
      const value = state.mustResolve<Id>(qValue);
      const index = state.db.getIndex(field);
      if (!index) throw new Error("TODO: non-indexed");
      for (const [{ entityId }] of index.tree.where(whereValue(value))) {
        const ns = state.unify(qId, k(entityId));
        if (!ns) continue;
        yield { tag: "result", state: ns };
      }
    }
  },
  *rule__insert(state, [qId, qValue]) {
    const id = state.mustResolve<Id>(qId);
    const value = state.mustResolve<Rec>(qValue)!;
    // TODO: handle rollback
    state.db.insert(id, value);
    yield { tag: "result", state };
  },
  *rule__update(state, [qId, qField, qValue]) {
    const id = state.mustResolve<Id>(qId);
    const field = state.mustResolve<Field>(qField);
    const value = state.mustResolve(qValue);
    state.db.update(id, field, value);
    yield { tag: "result", state };
  },
  *rule__eq(state, [exprL, exprR]) {
    const nextState = state.unify(exprL, exprR);
    if (nextState) yield { tag: "result", state: nextState };
  },
  *rule__log(state, [qMsg]) {
    const message = state.mustResolve<string>(qMsg);
    console.log(message, state.getScope());
    yield { tag: "result", state };
  },
  *rule__members(state, [qList, qItem]) {
    const list = state.mustResolve<unknown[]>(qList);
    for (const item of list) {
      const ns = state.unify(qItem, k(item));
      if (ns) yield { tag: "result", state: ns };
    }
  },
  *rule__call(state, [qRule, ...qArgs]) {
    const ruleId = state.mustResolve<Id>(qRule);
    const rule = state.db.get(ruleId) as RuleRec;
    // if (!rule) return;
    if (!rule) throw new Error(`Unknown rule ${ruleId}`);
    // TODO: call should allow out params
    const args = qArgs.map((arg) => state.mustResolve(arg)!);
    yield* state.runRule(rule, args);
  },
  *rule__or(state, items) {
    for (const qBody of items) {
      const body = state.mustResolve<Clause[]>(qBody);
      yield* state.runRuleBody(body);
    }
  },
  *rule__cond(state, groups) {
    for (const qPair of groups) {
      const pair = state.mustResolve<{ cond: Clause[]; body: Clause[] }>(qPair);
      let didSucceed = false;
      for (const res of state.runRuleBody(pair.cond)) {
        if (res.tag === "result") {
          didSucceed = true;
          yield* res.state.runRuleBody(pair.body);
        }
      }
      if (didSucceed) return;
    }
  },
  *rule__limit(state, [qLimit, qBlock]) {
    const limit = state.mustResolve<number>(qLimit);
    const block = state.mustResolve<Clause[]>(qBlock);
    let count = 0;
    for (const res of state.runRuleBody(block)) {
      yield res;
      if (res.tag === "result") {
        count += 1;
        if (count === limit) break;
      }
    }
  },
} satisfies Record<string, RulePrimitive>;

export const rulePrimitiveRecs = Object.fromEntries(
  Object.keys(rulePrimitives).map((id) => [
    id,
    {
      db__schema: "schema__rulePrimitive",
      rule__primitive: id as RulePrimitiveId,
    } satisfies Rec,
  ])
);
