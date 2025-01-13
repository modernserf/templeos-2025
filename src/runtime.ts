import { numberOrd, Where } from "./index";
import { DB } from "./db";
import { Expr, getVar, Ident, isOut, setVar } from "./expr";
import { Rec, Field, ViewPrimitive } from "./schema";
import { Query, QueryItem } from "./query";

type Id = string;

export type QueryArgs = Record<Ident, unknown>;

type RefIndex = { entityId: Id; valueId: Id };

function whereValue(valueId: Id): Where<RefIndex> {
  return {
    cmp(item) {
      return numberOrd.cmp(valueId, item.valueId);
    },
    order: "asc",
  };
}

export type HydratedViewElement = {
  view: string;
  args: Record<string, unknown>;
  children: HydratedViewElement[];
};

class QueryState {
  constructor(
    private queryItems: QueryItem[],
    private args: QueryArgs,
    private index: number = 0,
    private rollbackMap: Map<Id, Rec> = new Map()
  ) {}
  // TODO: typechecking, default values
  static init(query: Query, args: QueryArgs) {
    const out: QueryArgs = {};
    for (const key of query.params) {
      out[key] = args[key];
    }
    return new QueryState(query.items, out);
  }
  isOut(expr: Expr) {
    return isOut(this.args, expr);
  }
  get<T>(expr: Expr) {
    return getVar<T>(this.args, expr);
  }
  set(binding: Expr, value: unknown): boolean {
    return setVar(this.args, binding, value);
  }
  getArgs(args: Record<string, Expr>) {
    return Object.fromEntries(
      Object.entries(args).map(([k, v]) => [k, this.get(v)])
    );
  }
  advance() {
    const current = this.queryItems[this.index];
    this.index += 1;
    return current;
  }
  done() {
    if (this.index >= this.queryItems.length) {
      return this.args;
    } else {
      throw new Error("not done");
    }
  }
  getState() {
    return { ...this.args };
  }
  fork() {
    return new QueryState(
      this.queryItems,
      { ...this.args },
      this.index,
      this.rollbackMap
    );
  }
  savePrev(id: Id, prev: Rec) {
    if (this.rollbackMap.has(id)) return;
    this.rollbackMap.set(id, { ...prev });
  }
  rollback() {
    return this.rollbackMap;
  }
}

type QueryResult =
  | { tag: "result"; value: QueryArgs }
  | { tag: "viewPrimitive"; args: QueryArgs; primitive: ViewPrimitive };

export class Runtime {
  constructor(private db: DB<Rec>) {}
  private eventListeners: Array<() => void> = [];

