import { Arg, getVar, Ident, KArg, kToExpr, setVar, toExpr } from "./expr";
import { Expr } from "./expr";

type Id = string;
type Field = string;
type Rule = string;

type BaseRec = Record<Field, unknown>;
type Idx = Record<Field, Set<Id>>;

export type Query = {
  params: Ident[];
  items: QueryItem[];
};

type QueryItem =
  | { tag: "rollback" }
  | { tag: "id"; id: Expr }
  | { tag: "members"; item: Expr; collection: Expr }
  | { tag: "all"; id: Expr }
  | { tag: "fields"; id: Expr; field: Expr }
  | { tag: "get"; id: Expr; field: Expr; value: Expr }
  | { tag: "index"; id: Expr; field: Expr; value: Expr }
  | { tag: "insert"; id: Expr; record: Expr }
  | { tag: "update"; id: Expr; field: Expr; value: Expr }
  | { tag: "rule"; rule: Rule; args: Record<string, Expr> };

export type QueryArgs = Record<Ident, unknown>;

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
  members(item: Arg, collection: Arg) {
    this.items.push({
      tag: "members",
      item: toExpr(item),
      collection: toExpr(collection),
    });
    return this;
  }
  all(id: Arg) {
    this.items.push({ tag: "all", id: toExpr(id) });
    return this;
  }
  fields(id: Arg, field: Arg) {
    this.items.push({ tag: "fields", id: toExpr(id), field: toExpr(field) });
    return this;
  }
  get(id: Arg, field: KArg, value: Arg) {
    this.items.push({
      tag: "get",
      id: toExpr(id),
      field: kToExpr(field),
      value: toExpr(value),
    });
    return this;
  }
  index(id: Arg, field: KArg, value: Arg) {
    this.items.push({
      tag: "index",
      id: toExpr(id),
      field: kToExpr(field),
      value: toExpr(value),
    });
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

class QueryState {
  constructor(
    private query: Query,
    private args: QueryArgs,
    private index: number,
    private rollbackMap: Map<Id, BaseRec>
  ) {}
  // TODO: typechecking, default values
  static init(query: Query, args: QueryArgs) {
    const out: QueryArgs = {};
    for (const key of query.params) {
      out[key] = args[key];
    }
    return new QueryState(query, out, 0, new Map());
  }
  get<T>(expr: Expr) {
    return getVar<T>(this.args, expr);
  }
  set(binding: Expr, value: unknown) {
    setVar(this.args, binding, value);
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
  savePrev(id: Id, prev: BaseRec) {
    if (this.rollbackMap.has(id)) return;
    this.rollbackMap.set(id, { ...prev });
  }
  rollback() {
    return this.rollbackMap;
  }
}

export const q = (...params: Ident[]) => new QueryBuilder(params);

export class DB<Rec extends BaseRec> {
  private data = new Map<Id, Rec>();
  private index = new Map<Id, Idx>();
  private indexedFields = new Set<Field>();
  private eventListeners: Array<() => void> = [];
  private rules = new Map<string, { query: Query }>();
  // FIXME
  getDataView(id: Id) {
    return {
      data: this.data.get(id),
      index: this.index.get(id),
    };
  }
  bulkInsert(items: Record<Id, Rec>) {
    for (const [id, rec] of Object.entries(items)) {
      this.insertRec(id, rec);
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
  createIndex(field: Field) {
    this.indexedFields.add(field);
    for (const [id, rec] of this.data) {
      if (field in rec) {
        this.addToIndex(id, field, rec[field] as Id);
      }
    }
  }
  addEventListener(fn: () => void) {
    this.eventListeners.push(fn);
    return () => {
      this.eventListeners = this.eventListeners.filter((f) => f !== fn);
    };
  }
  createRule(name: string, query: Query) {
    this.rules.set(name, { query });
  }
  private notifyEventListeners() {
    for (const l of this.eventListeners) {
      l();
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
      // TODO: condition
      case "rollback": {
        for (const [key, value] of state.rollback()) {
          this.insertRec(key, value as Rec);
        }
        return;
      }
      case "id": {
        const id = crypto.randomUUID();
        state.set(q.id, id);
        yield* this.runQuery(state);
        return;
      }
      case "all": {
        for (const id of this.data.keys()) {
          const nextState = state.fork();
          nextState.set(q.id, id);
          yield* this.runQuery(nextState);
        }
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
      case "fields": {
        const id = state.get<Id>(q.id);
        const record = this.data.get(id) ?? {};
        for (const [f, value] of Object.entries(record)) {
          if (value != null) {
            const nextState = state.fork();
            nextState.set(q.field, f);
            yield* this.runQuery(nextState);
          }
        }
        return;
      }
      case "get": {
        const id = state.get<Id>(q.id);
        const field = state.get<Field>(q.field);
        const record = this.data.get(id);
        if (!record) return;
        state.set(q.value, record[field]);
        yield* this.runQuery(state);
        return;
      }
      case "index": {
        const value = state.get<Id>(q.value);
        const field = state.get<Field>(q.field);
        const idx = this.index.get(value);
        if (!idx) return;
        const ids = idx[field];
        if (!ids) return;
        for (const id of ids) {
          const nextState = state.fork();
          nextState.set(q.id, id);
          yield* this.runQuery(nextState);
        }
        return;
      }
      case "insert": {
        const id = state.get<Id>(q.id);
        const rec = state.get<Rec>(q.record) ?? {};
        state.savePrev(id, this.data.get(id) ?? {});
        this.insertRec(id, rec);
        yield* this.runQuery(state);
        return;
      }
      case "update": {
        const id = state.get<Id>(q.id);
        const field = state.get<Field>(q.field);
        const value = state.get(q.value);
        let record = this.data.get(id);
        state.savePrev(id, record ?? {});
        if (!record) {
          record = {} as Rec;
          this.data.set(id, record);
        }
        const prevValue = record[field];
        (record as BaseRec)[field] = value;
        if (this.indexedFields.has(field)) {
          if (prevValue) this.removeFromIndex(id, field, prevValue as Id);
          if (value) this.addToIndex(id, field, value as Id);
        }

        yield* this.runQuery(state);
        return;
      }
      case "rule": {
        const rule = this.rules.get(q.rule);
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
  private insertRec(id: Id, rec: Rec) {
    const prev = this.data.get(id);
    if (prev) {
      for (const [field, value] of Object.entries(prev)) {
        if (this.indexedFields.has(field)) {
          this.removeFromIndex(id, field, value as Id);
        }
      }
    }
    this.data.set(id, rec);
    for (const [field, value] of Object.entries(rec)) {
      if (this.indexedFields.has(field)) {
        this.addToIndex(id, field, value as Id);
      }
    }
    if (rec.db__schema === "schema__field" && rec.field__index) {
      this.createIndex(id as Field);
    }
    if (rec.db__schema === "schema__rule" && rec.rule__id && rec.rule__query) {
      this.createRule(rec.rule__id as string, rec.rule__query as Query);
    }
  }
  private addToIndex(id: Id, field: Field, value: Id) {
    let idx = this.index.get(value);
    if (!idx) {
      idx = {};
      this.index.set(value, idx);
    }
    idx[field] ??= new Set();
    idx[field].add(id);
  }
  private removeFromIndex(id: Id, field: Field, value: Id) {
    const idx = this.index.get(value);
    if (!idx) return;
    idx[field]?.delete(id);
  }
}
