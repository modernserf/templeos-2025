export type Ident = string;
export type Expr =
  | { tag: "ident"; ident: Ident }
  | { tag: "const"; value: unknown }
  | { tag: "or"; expr: Expr; default: Expr }
  | { tag: "field"; expr: Expr; field: string };

export type Arg = string | Expr;

export const k = (value: unknown): Expr => ({ tag: "const", value });
export const or = (left: Arg, right: Arg): Expr => ({
  tag: "or",
  expr: toExpr(left),
  default: toExpr(right),
});

export const toExpr = (arg: Arg): Expr => {
  if (typeof arg === "string") {
    return { tag: "ident", ident: arg };
  } else {
    return arg;
  }
};

export type Scope = Record<string, unknown>;

export function getVar<T>(scope: Scope, expr: Expr): T {
  switch (expr.tag) {
    case "ident": {
      if (!(expr.ident in scope)) {
        throw new Error(`Unknown identifier ${expr.ident}`);
      }
      return scope[expr.ident] as T;
    }
    case "const": {
      const value = expr.value;
      return value as T;
    }
    case "or": {
      return getVar<T>(scope, expr.expr) ?? getVar<T>(scope, expr.default);
    }
    default:
      throw new Error("unimplemented");
  }
}

export function setVar<T>(scope: Scope, binding: Expr, value: T) {
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
