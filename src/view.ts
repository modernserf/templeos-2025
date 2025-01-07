import { Arg, Expr, k, toExpr } from "./expr";
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

export type ViewElement = {
  view: Expr;
  args: Record<string, Expr>;
};

export class ViewBuilder {
  private out: ViewElement[] = [];
  build() {
    return this.out;
  }
  string(value: Arg) {
    this.out.push({ view: k("view__string"), args: { value: toExpr(value) } });
    return this;
  }
  link(label: Arg, id: Arg) {
    this.out.push({
      view: k("view__link"),
      args: { label: toExpr(label), id: toExpr(id) },
    });
    return this;
  }
  view(view: Arg, args: Record<string, Arg>) {
    this.out.push({
      view: toExpr(view),
      args: Object.fromEntries(
        Object.entries(args).map(([k, v]) => [k, toExpr(v)])
      ),
    });
    return this;
  }
}
