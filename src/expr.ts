import { defaultOrd, Ord } from "./tree";
export type Id = string;
export type Ident = string;

export type Expr =
  | string
  | number
  | { tag: "placeholder" }
  | { tag: "ident"; ident: Ident }
  | { tag: "struct"; id: Id; args: Expr[] };

export type Struct<Id, Args extends Expr[]> = {
  tag: "struct";
  id: Id;
  args: Args;
};
export type List<T extends Expr> = Struct<"", T[]>;
export type AnyStruct = Struct<string, Expr[]>;

export const s = <T extends Id, Args extends Expr[]>(id: T, ...args: Args) =>
  ({ tag: "struct", id, args } as const);
export const __ = { tag: "placeholder" } as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const v: any = new Proxy(
  function v(ident: string) {
    return { tag: "ident", ident };
  },
  {
    get(_, ident) {
      return { tag: "ident", ident };
    },
  }
);

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
        case "struct":
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
          case "struct":
            if (sameTypeExpr(l as AnyStruct, r)) {
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

export function printExpr(expr: Expr): string {
  switch (typeof expr) {
    case "string":
      return `"${expr}"`;
    case "number":
      return String(expr);
    case "object":
      switch (expr.tag) {
        case "placeholder":
          return "__";
        case "ident":
          return expr.ident;
        case "struct":
          return `${expr.id}(${expr.args.map(printExpr).join(", ")})`;
      }
  }
}
