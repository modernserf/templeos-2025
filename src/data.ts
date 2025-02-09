import {
  l,
  r,
  s,
  $,
  Expr,
  Struct,
  Id,
  List,
  AnyStruct,
  view,
  __,
} from "./expr";
import { typeRecs } from "./type";
import { schemas, SchemaId } from "./schema";
import { fields, Field, f } from "./field";
import { TypeId, coreTypes } from "./type";
import { views } from "./view";
import { db, rules } from "./rule";
import { testUtils } from "./test_utils";

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
  db__schema?: SchemaId;
  db__fields?: List<SchemaField>;
  db__type?: TypeId;
  db__index?: IndexType;
  db__default_view?: Id;

  rule__params?: List<Expr>;
  rule__rest_params?: Expr;
  rule__body?: AnyStruct;
  view__schema?: SchemaId;

  test__group?: string;

  file__name?: string;
  file__description?: List<FormatText>;
  file__tags?: List<string>;

  folder__items?: List<Id>;

  history__window?: Id;
  history__location?: Id;
  history__view?: Id;
  history__back?: Id;
  history__forward?: Id;
  window__currentHistory?: Id;
  browser__currentWindow?: Id;

  text__content?: List<FormatText>;
};

const files = {
  example_tag: {
    db__schema: "schema__tag",
    file__name: "Example Tag",
    file__description: l("A tag with some items"),
  },
  omnibox: {
    db__schema: "schema__form",
    file__name: "Omnibox",
    rule__params: l($.id, $.state, $.out),
    rule__body: r(
      s.get_default($.state, "data__omnibox", $.omnibox, ""),
      view.render(
        view.column(
          l(),
          s.children(
            view.input(
              l(s.placeholder("Search..."), s.style("width", "100%")),
              $.omnibox,
              l(
                s.change($.next),
                db.with_tx(
                  $.tx,
                  db.update($.tx, $.state, "data__omnibox", $.next),
                ),
              ),
            ),
            view.iter_else(
              s.limit(
                10,
                r(
                  f.file__name($.result, $.result_name),
                  s.string_substring($.result_name, $.omnibox),
                ),
              ),
              l(view.file_info($.result), view.spacer("0.5rem")),
              l(view.string("no results")),
            ),
          ),
        ),
        $.out,
      ),
    ),
  },
  code_explorer: {
    db__schema: "schema__form",
    file__name: "Code explorer",
    rule__params: l($.self, $.state, $.out),
    rule__body: r(
      s.get_default($.state, "data__omnibox", $.omnibox, ""),

      view.render(
        view.column(
          l(),
          s.children(
            view.input(
              l(
                s.debounce(300),
                s.placeholder("Search..."),
                s.style("width", "100%"),
              ),
              $.omnibox,
              l(
                s.change($.next),
                db.with_tx(
                  $.tx,
                  db.update($.tx, $.state, "data__omnibox", $.next),
                ),
              ),
            ),
            view.iter_else(
              s.limit(
                20,
                r(
                  f.rule__params($.id, $.params),
                  s("¬", f.test__group($.id, __)),
                  s.string_substring($.id, $.omnibox),
                  s.struct_tag_list($.struct, $.id, $.params),
                  s.get_default($.id, "file__description", $.desc, l("")),
                ),
              ),
              l(view.expr($.struct), view.text($.desc), view.spacer("0.5rem")),
              l(view.string("no results")),
            ),
          ),
        ),
        $.out,
      ),
    ),
  },
  view__test_result: {
    rule__params: l($.test_id, $.out),
    rule__body: s.try_error_catch(
      r(s.call($.test_id), view.string("ok", $.out)),
      $.error,
      view.any($.error, $.out),
    ),
  },
  test_runner: {
    db__schema: "schema__form",
    file__name: "Unit tests",
    rule__params: l($.self, $.state, $.out),
    rule__body: view.render(
      view.table(
        l(),
        s.children(
          view.table_header(
            l(),
            s.children(
              view.string("group"),
              view.string("test"),
              view.string("result"),
            ),
          ),
        ),
        s.children(
          view.iter(
            f.test__group($.id, $.group),
            l(
              view.table_row(
                l(),
                s.children(
                  view.string($.group),
                  view.file_link($.id),
                  view.test_result($.id),
                ),
              ),
            ),
          ),
        ),
      ),
      $.out,
    ),
  },
} satisfies Record<string, Rec>;

// always loads from source
export const data = {
  ...(schemas as Record<string, Rec>),
  ...coreTypes,
  ...fields,
  ...rules,
  ...views,
  ...files,
  ...testUtils,

  ...typeRecs,
};

// loads from db if available
export const initState = {
  rootHistory: {
    db__schema: "schema__history",
    history__window: "rootWindow",
    history__location: "home",
  },
  rootWindow: {
    db__schema: "schema__window",
    window__currentHistory: "rootHistory",
  },
  browser: {
    db__schema: "schema__browser",
    file__name: "Browser state",
    browser__currentWindow: "rootWindow",
  },
  example__folder: {
    db__schema: "schema__folder",
    file__name: "Example Folder",
    file__description: l("A folder with some items"),
    folder__items: l("home", "schema__text", "view__type__text"),
  },
  home: {
    db__schema: "schema__text",
    file__name: "home",
    file__description: l("this is the home card"),
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
} satisfies Record<string, Rec>;
