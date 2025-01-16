import { numberOrd, Where } from "./index";
import { DB } from "./db";
import { Expr, getVar, isOut, setVar } from "./expr";
import { Query, QueryItem } from "./query";
import { Field, Rec } from "./schema";
import { flatMap } from "./iter";

type RefIndex = { entityId: Id; valueId: Id };
function whereValue(valueId: Id): Where<RefIndex> {
  return {
    cmp(item) {
      return numberOrd.cmp(valueId, item.valueId);
    },
    order: "asc",
  };
}

type Scope = Record<string, unknown>;
type Id = string;
type ExprArgs = Record<string, Expr>;

export type QueryNext =
  | {
      tag: "viewPrimitive";
      primitive: string;
      args: Scope;
      children: QueryNext[];
      state: QueryState;
    }
  | { tag: "result"; value: Scope };
type QueryReturn = { tag: "ok" } | { tag: "fail" };

export class EventSource {
  private eventListeners: Array<() => void> = [];
  addEventListener(fn: () => void) {
    this.eventListeners.push(fn);
    return () => {
      this.eventListeners = this.eventListeners.filter((f) => f !== fn);
    };
  }
  notifyEventListeners() {
    for (const l of this.eventListeners) {
      l();
    }
  }
}

export class QueryState {
  private constructor(
    private queryItems: QueryItem[],
    private scope: Scope,
    private context: Scope,
    private index: number,
    private rollbackMap: Map<Id, Rec>
  ) {}
  static root() {
    return new QueryState([], {}, {}, 0, new Map());
  }
  advance() {
    const item = this.queryItems[this.index];
    this.index += 1;
    return item;
  }
  result() {
    return { ...this.scope };
  }
  done() {
    return this.index == this.queryItems.length;
  }
  hasChanges() {
    return this.rollbackMap.size > 0;
  }
  rollback(db: DB<Rec>) {
    for (const [key, value] of this.rollbackMap) {
      db.insert(key, value);
    }
  }
  isOut(expr: Expr) {
    return isOut(this.scope, expr);
  }
  get<T>(expr: Expr) {
    return getVar<T>(this.scope, expr);
  }
  getArgs(args: ExprArgs) {
    return Object.fromEntries(
      Object.entries(args).map(([k, v]) => [k, this.get(v)])
    );
  }
  tryGetArgs(args: ExprArgs) {
    const evalArgs: Record<string, unknown> = {};
    for (const key in args) {
      if (!this.isOut(args[key])) {
        evalArgs[key] = this.get(args[key]);
      }
    }
    return evalArgs;
  }
  set<T>(binding: Expr, value: T): boolean {
    return setVar(this.scope, binding, value);
  }
  savePrev(id: Id, prev: Rec) {
    if (this.rollbackMap.has(id)) return;
    this.rollbackMap.set(id, { ...prev });
  }
  getContext<T>(field: Expr, binding: Expr) {
    const value = this.context[this.get<Field>(field)] as T;
    if (!value) throw new Error();
    return this.set<T>(binding, value);
  }
  setContext(field: Expr, value: Expr) {
    const nextContext = { ...this.context };
    nextContext[this.get<Field>(field)] = this.get(value);
    this.context = nextContext;
  }
  fork<T>(binding: Expr, value: T) {
    const nextState = new QueryState(
      this.queryItems,
      { ...this.scope },
      this.context,
      this.index,
      this.rollbackMap
    );
    if (!nextState.set(binding, value)) return null;
    return nextState;
  }
  innerScope(items: QueryItem[]) {
    return new QueryState(
      items,
      { ...this.scope },
      this.context,
      0,
      this.rollbackMap
    );
  }
  resume(child: QueryState) {
    return new QueryState(
      this.queryItems,
      child.scope,
      this.context,
      this.index,
      this.rollbackMap
    );
  }
  rule(query: Query, qArgs: ExprArgs) {
    // TODO: check query params against args
    const args = this.tryGetArgs(qArgs);
    return new QueryState(query.items, args, this.context, 0, this.rollbackMap);
  }
  ruleReturn(childState: QueryState, qArgs: ExprArgs, query: Query) {
    for (const p of query.params) {
      const value = childState.scope[p];
      this.set(qArgs[p], value);
    }
  }
  update(query: Query, args: Scope) {
    return new QueryState(query.items, args, this.context, 0, this.rollbackMap);
  }
  eventHandler(query: Query, args: Scope) {
    return new QueryState(
      query.items,
      { ...this.scope, ...args },
      this.context,
      0,
      this.rollbackMap
    );
  }
}

