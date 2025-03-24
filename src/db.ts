import BTree from "sorted-btree";
import { Value } from "./value";

type Id = string;
type Field = string;

type BaseRec = Record<Field, unknown>;

export class DB<Rec extends BaseRec> {
  private data = new Map<Id, Rec>();
  public index2 = new Map<Id, BTree<Value, Value>>();
  dump() {
    return Object.fromEntries(this.data);
  }
  get(id: Id): Rec | null {
    return this.data.get(id) ?? null;
  }
  *keys() {
    yield* this.data.keys();
  }
  bulkInsert(items: Record<Id, Rec>) {
    for (const [id, rec] of Object.entries(items)) {
      this.insert(id, rec);
    }
  }
  insert(id: Id, rec: Rec) {
    this.data.set(id, rec);
  }
  delete(id: Id) {
    this.data.delete(id);
  }
  update(id: Id, field: Field, value: unknown) {
    let record = this.data.get(id);
    if (!record) {
      record = {} as Rec;
      this.data.set(id, record);
    }
    const prevValue = record[field];
    (record as BaseRec)[field] = value;
    return prevValue;
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
    return this.update(id, field, value);
  }
  insertTx(tx: Tx, id: Id, rec: Rec) {
    const changes = this.getTx(tx);
    if (!changes.has(id)) {
      const prev = this.get(id) ?? null;
      changes.set(id, { ...prev });
    }
    this.insert(id, rec);
  }
  deleteTx(tx: Tx, id: Id) {
    const changes = this.getTx(tx);
    if (!changes.has(id)) {
      const prev = this.get(id) ?? null;
      changes.set(id, { ...prev });
    }
    this.delete(id);
  }
}
