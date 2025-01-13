import { Expr, k, v } from "./expr";
import { q } from "./query";
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
  children?: ViewElement[];
};

type ViewRec = Rec & { db__schema: "schema__view" };

export const views = {
  // Views
  view__dataView2: {
    db__schema: "schema__view",
    file__name: "DataView",
    file__description: "default viewer for all data types",
    view__schema: "schema__anyType",
    view__query: q("id")
      .string(k("fields"))
      .view(k("view__dataViewFields"), { id: "id" })
      .string(k("references"))
      .view(k("view__dataViewRefs"), { id: "id" })
      .build(),
  },
  view__fileLink: {
    db__schema: "schema__view",
    file__name: "File Link",
    view__query: q("id")
      .get("id", "file__name", "fileName")
      .link("fileName", "id")
      .build(),
  },
  view__dataViewFields: {
    db__schema: "schema__view",
    file__name: "DataView - fields",
    view__query: q("id") //
      .get("id", v("fieldId"))
      .get("id", v("fieldId"), "value")
      .row((q) =>
        q
          .view(k("view__fileLink"), { id: "fieldId" })
          .view(k("view__maybeLink"), { fieldId: "fieldId", value: "value" })
      )
      .build(),
  },
  view__maybeLink: {
    db__schema: "schema__view",
    view__query: q("fieldId", "value") //
      .cond(
        (q) => q.get("fieldId", "field__index", k("ref")),
        (q) => q.view(k("view__fileLink"), { id: "value" }),
        (q) => q.view(k("view__anyData"), { value: "value" })
      )
      .build(),
  },
  view__dataViewRefs: {
    db__schema: "schema__view",
    file__name: "DataView - fields",
    view__query: q("id")
      .get("fieldId", "field__index", k("ref"))
      .get("refId", v("fieldId"), "id")
      .row((q) =>
        q
          .view(k("view__fileLink"), { id: "fieldId" })
          .view(k("view__fileLink"), { id: "refId" })
      )
      .build(),
  },
  view__text: {
    db__schema: "schema__view",
    file__name: "Text",
    file__description: "viewer for text cards",
    view__schema: "schema__text",
    view__query: q("id") //
      .get("id", "text__content", "content")
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
      .get("item", "file__description", "description")
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
      .get("item", "file__name", "name")
      .view(k("view__icon"), {})
      .link("name", "item")
      .build(),
  },
  view__schemaDefinition: {
    db__schema: "schema__view",
    file__name: "Schema",
    view__schema: "schema__schema",
    view__query: q("id") //
      .get("id", "file__name", "name")
      .view(k("view__fileInfo"), { id: "id" })
      .link(k("click me"), k("home"))
      .build(),
  },
  view__fileInfo: {
    db__schema: "schema__view",
    file__name: "File Info",
    view__query: q("id")
      .get("id", "file__name", "name")
      .get("id", "file__description", "description")
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
    view__primitive: "String",
  },
  view__link: {
    db__schema: "schema__view",
    file__name: "Link",
    view__primitive: "Link",
  },
  view__anyData: {
    db__schema: "schema__view",
    file__name: "AnyData",
    file__description: "JSON stringification of data",
    view__primitive: "AnyData",
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
  view__row: {
    db__schema: "schema__view",
    file__name: "Row layout",
    view__primitive: "Row",
  },
  view__column: {
    db__schema: "schema__view",
    file__name: "Column layout",
    view__primitive: "Column",
  },
} satisfies Record<string, ViewRec>;
