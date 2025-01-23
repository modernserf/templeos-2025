import { BrowseParams, FormatTextNode } from "./schema";

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
