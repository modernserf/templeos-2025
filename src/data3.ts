import { s, v, Rec } from "./state3";

export type SchemaId = keyof typeof schemas;
const schemas = {
  // schemas
  schema__anyType: {
    db__schema: "schema__schema",
    file__name: "any Type",
    file__description: s("", "Fallback schema for any type of record"),
    db__fields: s(""),
  },
  schema__schema: {
    db__schema: "schema__schema",
    file__name: "Schema",
    file__description: s("", "Schema for schema definitions"),
    db__fields: s("", s("field", "db__fields")),
  },
  schema__field: {
    db__schema: "schema__schema",
    file__name: "Field",
    file__description: s("", "Schema for field definitions"),
    db__fields: s(
      "",
      s("field_optional", "db__refType"),
      s("field_optional", "db__index")
    ),
  },
  schema__indexType: {
    db__schema: "schema__schema",
    file__name: "Index type",
    file__description: s(
      "",
      "Schema for index type definitions (e.g. ref, unique, sorted etc)"
    ),
    db__fields: s(""),
  },
  // TODO: rule primitive / view primitive?
  schema__rule: {
    db__schema: "schema__schema",
    file__name: "Rule",
    file__description: s("", "Schema for rule definitions"),
    db__fields: s("", s("field", "rule__params"), s("field", "rule__body")),
  },
  schema__view: {
    db__schema: "schema__schema",
    file__name: "View",
    file__description: s(
      "",
      "a top-level view that can render records with a given schema"
    ),
    db__fields: s(
      "",
      s("field", "view__schema"),
      s("field", "rule__params"),
      s("field", "rule__body")
    ),
  },
  schema__text: {
    db__schema: "schema__schema",
    file__name: "Form",
    file__description: s("", "A text document"),
    db__fields: s("", s("field", "text__content")),
  },
  schema__form: {
    db__schema: "schema__schema",
    file__name: "Form",
    file__description: s("", "A self rendering form UI"),
    db__fields: s("", s("field", "rule__params"), s("field", "rule__body")),
  },
  schema__folder: {
    db__schema: "schema__schema",
    file__name: "Folder",
    file__description: s("", "A collection of records"),
    db__fields: s("", s("field", "rule__params"), s("field", "rule__body")),
  },
  schema__history: {
    db__schema: "schema__schema",
    file__name: "History",
    file__description: s("", "A history entry"),
    db__fields: s(
      "",
      s("field", "history__window"),
      s("field", "history__location"),
      s("field_optional", "history__view"),
      s("field", "history__forward"),
      s("field", "history__back")
    ),
  },
  schema__window: {
    db__schema: "schema__schema",
    file__name: "Window",
    file__description: s("", "A window"),
    db__fields: s("", s("field", "window__currentHistory")),
  },
  schema__browser: {
    db__schema: "schema__schema",
    file__name: "Browser",
    file__description: s("", "Root state for browser"),
    db__fields: s("", s("field", "browser__currentWindow")),
  },
} satisfies Record<string, Omit<Rec, "db__schema">>;

