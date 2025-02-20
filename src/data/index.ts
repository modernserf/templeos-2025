import { TransactDB } from "../db";
import { ProcessManager } from "../process";
import { Expr, Box, Id, List, l } from "../expr";
import { core } from "./core";
import { viewCore } from "./view_core";
import { rules as rulePrimitiveRecs, rulePrimitives } from "./primitives";
import { browserData, browserInitState } from "./browser";
import { testUtils } from "./test_utils";
import { viewForm } from "./view_form";
import { viewTable } from "./view_table";
import { viewAnyRecord } from "./view_any_record";
import { dbRules } from "./db";

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
  | Box<"location", [id: Id]>
  | Box<"location", [id: Id, view: Id]>
  | Box<"location", [id: Id, view: Id, params: List<Box<string, Expr[]>>]>;

export type FormatText =
  | string
  | Box<"link", [string, Location]>
  | Box<"section", [List<FormatText>, List<FormatText>]>
  | Box<"code", [Expr]>;

export type HtmlProp =
  | Box<"class", [string]>
  | Box<"style", [key: string, value: string]>;

type SchemaField =
  | Box<"field", [Field]>
  | Box<"field_optional", [Field]>
  | Box<"field_default", [Field, Expr]>;

type IndexType =
  | Box<"ref", []> // TODO: what does this mean now?
  | Box<"multiRef", []>
  | Box<"sorted", []>
  | Box<"unique", []>;

export type Rec = Record<string, Expr> & {
  time__created?: number;
  db__schema?: Schema;
  db__fields?: List<SchemaField>;
  db__type?: TypeId;
  db__index?: IndexType;
  db__default_view?: Id;

  rule__params?: List<Expr>;
  rule__rest_params?: Expr;
  rule__body?: Box<string, Expr[]>;
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
    testUtils,
    rulePrimitiveRecs,
    core,
    browserData,
    viewCore,
    viewForm,
    viewTable,
    viewAnyRecord,
    dbRules,
  ],
  {},
);

// loads from db if available
export const initState = mergeAndCheck(
  [
    browserInitState,
    {
      home: {
        file__name: "Home",
        file__description: l("this is the home record"),
      },
    },
  ],
  data,
);

export function initProcessManager() {
  // TODO: do storage setup here
  const db = new TransactDB<Rec>();
  db.bulkInsert(data);
  db.bulkInsert(initState);

  const p = ProcessManager.init(db, rulePrimitives);
  return p;
}
