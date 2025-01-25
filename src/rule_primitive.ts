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
    if (state.resolve(q)) yield { tag: "result", state };
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
    const id = state.resolve<Id>(qId);
    if (!id) return;
    const value = state.getContext(id);
    if (!value) return;
    const ns = state.unify(qValue, k(value));
    if (!ns) return;
    yield { tag: "result", state: ns };
  },
  *rule__setContext(state, [qId, qValue]) {
    const id = state.resolve<Id>(qId);
    if (!id) return;
    const value = state.resolve(qValue);
    if (!value) return;
    const ns = state.setContext(id, value);
    yield { tag: "result", state: ns };
  },
  *rule__get(state, [qId, qField, qValue]) {
    const id = state.resolve<Ident>(qId);
    if (id) {
      const rec = state.db.get(id);
      if (!rec) return;
      const field = state.resolve<keyof Rec>(qField);
      if (field) {
        const value = rec[field];
        const ns = state.unify(qValue, k(value));
        if (ns) yield { tag: "result", state: ns };
      } else {
        for (const [field, value] of Object.entries(rec)) {
          const ns = state.unify(qField, k(field));
          if (!ns) continue;
          const ns1 = ns.unify(qValue, k(value));
          if (!ns1) continue;
          yield { tag: "result", state: ns1 };
        }
      }
      return;
    }
    const field = state.resolve<keyof Rec>(qField);
    const value = state.resolve<Id>(qValue);
    if (!field || !value) {
      throw new Error("either id or field + value must be ground");
    }
    const index = state.db.getIndex(field);
    if (!index) throw new Error("TODO: non-indexed");
    for (const [{ entityId }] of index.tree.where(whereValue(value))) {
      const ns = state.unify(qId, k(entityId));
      if (!ns) continue;
      yield { tag: "result", state: ns };
    }
  },
  *rule__insert(state, [qId, qValue]) {
    const id = state.resolve<Id>(qId);
    if (!id) return;
    const value = state.resolve<Rec>(qValue)!;
    // TODO: handle rollback
    // TODO: distinguish between null value & no response?
    state.db.insert(id, value);
    yield { tag: "result", state };
  },
  *rule__update(state, [qId, qField, qValue]) {
    const id = state.resolve<Id>(qId);
    if (!id) return;
    const field = state.resolve<Field>(qField);
    if (!field) return;
    const value = state.resolve(qValue)!;
    // TODO: distinguish between null value & no response
    state.db.update(id, field, value);
    yield { tag: "result", state };
  },
  *rule__eq(state, [exprL, exprR]) {
    const nextState = state.unify(exprL, exprR);
    if (nextState) yield { tag: "result", state: nextState };
  },
  *rule__log(state, [qMsg]) {
    const message = state.resolve<string>(qMsg);
    console.log(message, state.getScope());
    yield { tag: "result", state };
  },
  *rule__members(state, [qList, qItem]) {
    const list = state.resolve<unknown[]>(qList);
    if (!list) return;
    for (const item of list) {
      const ns = state.unify(qItem, k(item));
      if (ns) yield { tag: "result", state: ns };
    }
  },
  *rule__call(state, [qRule, ...qArgs]) {
    const ruleId = state.resolve<Id>(qRule);
    if (!ruleId) return;
    const rule = state.db.get(ruleId) as RuleRec;
    if (!rule) return;
    // TODO: call should allow out params
    const args = qArgs.map((arg) => state.resolve(arg)!);
    yield* state.runRule(rule, args);
  },
  *rule__or(state, items) {
    for (const qBody of items) {
      const body = state.resolve<Clause[]>(qBody);
      if (!body) throw new Error();
      yield* state.runRuleBody(body);
    }
  },
  *rule__cond(state, groups) {
    for (const qPair of groups) {
      const pair = state.resolve<{ cond: Clause[]; body: Clause[] }>(qPair);
      if (!pair) throw new Error();
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
    const limit = state.resolve<number>(qLimit);
    if (!limit) throw new Error();
    const block = state.resolve<Clause[]>(qBlock);
    if (!block) throw new Error();
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
