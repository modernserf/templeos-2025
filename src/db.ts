import { Where, numberOrd, Ord, Tree } from "./tree";

type Id = string;
type Field = string;

type BaseRec = Record<Field, unknown>;
type IndexType = "ref" | "multiRef" | "sorted";

type Index = {
  tree: Tree<RefIndex, null>;
  indexType: IndexType;
};

type RefIndex = { entityId: Id; valueId: Id };

const indexOrd: Ord<RefIndex> = {
  cmp(l: RefIndex, r: RefIndex) {
    return (
      numberOrd.cmp(l.valueId, r.valueId) ||
      numberOrd.cmp(l.entityId, r.entityId)
    );
  },
};

export function whereValue(valueId: Id): Where<RefIndex> {
  return {
    cmp(item) {
      return numberOrd.cmp(valueId, item.valueId);
    },
    order: "asc",
  };
}

export class DB<Rec extends BaseRec> {
  private data = new Map<Id, Rec>();
  private index = new Map<Field, Index>();

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
  private addToIndex<T>(entityId: Id, field: Field, value: T) {
    const idx = this.index.get(field);
    if (!idx) return;
    switch (idx.indexType) {
      case "ref":
      case "sorted":
        idx.tree.set({ entityId, valueId: value as Id }, null);
        return;
      case "multiRef":
        for (const valueId of value as Id[]) {
          idx.tree.set({ entityId, valueId }, null);
        }
        return;
    }
  }
  private removeFromIndex<T>(entityId: Id, field: Field, value: T) {
    const idx = this.index.get(field);
    if (!idx) return;
    switch (idx.indexType) {
      case "ref":
      case "sorted":
        idx.tree.delete({ entityId, valueId: value as Id });
        return;
      case "multiRef":
        for (const valueId of value as Id[]) {
          idx.tree.delete({ entityId, valueId });
        }
        return;
    }
  }
}
