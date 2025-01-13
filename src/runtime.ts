import { numberOrd, Where } from "./index";
import { DB } from "./db";
import {
  Expr,
  getVar,
  Ident,
  isOut,
  setVar,
  Arg,
  KArg,
  kToExpr,
  toExpr,
} from "./expr";
import { Rec, Field } from "./schema";

type Id = string;
type Rule = string;
type View = string;

export type Query = {
  params: Ident[];
  items: QueryItem[];
};

export const q = (...params: Ident[]) => new QueryBuilder(params);

class QueryBuilder implements Query {
  items: QueryItem[] = [];
  constructor(public params: Ident[]) {}
  rollback() {
    this.items.push({ tag: "rollback" });
    return this;
  }
  id(id: Arg) {
    this.items.push({ tag: "id", id: toExpr(id) });
    return this;
  }
  timestamp(timestamp: Arg) {
    this.items.push({ tag: "timestamp", timestamp: toExpr(timestamp) });
    return this;
  }
  members(item: Arg, collection: Arg) {
    this.items.push({
      tag: "members",
      item: toExpr(item),
      collection: toExpr(collection),
    });
    return this;
  }
  get(id: Arg, field?: KArg, value?: Arg) {
    if (field) {
      if (value) {
        this.items.push({
          tag: "get/3",
          id: toExpr(id),
          field: kToExpr(field),
          value: toExpr(value),
        });
      } else {
        this.items.push({
          tag: "get/2",
          id: toExpr(id),
          field: kToExpr(field),
        });
      }
    } else {
      this.items.push({
        tag: "get/1",
        id: toExpr(id),
      });
    }

    return this;
  }
  insert(id: Arg, record: Arg) {
    this.items.push({
      tag: "insert",
      id: toExpr(id),
      record: toExpr(record),
    });
    return this;
  }
  update(id: Arg, field: KArg, value: Arg) {
    this.items.push({
      tag: "update",
      id: toExpr(id),
      field: kToExpr(field),
      value: toExpr(value),
    });
    return this;
  }
  rule(rule: Rule, args: Record<string, Arg>) {
    this.items.push({
      tag: "rule",
      rule,
      args: Object.fromEntries(
        Object.entries(args).map(([k, v]) => [k, toExpr(v)])
      ),
    });
    return this;
  }
}

type QueryItem =
  | { tag: "rollback" }
  | { tag: "id"; id: Expr }
  | { tag: "timestamp"; timestamp: Expr }
  | { tag: "members"; item: Expr; collection: Expr }
  | { tag: "get/1"; id: Expr }
  | { tag: "get/2"; id: Expr; field: Expr }
  | { tag: "get/3"; id: Expr; field: Expr; value: Expr }
  | { tag: "insert"; id: Expr; record: Expr }
  | { tag: "update"; id: Expr; field: Expr; value: Expr }
  | { tag: "rule"; rule: Rule; args: Record<string, Expr> }
  | {
      tag: "view";
      id: View;
      args: Record<string, Expr>;
      children: QueryItem[];
    };

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

class QueryState {
  constructor(
    private query: Query,
    private args: QueryArgs,
    private index: number,
    private rollbackMap: Map<Id, Rec>
  ) {}
  // TODO: typechecking, default values
  static init(query: Query, args: QueryArgs) {
    const out: QueryArgs = {};
    for (const key of query.params) {
      out[key] = args[key];
    }
    return new QueryState(query, out, 0, new Map());
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
  advance() {
    const current = this.query.items[this.index];
    this.index += 1;
    return current;
  }
  done() {
    if (this.index >= this.query.items.length) {
      return this.args;
    } else {
      throw new Error("not done");
    }
  }
  fork() {
    return new QueryState(
      this.query,
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

export class Runtime {
  constructor(private db: DB<Rec>) {}
  private eventListeners: Array<() => void> = [];

  bulkInsert(items: Record<Id, Rec>) {
    for (const [id, rec] of Object.entries(items)) {
      this.db.insert(id, rec);
    }
    this.notifyEventListeners();
  }
  query1(query: Query, args: QueryArgs = {}) {
    const iter = this.runQuery(QueryState.init(query, args));
    return iter.next().value;
  }
  queryAll(query: Query, args: QueryArgs = {}) {
    return this.runQuery(QueryState.init(query, args));
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
  private *runQuery(
    state: QueryState
  ): Generator<QueryArgs, undefined, undefined> {
    const q = state.advance();
    if (!q) {
      yield state.done();
      return;
    }
    switch (q.tag) {
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
    }
  }
}
