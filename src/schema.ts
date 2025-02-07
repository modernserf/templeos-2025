import { Rec } from "./data";
import { l, s } from "./expr";

export type SchemaId = keyof typeof schemas;
export const schemas = {
  // schemas
  schema__any: {
    db__schema: "schema__schema",
    file__name: "any Type",
    file__description: l("Fallback schema for any type of record"),
    db__fields: l(),
  },
  schema__schema: {
    db__schema: "schema__schema",
    file__name: "Schema",
    file__description: l("Schema for schema definitions"),
    db__fields: l(s.field("db__fields")),
  },
  schema__type: {
    db__schema: "schema__schema",
    file__name: "Type",
    file__description: l("Schema for type definitions"),
    db__fields: l(s.field("db__type")),
  },
  schema__field: {
    db__schema: "schema__schema",
    file__name: "Field",
    file__description: l("Schema for field definitions"),
    db__fields: l(
      s.field_optional("db__refType"),
      s.field_optional("db__index"),
    ),
  },
  schema__indexType: {
    db__schema: "schema__schema",
    file__name: "Index type",
    file__description: l(
      "Schema for index type definitions (e.g. ref, unique, sorted etc)",
    ),
    db__fields: l(),
  },
  schema__primitive: {
    db__schema: "schema__schema",
    file__name: "Rule primitive",
    file__description: l("Schema for rules with native implementations"),
    db__fields: l(s.field("rule__params")),
  },
  schema__rule: {
    db__schema: "schema__schema",
    file__name: "Rule",
    file__description: l("Schema for rule definitions"),
    db__fields: l(s.field("rule__params"), s.field("rule__body")),
  },
  schema__view: {
    db__schema: "schema__schema",
    file__name: "View",
    file__description: l(
      "a top-level view that can render records with a given schema",
    ),
    db__fields: l(
      s.field("view__schema"),
      s.field("rule__params"),
      s.field("rule__body"),
    ),
  },
  schema__form: {
    db__schema: "schema__schema",
    file__name: "Form",
    file__description: l("A self rendering form UI"),
    db__fields: l(s.field("rule__params"), s.field("rule__body")),
  },
  schema__text: {
    db__schema: "schema__schema",
    file__name: "Text",
    file__description: l("A text document"),
    db__fields: l(s.field("text__content")),
  },
  schema__folder: {
    db__schema: "schema__schema",
    file__name: "Folder",
    file__description: l("A collection of records"),
    db__fields: l(s.field("rule__params"), s.field("rule__body")),
  },
  schema__tag: {
    db__schema: "schema__schema",
    file__name: "Tag",
    db__fields: l(s.field("file__name")),
  },
  schema__history: {
    db__schema: "schema__schema",
    file__name: "History",
    file__description: l("A history entry"),
    db__fields: l(
      s.field("history__window"),
      s.field("history__location"),
      s.field_optional("history__view"),
      s.field("history__forward"),
      s.field("history__back"),
    ),
  },
  schema__window: {
    db__schema: "schema__schema",
    file__name: "Window",
    file__description: l("A window"),
    db__fields: l(s.field("window__currentHistory")),
  },
  schema__browser: {
    db__schema: "schema__schema",
    file__name: "Browser",
    file__description: l("Root state for browser"),
    db__fields: l(s.field("browser__currentWindow")),
  },
} satisfies Record<string, Omit<Rec, "db__schema"> & { db__schema: string }>;
