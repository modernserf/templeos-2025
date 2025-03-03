import { Rec } from "./data";
import { Expr } from "./expr";

function nsId(ns: string, id: string) {
  return id.startsWith("_") ? `${ns}_${id}` : id;
}

function expandNamespace(name: string, expr: Expr): Expr {
  if (typeof expr !== "object") return expr;
  switch (expr.tag) {
    case "placeholder":
    case "ident":
      return expr;
    case "box":
      return {
        tag: "box",
        id: nsId(name, expr.id),
        args: expr.args.map((arg) => expandNamespace(name, arg)),
      };
  }
}

export function pkg(
  name: string,
  data: Record<string, Rec>,
): Record<string, Rec> {
  const out: Record<string, Rec> = {};
  for (const id in data) {
    const key = id.startsWith("_") ? `${name}_${id}` : id;
    // TODO: add package field & visibility flag
    if (key in out) throw new Error(`duplicate key ${key}`);
    out[key] = {};
    for (const field in data[id]) {
      out[key][field] = expandNamespace(name, data[id][field]);
    }
  }
  return out;
}
