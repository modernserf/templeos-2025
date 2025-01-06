type Id = string;
type Field = string;

type Rec = Record<Field, unknown>;
type Idx = Record<Field, Set<Id>>;

type Ident = string;
export type Query = {
  params: Ident[];
  items: QueryItem[];
};

type QueryItem =
  | { tag: "id"; id: Ident }
  | { tag: "all"; id: Ident }
  | { tag: "get"; id: Ident; field: Field; value: Ident }
  | { tag: "index"; id: Ident; field: Field; value: Ident }
  | { tag: "insert"; id: Ident; record: Ident }
  | { tag: "update"; id: Ident; field: Field; value: Ident }
  | { tag: "deleteField"; id: Ident; field: Field }
  | { tag: "deleteRecord"; id: Ident };

export type QueryArgs = Record<Ident, unknown>;

class QueryBuilder implements Query {
  items: QueryItem[] = [];
  constructor(public params: Ident[]) {}
  id(id: Ident) {
    this.items.push({ tag: "id", id });
    return this;
  }
  all(id: Ident) {
    this.items.push({ tag: "all", id });
    return this;
  }
  get(id: Ident, field: Field, value: Ident) {
    this.items.push({ tag: "get", id, field, value });
    return this;
  }
  index(id: Ident, field: Field, value: Ident) {
    this.items.push({ tag: "index", id, field, value });
    return this;
  }
  insert(id: Ident, record: Ident) {
    this.items.push({ tag: "insert", id, record });
    return this;
  }
  update(id: Ident, field: Field, value: Ident) {
    this.items.push({ tag: "update", id, field, value });
    return this;
  }
  deleteField(id: Ident, field: Field) {
    this.items.push({ tag: "deleteField", id, field });
    return this;
  }
  deleteRecord(id: Ident) {
    this.items.push({ tag: "deleteRecord", id });
    return this;
  }
}

export const q = (...params: Ident[]) => new QueryBuilder(params);

function expectVar<T>(args: QueryArgs, ident: Ident): T {
  const value = args[ident];
  if (!value) throw new Error();
  return value as T;
}

function checkVar<T>(args: QueryArgs, ident: Ident, value: T) {
  // if (!value) throw new Error();
  if (ident in args) {
    if (args[ident] !== value) throw new Error();
  } else {
    args[ident] = value;
  }
  return value;
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
  query1(query: Query, args: QueryArgs) {
    const iter = this.runQuery(query, { ...args });
    return iter.next().value;
  }
  queryAll(query: Query, args: QueryArgs) {
    return this.runQuery(query, { ...args });
  }
  update(query: Query, args: QueryArgs) {
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
        checkVar(args, q.id, id);
        yield* this.runQuery(query, args, index + 1);
        return;
      }
      case "all": {
        for (const id of this.data.keys()) {
          const nextArgs = { ...args };
          checkVar(nextArgs, q.id, id);
          yield* this.runQuery(query, nextArgs, index + 1);
        }
        return;
      }
      case "get": {
        const id = expectVar<Id>(args, q.id);
        const record = this.data.get(id);
        if (!record) throw new Error();
        checkVar(args, q.value, record[q.field]);
        yield* this.runQuery(query, args, index + 1);
        return;
      }
      case "index": {
        const value = expectVar<Id>(args, q.value);
        const idx = this.index.get(value);
        if (!idx) throw new Error();
        const ids = idx[q.field];
        if (!ids) throw new Error();
        for (const id of ids) {
          const nextArgs = { ...args };
          checkVar(nextArgs, q.id, id);
          yield* this.runQuery(query, nextArgs, index + 1);
        }
        return;
      }
      case "insert": {
        const id = expectVar<Id>(args, q.id);
        const rec = expectVar<Rec>(args, q.record);
        this.insertRec(id, rec);
        yield* this.runQuery(query, args, index + 1);
        return;
      }
      case "update": {
        const id = expectVar<Id>(args, q.id);
        const value = expectVar(args, q.value);
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
        const id = expectVar<Id>(args, q.id);
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
      default:
        throw new Error("unimplemented");
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
