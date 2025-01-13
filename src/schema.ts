import { Query } from "./query";
import { FormatTextNode } from "./view";
import * as primitives from "./primitive";

type Id = string;

export type ViewPrimitive = keyof typeof primitives;

export type Rec = {
  time__created?: number;
  file__name?: string;
  file__description?: string;
  file__folderItems?: Id[];
  text__content?: FormatTextNode[];
  db__schema?: SchemaId;
  field__refType?: Id;
  field__index?: "ref" | "sorted"; // "multiRef" | "unique"
  rule__query?: Query;
  view__primitive?: ViewPrimitive;
  view__schema?: SchemaId;
  view__query?: Query;
  history__window?: Id;
  history__location?: Id;
  history__view?: Id;
  history__data?: Record<string, string>;
  history__back?: Id;
  history__forward?: Id;
  window__currentHistory?: Id;
  browser__currentWindow?: Id;
};

type SchemaId = keyof typeof schemas;
// Omit<Rec, "db__schema"> avoids circular reference in type definition
type SchemaRec = Omit<Rec, "db__schema"> & { db__schema: "schema__schema" };
export const schemas = {
  schema__schema: {
    db__schema: "schema__schema",
    file__name: "Schema",
    file__description:
      "Schema defines the fields in a record & is used to select the viewer",
  },
  schema__field: {
    db__schema: "schema__schema",
    file__name: "Field",
  },
  schema__anyType: {
    db__schema: "schema__schema",
    file__name: "AnyType",
    file__description: "fallback schema for any type of record",
  },
  schema__text: {
    db__schema: "schema__schema",
    file__name: "Text",
    file__description: "schema for Text",
  },
  schema__view: {
    db__schema: "schema__schema",
    file__name: "View",
    file__description: "schema for View",
  },
  schema__form: {
    db__schema: "schema__schema",
    file__name: "Form",
    file__description: "schema for form UI",
  },
  schema__folder: {
    db__schema: "schema__schema",
    file__name: "Folder",
    file__description: "schema for Folder",
  },
  schema__history: {
    db__schema: "schema__schema",
    file__name: "History",
  },
  schema__window: {
    db__schema: "schema__schema",
    file__name: "Window",
  },
  schema__browser: {
    db__schema: "schema__schema",
    file__name: "Browser",
  },
  schema__rule: {
    db__schema: "schema__schema",
    file__name: "Rule",
  },
} satisfies Record<string, SchemaRec>;

type FieldRec = Rec & { db__schema: "schema__field" };
export type Field = keyof typeof fields;

export const fields = {
  db__schema: {
    db__schema: "schema__field",
    file__name: "DB Schema",
    file__description: "schema used to validate & render this record",
    field__refType: "schema__schema",
    field__index: "ref",
  },
  time__created: {
    db__schema: "schema__field",
    file__name: "Time created",
    // field__index: "sorted", TODO
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
    field__index: "ref",
  },
  view__primitive: {
    db__schema: "schema__field",
    file__name: "View component",
    file__description: "name of the primitive component used for rendering",
  },
  view__schema: {
    db__schema: "schema__field",
    file__name: "View schema",
    file__description: "the schema that this view is supposed to render",
    field__refType: "schema__schema",
    field__index: "ref",
  },
  view__query: {
    db__schema: "schema__field",
    file__name: "View query",
    file__description: "query populates data for view",
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
    field__index: "ref",
  },
  rule__query: {
    db__schema: "schema__field",
    file__name: "Rule query",
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
  history__data: {
    db__schema: "schema__field",
    file__name: "History data",
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
  text__content: {
    db__schema: "schema__field",
    file__name: "Text content",
    file__description: "a list of text nodes used in text schema",
  },
} satisfies Record<string, FieldRec>;
