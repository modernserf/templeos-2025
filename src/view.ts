import { k, R, v } from "./rule_builder";
import { Expr, Rec } from "./schema";

export type ViewElement = {
  view: Expr;
  args: Record<string, Expr>;
  children?: ViewElement[];
};

type ViewRec = Rec;

export const views = {
  // primitives
  view__string: {
    db__schema: "schema__viewPrimitive",
    file__name: "String",
    view__primitive: "String",
  },
  view__button: {
    db__schema: "schema__viewPrimitive",
    file__name: "Button",
    view__primitive: "Button",
  },
  view__input: {
    db__schema: "schema__viewPrimitive",
    file__name: "Input",
    view__primitive: "Input",
  },
  view__select: {
    db__schema: "schema__viewPrimitive",
    file__name: "Select",
    view__primitive: "Select",
  },
  view__option: {
    db__schema: "schema__viewPrimitive",
    file__name: "Option",
    view__primitive: "Option",
  },
  view__link: {
    db__schema: "schema__viewPrimitive",
    file__name: "Link",
    view__primitive: "Link",
  },
  view__anyData: {
    db__schema: "schema__viewPrimitive",
    file__name: "AnyData",
    file__description: "JSON stringification of data",
    view__primitive: "AnyData",
  },
  view__icon: {
    db__schema: "schema__viewPrimitive",
    file__name: "Icon",
    view__primitive: "IconView",
  },
  view__textContent: {
    db__schema: "schema__viewPrimitive",
    file__name: "Text Content",
    view__primitive: "TextView",
  },
  view__row: {
    db__schema: "schema__viewPrimitive",
    file__name: "Row layout",
    view__primitive: "Row",
  },
  view__column: {
    db__schema: "schema__viewPrimitive",
    file__name: "Column layout",
    view__primitive: "Column",
  },
  view__windowPrimitive: {
    db__schema: "schema__viewPrimitive",
    file__name: "Window",
    view__primitive: "Window",
  },
  view__window: R("windowId")
    .name("Window")
    .setContext("windowId", "windowId")
    .get("windowId", "window__currentHistory", "historyId")
    .get(k("browser"), "browser__currentWindow", "currentWindowId")
    .get("historyId", "history__location", "id")
    .r("rule__cond", [
      // view from params
      k({
        cond: R()
          .get("historyId", "history__view", "view")
          .r("rule__ground", [v("view")])
          .body(),
        body: [],
      }),
      // view from rule type
      // TODO: limit 1
      k({
        cond: R()
          .get("id", "db__schema", "schema")
          .get("view", "view__schema", "schema")
          .body(),
        body: [],
      }),
      // view from any type
      k({
        cond: R().get("view", "view__schema", k("schema__anyType")).build()
          .rule__body!,
        body: [],
      }),
    ])
    .r("view__windowPrimitive", [
      v("id"),
      v("view"),
      v("windowId"),
      v("currentWindowId"),
    ])
    .build(),
  // system components
  view__appMenu: R()
    .name("App menu")
    .row(
      R()
        .or(
          R()
            .get(k("browser"), "browser__currentWindow", "windowId")
            .get("windowId", "window__currentHistory", "currentHistory")
            .get("currentHistory", "history__back", "back")
            .get("currentHistory", "history__forward", "forward")
            .button(
              k("back"),
              R()
                .r("rule__back", [v("windowId")])
                .build()
            )
            .button(
              k("forward"),
              R()
                .r("rule__forward", [v("windowId")])
                .build()
            )
            .body()
        )
        // TODO: these should be populated by a query
        .link(k("home"), k("home"), k("new"))
        .body()
      // .link(k("omnibox"), k("omnibox"), k("new"))
    )
    .build(),
  view__fileLink: R("id")
    .name("File Link")
    .get("id", "file__name", "fileName")
    .link("fileName", "id")
    .build(),
  view__fileInfo: R("id")
    .get("id", "file__name", "name")
    .get("id", "file__description", "description")
    .string(k("id"))
    .string("id")
    .string(k("name"))
    .string("name")
    .string(k("description"))
    .string("description")
    .build(),
  // built in root viewers
  view__anyType: R("id")
    .viewFor("schema__anyType")
    .name("Raw Data")
    .desc("default viewer for all data types")
    .or(
      R()
        .string(k("fields"))
        .get("id", v("fieldId"), "value")
        .row(
          R()
            .r("view__fileLink", [v("fieldId")])
            .cond(
              [
                R().get("fieldId", "field__index", k("ref")).body(),
                R()
                  .r("view__fileLink", [v("value")])
                  .body(),
              ],
              [
                R().body(),
                R()
                  .r("view__anyData", [v("value")])
                  .body(),
              ]
            )
            .body()
        )
        .body(),
      R()
        .string(k("references"))
        .or(
          R()
            .get("fieldId", "field__index", k("ref"))
            .get("refId", v("fieldId"), "id")
            .row(
              R()
                .r("view__fileLink", [v("fieldId")])
                .r("view__fileLink", [v("refId")])
                .body()
            )
            .body(),
          R()
            .get("fieldId", "field__index", k("multiRef"))
            .get("refId", v("fieldId"), "id")
            .row(
              R()
                .r("view__fileLink", [v("fieldId")])
                .r("view__fileLink", [v("refId")])
                .body()
            )
            .body()
        )
        .body()
    )
    .build(),
  view__text: R("id")
    .viewFor("schema__text")
    .name("Text")
    .desc("viewer for text cards")
    .get("id", "text__content", "content")
    .r("view__textContent", [v("content")])
    .build(),
  view__folderList: R("id")
    .viewFor("schema__folder")
    .name("Folder - List")
    .desc("viewer for folders as list")
    .get("id", "file__folderItems", "items")
    .members("items", "item")
    .get("item", "file__name", "name")
    .get("item", "file__description", "description")
    .link("name", "item")
    .string("description")
    .build(),
  view__folderIcon: R("id")
    .viewFor("schema__folder")
    .name("Folder - Icon")
    .desc("viewer for folders as icon grid")
    .get("id", "file__folderItems", "items")
    .members("items", "item")
    .get("item", "file__name", "name")
    .r("view__icon", [])
    .link("name", "item")
    .build(),
  view__form: R("id")
    .viewFor("schema__form")
    .name("Form")
    .r("rule__call", [v("id"), v("id")])
    .build(),
} satisfies Record<string, ViewRec>;
