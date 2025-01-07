import { Arg, Expr, toExpr } from "./expr";
import { BrowseParams } from "./state";

export type FormatTextNode =
  | { tag: "text"; text: string }
  | { tag: "link"; text: string; params: BrowseParams };

export class FormatTextBuilder {
  private out: FormatTextNode[] = [];
  build() {
    return this.out;
  }
  text(text: string) {
    this.out.push({ tag: "text", text });
    return this;
  }
  link(params: BrowseParams, text: string) {
    this.out.push({ tag: "link", params, text });
    return this;
  }
}

export type ViewElement =
  | { tag: "string"; value: Expr } //
  | { tag: "link"; label: Expr; id: Expr };

export class ViewBuilder {
  private out: ViewElement[] = [];
  build() {
    return this.out;
  }
  string(value: Arg) {
    this.out.push({ tag: "string", value: toExpr(value) });
    return this;
  }
  link(label: Arg, id: Arg) {
    this.out.push({ tag: "link", label: toExpr(label), id: toExpr(id) });
    return this;
  }
}
