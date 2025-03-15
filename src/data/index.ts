import { TransactDB } from "../db";
import { ProcessManager } from "../process";
import { Expr, Box, Id, List, l, $, s, seq, f, __ } from "../expr";
import { core } from "./core";
import { viewCore } from "./view_core";
import { rules as rulePrimitiveRecs, rulePrimitives } from "./primitives";
import { browserData, browserInitState } from "./browser";
import { testUtils } from "./test_utils";
import { viewForm } from "./view_form";
import { viewTable } from "./view_table";
import { viewAnyRecord } from "./schema_any_record";
import { dbRules } from "./db";
import { loadState } from "../storage";
import { EventSource } from "../event_source";
import { Value } from "../value";
import { omnibox } from "./omnibox";
import { codeExplorerData } from "./code_explorer";
import { collectionData, collectionInitState } from "./collection";
import { text } from "./text";
import { note, noteInitState } from "./note";
import { clipboardInitState, clipboardRules } from "./clipboard";
import { asyncRules } from "./async";
import { supervisor } from "./supervisor";
import { freeCell } from "./freecell";
import { ord } from "./ord";
import { debug } from "./debugger";
import { time } from "./time";
import { list } from "./list";
import { number } from "./number";
import { parse } from "./parse";
import { iter } from "./iter";
import { error } from "./error";
import { schema } from "./schema";
import { field } from "./field";
import { view } from "./view";
import { typeRecs } from "./type";

export type Schema =
  | "clipboard"
  | "field"
  | "folder"
  | "history"
  | "note"
  | "schema"
  | "tag"
  | "text_document"
  | "type"
  | "window"
  | `_${string}`;

export type Field =
  | "schema__fields"
  | "field__index"
  | "db__schema"
  | "field__type"
  | "file__name"
  | "file__description"
  | "note__content"
  | "rule__body"
  | "rule__params"
  | "text__content"
  | "time__created"
  | `_${string}`;

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
  | Box<"field", [Expr]>
  | Box<"field_optional", [Expr]>
  | Box<"field_default", [Expr, Expr]>;

type IndexType =
  | Box<"ref", []> // TODO: what does this mean now?
  | Box<"multiRef", []>
  | Box<"sorted", []>
  | Box<"unique", []>;

export type Rec = Record<string, Expr> & {
  db__schema?: Schema;
  schema__fields?: List<SchemaField>;
  field__index?: IndexType;

  rule__params?: List<Expr>;
  rule__body?: Box<string, Expr[]>;

  file__name?: string;
  file__description?: List<FormatText>;
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
    asyncRules,
    browserData,
    codeExplorerData,
    collectionData,
    core,
    clipboardRules,
    debug,
    dbRules,
    error,
    field,
    freeCell,
    iter,
    list,
    note,
    number,
    omnibox,
    ord,
    parse,
    rulePrimitiveRecs,
    schema,
    supervisor,
    testUtils,
    typeRecs,
    view,
    viewAnyRecord,
    viewCore,
    viewForm,
    viewTable,
    text,
    time,
    {
      home: {
        view__subject: s.self(),
        file__name: "Home",
        file__description: l("This is the home card"),
        rule__params: l($.out, $.id, $.state),
        _left_links: l(
          "code_explorer",
          "omnibox",
          "note__view_all",
          "free_cell__game",
        ),
        rule__body: s.column(
          $.out,
          l(s.style("padding", "1rem")),
          s.view__text(
            l(s.section(l("Welcome!"), l("this is the home card etc"))),
          ),
          s.row(
            l(),
            s.column(
              l(s.style("flex", "0 0 50%")),
              s.view__text(l("helpful links")),
              s.expr_iter(
                seq(f._left_links($.id, $.links), s($.link).in($.links)),
                s.view__file_info($.link),
              ),
            ),
            s.column(
              l(s.style("flex", "0 0 50%")),
              s.view__text(l("right column list")),
              s.view__button(
                l(),
                "throw an error",
                s.on_click(
                  seq(s.log("clicked"), s.throw(s.error("clicked a button"))),
                ),
              ),
              s.view__button(
                l(),
                "test debugger",
                s.on_click(
                  seq(
                    s.log("before debugger"),
                    s.debugger(),
                    s.log("after debugger"),
                  ),
                ),
              ),
            ),
          ),
        ),
      },
    },
  ],
  {},
);

// loads from db if available
export const initState = mergeAndCheck(
  [browserInitState, collectionInitState, noteInitState, clipboardInitState],
  data,
);

export function initProcessManager() {
  const db = new TransactDB<Rec>();
  const p = ProcessManager.init(db, rulePrimitives);
  const e = new EventSource<Value>();

  p.addExternal(e, "local_storage");
  const storedData = loadState(db, e) ?? initState;
  db.bulkInsert({ ...storedData, ...data });
  return p;
}
