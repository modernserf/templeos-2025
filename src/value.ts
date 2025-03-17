import { Expr } from "./expr";

export type Fact = { value: Value; gen: number; name: string };

export type Value =
  | { tag: "string"; value: string }
  | { tag: "number"; value: number }
  | { tag: "box"; id: string; args: Value[] }
  | { tag: "fresh" }
  | { tag: "var"; fact: Fact }
  | { tag: "expand"; value: Value };

export const fresh = { tag: "fresh" } as const;

export const k = (value: string | number) =>
  typeof value === "string"
    ? ({ tag: "string", value } as const)
    : ({ tag: "number", value } as const);
export const box = (id: string, args: Value[]) =>
  ({ tag: "box", id, args } as const);

export function printValue(value: Value, indent = ""): string {
  switch (value.tag) {
    case "fresh":
      return "__";
    case "var": {
      if (value.fact.value.tag === "fresh") {
        return value.fact.name;
      } else {
        return printValue(value.fact.value, indent);
      }
    }
    case "string":
    case "number":
      return JSON.stringify(value.value);
    case "box": {
      const inline = `${value.id}(${value.args
        .map((f) => printValue(f, indent))
        .join(", ")})`;
      if (inline.length < 80 - indent.length) return inline;
      return `${value.id}(\n${indent}  ${value.args
        .map((f) => printValue(f, indent + "  "))
        .join(",\n" + indent + "  ")}\n${indent})`;
    }
    case "expand":
      return `{ ${printValue(value.value, indent)} }`;
  }
}

export function valueExpr(value: Value): Expr {
  switch (value.tag) {
    case "string":
    case "number":
      return value.value;
    case "box":
      return { tag: "box", id: value.id, args: value.args.map(valueExpr) };
    case "fresh":
      return { tag: "placeholder" };
    case "var":
      return { tag: "ident", ident: value.fact.name };
    case "expand":
      return { tag: "expand", expr: valueExpr(value.value) };
  }
}
