type Id = string;
type Field = string;

type Rec = Record<Field, unknown>;
type Idx = Record<Field, Set<Id>>;

type Ident = string;
type Expr =
  | { tag: "ident"; ident: Ident }
  | { tag: "const"; value: unknown }
  | { tag: "or"; expr: Expr; default: Expr };
export type Query = {
  params: Ident[];
  items: QueryItem[];
};

type QueryItem =
  | { tag: "id"; id: Expr }
  | { tag: "all"; id: Expr }
  | { tag: "get"; id: Expr; field: Field; value: Expr }
  | { tag: "index"; id: Expr; field: Field; value: Expr }
  | { tag: "insert"; id: Expr; record: Expr }
  | { tag: "update"; id: Expr; field: Field; value: Expr }
  | { tag: "deleteField"; id: Expr; field: Field }
  | { tag: "deleteRecord"; id: Expr };

export type QueryArgs = Record<Ident, unknown>;

type Arg = string | Expr;

class QueryBuilder implements Query {
  items: QueryItem[] = [];
  constructor(public params: Ident[]) {}
  id(id: Arg) {
    this.items.push({ tag: "id", id: toExpr(id) });
    return this;
  }
  all(id: Arg) {
    this.items.push({ tag: "all", id: toExpr(id) });
    return this;
  }
  get(id: Arg, field: Field, value: Arg) {
    this.items.push({
      tag: "get",
      id: toExpr(id),
      field,
      value: toExpr(value),
    });
    return this;
  }
  index(id: Arg, field: Field, value: Arg) {
    this.items.push({
      tag: "index",
      id: toExpr(id),
      field,
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
  update(id: Arg, field: Field, value: Arg) {
    this.items.push({
      tag: "update",
      id: toExpr(id),
      field,
      value: toExpr(value),
    });
    return this;
  }
  deleteField(id: Arg, field: Field) {
    this.items.push({ tag: "deleteField", id: toExpr(id), field });
    return this;
  }
  deleteRecord(id: Arg) {
    this.items.push({ tag: "deleteRecord", id: toExpr(id) });
    return this;
  }
}

const toExpr = (arg: Arg): Expr => {
  if (typeof arg === "string") {
    return { tag: "ident", ident: arg };
  } else {
    return arg;
  }
};

export const q = (...params: Ident[]) => new QueryBuilder(params);
export const k = (value: unknown): Expr => ({ tag: "const", value });
export const or = (left: Arg, right: Arg): Expr => ({
  tag: "or",
  expr: toExpr(left),
  default: toExpr(right),
});

function getVar<T>(scope: QueryArgs, expr: Expr): T {
  switch (expr.tag) {
    case "ident": {
      if (!(expr.ident in scope)) throw new Error();
      return scope[expr.ident] as T;
    }
    case "const": {
      const value = expr.value;
      return value as T;
    }
    case "or": {
      return getVar<T>(scope, expr.expr) ?? getVar<T>(scope, expr.default);
    }
  }
}

function setVar<T>(scope: QueryArgs, binding: Expr, value: T) {
  switch (binding.tag) {
    case "ident": {
      const { ident } = binding;
      if (ident in scope) {
        if (scope[ident] !== value) throw new Error();
      } else {
        scope[ident] = value;
      }
      return;
    }
    case "const": {
      throw new Error("assigning to constant");
    }
  }
}

export class DB {
  private data = new Map<Id, Rec>();
  private index = new Map<Id, Idx>();
  private indexedFields = new Set<Field>();
  private eventListeners: Array<() => void> = [];
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
    const iter = this.runQuery(query, { ...args });
    return iter.next().value;
  }
  queryAll(query: Query, args: QueryArgs = {}) {
    return this.runQuery(query, { ...args });
  }
  update(query: Query, args: QueryArgs = {}) {
    for (const _ of this.runQuery(query, { ...args })) {
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
  private notifyEventListeners() {
    for (const l of this.eventListeners) {
      l();
    }
  }
  private insertRec(id: Id, rec: Rec) {
    this.data.set(id, rec);
    for (const [field, value] of Object.entries(rec)) {
      if (this.indexedFields.has(field)) {
        this.addToIndex(id, field, value as Id);
      }
    }
    if (rec.db__schema === "schema__index" && rec.index__field) {
      this.createIndex(rec.index__field as Field);
    }
  }
  private *runQuery(
    query: Query,
    args: QueryArgs,
    index = 0
  ): Generator<QueryArgs, undefined, undefined> {
    if (index >= query.items.length) {
      yield args;
      return;
    }
    const q = query.items[index];
    switch (q.tag) {
      case "id": {
        const id = crypto.randomUUID();
        setVar(args, q.id, id);
        yield* this.runQuery(query, args, index + 1);
        return;
      }
      case "all": {
        for (const id of this.data.keys()) {
          const nextArgs = { ...args };
          setVar(nextArgs, q.id, id);
          yield* this.runQuery(query, nextArgs, index + 1);
        }
        return;
      }
      case "get": {
        const id = getVar<Id>(args, q.id);
        const record = this.data.get(id);
        if (!record) return;
        setVar(args, q.value, record[q.field]);
        yield* this.runQuery(query, args, index + 1);
        return;
      }
      case "index": {
        const value = getVar<Id>(args, q.value);
        const idx = this.index.get(value);
        if (!idx) return;
        const ids = idx[q.field];
        if (!ids) return;
        for (const id of ids) {
          const nextArgs = { ...args };
          setVar(nextArgs, q.id, id);
          yield* this.runQuery(query, nextArgs, index + 1);
        }
        return;
      }
      case "insert": {
        const id = getVar<Id>(args, q.id);
        const rec = getVar<Rec>(args, q.record);
        this.insertRec(id, rec);
        yield* this.runQuery(query, args, index + 1);
        return;
      }
      case "update": {
        const id = getVar<Id>(args, q.id);
        const value = getVar(args, q.value);
        let record = this.data.get(id);
        if (!record) {
          record = {};
          this.data.set(id, record);
        }
        const prevValue = record[q.field];
        record[q.field] = value;
        if (this.indexedFields.has(q.field)) {
          if (prevValue) this.removeFromIndex(id, q.field, prevValue as Id);
          this.addToIndex(id, q.field, value as Id);
        }

        yield* this.runQuery(query, args, index + 1);
        return;
      }
      case "deleteRecord": {
        const id = getVar<Id>(args, q.id);
        const record = this.data.get(id);
        if (record) {
          for (const [field, value] of Object.entries(record)) {
            if (this.indexedFields.has(field)) {
              this.removeFromIndex(id, field, value as Id);
            }
          }
        }
        this.data.delete(id);
        yield* this.runQuery(query, args, index + 1);
        return;
      }
      case "deleteField": {
        const id = getVar<Id>(args, q.id);
        const record = this.data.get(id);
        if (record) {
          if (this.indexedFields.has(q.field)) {
            this.removeFromIndex(id, q.field, record[q.field] as Id);
          }
          record[id] = undefined;
        }
        yield* this.runQuery(query, args, index + 1);
        return;
      }
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