export type Field = keyof typeof fields;
const fields = {
  time__created: {
    db__schema: "schema__field",
    file__name: "Time created",
    db__index: "sorted",
  },
  db__schema: {
    db__schema: "schema__field",
    file__name: "DB Schema",
    file__description: s("", "schema used to validate & render this record"),
    db__refType: "schema__schema",
    db__index: "ref",
  },
  db__fields: {
    db__schema: "schema__field",
    file__name: "DB Fields",
  },
  db__refType: {
    db__schema: "schema__field",
    file__name: "Field refType",
    file__description: s(
      "",
      "if this is set, the value of this field is a ref to a record with this schema"
    ),
    db__refType: "schema__schema",
    db__index: "ref",
  },
  db__index: {
    db__schema: "schema__field",
    file__name: "Field index",
    file__description: s(
      "",
      "If set, the field is indexed using an index of this type."
    ),
    db__refType: "schema__indexType",
    db__index: "ref",
  },
  // TODO: rule primitive / view primitive?
  rule__params: {
    db__schema: "schema__field",
    file__name: "Rule params",
  },
  rule__body: {
    db__schema: "schema__field",
    file__name: "Rule body",
  },
  view__schema: {
    db__schema: "schema__field",
    file__name: "View schema",
    file__description: s("", "the schema that this view is supposed to render"),
    db__refType: "schema__schema",
    db__index: "ref",
  },
  file__name: {
    db__schema: "schema__field",
    file__name: "File name",
    file__description: s(
      "",
      "field used for name in tab header & file explorer"
    ),
  },
  file__description: {
    db__schema: "schema__field",
    file__name: "File description",
    file__description: s("", "describes the content of the record"),
  },
  folder__items: {
    db__schema: "schema__field",
    file__name: "File folder items",
    file__description: s("", "ids of files in folder"),
    db__index: "multiRef",
  },
  // Browser
  history__location: {
    db__schema: "schema__field",
    file__name: "History location ref",
    db__refType: "schema__anyType",
  },
  history__view: {
    db__schema: "schema__field",
    file__name: "History view ref",
    db__refType: "schema__view",
  },
  history__back: {
    db__schema: "schema__field",
    file__name: "History back ref",
    db__refType: "schema__history",
  },
  history__forward: {
    db__schema: "schema__field",
    file__name: "History forward ref",
    db__refType: "schema__history",
  },
  history__window: {
    db__schema: "schema__field",
    file__name: "History window ref",
    db__refType: "schema__window",
  },
  window__currentHistory: {
    db__schema: "schema__field",
    file__name: "Window current history ref",
    db__refType: "schema__history",
  },
  browser__currentWindow: {
    db__schema: "schema__field",
    file__name: "Focused window in browser",
    db__refType: "schema__window",
  },
  text__content: {
    db__schema: "schema__field",
    file__name: "Text content",
    file__description: s("", "a list of text nodes used in text schema"),
  },
  data__omnibox: {
    db__schema: "schema__field",
    file__name: "Omnibox search string",
  },
} satisfies Record<string, Rec>;

const rules = {
  list_list_append: {
    rule__params: s("params", v.left, v.right, v.append),
    rule__body: s(
      ";",
      s(
        ",", // []
        s("=", v.left, s("nil")),
        s("=", v.right, v.append)
      ),
      s(
        ",", // [head | tail]
        s("=", v.left, s("cons", v.head, v.tail)),
        s("=", s("cons", v.head, v.append_tail), v.append),
        s("list_list_append", v.tail, v.right, v.append_tail)
      )
    ),
  },
  update_field_value: {
    rule__params: s("params", v.id, v.field, v.value),
    rule__body: s(
      ",",
      s("tx", v.tx),
      s("tx_update_field_value", v.tx, v.id, v.field, v.value),
      s("commit", v.tx)
    ),
  },
  delete_field_value: {
    rule__params: s("params", v.id, v.field, v.value),
    rule__body: s(
      ",",
      s("tx", v.tx),
      s("tx_delete_field_value", v.tx, v.id, v.field, v.value),
      s("commit", v.tx)
    ),
  },
  with_tx: {
    rule__params: s("params", v.tx, v.goal),
    rule__body: s(
      ",",
      s("tx", v.tx),
      s("if_then_else", v.goal, s("commit", v.tx), s("rollback", v.tx))
    ),
  },
} satisfies Record<string, Rec>;

const startupItems = {
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

  home: {
    db__schema: "schema__text",
    file__name: "home",
    file__description: s("", "this is the home card"),
    text__content: s(
      "",
      "content that ",
      s("link", "links", "example__folder"),
      " to another record."
    ),
  },
  example__folder: {
    db__schema: "schema__folder",
    file__name: "Example Folder",
    file__description: s("", "A folder with some items"),
    file__folderItems: s("", "home", "schema__text", "view__text"),
  },
} satisfies Record<string, Rec>;

export const data = {
  ...(schemas as Record<string, Rec>),
  ...fields,
  ...rules,
  ...startupItems,
};
