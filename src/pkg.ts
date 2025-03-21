import { CoreRec, Rec } from "./data";
import { Expr, l, s } from "./expr";
import { RulePrimitive } from "./process";

function nsId(ns: string, id: string) {
  return id.startsWith("_") ? `${ns}_${id}` : id;
}

function expandNamespace(name: string, expr: Expr): Expr {
  if (typeof expr === "string") return nsId(name, expr);
  if (typeof expr === "number") return expr;
  switch (expr.tag) {
    case "placeholder":
    case "ident":
      return expr;
    case "expand":
      return {
        tag: "expand",
        expr: expandNamespace(name, expr.expr),
      };
    case "box":
      return {
        tag: "box",
        id: nsId(name, expr.id),
        args: expr.args.map((arg) => expandNamespace(name, arg)),
      };
  }
}

export function pkg(
  ns: string,
  data: Record<string, Rec | (CoreRec & { rule__primitive: RulePrimitive })>,
) {
  const out: {
    rules: Record<string, Rec>;
    rulePrimitives: Record<string, RulePrimitive>;
  } = { rules: {}, rulePrimitives: {} };

  for (const id in data) {
    const key = nsId(ns, id);
    // TODO: add package field & visibility flag
    if (key in out) throw new Error(`duplicate key ${key}`);
    out.rules[key] = {};
    for (const field in data[id]) {
      if (field === "rule__primitive") {
        out.rulePrimitives[key] = data[id].rule__primitive as RulePrimitive;
        out.rules[key].test__flags = l(s.ignore_single_vars());
      } else {
        out.rules[key][nsId(ns, field)] = expandNamespace(
          ns,
          (data[id] as Rec)[field],
        );
      }
    }
  }
  return out;
}