export class Runtime {
  constructor(private db: DB<Rec>, private es: EventSource) {}
  bulkInsert(items: Record<Id, Rec>) {
    for (const [id, rec] of Object.entries(items)) {
      this.db.insert(id, rec);
    }
    this.es.notifyEventListeners();
  }
  *query(qs: QueryState) {
    const res = yield* this.runQuery(qs);
    if (res.tag === "fail") {
      qs.rollback(this.db);
    } else if (qs.hasChanges()) {
      this.es.notifyEventListeners();
    }
  }
  private *runQuery(qs: QueryState): Generator<QueryNext, QueryReturn> {
    if (qs.done()) {
      yield { tag: "result", value: qs.result() };
      return { tag: "ok" };
    }
    const q = qs.advance();
    switch (q.tag) {
      case "fail":
        return { tag: "fail" };
      case "get/1":
        return yield* this.get1(qs, q.id);
      case "get/2":
        return yield* this.get2(qs, q.id, q.field);
      case "get/3":
        return yield* this.get3(qs, q.id, q.field, q.value);
      case "insert": {
        const id = qs.get<Id>(q.id);
        const rec = qs.get<Rec>(q.record) ?? {};
        qs.savePrev(id, this.db.get(id) ?? {});
        this.db.insert(id, rec);
        return yield* this.runQuery(qs);
      }
      case "update": {
        const id = qs.get<Id>(q.id);
        const field = qs.get<Field>(q.field);
        const value = qs.get(q.value);
        const record = this.db.get(id);
        qs.savePrev(id, record ?? {});
        this.db.update(id, field, value);
        return yield* this.runQuery(qs);
      }
      case "id": {
        const id = crypto.randomUUID();
        if (!qs.set(q.id, id)) return { tag: "fail" };
        return yield* this.runQuery(qs);
      }
      case "timestamp": {
        const timestamp = Date.now();
        if (!qs.set(q.timestamp, timestamp)) return { tag: "fail" };
        return yield* this.runQuery(qs);
      }
      case "or": {
        yield* this.runQuery(qs.innerScope(q.items));
        return yield* this.runQuery(qs);
      }
      case "cond": {
        const ifScope = qs.innerScope(q.if);
        const ifRes = yield* this.runQuery(ifScope);
        if (ifRes.tag === "ok") {
          const thenScope = ifScope.innerScope(q.then);
          const res = yield* this.runQuery(thenScope);
          if (res.tag === "fail") return res;
          return yield* this.runQuery(qs.resume(thenScope));
        }
        const elseScope = qs.innerScope(q.else);
        const res = yield* this.runQuery(elseScope);
        if (res.tag === "fail") return res;
        return yield* this.runQuery(qs.resume(elseScope));
      }
      case "result":
        yield { tag: "result", value: qs.result() };
        return yield* this.runQuery(qs);
      case "log": {
        const message = qs.get(q.message);
        console.log(message, qs.result());
        return yield* this.runQuery(qs);
      }
      case "view":
        return yield* this.view(qs, q.view, q.args, q.children);
      case "rule":
        return yield* this.rule(qs, q.rule, q.args);
      case "members":
        return yield* this.members(qs, q.item, q.collection);
      case "getContext":
        if (!qs.getContext(q.field, q.value)) return { tag: "fail" };
        return yield* this.runQuery(qs);
      case "setContext":
        qs.setContext(q.field, q.value);
        return yield* this.runQuery(qs);
      case "limit": {
        const max = qs.get(q.count);
        let resultCount = 0;
        for (const res of this.runQuery(qs)) {
          if (resultCount === max) break;
          if (res.tag === "result") resultCount += 1;
          yield res;
        }
        return { tag: "ok" };
      }
      case "matchString": {
        const matcher = qs.get<string>(q.matcher);
        const re = new RegExp(matcher, "i");
        const subject = qs.get<string>(q.subject);
        if (re.test(subject)) {
          return yield* this.runQuery(qs);
        } else {
          return { tag: "fail" };
        }
      }
      default:
        return { tag: "fail" };
    }
  }
  private *get1(qs: QueryState, qId: Expr): Generator<QueryNext, QueryReturn> {
    if (qs.isOut(qId)) {
      for (const id of this.db.keys()) {
        const nextState = qs.fork(qId, id);
        if (!nextState) return { tag: "fail" };
        yield* this.runQuery(nextState);
      }
      return { tag: "ok" };
    }
    const id = qs.get<Id>(qId);
    if (!this.db.get(id)) return { tag: "fail" };
    return yield* this.runQuery(qs);
  }
  private *get2(
    qs: QueryState,
    qId: Expr,
    qField: Expr
  ): Generator<QueryNext, QueryReturn> {
    const id = qs.get<Id>(qId);
    const record = this.db.get(id);
    if (!record) return { tag: "fail" };
    if (qs.isOut(qField)) {
      for (const [f, value] of Object.entries(record)) {
        if (value != null) {
          const nextState = qs.fork(qField, f);
          if (!nextState) return { tag: "fail" };
          yield* this.runQuery(nextState);
        }
      }
      return { tag: "ok" };
    }
    const field = qs.get<Field>(qField);
    if (!record[field]) return { tag: "fail" };
    return yield* this.runQuery(qs);
  }
  private *get3(
    qs: QueryState,
    qId: Expr,
    qField: Expr,
    qValue: Expr
  ): Generator<QueryNext, QueryReturn> {
    const field = qs.get<Field>(qField);
    if (qs.isOut(qId)) {
      const refId = qs.get<Id>(qValue);
      const index = this.db.getIndex(field);
      if (!index) return { tag: "fail" };
      for (const [{ entityId }] of index.where(whereValue(refId))) {
        const nextState = qs.fork(qId, entityId);
        if (!nextState) return { tag: "fail" };
        yield* this.runQuery(nextState);
      }
      return { tag: "ok" };
    }
    const id = qs.get<Id>(qId);
    const record = this.db.get(id);
    if (!record || !qs.set(qValue, record[field])) return { tag: "fail" };
    return yield* this.runQuery(qs);
  }
  private *view(
    qs: QueryState,
    qView: Expr,
    qArgs: ExprArgs,
    qChildren: QueryItem[]
  ): Generator<QueryNext, QueryReturn> {
    const viewId = qs.get<Id>(qView);
    const view = this.db.get(viewId);
    if (!view) throw new Error(`Unknown view ${viewId}`);

    let viewState = qs;
    if (view.view__query) {
      viewState = qs.rule(view.view__query, qArgs);
      const res = yield* this.runQuery(viewState);
      if (res.tag === "fail") return res;
    }

    if (view.view__primitive) {
      const children = Array.from(
        this.runQuery(viewState.innerScope(qChildren))
      );
      yield {
        tag: "viewPrimitive",
        args: viewState.getArgs(qArgs),
        primitive: view.view__primitive,
        children,
        state: viewState,
      };
    }

    return yield* this.runQuery(qs);
  }
  private *rule(
    qs: QueryState,
    qRule: Expr,
    qArgs: ExprArgs
  ): Generator<QueryNext, QueryReturn> {
    const ruleId = qs.get<Id>(qRule);
    const rule = this.db.get(ruleId);
    if (!rule) throw new Error(`Unknown rule ${ruleId}`);
    if (!rule.rule__query) throw new Error(`Invalid rule ${ruleId}`);

    const ruleState = qs.rule(rule.rule__query, qArgs);
    // don't yield results/views from rule
    const res = yield* flatMap(function* () {}, this.runQuery(ruleState));
    if (res.tag === "fail") return res;
    qs.ruleReturn(ruleState, qArgs, rule.rule__query);
    return yield* this.runQuery(qs);
  }
  private *members(
    qs: QueryState,
    qItem: Expr,
    qCollection: Expr
  ): Generator<QueryNext, QueryReturn> {
    for (const item of qs.get<unknown[]>(qCollection)) {
      const nextState = qs.fork(qItem, item);
      if (!nextState) return { tag: "fail" };
      yield* this.runQuery(nextState);
    }
    return { tag: "ok" };
  }
}
