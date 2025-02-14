import { Expr, Struct, Id, List, AnyStruct, l, s, $ } from "../v3/expr";
import { rules as rulePrimitiveRecs } from "../v3/rule_primitive";

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
export const data = mergeAndCheck([rulePrimitiveRecs], {});

// loads from db if available
export const initState = mergeAndCheck([], data);
