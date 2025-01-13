import { Expr, Ident, Arg, KArg, kToExpr, toExpr, k } from "./expr";

export type QueryItem =
  | { tag: "rollback" }
  | { tag: "id"; id: Expr }
  | { tag: "timestamp"; timestamp: Expr }
  | { tag: "members"; item: Expr; collection: Expr }
  | { tag: "get/1"; id: Expr }
  | { tag: "get/2"; id: Expr; field: Expr }
  | { tag: "get/3"; id: Expr; field: Expr; value: Expr }
  | { tag: "insert"; id: Expr; record: Expr }
  | { tag: "update"; id: Expr; field: Expr; value: Expr }
  | { tag: "rule"; rule: Expr; args: Record<string, Expr> }
  | {
      tag: "view";
      view: Expr;
      args: Record<string, Expr>;
      children: QueryItem[];
    }
  | { tag: "cond"; if: QueryItem[]; then: QueryItem[]; else: QueryItem[] }
  | { tag: "or"; items: QueryItem[] };

export type Query = {
  params: Ident[];
  items: QueryItem[];
};

type ArgRecord = Record<string, Arg>;

function toRecordExpr(args: ArgRecord) {
  return Object.fromEntries(
    Object.entries(args).map(([k, v]) => [k, toExpr(v)])
  );
}

export const q = (...params: Ident[]) => new QueryBuilder(params);

type QBCallback = (f: QueryBuilder) => QueryBuilder;

class QueryBuilder {
  private items: QueryItem[] = [];
  constructor(private params: Ident[]) {}
  build(): Query {
    return { params: this.params, items: this.items };
  }
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
  rule(rule: KArg, args: ArgRecord) {
    this.items.push({
      tag: "rule",
      rule: kToExpr(rule),
      args: toRecordExpr(args),
    });
    return this;
  }
  view(view: Arg, args: ArgRecord) {
    this.items.push({
      tag: "view",
      view: toExpr(view),
      args: toRecordExpr(args),
      children: [],
    });
    return this;
  }
  string(value: Arg) {
    this.items.push({
      tag: "view",
      view: k("view__string"),
      args: { value: toExpr(value) },
      children: [],
    });
    return this;
  }
  button(label: Arg, fn: QBCallback) {
    this.items.push({
      tag: "view",
      view: k("view__button"),
      args: {
        label: toExpr(label),
        query: k(fn(new QueryBuilder([])).build()),
      },
      children: [],
    });
    return this;
  }
  link(label: Arg, id: Arg, target?: Arg) {
    this.items.push({
      tag: "view",
      view: k("view__link"),
      args: {
        label: toExpr(label),
        id: toExpr(id),
        target: target ? toExpr(target) : k("current"),
      },
      children: [],
    });
    return this;
  }
  row(fn: QBCallback) {
    this.items.push({
      tag: "view",
      view: k("view__row"),
      args: {},
      children: fn(new QueryBuilder(this.params)).build().items,
    });
    return this;
  }
  column(fn: QBCallback) {
    this.items.push({
      tag: "view",
      view: k("view__column"),
      args: {},
      children: fn(new QueryBuilder(this.params)).build().items,
    });
    return this;
  }
  cond(qIf: QBCallback, qThen: QBCallback, qElse: QBCallback) {
    this.items.push({
      tag: "cond",
      if: qIf(new QueryBuilder(this.params)).build().items,
      then: qThen(new QueryBuilder(this.params)).build().items,
      else: qElse(new QueryBuilder(this.params)).build().items,
    });
    return this;
  }
  or(fn: QBCallback) {
    this.items.push({
      tag: "or",
      items: fn(new QueryBuilder(this.params)).build().items,
    });
    return this;
  }
}
