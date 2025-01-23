import { RulePrimitiveId } from "./rule_primitive";
import { S } from "./schema_builder";
import { ViewPrimitiveId } from "./view_primitive";

export type Id = string;
export type Ident = string;
export type Expr =
  | { tag: "ident"; ident: Ident }
  | { tag: "const"; value: unknown };

export type Clause = { name: Ident; args: Expr[] };
export type Param = { ident: Ident };

export type FieldSchema = { id: Field; defaultValue?: unknown };

export type BrowseParams = {
  id: Id;
  view?: Id;
  data?: Record<string, string>;
};

export type FormatTextNode =
  | { tag: "text"; text: string }
  | { tag: "link"; text: string; params: BrowseParams };

export type Rec = {
  time__created?: number;
  file__name?: string;
  file__description?: string;
  file__folderItems?: Id[];
  text__content?: FormatTextNode[];
  db__schema?: SchemaId;
  db__fields?: FieldSchema[];
  field__refType?: SchemaId;
  field__index?: IndexType;
  rule__params?: Param[];
  rule__body?: Clause[];
  rule__primitive?: RulePrimitiveId;
  view__primitive?: ViewPrimitiveId;
  view__schema?: SchemaId;
  history__window?: Id;
  history__location?: Id;
  history__view?: Id;
  history__back?: Id;
  history__forward?: Id;
  window__currentHistory?: Id;
  browser__currentWindow?: Id;
  data__omnibox?: string;
};

type RuleRecBase =
  | {
      db__schema: "schema__rule" | "schema__view";
      rule__params: Param[];
      rule__body: Clause[];
    }
  | {
      db__schema: "schema__rulePrimitive";
      rule__params: Param[];
      rule__primitive: RulePrimitiveId;
    }
  | {
      db__schema: "schema__viewPrimitive";
      rule__params: Param[];
      view__primitive: ViewPrimitiveId;
    };

export type RuleRec = Rec & RuleRecBase;

export type SchemaId = keyof typeof schemas;
export const schemas = {
  schema__schema: S("Schema")
    .desc("defines the fields in a record & is used to select the viewer")
    .field("db__fields", [])
    .build(),
  schema__field: S("Field")
    .desc("A field definition")
    .field("field__refType", null)
    .field("field__index", null)
    .build(),
  schema__indexType: S("Index type")
    .desc("The type of index used by a field (e.g. ref, unique, sorted etc)")
    .build(),
  schema__anyType: S("Any type")
    .desc("fallback schema for any type of record")
    .build(),
  schema__rule: S("Rule")
    .desc("Code")
    .field("rule__params")
    .field("rule__body")
    .build(),
  schema__rulePrimitive: S("Rule primitive")
    .desc("A rule implemented in native code")
    .field("rule__params")
    .field("rule__primitive")
    .build(),
  schema__viewPrimitive: S("View primitive")
    .desc("A view implemented in native code")
    .field("rule__params")
    .field("view__primitive")
    .build(),
  schema__view: S("View")
    .desc("a top-level view that can render records with a given schema")
    .field("view__schema")
    .field("rule__params")
    .field("rule__body")
    .build(),
  schema__form: S("Form")
    .desc("A self-rendering form UI")
    .field("rule__params")
    .field("rule__body")
    .build(),
  schema__folder: S("Folder")
    .desc("a collection of records")
    .field("file__folderItems")
    .build(),
  schema__history: S("History")
    .desc("a history entry")
    .field("history__window")
    .field("history__location")
    .field("history__view")
    .field("history__forward")
    .field("history__back")
    .build(),
  schema__window: S("Window").field("window__currentHistory").build(),
  schema__browser: S("Browser")
    .desc("Root state for browser")
    .field("browser__currentWindow")
    .build(),
  schema__text: S("Text")
    .desc("A formatted text document")
    .field("text__content", [])
    .build(),
} as const;

export type IndexType = keyof typeof indexTypes;
export const indexTypes = {
  ref: {
    db__schema: "schema__indexType",
    file__name: "Ref",
  },
  multiRef: {
    db__schema: "schema__indexType",
    file__name: "Multi-ref",
  },
  sorted: {
    db__schema: "schema__indexType",
    file__name: "Sorted",
  },
  unique: {
    db__schema: "schema__indexType",
    file__name: "Unique",
  },
} satisfies Record<string, Rec>;

export type Field = keyof typeof fields;
export const fields = {
  db__schema: {
    db__schema: "schema__field",
    file__name: "DB Schema",
    file__description: "schema used to validate & render this record",
    field__refType: "schema__schema",
    field__index: "ref",
  },
  db__fields: {
    db__schema: "schema__field",
    file__name: "DB Fields",
    file__description: "",
  },
  time__created: {
    db__schema: "schema__field",
    file__name: "Time created",
    field__index: "sorted",
  },
  field__refType: {
    db__schema: "schema__field",
    file__name: "Field refType",
    file__description:
      "if this is set, the value of this field is a ref to a record with this schema",
    field__refType: "schema__schema",
    field__index: "ref",
  },
  field__index: {
    db__schema: "schema__field",
    file__name: "Field index",
    file__description:
      "If set, the field is indexed using an index of this type.",
    field__refType: "schema__indexType",
    field__index: "ref",
  },
  rule__params: {
    db__schema: "schema__field",
    file__name: "Rule params",
  },
  rule__body: {
    db__schema: "schema__field",
    file__name: "Rule body",
  },
  rule__primitive: {
    db__schema: "schema__field",
    file__name: "Rule primitive",
  },
  view__primitive: {
    db__schema: "schema__field",
    file__name: "View primitive",
    file__description: "name of the primitive component used for rendering",
  },
  view__schema: {
    db__schema: "schema__field",
    file__name: "View schema",
    file__description: "the schema that this view is supposed to render",
    field__refType: "schema__schema",
    field__index: "ref",
  },
  file__name: {
    db__schema: "schema__field",
    file__name: "File name",
    file__description: "field used for name in tab header & file explorer",
  },
  file__description: {
    db__schema: "schema__field",
    file__name: "File description",
    file__description: "describes the content of the record",
  },
  file__folderItems: {
    db__schema: "schema__field",
    file__name: "File folder items",
    file__description: "ids of files in folder",
    field__index: "multiRef",
  },
  // Browser
  history__location: {
    db__schema: "schema__field",
    file__name: "History location ref",
    field__refType: "schema__anyType",
  },
  history__view: {
    db__schema: "schema__field",
    file__name: "History view ref",
    field__refType: "schema__view",
  },
  history__back: {
    db__schema: "schema__field",
    file__name: "History back ref",
    field__refType: "schema__history",
  },
  history__forward: {
    db__schema: "schema__field",
    file__name: "History forward ref",
    field__refType: "schema__history",
  },
  history__window: {
    db__schema: "schema__field",
    file__name: "History window ref",
    field__refType: "schema__window",
  },
  window__currentHistory: {
    db__schema: "schema__field",
    file__name: "Window current history ref",
    field__refType: "schema__history",
  },
  browser__currentWindow: {
    db__schema: "schema__field",
    file__name: "Focused window in browser",
    field__refType: "schema__window",
  },
  text__content: {
    db__schema: "schema__field",
    file__name: "Text content",
    file__description: "a list of text nodes used in text schema",
  },
  data__omnibox: {
    db__schema: "schema__field",
    file__name: "Omnibox search string",
  },
} as const;
