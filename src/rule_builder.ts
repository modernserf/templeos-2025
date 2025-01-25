import {
  Clause,
  Param,
  Expr,
  Ident,
  Rec,
  Id,
  SchemaId,
  RuleRec,
  Field,
} from "./schema";

export function v(ident: Ident) {
  return { tag: "ident", ident } as const;
}
export function k(value: unknown) {
  return { tag: "const", value } as const;
}

type KArg = string | Expr;
type VArg = Ident | Expr;
const kExpr = (arg: string | Expr): Expr =>
  typeof arg === "string" ? k(arg) : arg;
const vExpr = (arg: string | Expr): Expr =>
  typeof arg === "string" ? v(arg) : arg;

export class RuleBuilder {
  constructor(
    private params: Param[],
    private _body: Clause[] = [],
    private props: Partial<RuleRec> = { db__schema: "schema__rule" }
  ) {}
  build() {
    return {
      ...this.props,
      rule__params: this.params,
      rule__body: this._body,
    } as RuleRec;
  }
  body() {
    if (this.params.length) throw new Error("body cannot have params");
    return this._body;
  }
  name(name: string) {
    this.props.file__name = name;
    return this;
  }
  desc(desc: string) {
    this.props.file__description = desc;
    return this;
  }
  viewFor(viewSchema: SchemaId) {
    this.props.db__schema = "schema__view";
    this.props.view__schema = viewSchema;
    return this;
  }
  r(id: Id, args: Expr[]): this {
    this._body.push({ name: id, args });
    return this;
  }
  id(id: VArg) {
    return this.r("rule__id", [vExpr(id)]);
  }
  timestamp(ts: VArg) {
    return this.r("rule__timestamp", [vExpr(ts)]);
  }
  getContext(id: KArg, value: VArg) {
    return this.r("rule__getContext", [kExpr(id), vExpr(value)]);
  }
  setContext(id: KArg, value: VArg) {
    return this.r("rule__setContext", [kExpr(id), vExpr(value)]);
  }
  get(id: VArg, field: Field | Expr, value: VArg) {
    return this.r("rule__get", [vExpr(id), kExpr(field), vExpr(value)]);
  }
  insert(id: VArg, value: VArg) {
    return this.r("rule__insert", [vExpr(id), vExpr(value)]);
  }
  update(id: VArg, field: Field | Expr, value: VArg) {
    return this.r("rule__update", [vExpr(id), kExpr(field), vExpr(value)]);
  }
  eq(left: VArg, right: VArg) {
    return this.r("rule__eq", [vExpr(left), vExpr(right)]);
  }
  log(message: KArg) {
    return this.r("rule__log", [kExpr(message)]);
  }
  fail() {
    return this.r("rule__fail", []);
  }
  members(items: VArg, item: VArg) {
    return this.r("rule__members", [vExpr(items), vExpr(item)]);
  }
  or(...clauses: Array<Clause[]>) {
    return this.r("rule__or", clauses.map(k));
  }
  cond(...clauses: Array<[Clause[], Clause[]]>) {
    return this.r(
      "rule__cond",
      clauses.map(([cond, body]) => k({ cond, body }))
    );
  }
  limit(countArg: number | VArg, block: Clause[]) {
    const count = typeof countArg === "number" ? k(countArg) : vExpr(countArg);
    return this.r("rule__limit", [vExpr(count), k(block)]);
  }
  // views
  string(value: VArg) {
    return this.r("view__string", [vExpr(value)]);
  }
  link(label: VArg, id: VArg, target: KArg = k("current")) {
    return this.r("view__link", [vExpr(label), vExpr(id), kExpr(target)]);
  }
  button(label: VArg, onClick: Rec) {
    return this.r("view__button", [vExpr(label), k(onClick)]);
  }
  row(body: Clause[]) {
    return this.r("view__row", [k(body)]);
  }
}

export const R = (...params: string[]) => {
  return new RuleBuilder(params.map((ident) => ({ ident })));
};
