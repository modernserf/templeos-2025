import { Expr } from "./expr";

export type BoxTag = string;
export type FactId = number;

export type Value =
  | { tag: "var"; id: FactId; name: string }
  | { tag: "string"; value: string }
  | { tag: "number"; value: number }
  | { tag: "box"; id: BoxTag; args: Value[] };

export const k = (value: string | number) =>
  typeof value === "string"
    ? ({ tag: "string", value } as const)
    : ({ tag: "number", value } as const);

export const v = (id: FactId, name = "") => ({ tag: "var", id, name } as const);

export const box = <T extends BoxTag, Args extends Value[]>(
  id: T,
  args: Args,
) => ({ tag: "box", id, args } as const);

export class Exception {
  constructor(public error: Value) {}
  get message() {
    return printValue(this.error);
  }
}

export function valueExpr(value: Value): Expr {
  switch (value.tag) {
    case "var":
      return { tag: "ident", ident: value.name };
    case "string":
    case "number":
      return value.value;
    case "box":
      return {
        tag: "box",
        id: value.id,
        args: value.args.map(valueExpr),
      };
  }
}

export function printValue(value: Value, indent = ""): string {
  switch (value.tag) {
    case "var":
      return `${value.name}<${value.id}>`;
    case "string":
    case "number":
      return JSON.stringify(value.value);
    case "box":
      return `${value.id}(\n${indent}  ${value.args
        .map((f) => printValue(f, indent + "  "))
        .join("\n" + indent + "  ")}\n${indent})`;
  }
}

export function ensure<T extends Value["tag"]>(
  value: Value,
  tag: T,
): asserts value is Value & { tag: T } {
  if (value.tag !== tag) {
    throw new Exception(box("expected_type", [k(tag), value]));
  }
}
