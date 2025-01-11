import { q } from "./db";
import { Arg, Expr, k, toExpr, v } from "./expr";
import { Rec } from "./schema";
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

type ViewRec = Rec & { db__schema: "schema__view" };

export const views = {
  // Views
  view__anyType: {
    db__schema: "schema__view",
    file__name: "DataView",
    file__description: "default viewer for all data types",
    view__primitive: "DataView",
    view__schema: "schema__anyType",
  },
  view__dataView2: {
    db__schema: "schema__view",
    file__name: "DataView 2",
    file__description: "default viewer for all data types",
    view__schema: "schema__anyType",
    view__query: q("id"),
    view__elements: new ViewBuilder()
      .string(k("fields"))
      .view(k("view__dataViewFields"), { id: "id" })
      .string(k("references"))
      .view(k("view__dataViewRefs"), { id: "id" })
      .build(),
  },
  view__fileLink: {
    db__schema: "schema__view",
    file__name: "File Link",
    view__query: q("id").get("id", "file__name", "fileName"),
    view__elements: new ViewBuilder().link("fileName", "id").build(),
  },
  view__dataViewFields: {
    db__schema: "schema__view",
    file__name: "DataView - fields",
    view__query: q("id")
      .fields("id", "fieldId")
      .get("id", v("fieldId"), "value"),
    view__elements: new ViewBuilder()
      .view(k("view__fileLink"), { id: "fieldId" })
      .view(k("view__dataViewField"), { id: "id", value: "value" })
      .build(),
  },
  view__dataViewField: {
    db__schema: "schema__view",
    view__primitive: "DataViewField",
  },
  view__dataViewRefs: {
    db__schema: "schema__view",
    file__name: "DataView - fields",
    view__query: q("id")
      .index("fieldId", "field__index", k("ref"))
      .index("refId", v("fieldId"), "id"),
    view__elements: new ViewBuilder()
      .view(k("view__fileLink"), { id: "fieldId" })
      .view(k("view__fileLink"), { id: "refId" })
      .build(),
  },
  view__text: {
    db__schema: "schema__view",
    file__name: "Text",
    file__description: "viewer for text cards",
    view__schema: "schema__text",
    view__query: q("id") //
      .get("id", "text__content", "content"),
    view__elements: new ViewBuilder() //
      .view(k("view__textContent"), { text: "content" })
      .build(),
  },
  view__folderList: {
    db__schema: "schema__view",
    file__name: "Folder - List",
    file__description: "viewer for folders as list",
    view__schema: "schema__folder",
    view__query: q("id") //
      .get("id", "file__folderItems", "items")
      .members("item", "items")
      .get("item", "file__name", "name")
      .get("item", "file__description", "description"),
    view__elements: new ViewBuilder()
      .link("name", "item")
      .string("description")
      .build(),
  },
  view__folderIcon: {
    db__schema: "schema__view",
    file__name: "Folder - Icon",
    file__description: "viewer for folders as icon grid",
    view__schema: "schema__folder",
    view__query: q("id") //
      .get("id", "file__folderItems", "items")
      .members("item", "items")
      .get("item", "file__name", "name"),
    view__elements: new ViewBuilder()
      .view(k("view__icon"), {})
      .link("name", "item")
      .build(),
  },
  view__schemaDefinition: {
    db__schema: "schema__view",
    file__name: "Schema",
    view__schema: "schema__schema",
    view__query: q("id") //
      .get("id", "file__name", "name"),
    view__elements: new ViewBuilder()
      .view(k("view__fileInfo"), { id: "id" })
      .link(k("click me"), k("home"))
      .build(),
  },
  view__fileInfo: {
    db__schema: "schema__view",
    file__name: "File Info",
    view__query: q("id")
      .get("id", "file__name", "name")
      .get("id", "file__description", "description"),
    view__elements: new ViewBuilder()
      .string(k("id"))
      .string("id")
      .string(k("name"))
      .string("name")
      .string(k("description"))
      .string("description")
      .build(),
  },
  view__string: {
    db__schema: "schema__view",
    file__name: "String",
    view__primitive: "PrimitiveString",
  },
  view__link: {
    db__schema: "schema__view",
    file__name: "Link",
    view__primitive: "PrimitiveLink",
  },
  view__icon: {
    db__schema: "schema__view",
    file__name: "Icon",
    view__primitive: "IconView",
  },
  view__textContent: {
    db__schema: "schema__view",
    file__name: "Text Content",
    view__primitive: "TextView",
  },
} satisfies Record<string, ViewRec>;
