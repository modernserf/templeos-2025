import { Expr, Struct, Id, List, AnyStruct, l, s, $, view } from "../expr";
import { core } from "./core";

import { dbData } from "./db";
import { browser, browserInitState } from "./browser";
import { clipboardInitState, clipboardRules } from "./clipboard";
import { text } from "./text";
import { omnibox } from "./omnibox";
import { boxData } from "./box";
import { testUtils } from "./test_utils";
import { viewCore } from "./view_core";
import { viewExpr } from "./view_expr";
import { viewForm } from "./view_form";
import { viewRender } from "./render";
import { tagData } from "./tag";
import { codeExplorerData } from "./code_explorer";
import { folderData } from "./folder";

export type Schema =
  | "any_record"
  | "clipboard"
  | "field"
  | "folder"
  | "form"
  | "history"
  | "schema"
  | "tag"
  | "text_document"
  | "type"
  | "window";

export type Field =
  | "browser__current_window"
  | "clipboard__data"
  | "data__omnibox"
  | "db__default_value"
  | "db__default_view"
  | "db__fields"
  | "db__index"
  | "db__schema"
  | "db__type"
  | "file__name"
  | "file__description"
  | "file__tags"
  | "history__back"
  | "history__forward"
  | "history__id"
  | "history__view"
  | "history__window"
  | "rule__body"
  | "rule__params"
  | "rule__rest_params"
  | "text__content"
  | "time__created"
  | "view__schema"
  | "window__current_history";

export type TypeId =
  | "any_type"
  | "multi_ref"
  | "number"
  | "ref"
  | "string"
  | "text"
  | "time";

export type Location =
  | Struct<"location", [id: Id]>
  | Struct<"location", [id: Id, view: Id]>
  | Struct<"location", [id: Id, view: Id, params: List<AnyStruct>]>;

export type FormatText =
  | string
  | Struct<"link", [string, Location]>
  | Struct<"section", [List<FormatText>, List<FormatText>]>
  | Struct<"code", [Expr]>;

export type HtmlProp =
  | Struct<"class", [string]>
  | Struct<"style", [key: string, value: string]>;

type SchemaField =
  | Struct<"field", [Field]>
  | Struct<"field_optional", [Field]>
  | Struct<"field_default", [Field, Expr]>;

type IndexType =
  | Struct<"ref", []> // TODO: what does this mean now?
  | Struct<"multiRef", []>
  | Struct<"sorted", []>
  | Struct<"unique", []>;

export type Rec = Record<string, Expr> & {
  time__created?: number;
  db__schema?: Schema;
  db__fields?: List<SchemaField>;
  db__type?: TypeId;
  db__index?: IndexType;
  db__default_view?: Id;

  rule__params?: List<Expr>;
  rule__rest_params?: Expr;
  rule__body?: AnyStruct;
  view__schema?: Schema;

  test__group?: string;

  file__name?: string;
  file__description?: List<FormatText>;
  file__tags?: List<string>;

  folder__items?: List<Id>;

  history__window?: Id;
  history__id?: Id;
  history__view?: Id;
  history__back?: Id;
  history__forward?: Id;
  window__current_history?: Id;
  browser__current_window?: Id;

  text__content?: List<FormatText>;
};

function mergeAndCheck(
  groups: Record<string, Rec>[],
  prev: Record<string, Rec>,
) {
  const base: Record<string, Rec> = {};
  for (const records of groups) {
    for (const id in records) {
      if (base[id] || prev[id]) throw new Error(`Duplicate record ${id}`);
      base[id] = records[id];
    }
  }
  return base;
}

// always loads from source
export const data = mergeAndCheck(
  [
    boxData,
    browser,
    clipboardRules,
    codeExplorerData,
    core,
    dbData,
    folderData,
    omnibox,
    tagData,
    testUtils,
    text,
    viewCore,
    viewExpr,
    viewForm,
    viewRender,
  ],
  {},
);

// loads from db if available
export const initState = mergeAndCheck(
  [
    browserInitState,
    clipboardInitState,
    {
      example_text_document: {
        db__schema: "text_document",
        file__name: "home",
        file__tags: l("example_tag"),
        text__content: l(
          s.section(
            l("a heading"),
            l(
              s.section(
                l("subhed"),
                l(
                  s.section(
                    l("heading 3"),
                    l(
                      "content that ",
                      s.link("links", s.location("example__folder")),
                      " to another record. ",
                      s.link("omnibox", s.location("omnibox")),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      },
      example_tag: {
        db__schema: "tag",
        file__name: "Example Tag",
        file__description: l("A tag with some items"),
      },
      example__folder: {
        db__schema: "folder",
        file__name: "Example Folder",
        file__description: l("A folder with some items"),
        folder__items: l("home", "example_text_document"),
      },
      home: {
        db__schema: "form",
        file__name: "home",
        file__description: l("This is the home card"),
        rule__params: l($.id, $.state, $.out),
        _left_links: l("code_explorer", "omnibox"),
        rule__body: view.render(
          view.column(
            l(s.style("padding", "1rem")),
            s.children(
              view.text(
                l(s.section(l("Welcome!"), l("this is the home card etc"))),
              ),
              view.row(
                l(),
                s.children(
                  view.column(
                    l(s.style("flex", "0 0 50%")),
                    s.children(
                      view.text(l("helpful links")),
                      view.iter(
                        s.do(
                          s.get_field_value($.id, "_left_links", $.links),
                          s.box_at_value($.links, $._, $.link),
                        ),
                        l(view.file_info($.link)),
                      ),
                    ),
                  ),
                  view.column(
                    l(s.style("flex", "0 0 50%")),
                    s.children(view.text(l("right column list"))),
                  ),
                ),
              ),
            ),
          ),
          $.out,
        ),
      },
    },
  ],
  data,
);
