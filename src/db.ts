import { exprOrd, Expr, List } from "./expr";
import { Where, defaultOrd, Ord, Tree } from "./tree";

type Id = string;
type Field = string;

type BaseRec = Record<Field, unknown>;
type IndexType = "ref" | "multiRef" | "sorted";

type Index = {
  tree: Tree<ExprIndex, null>;
  indexType: IndexType;
};

type ExprIndex = { entityId: Id; value: Expr };

const indexOrd: Ord<ExprIndex> = {
  cmp(l: ExprIndex, r: ExprIndex) {
    return (
      exprOrd.cmp(l.value, r.value) || defaultOrd.cmp(l.entityId, r.entityId)
    );
  },
};

export function whereValue(value: Expr): Where<ExprIndex> {
  return {
    cmp(item) {
      return exprOrd.cmp(value, item.value);
    },
    order: "asc",
  };
}

export class DB<Rec extends BaseRec> {
  private data = new Map<Id, Rec>();
  private index = new Map<Field, Index>();
  dump() {
    return Object.fromEntries(this.data);
  }
  get(id: Id): Rec | null {
    return this.data.get(id) ?? null;
  }
  getIndex(field: Field) {
    return this.index.get(field);
  }
  *keys() {
    yield* this.data.keys();
  }
  bulkInsert(items: Record<Id, Rec>) {
    for (const [id, rec] of Object.entries(items)) {
      this.insert(id, rec);
    }
  }
  insert(id: Id, rec: Rec | null) {
    const prev = this.data.get(id);
    if (prev) {
      for (const [field, value] of Object.entries(prev)) {
        this.removeFromIndex(id, field, value as Id);
      }
    }
    if (!rec) {
      this.data.delete(id);
      return;
    }
    this.data.set(id, rec);
    for (const [field, value] of Object.entries(rec)) {
      this.addToIndex(id, field, value as Id);
    }
    if (rec.db__schema === "schema__field" && rec.field__index) {
      this.createIndex(id as Field, rec.field__index as IndexType);
    }
  }
  update(id: Id, field: Field, value: unknown) {
    let record = this.data.get(id);
    if (!record) {
      record = {} as Rec;
      this.data.set(id, record);
    }
    const prevValue = record[field];
    (record as BaseRec)[field] = value;
    if (prevValue) this.removeFromIndex(id, field, prevValue as Id);
    if (value) this.addToIndex(id, field, value as Id);
  }
  private createIndex(field: Field, indexType: IndexType) {
    this.index.set(field, { indexType, tree: new Tree(indexOrd) });
    for (const [id, rec] of this.data) {
      if (field in rec) {
        this.addToIndex(id, field, rec[field] as Id);
      }
    }
  }
  private addToIndex(entityId: Id, field: Field, value: Expr) {
    const idx = this.index.get(field);
    if (!idx) return;
    switch (idx.indexType) {
      case "ref":
      case "sorted":
        idx.tree.set({ entityId, value: value as Expr }, null);
        return;
      case "multiRef":
        for (const v of (value as List<Expr>).args) {
          idx.tree.set({ entityId, value: v }, null);
        }
        return;
    }
  }
  private removeFromIndex(entityId: Id, field: Field, value: Expr) {
    const idx = this.index.get(field);
    if (!idx) return;
    switch (idx.indexType) {
      case "ref":
      case "sorted":
        idx.tree.delete({ entityId, value: value as Expr });
        return;
      case "multiRef":
        for (const v of (value as List<Expr>).args) {
          idx.tree.delete({ entityId, value: v });
        }
        return;
    }
  }
}

type Tx = number;

export class TransactDB<Rec extends BaseRec> extends DB<Rec> {
  private txs = new Map<Tx, Map<Id, Rec>>();
  private nextId = 1;
  private getTx(tx: Tx): Map<Id, Rec> {
    const changes = this.txs.get(tx);
    if (!changes) throw new Error("invalid tx");
    return changes;
  }
  beginTx(): Tx {
    const tx = this.nextId++;
    this.txs.set(tx, new Map());
    return tx;
  }
  commitTx(tx: Tx) {
    if (!this.txs.delete(tx)) throw new Error("invalid tx");
  }
  rollbackAll() {
    for (const tx of this.txs.keys()) {
      this.rollbackTx(tx);
    }
  }
  rollbackTx(tx: Tx) {
    const changes = this.getTx(tx);
    for (const [id, rec] of changes) {
      this.insert(id, rec);
    }
    this.txs.delete(tx);
  }
  updateTx<Expr>(tx: Tx, id: Id, field: Field, value: Expr | null) {
    const changes = this.getTx(tx);
    if (!changes.has(id)) {
      const prev = this.get(id) ?? null;
      changes.set(id, { ...prev });
    }
    this.update(id, field, value);
  }
  insertTx(tx: Tx, id: Id, rec: Rec | null) {
    const changes = this.getTx(tx);
    if (!changes.has(id)) {
      const prev = this.get(id) ?? null;
      changes.set(id, { ...prev });
    }
    this.insert(id, rec);
  }
}
