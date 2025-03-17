import { defaultOrd, Ord } from "./ord";

export type Id = string;
export type Expr =
  | string
  | number
  | { tag: "box"; id: Id; args: Expr[] }
  | { tag: "placeholder" }
  | { tag: "expand"; expr: Expr }
  | { tag: "ident"; ident: string };
export type Box<Id, Args extends Expr[]> = {
  tag: "box";
  id: Id;
  args: Args;
};
export type List<T extends Expr> = Box<"", T[]>;
export const __ = { tag: "placeholder" } as const;

type SInfix = (...left: Expr[]) => Record<string, (...right: Expr[]) => Expr>;

export const s = new Proxy(
  <Args extends Expr[]>(...left: Args) =>
    new Proxy(
      {},
      {
        get(_, id: string) {
          return (...right: Expr[]) =>
            ({ tag: "box", id, args: [...left, ...right] } as const);
        },
      },
    ),
  {
    get<T extends string>(_: unknown, id: T) {
      return (...args: Expr[]) => ({ tag: "box", id, args } as const);
    },
  },
) as { [Tag in Id]: S<Tag> } & Ss<"call"> &
  Ss<"apply"> &
  Ss<"section"> &
  Ss<"link"> &
  Ss<"location"> &
  Ss<"ref"> &
  Ss<"multi_ref"> &
  Ss<"sorted"> &
  Ss<"code"> &
  Ss<"field"> &
  Ss<"field_optional"> &
  SInfix;

type Ss<Tag extends string> = { [t in Tag]: S<Tag> };

type S<Tag extends string> = <Args extends Expr[]>(
  ...args: Args
) => Box<Tag, Args>;

export const f = new Proxy(
  {},
  {
    get<T extends string>(_: unknown, field: T) {
      return (id: Expr, value: Expr) => s.record_field_value(id, field, value);
    },
  },
) as Record<
  string,
  (id: Expr, value: Expr) => Box<"record_field_value", [Expr, Expr, Expr]>
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const $: any = new Proxy(
  function v(ident: string) {
    return { tag: "ident", ident };
  },
  {
    get(_, ident) {
      return { tag: "ident", ident };
    },
  },
);

export function l<Args extends Expr[]>(...args: Args) {
  return { tag: "box", id: "", args } as const;
}

export const seq = (head: Expr, ...tail: Expr[]) =>
  tail.reduce((l, r) => s.seq2(l, r), head) as Box<string, Expr[]>;
export const alt = (head: Expr, ...tail: Expr[]) =>
  tail.reduce((l, r) => s.alt2(l, r), head) as Box<string, Expr[]>;
export const u = (l: Expr, r: Expr) => s.unify(l, r);

function sameTypeExpr<T extends Expr>(l: T, r: Expr): r is T {
  if (typeof l === "object" && typeof r === "object") {
    return l.tag === r.tag;
  }
  return typeof l === typeof r;
}

function exprTypeOrd(expr: Expr) {
  switch (typeof expr) {
    case "number":
      return 2;
    case "string":
      return 3;
    case "object":
      switch (expr.tag) {
        case "placeholder":
          return 0;
        case "ident":
          return 1;
        case "box":
          return 4;
      }
  }
}

export const exprOrd: Ord<Expr> = {
  cmp<T extends Expr, U extends Expr>(l: T, r: U) {
    switch (typeof l) {
      case "number":
      case "string":
        if (sameTypeExpr(l, r)) {
          return defaultOrd.cmp(l, r);
        }
        break;
      case "object":
        switch (l.tag) {
          case "placeholder":
            if (sameTypeExpr(l, r)) return 0;
            break;
          case "ident":
            type IdentExpr = { tag: "ident"; ident: string };
            if (sameTypeExpr(l as IdentExpr, r)) {
              return defaultOrd.cmp(l.ident, r.ident);
            }
            break;
          case "box":
            if (sameTypeExpr(l as Box<string, Expr[]>, r)) {
              const ord =
                defaultOrd.cmp(l.id, r.id) ||
                defaultOrd.cmp(l.args.length, r.args.length);
              if (ord) return ord;
              for (let i = 0; i < l.args.length; i++) {
                const ord = exprOrd.cmp(l.args[i], r.args[i]);
                if (ord) return ord;
              }
              return 0;
            }
        }
    }
    return defaultOrd.cmp(exprTypeOrd(l), exprTypeOrd(r));
  },
};

export const fn =
  (...params: Expr[]) =>
  (head: Expr = s.ok(), ...body: Expr[]) =>
    s.fn(l(...params), seq(head, ...body));

export const x = new Proxy((expr: Expr) => ({ tag: "expand", expr } as const), {
  get<T extends string>(_: unknown, id: T) {
    return (...args: Expr[]) =>
      ({ tag: "expand", expr: { tag: "box", id, args } } as const);
  },
}) as ((expr: Expr) => Expr) & Record<string, (...args: Expr[]) => Expr>;

export const xfn =
  (...params: Expr[]) =>
  (head: Expr = s.ok(), ...body: Expr[]) =>
    x.fn(l(...params), seq(head, ...body));
