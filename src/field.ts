import { Rec } from "./data";
import { Expr, l, s } from "./expr";

export const f = new Proxy(
  {},
  {
    get(_, field: Field) {
      return (id: Expr, value: Expr) => s(field, id, value);
    },
  }
) as Record<Field, (id: Expr, value: Expr) => Expr>;

export type Field = keyof typeof fields;
export const fields = {
  time__created: {
    db__schema: "schema__field",
    file__name: "Time created",
    db__type: "type__time",
    db__index: s("sorted"),
  },
  db__schema: {
    db__schema: "schema__field",
    file__name: "DB Schema",
    file__description: l("schema used to validate & render this record"),
    // db__type: s("ref", "schema__schema" as const),
    db__type: "type__ref",
    db__index: s("ref"),
  },
  db__fields: {
    db__schema: "schema__field",
    file__name: "DB Fields",
    // db__type: s(
    //   "list",
    //   s(
    //     "oneof",
    //     s("struct", "field", fieldRef),
    //     s("struct", "field__optional", fieldRef),
    //     s("struct", "field__default", fieldRef, s("any"))
    //   )
    // ),
  },
  db__type: {
    db__schema: "schema__field",
    file__name: "Field type",
    db__type: "type__ref",
    // db__type: s("ref", "schema__schema" as const),
    db__index: s("ref"),
  },
  db__index: {
    db__schema: "schema__field",
    file__name: "Field index",
    file__description: l(
      "If set, the field is indexed using an index of this type."
    ),
    // db__type: s(
    //   "oneof",
    //   s("struct", "ref"),
    //   s("struct", "multiRef"),
    //   s("struct", "sorted"),
    //   s("struct", "unique")
    // ),
    db__index: s("sorted"),
  },
  db__default_value: {
    db__schema: "schema__field",
    file__name: "Default value",
  },
  // TODO: rule primitive / view primitive?
  rule__params: {
    db__schema: "schema__field",
    file__name: "Rule params",
    // db__type: s("list", s("any")),
  },
  rule__body: {
    db__schema: "schema__field",
    file__name: "Rule body",
    // db__type: s("struct"),
  },
  test__group: {
    db__schema: "schema__field",
    file__name: "Test group",
  },
  view__schema: {
    db__schema: "schema__field",
    file__name: "View for schema",
    file__description: l("the schema that this view is supposed to render"),
    db__type: "type__ref",
    // db__type: s("ref", "schema__schema" as const),
    db__index: s("ref"),
  },
  view__field: {
    db__schema: "schema__field",
    file__name: "View for field",
    file__description: l("the field that this view can render"),
    db__type: "type__ref",
    db__index: s("ref"),
  },
  view__type: {
    db__schema: "schema__field",
    file__name: "View for type",
    file__description: l("the type that this view can render"),
    db__type: "type__ref",
    db__index: s("ref"),
  },
  file__name: {
    db__schema: "schema__field",
    file__name: "File name",
    file__description: l("field used for name in tab header & file explorer"),
    db__type: "type__string",
  },
  file__description: {
    db__schema: "schema__field",
    file__name: "File description",
    file__description: l("describes the content of the record"),
    db__type: "type__text",
  },
  folder__items: {
    db__schema: "schema__field",
    file__name: "File folder items",
    file__description: l("ids of files in folder"),
    db__type: "type__multiRef",
    db__index: s("multiRef"),
  },
  // Browser
  history__location: {
    db__schema: "schema__field",
    file__name: "History location ref",
    db__type: "type__ref",
  },
  history__view: {
    db__schema: "schema__field",
    file__name: "History view ref",
    db__type: "type__ref",
    // db__type: s("ref", "schema__view" as const),
  },
  history__back: {
    db__schema: "schema__field",
    file__name: "History back ref",
    db__type: "type__ref",
    // db__type: s("ref", "schema__history" as const),
  },
  history__forward: {
    db__schema: "schema__field",
    file__name: "History forward ref",
    db__type: "type__ref",
    // db__type: s("ref", "schema__history" as const),
  },
  history__window: {
    db__schema: "schema__field",
    file__name: "History window ref",
    db__type: "type__ref",
    // db__type: s("ref", "schema__window" as const),
  },
  window__currentHistory: {
    db__schema: "schema__field",
    file__name: "Window current history ref",
    db__type: "type__ref",
    // db__type: s("ref", "schema__history" as const),
  },
  browser__currentWindow: {
    db__schema: "schema__field",
    file__name: "Focused window in browser",
    db__type: "type__ref",
    // db__type: s("ref", "schema__window" as const),
  },
  text__content: {
    db__schema: "schema__field",
    file__name: "Text content",
    file__description: l("a list of text nodes used in text schema"),
    db__type: "type__text",
  },
  data__omnibox: {
    db__schema: "schema__field",
    file__name: "Omnibox search string",
    db__type: "type__string",
  },
} satisfies Record<string, Rec>;
