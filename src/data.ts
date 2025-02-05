import { l, r, s, v, Expr, Struct, Id, List, AnyStruct } from "./expr";
import { typeRecs } from "./type";
import { schemas, SchemaId } from "./schema";
import { fields, Field, f } from "./field";
import { TypeId, coreTypes } from "./type";
import { view, views } from "./view";
import { db, rules } from "./rule";

export type Location =
  | Struct<"location", [id: Id]>
  | Struct<"location", [id: Id, view: Id]>
  | Struct<"location", [id: Id, view: Id, params: List<AnyStruct>]>;

export type FormatText = string | Struct<"link", [string, Location]>;

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

  rule__params?: List<Expr>;
  rule__rest_params?: Expr;
  rule__body?: AnyStruct;
  view__schema?: SchemaId;
  view__field?: Field;
  view__type?: TypeId;

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
  home: {
    db__schema: "schema__text",
    file__name: "home",
    file__description: l("this is the home card"),
    file__tags: l("example_tag"),
    text__content: l(
      "content that ",
      s("link", "links", s("location", "example__folder")),
      " to another record.",
      s("link", "omnibox", s("location", "omnibox"))
    ),
  },
  example_tag: {
    db__schema: "schema__tag",
    file__name: "Example Tag",
    file__description: l("A tag with some items"),
  },
  omnibox: {
    db__schema: "schema__form",
    file__name: "Omnibox",
    rule__params: l(v.id, v.state),
    rule__body: r(
      s("get_default", v.state, "data__omnibox", v.omnibox, ""),
      view.column(
        view.input(
          v.omnibox,
          v.next,
          db.with_tx(v.tx, db.update(v.tx, v.state, "data__omnibox", v.next))
        ),
        r(
          s(
            "limit",
            10,
            r(
              f.file__name(v.result, v.result_name),
              s("string_substring", v.result_name, v.omnibox)
            )
          ),
          view.file_info(v.result)
        )
      )
    ),
  },
  example__folder: {
    db__schema: "schema__folder",
    file__name: "Example Folder",
    file__description: l("A folder with some items"),
    folder__items: l("home", "schema__text", "view__type__text"),
  },
  test_local_state: {
    db__schema: "schema__form",
    file__name: "Test local state",
    rule__params: l(v.id, v.state),
    rule__body: view.column(
      view.string("test local state"),
      view.local_state(
        "init",
        v.value,
        v.next,
        v.on_change,
        r(view.input(v.value, v.next, v.on_change))
      ),
      view.local_state(
        "other",
        v.value1,
        v.next1,
        v.on_change1,
        r(view.input(v.value1, v.next1, v.on_change1))
      )
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
} satisfies Record<string, Rec>;
