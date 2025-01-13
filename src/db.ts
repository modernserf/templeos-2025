import { numberOrd, Ord, Tree } from "./index";

import { Query } from "./runtime";

type Id = string;
type Field = string;

type BaseRec = Record<Field, unknown>;

type RefIndex = { entityId: Id; valueId: Id };

const indexOrd: Ord<RefIndex> = {
  cmp(l: RefIndex, r: RefIndex) {
    return (
      numberOrd.cmp(l.valueId, r.valueId) ||
      numberOrd.cmp(l.entityId, r.entityId)
    );
  },
};

export class DB<Rec extends BaseRec> {
  private data = new Map<Id, Rec>();
  private refIndex = new Map<Field, Tree<RefIndex, null>>();
  private rules = new Map<string, { query: Query }>();

  get(id: Id): Rec | null {
    return this.data.get(id) ?? null;
  }
  getIndex(field: Field) {
    return this.refIndex.get(field);
  }
  getRule(rule: Id) {
    return this.rules.get(rule);
  }
  *keys() {
    yield* this.data.keys();
  }
  insert(id: Id, rec: Rec) {
    const prev = this.data.get(id);
    if (prev) {
      for (const [field, value] of Object.entries(prev)) {
        this.removeFromIndex(id, field, value as Id);
      }
    }
    this.data.set(id, rec);
    for (const [field, value] of Object.entries(rec)) {
      this.addToIndex(id, field, value as Id);
    }
    if (rec.db__schema === "schema__field" && rec.field__index) {
      this.createIndex(id as Field);
    }
    if (rec.db__schema === "schema__rule" && rec.rule__id && rec.rule__query) {
      this.createRule(rec.rule__id as string, rec.rule__query as Query);
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
  private createIndex(field: Field) {
    this.refIndex.set(field, new Tree(indexOrd));
    for (const [id, rec] of this.data) {
      if (field in rec) {
        this.addToIndex(id, field, rec[field] as Id);
      }
    }
  }
  private createRule(name: string, query: Query) {
    this.rules.set(name, { query });
  }
  private addToIndex(entityId: Id, field: Field, valueId: Id) {
    this.refIndex.get(field)?.set({ entityId, valueId }, null);
  }
  private removeFromIndex(entityId: Id, field: Field, valueId: Id) {
    this.refIndex.get(field)?.delete({ entityId, valueId });
  }
}