  bulkInsert(items: Record<Id, Rec>) {
    for (const [id, rec] of Object.entries(items)) {
      this.db.insert(id, rec);
    }
    this.notifyEventListeners();
  }
  *render(query: Query, args: QueryArgs = {}) {
    for (const result of this.runQuery(QueryState.init(query, args))) {
      if (result.tag === "viewPrimitive") yield result;
    }
  }
  query1(query: Query, args: QueryArgs = {}) {
    for (const item of this.runQuery(QueryState.init(query, args))) {
      if (item.tag === "result") return item.value;
    }
    return null;
  }
  *queryAll(query: Query, args: QueryArgs = {}) {
    for (const item of this.runQuery(QueryState.init(query, args))) {
      if (item.tag === "result") yield item.value;
    }
  }
  update(query: Query, args: QueryArgs = {}) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _ of this.runQuery(QueryState.init(query, args))) {
      // empty
    }
    this.notifyEventListeners();
  }

  addEventListener(fn: () => void) {
    this.eventListeners.push(fn);
    return () => {
      this.eventListeners = this.eventListeners.filter((f) => f !== fn);
    };
  }
  private notifyEventListeners() {
    for (const l of this.eventListeners) {
      l();
    }
  }

  private *runGet1(state: QueryState, q: { id: Expr }) {
    if (state.isOut(q.id)) {
      for (const id of this.db.keys()) {
        const nextState = state.fork();
        nextState.set(q.id, id);
        yield* this.runQuery(nextState);
      }
    } else {
      const id = state.get<Id>(q.id);
      if (this.db.get(id)) {
        yield* this.runQuery(state);
      }
    }
  }
  private *runGet2(state: QueryState, q: { id: Expr; field: Expr }) {
    const id = state.get<Id>(q.id);
    const record = this.db.get(id);
    if (state.isOut(q.field)) {
      for (const [f, value] of Object.entries(record ?? {})) {
        if (value != null) {
          const nextState = state.fork();
          nextState.set(q.field, f);
          yield* this.runQuery(nextState);
        }
      }
    } else {
      const field = state.get<Field>(q.field);
      if (record?.[field]) {
        yield* this.runQuery(state);
      }
    }
  }
  private *runGet3(state: QueryState, q: QueryItem & { tag: "get/3" }) {
    if (state.isOut(q.id)) {
      const refId = state.get<Id>(q.value);
      const field = state.get<Field>(q.field);
      const index = this.db.getIndex(field);
      if (!index) return;
      for (const [{ entityId }] of index.where(whereValue(refId))) {
        const nextState = state.fork();
        nextState.set(q.id, entityId);
        yield* this.runQuery(nextState);
      }
    } else {
      const id = state.get<Id>(q.id);
      const field = state.get<Field>(q.field);
      const record = this.db.get(id);
      if (!record) return;
      if (state.set(q.value, record[field])) {
        yield* this.runQuery(state);
      }
    }
  }
  // TODO: running view and rule should be similar
  private *runView(state: QueryState, q: QueryItem & { tag: "view" }) {
    const viewId = state.get<Id>(q.view);
    const view = this.db.get(viewId);
    if (!view) throw new Error(`unknown view ${viewId}`);
    const args = state.getArgs(q.args);
    if (view.view__primitive) {
      yield { tag: "viewPrimitive", args, primitive: view.view__primitive };
    } else if (view.view__query) {
      for (const res of this.runQuery(
        QueryState.init(view.view__query, args)
      )) {
        if (res.tag === "viewPrimitive") yield res;
      }
    }

    yield* this.runQuery(state);
  }
  private *runQuery(
    state: QueryState
  ): Generator<QueryResult, undefined, undefined> {
    const q = state.advance();
    if (!q) {
      yield { tag: "result", value: state.done() };
      return;
    }
    switch (q.tag) {
      case "view":
        yield* this.runView(state, q);
        return;
      case "get/1":
        yield* this.runGet1(state, q);
        return;
      case "get/2":
        yield* this.runGet2(state, q);
        return;
      case "get/3":
        yield* this.runGet3(state, q);
        return;
      // TODO: condition
      case "rollback": {
        for (const [key, value] of state.rollback()) {
          this.db.insert(key, value as Rec);
        }
        return;
      }
      case "id": {
        const id = crypto.randomUUID();
        state.set(q.id, id);
        yield* this.runQuery(state);
        return;
      }
      case "timestamp": {
        const timestamp = Date.now();
        state.set(q.timestamp, timestamp);
        yield* this.runQuery(state);
        return;
      }
      case "members": {
        for (const item of state.get<unknown[]>(q.collection)) {
          const nextState = state.fork();
          nextState.set(q.item, item);
          yield* this.runQuery(nextState);
        }
        return;
      }
      case "insert": {
        const id = state.get<Id>(q.id);
        const rec = state.get<Rec>(q.record) ?? {};
        state.savePrev(id, this.db.get(id) ?? {});
        this.db.insert(id, rec);
        yield* this.runQuery(state);
        return;
      }
      case "update": {
        const id = state.get<Id>(q.id);
        const field = state.get<Field>(q.field);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const value = state.get<any>(q.value);
        const record = this.db.get(id);
        state.savePrev(id, record ?? {});
        this.db.update(id, field, value);
        yield* this.runQuery(state);
        return;
      }
      case "rule": {
        const rule = this.db.getRule(q.rule);
        if (!rule) throw new Error();
        const ruleArgs: QueryArgs = {};
        for (const key of rule.query.params) {
          const expr = q.args[key];
          if (expr) {
            ruleArgs[key] = state.get(expr);
          } else {
            ruleArgs[key] = undefined;
          }
        }
        yield* this.runQuery(QueryState.init(rule.query, ruleArgs));
        // TODO
        // for (const key of Object.keys(q.args)) {
        //   setVar(args, { tag: "ident", ident: key }, ruleArgs[key]);
        // }

        yield* this.runQuery(state);
        return;
      }
      case "or": {
        for (const subquery of q.queries) {
          yield* this.runQuery(
            new QueryState(subquery.items, state.getState())
          );
        }
        yield* this.runQuery(state);
        return;
      }
      case "cond": {
        let didSucceed = false;
        const qIfState = new QueryState(q.if, state.getState());
        for (const res of this.runQuery(qIfState)) {
          if (res.tag === "result") {
            didSucceed = true;
            yield* this.runQuery(new QueryState(q.then, res.value));
          }
        }
        if (!didSucceed) {
          yield* this.runQuery(new QueryState(q.else, state.getState()));
        }
        yield* this.runQuery(state);
        return;
      }
    }
  }
}
